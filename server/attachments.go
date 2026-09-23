package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

type Attachment struct {
	ID          string        `json:"id"`
	OwnerID     string        `json:"ownerId"`
	Name        string        `json:"name"`
	Size        int64         `json:"size"`
	ContentType string        `json:"contentType"`
	At          string        `json:"at"`
	Audit       LanguageAudit `json:"audit"`
	AuditScope  string        `json:"auditScope"`
}

var attachmentID = regexp.MustCompile(`^[a-f0-9]{32}$`)
var attachmentTypes = map[string]string{".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".csv": "text/csv", ".txt": "text/plain", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".zip": "application/zip"}

func officeText(raw []byte, ext string) (string, error) {
	archive, e := zip.NewReader(bytes.NewReader(raw), int64(len(raw)))
	if e != nil {
		return "", bad("Повреждённый архив")
	}
	if ext == ".zip" {
		return "", nil
	}
	valid := false
	content := ""
	if ext == ".docx" {
		content = "word/document.xml"
	} else {
		content = "xl/sharedStrings.xml"
	}
	var text strings.Builder
	for _, f := range archive.File {
		if (ext == ".docx" && f.Name == "word/document.xml") || (ext == ".xlsx" && f.Name == "xl/workbook.xml") {
			valid = true
		}
		if f.Name != content {
			continue
		}
		if f.UncompressedSize64 > 2*1024*1024 {
			continue
		}
		r, e := f.Open()
		if e != nil {
			return "", bad("Файл не удалось прочитать")
		}
		d := xml.NewDecoder(io.LimitReader(r, 2*1024*1024))
		for text.Len() < 60000 {
			token, err := d.Token()
			if err != nil {
				break
			}
			if c, ok := token.(xml.CharData); ok {
				text.Write(c)
				text.WriteByte(' ')
			}
		}
		r.Close()
	}
	if !valid {
		return "", bad("Формат файла не соответствует расширению")
	}
	return text.String(), nil
}

type boundedText struct {
	data  []byte
	limit int
}

func (b *boundedText) Write(p []byte) (int, error) {
	n := len(p)
	left := b.limit - len(b.data)
	if left > 0 {
		b.data = append(b.data, p[:min(left, n)]...)
	}
	return n, nil
}
func (a *App) attachmentAPI(w http.ResponseWriter, r *http.Request) error {
	s, e := a.read(r.Context())
	if e != nil {
		return e
	}
	u, e := a.authorized(&s, r)
	if e != nil {
		return e
	}
	if u.Role != "student" && u.Role != "business" {
		return forbidden()
	}
	r.Body = http.MaxBytesReader(w, r.Body, 21*1024*1024)
	if e = r.ParseMultipartForm(21 * 1024 * 1024); e != nil {
		return bad("Файл должен быть не больше 20 МБ")
	}
	defer r.MultipartForm.RemoveAll()
	file, header, e := r.FormFile("file")
	if e != nil {
		return bad("Выберите файл")
	}
	defer file.Close()
	if header.Size > 20*1024*1024 {
		return bad("Файл должен быть не больше 20 МБ")
	}
	name := filepath.Base(strings.ReplaceAll(header.Filename, "\\", "/"))
	if len(name) > 220 || strings.ContainsAny(name, "\r\n\x00") {
		return bad("Слишком длинное или недопустимое имя файла")
	}
	ext := strings.ToLower(filepath.Ext(name))
	contentType, ok := attachmentTypes[ext]
	if !ok {
		return bad("Поддерживаются PDF, DOCX, XLSX, CSV, TXT, PNG, JPG и ZIP")
	}
	raw, e := io.ReadAll(io.LimitReader(file, 20*1024*1024+1))
	if e != nil {
		return e
	}
	if len(raw) == 0 || len(raw) > 20*1024*1024 {
		return bad("Выберите непустой файл до 20 МБ")
	}
	content := ""
	scope := "manual"
	switch ext {
	case ".txt", ".csv":
		if !utf8.Valid(raw) || bytes.Contains(raw, []byte{0}) {
			return bad("Сохраните текстовый файл в UTF-8")
		}
		content = string(raw[:min(60000, len(raw))])
		scope = "first-60000-bytes"
	case ".docx", ".xlsx", ".zip":
		content, e = officeText(raw, ext)
		if e != nil {
			return e
		}
		if content != "" {
			scope = "office-text-sample"
		}
	case ".pdf":
		if !bytes.HasPrefix(raw, []byte("%PDF-")) {
			return bad("Файл не является PDF")
		}
	case ".png":
		if !bytes.HasPrefix(raw, []byte{137, 80, 78, 71, 13, 10, 26, 10}) {
			return bad("Файл не является PNG")
		}
	case ".jpg", ".jpeg":
		if !bytes.HasPrefix(raw, []byte{255, 216, 255}) {
			return bad("Файл не является JPEG")
		}
	}
	f := Attachment{ID: id(), OwnerID: u.ID, Name: name, Size: int64(len(raw)), ContentType: contentType, At: now()}
	dir := filepath.Join(a.mediaDir, "attachments")
	if e = os.MkdirAll(dir, 0750); e != nil {
		return e
	}
	path := filepath.Join(dir, f.ID)
	if e = os.WriteFile(path, raw, 0640); e != nil {
		return e
	}
	if ext == ".pdf" {
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, "pdftotext", "-enc", "UTF-8", "-nopgbrk", "-f", "1", "-l", "20", path, "-")
		output := &boundedText{limit: 60000}
		cmd.Stdout = output
		cmd.Stderr = io.Discard
		if cmd.Run() == nil && len(bytes.TrimSpace(output.data)) > 0 {
			content = string(output.data)
			scope = "pdf-first-20-pages"
		}
	}
	locale := r.FormValue("locale")
	if locale == "" {
		locale = "ru"
	}
	f.Audit = auditLanguage(content, locale)
	f.AuditScope = scope
	e = a.mutate(r.Context(), func(s *State) error {
		actor, err := a.authorized(s, r)
		if err != nil {
			return err
		}
		if actor.Role != "business" && actor.Role != "student" {
			return forbidden()
		}
		count := 0
		for _, existing := range s.Attachments {
			if existing.OwnerID == u.ID {
				count++
			}
		}
		if count >= 50 {
			return appError{429, "Лимит MVP: 50 файлов на аккаунт"}
		}
		s.Attachments = append(s.Attachments, f)
		return nil
	})
	if e != nil {
		_ = os.Remove(path)
		return e
	}
	respond(w, f)
	return nil
}
func validateAttachments(s *State, ids []string, uid string) error {
	if len(ids) > 5 {
		return bad("К одному материалу можно прикрепить до 5 файлов")
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if seen[id] {
			return bad("Файл уже прикреплён")
		}
		seen[id] = true
		found := false
		for _, f := range s.Attachments {
			if f.ID == id && f.OwnerID == uid {
				found = true
				break
			}
		}
		if !found {
			return forbidden()
		}
	}
	return nil
}
func attachmentVisible(s *State, f Attachment, uid string) bool {
	if f.OwnerID == uid {
		return true
	}
	for _, c := range s.Challenges {
		if !c.Published {
			continue
		}
		for _, v := range c.Versions {
			for _, id := range v.AttachmentIDs {
				if id == f.ID {
					return true
				}
			}
		}
	}
	u := s.user(uid)
	if u == nil {
		return false
	}
	for _, p := range s.Proposals {
		c := s.challenge(p.ChallengeID)
		if c == nil || (c.OwnerID != uid && p.TeamID != u.TeamID) {
			continue
		}
		for _, id := range append(append([]string{}, p.AttachmentIDs...), p.SubmissionAttachmentIDs...) {
			if id == f.ID {
				return true
			}
		}
	}
	return false
}
func (a *App) serveAttachment(w http.ResponseWriter, r *http.Request) {
	fid := strings.TrimPrefix(r.URL.Path, "/files/")
	if !attachmentID.MatchString(fid) {
		http.NotFound(w, r)
		return
	}
	s, e := a.read(r.Context())
	if e != nil {
		fail(w, e)
		return
	}
	uid := a.uid(r)
	for _, f := range s.Attachments {
		if f.ID != fid {
			continue
		}
		if !attachmentVisible(&s, f, uid) {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": f.Name}))
		w.Header().Set("Content-Type", f.ContentType)
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
		http.ServeFile(w, r, filepath.Join(a.mediaDir, "attachments", fid))
		return
	}
	http.NotFound(w, r)
}
func attachmentAudit(ids []string, s *State, locale string) LanguageAudit {
	for _, id := range ids {
		for _, f := range s.Attachments {
			if f.ID == id && auditForLocale(f.Audit, locale).Warning {
				return auditForLocale(f.Audit, locale)
			}
		}
	}
	return LanguageAudit{Expected: locale}
}
func languageError() error {
	return bad(fmt.Sprintf("Обнаружено возможное расхождение языка. Исправьте материал или подтвердите продолжение с учётом предупреждения."))
}
