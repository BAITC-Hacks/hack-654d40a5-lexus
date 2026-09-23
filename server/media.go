package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type Media struct {
	ID          string `json:"id"`
	ChallengeID string `json:"challengeId"`
	OwnerID     string `json:"ownerId"`
	Version     int    `json:"version"`
	Locale      string `json:"locale"`
	Status      string `json:"status"`
	Script      string `json:"script"`
	URL         string `json:"url"`
	PreviewURL  string `json:"previewUrl"`
	Error       string `json:"error"`
	At          string `json:"at"`
	Duration    int    `json:"duration"`
	Voice       string `json:"voice"`
	Approved    bool   `json:"approved"`
}
type Scene struct {
	Text     string `json:"text"`
	Label    string `json:"label"`
	From     int    `json:"from"`
	Duration int    `json:"duration"`
}
type Caption struct {
	From int    `json:"from"`
	To   int    `json:"to"`
	Text string `json:"text"`
}

func (a *App) recoverMedia() {
	_ = a.mutate(context.Background(), func(s *State) error {
		for i := range s.Media {
			m := &s.Media[i]
			if m.Status == "rendering" || m.Status == "previewing" {
				m.Status = "failed"
				m.Error = "Rendering was interrupted by a server restart. Retry from the video panel."
			}
		}
		return nil
	})
	go a.mediaWorker()
}
func (a *App) serveMedia(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/media/"), "/")
	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}
	allowed := map[string]bool{"final.mp4": true, "final.vtt": true, "preview.mp4": true}
	if !allowed[parts[1]] {
		http.NotFound(w, r)
		return
	}
	s, e := a.read(r.Context())
	if e != nil {
		fail(w, e)
		return
	}
	for _, m := range s.Media {
		if m.ID != parts[0] {
			continue
		}
		if a.uid(r) != m.OwnerID && !(m.Status == "ready" && parts[1] != "preview.mp4") {
			fail(w, forbidden())
			return
		}
		if parts[1] == "final.vtt" {
			w.Header().Set("Content-Type", "text/vtt; charset=utf-8")
		}
		http.ServeFile(w, r, filepath.Join(a.mediaDir, m.ID, parts[1]))
		return
	}
	http.NotFound(w, r)
}
func (a *App) mediaAPI(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		ChallengeID     string `json:"challengeId"`
		Version         int    `json:"version"`
		Script          string `json:"script"`
		Locale          string `json:"locale"`
		Duration        int    `json:"duration"`
		Voice           string `json:"voice"`
		Approved        bool   `json:"approved"`
		PreviewApproved bool   `json:"previewApproved"`
		ID              string `json:"id"`
		Action          string `json:"action"`
	}
	if e := decode(w, r, &in); e != nil {
		return e
	}
	var out Media
	err := a.mutate(r.Context(), func(s *State) error {
		u, e := a.authorized(s, r)
		if e != nil {
			return e
		}
		if u.Plan != "pro" {
			return appError{403, "Sana Pro is required for video generation"}
		}
		if in.Action == "finalize" || in.Action == "retry" {
			for i := range s.Media {
				m := &s.Media[i]
				if m.ID == in.ID {
					if m.OwnerID != u.ID {
						return forbidden()
					}
					if s.challenge(m.ChallengeID).Versions[len(s.challenge(m.ChallengeID).Versions)-1].Number != m.Version {
						return appError{409, "The brief changed. Create a preview from the current version."}
					}
					if in.Action == "finalize" {
						if m.Status != "preview_ready" || !in.PreviewApproved {
							return bad("Watch and approve the rendered preview first")
						}
						m.Status = "queued_final"
						m.Approved = true
					} else {
						if m.Status != "failed" {
							return bad("Only failed jobs can be retried")
						}
						m.Status = "queued"
						m.Error = ""
					}
					out = *m
					return nil
				}
			}
			return appError{404, "Video not found"}
		}
		c := s.challenge(in.ChallengeID)
		if c == nil || c.OwnerID != u.ID || !c.Published {
			return forbidden()
		}
		if in.Version != len(c.Versions) {
			return appError{409, "Use the current published version"}
		}
		if !in.Approved || !in.PreviewApproved {
			return bad("Approve language, narration, voice and storyboard")
		}
		if in.Locale != "ru" && in.Locale != "kk" && in.Locale != "en" {
			return bad("Unsupported language")
		}
		if in.Duration != 30 && in.Duration != 45 && in.Duration != 60 && in.Duration != 90 {
			return bad("Choose 30, 45, 60 or 90 seconds")
		}
		if in.Voice != "none" && in.Voice != "ai" {
			return bad("Unknown voice option")
		}
		if in.Voice == "ai" && openAIKey() == "" && elevenKey() == "" {
			return bad("Voice generation requires an API key")
		}
		n := utf8.RuneCountInString(in.Script)
		if n < 20 || n > 1800 {
			return bad("Video script must contain 20–1800 characters")
		}
		paragraphs := splitParagraphs(in.Script)
		if len(paragraphs) > 6 {
			return bad("Use at most 6 paragraphs for the 6 scenes")
		}
		for _, p := range paragraphs {
			if utf8.RuneCountInString(p) > 400 {
				return bad("Each paragraph must be at most 400 characters. Split long paragraphs with a blank line.")
			}
		}
		for _, m := range s.Media {
			if m.OwnerID == u.ID && (m.Status == "queued" || m.Status == "previewing" || m.Status == "queued_final" || m.Status == "rendering") {
				return appError{429, "Please wait for your current video to finish"}
			}
			if m.ChallengeID == c.ID && m.Version == in.Version && m.Script == in.Script && m.Locale == in.Locale && m.Duration == in.Duration && m.Voice == in.Voice && m.Status != "failed" {
				out = m
				return nil
			}
		}
		if len(s.Media) > 100 {
			return appError{429, "Demo media storage limit reached"}
		}
		out = Media{ID: id(), ChallengeID: c.ID, OwnerID: u.ID, Version: in.Version, Locale: in.Locale, Script: in.Script, Duration: in.Duration, Voice: in.Voice, Status: "queued", At: now()}
		s.Media = append(s.Media, out)
		return nil
	})
	if err == nil {
		respond(w, out)
	}
	return err
}
func splitParagraphs(s string) []string {
	out := []string{}
	for _, p := range strings.Split(strings.ReplaceAll(s, "\r\n", "\n"), "\n\n") {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
func (a *App) updateMedia(mid, status, message string) {
	_ = a.mutate(context.Background(), func(s *State) error {
		for i := range s.Media {
			m := &s.Media[i]
			if m.ID == mid {
				m.Status = status
				m.Error = message
				if status == "preview_ready" {
					m.PreviewURL = "/media/" + mid + "/preview.mp4"
				}
				if status == "ready" {
					m.URL = "/media/" + mid + "/final.mp4"
				}
			}
		}
		return nil
	})
}
func (a *App) mediaWorker() {
	for {
		time.Sleep(2 * time.Second)
		var job *Media
		var challenge Challenge
		err := a.mutate(context.Background(), func(s *State) error {
			for i := range s.Media {
				m := &s.Media[i]
				if m.Status == "queued" || m.Status == "queued_final" {
					j := *m
					job = &j
					challenge = *s.challenge(m.ChallengeID)
					if m.Status == "queued" {
						m.Status = "previewing"
					} else {
						m.Status = "rendering"
					}
					break
				}
			}
			return nil
		})
		if err != nil || job == nil {
			continue
		}
		if e := a.renderJob(*job, challenge); e != nil {
			a.updateMedia(job.ID, "failed", e.Error())
			continue
		}
		if job.Status == "queued" {
			a.updateMedia(job.ID, "preview_ready", "")
		} else {
			a.updateMedia(job.ID, "ready", "")
		}
	}
}
func (a *App) renderJob(m Media, c Challenge) error {
	dir := filepath.Join(a.mediaDir, m.ID)
	if e := os.MkdirAll(dir, 0750); e != nil {
		return e
	}
	manifest := filepath.Join(dir, "manifest.json")
	if m.Status == "queued" {
		audioDuration := float64(m.Duration)
		if m.Voice == "ai" {
			audioPath := filepath.Join(dir, "audio.mp3")
			if _, e := os.Stat(audioPath); os.IsNotExist(e) {
				if e = a.limit(m.OwnerID); e != nil {
					return e
				}
				b, e := synthesize(m.Script, m.Locale)
				if e != nil {
					return e
				}
				if e = os.WriteFile(audioPath, b, 0600); e != nil {
					return e
				}
			}
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			out, e := exec.CommandContext(ctx, env("FFPROBE_PATH", "ffprobe"), "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath).Output()
			cancel()
			if e != nil {
				return fmt.Errorf("Audio inspection failed. Check FFmpeg installation.")
			}
			dur, e := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
			if e != nil {
				return e
			}
			if dur > float64(m.Duration)-0.5 {
				return fmt.Errorf("Narration lasts %.0f seconds. Shorten the script or select a longer video duration.", dur)
			}
			audioDuration = dur
		}
		labels := map[string][]string{"ru": {"Потребность", "Пользователи", "Результат", "Критерии", "Детали", "Следующий шаг"}, "kk": {"Қажеттілік", "Пайдаланушылар", "Нәтиже", "Өлшемдер", "Деректер", "Келесі қадам"}, "en": {"The need", "People", "The result", "Success", "Details", "Next step"}}[m.Locale]
		scenes, caps := mediaTimeline(splitParagraphs(m.Script), labels, m.Duration, audioDuration)
		v := c.Versions[m.Version-1]
		body := map[string]any{"title": v.Fields["title"], "company": c.Company, "version": m.Version, "locale": m.Locale, "duration": m.Duration, "scenes": scenes, "captions": caps}
		if e := os.WriteFile(manifest, serialize(body), 0600); e != nil {
			return e
		}
		vtt := "WEBVTT\n\n"
		for _, cap := range caps {
			vtt += stamp(cap.From) + " --> " + stamp(cap.To) + "\n" + strings.ReplaceAll(strings.ReplaceAll(cap.Text, "&", "&amp;"), "<", "&lt;") + "\n\n"
		}
		if e := os.WriteFile(filepath.Join(dir, "final.vtt"), []byte(vtt), 0640); e != nil {
			return e
		}
	}
	mode := "preview"
	if m.Status == "queued_final" {
		mode = "final"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, env("NODE_PATH_BIN", "node"), "renderer/render.mjs", manifest, mode)
	out, e := cmd.CombinedOutput()
	if e != nil {
		msg := string(out)
		if len(msg) > 1200 {
			msg = msg[len(msg)-1200:]
		}
		return fmt.Errorf("Video render failed: %s", msg)
	}
	return nil
}
func captionChunks(text string) []string {
	chunks := []string{}
	current := ""
	for _, w := range strings.Fields(text) {
		if utf8.RuneCountInString(current)+utf8.RuneCountInString(w) > 54 && current != "" {
			chunks = append(chunks, current)
			current = ""
		}
		if current != "" {
			current += " "
		}
		current += w
	}
	if current != "" {
		chunks = append(chunks, current)
	}
	return chunks
}
func stamp(frame int) string {
	ms := frame * 1000 / 30
	return fmt.Sprintf("%02d:%02d:%02d.%03d", ms/3600000, (ms/60000)%60, (ms/1000)%60, ms%1000)
}

// Narration captions stop with the voice; the final visual may remain for reading.
func mediaTimeline(paras, labels []string, seconds int, audioDuration float64) ([]Scene, []Caption) {
	total := 0
	for _, p := range paras {
		total += utf8.RuneCountInString(p)
	}
	scenes := []Scene{}
	caps := []Caption{}
	frame := 0
	for i, p := range paras {
		spokenFrames := int(audioDuration * 30 * float64(utf8.RuneCountInString(p)) / float64(total))
		if i == len(paras)-1 {
			spokenFrames = int(audioDuration*30) - frame
		}
		frames := spokenFrames
		if i == len(paras)-1 {
			frames = seconds*30 - frame
		}
		scenes = append(scenes, Scene{p, labels[i], frame, frames})
		chunks := captionChunks(p)
		for j, text := range chunks {
			from := frame + spokenFrames*j/len(chunks)
			to := frame + spokenFrames*(j+1)/len(chunks)
			if to > from {
				caps = append(caps, Caption{from, to, text})
			}
		}
		frame += frames
	}
	return scenes, caps
}
