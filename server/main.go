package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type App struct {
	analysisLocks sync.Map
	db            *pgxpool.Pool
	sessions      sync.Map
	limits        sync.Map
	mediaDir      string
}
type appError struct {
	status  int
	message string
}

func (e appError) Error() string { return e.message }
func bad(s string) error         { return appError{400, s} }
func forbidden() error           { return appError{403, "Access denied"} }
func id() string                 { b := make([]byte, 16); _, _ = rand.Read(b); return hex.EncodeToString(b) }
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func key(keys ...string) string {
	for _, k := range keys {
		if v := os.Getenv(k); v != "" {
			return v
		}
	}
	return ""
}
func loadEnv() {
	b, _ := os.ReadFile(".env")
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		k = strings.TrimSpace(strings.TrimPrefix(k, "export "))
		if ok && os.Getenv(k) == "" {
			_ = os.Setenv(k, strings.Trim(strings.TrimSpace(v), "\"'"))
		}
	}
}
func (a *App) read(ctx context.Context) (State, error) {
	var s State
	var b []byte
	err := a.db.QueryRow(ctx, "SELECT body FROM app_state WHERE id=1").Scan(&b)
	if err != nil {
		return s, err
	}
	err = json.Unmarshal(b, &s)
	return s, err
}
func (a *App) mutate(ctx context.Context, fn func(*State) error) error {
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var b []byte
	if err = tx.QueryRow(ctx, "SELECT body FROM app_state WHERE id=1 FOR UPDATE").Scan(&b); err != nil {
		return err
	}
	var s State
	if err = json.Unmarshal(b, &s); err != nil {
		return err
	}
	before := serialize(s)
	if err = fn(&s); err != nil {
		return err
	}
	if bytes.Equal(before, serialize(s)) {
		return tx.Commit(ctx)
	}
	if _, err = tx.Exec(ctx, "UPDATE app_state SET body=$1,updated_at=now() WHERE id=1", serialize(s)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func respond(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, err error) {
	status := 500
	msg := "Internal server error"
	var ae appError
	if errors.As(err, &ae) {
		status = ae.status
		msg = ae.message
	} else {
		log.Printf("request failed: %v", err)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 256*1024)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return bad("Invalid JSON: " + err.Error())
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		return bad("Only one JSON object is allowed")
	}
	return nil
}
func (a *App) uid(r *http.Request) string {
	c, e := r.Cookie("sana_session")
	if e != nil {
		return ""
	}
	if v, ok := a.sessions.Load(c.Value); ok {
		return v.(string)
	}
	return ""
}
func (a *App) authorized(s *State, r *http.Request) (*User, error) {
	u := s.user(a.uid(r))
	if u == nil {
		return nil, appError{401, "Choose a demo profile to continue"}
	}
	return u, nil
}
func safeLink(s string) bool {
	if s == "" {
		return true
	}
	u, e := url.Parse(s)
	return e == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != "" && u.User == nil
}
func (a *App) api(w http.ResponseWriter, r *http.Request) {
	var err error
	if r.Method != "GET" {
		if origin := r.Header.Get("Origin"); origin != "" {
			u, e := url.Parse(origin)
			if e != nil || u.Host != r.Host {
				fail(w, forbidden())
				return
			}
		}
	}
	switch {
	case r.URL.Path == "/api/health":
		err = a.db.Ping(r.Context())
		if err == nil {
			respond(w, map[string]string{"status": "ok"})
		}
	case r.URL.Path == "/api/session" && r.Method == "POST":
		var in struct {
			UserID string `json:"userId"`
		}
		if err = decode(w, r, &in); err == nil {
			if env("DEMO_MODE", "true") != "true" {
				err = forbidden()
				break
			}
			s, e := a.read(r.Context())
			if e != nil {
				err = e
				break
			}
			if s.user(in.UserID) == nil {
				err = bad("Unknown demo profile")
				break
			}
			token := id()
			a.sessions.Store(token, in.UserID)
			http.SetCookie(w, &http.Cookie{Name: "sana_session", Value: token, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: 86400, Secure: r.TLS != nil})
			respond(w, s.user(in.UserID))
		}
	case r.URL.Path == "/api/bootstrap" && r.Method == "GET":
		var s State
		s, err = a.read(r.Context())
		if err != nil {
			break
		}
		uid := a.uid(r)
		u := s.user(uid)
		cs := []Challenge{}
		for _, c := range s.Challenges {
			if c.OwnerID == uid {
				c.Score = score(c.Fields, c.Approved)
				cs = append(cs, c)
			} else if c.Published && len(c.Versions) > 0 {
				v := c.Versions[len(c.Versions)-1]
				c.Fields = v.Fields
				c.Approved = v.Approved
				c.Score = v.Score
				c.Activity = nil
				cs = append(cs, c)
			}
		}
		ps := []Proposal{}
		for _, p := range s.Proposals {
			c := s.challenge(p.ChallengeID)
			if u != nil && c != nil && (c.OwnerID == uid || p.TeamID == u.TeamID) {
				ps = append(ps, p)
			}
		}
		ns := []Notification{}
		for _, n := range s.Notifications {
			if n.UserID == uid {
				ns = append(ns, n)
			}
		}
		ms := []Media{}
		for _, m := range s.Media {
			c := s.challenge(m.ChallengeID)
			if c != nil && (m.OwnerID == uid || m.Status == "ready" && c.Published) {
				ms = append(ms, m)
			}
		}
		respond(w, map[string]any{"user": u, "profiles": s.Users, "challenges": cs, "teams": s.Teams, "proposals": ps, "notifications": ns, "media": ms, "criteria": criteria, "capabilities": map[string]any{"ai": openAIKey() != "", "speech": openAIKey() != "" || elevenKey() != "", "demo": env("DEMO_MODE", "true") == "true"}})
	case r.URL.Path == "/api/challenges" && r.Method == "POST":
		var in struct {
			Fields   Fields `json:"fields"`
			Category string `json:"category"`
			Locale   string `json:"locale"`
			Original string `json:"original"`
			Answers  string `json:"answers"`
		}
		if err = decode(w, r, &in); err != nil {
			break
		}
		var result Challenge
		err = a.mutate(r.Context(), func(s *State) error {
			u, e := a.authorized(s, r)
			if e != nil {
				return e
			}
			if u.Role != "business" {
				return forbidden()
			}
			if e = validateFields(in.Fields); e != nil {
				return bad(e.Error())
			}
			if in.Locale != "ru" && in.Locale != "kk" && in.Locale != "en" {
				return bad("Unsupported language")
			}
			if !strings.Contains("|Retail|Social|Education|Analytics|Ecology|Technology|", "|"+in.Category+"|") || in.Category == "" {
				return bad("Unsupported category")
			}
			if len(in.Original) > 24000 || len(in.Answers) > 24000 {
				return bad("Source text is too long")
			}
			original := in.Original
			if strings.TrimSpace(original) == "" {
				original = in.Fields["need"]
			}
			result = Challenge{ID: id(), OwnerID: u.ID, Company: u.Name, Category: in.Category, Locale: in.Locale, Fields: in.Fields, Approved: map[string]string{}, Revision: 1, Versions: []Version{}, CreatedAt: now(), Activity: []Activity{{"created", now(), original}}}
			if strings.TrimSpace(in.Answers) != "" {
				result.Activity = append(result.Activity, Activity{"clarified", now(), in.Answers})
			}
			s.Challenges = append(s.Challenges, result)
			return nil
		})
		if err == nil {
			respond(w, result)
		}
	case strings.HasPrefix(r.URL.Path, "/api/challenges/"):
		err = a.challengeAPI(w, r)
	case r.URL.Path == "/api/proposals" && r.Method == "POST":
		var in struct {
			ChallengeID string `json:"challengeId"`
			Version     int    `json:"version"`
			Idea        string `json:"idea"`
			Plan        string `json:"plan"`
			Deadline    string `json:"deadline"`
			Link        string `json:"link"`
		}
		if err = decode(w, r, &in); err != nil {
			break
		}
		var p Proposal
		err = a.mutate(r.Context(), func(s *State) error {
			u, e := a.authorized(s, r)
			if e != nil {
				return e
			}
			if u.Role != "student" {
				return forbidden()
			}
			c := s.challenge(in.ChallengeID)
			if c == nil || !c.Published {
				return bad("Challenge not published")
			}
			if in.Version != len(c.Versions) {
				return appError{409, "Requirements changed. Review the new version."}
			}
			if len(strings.TrimSpace(in.Idea)) < 10 || len(strings.TrimSpace(in.Plan)) < 10 || in.Deadline == "" || len(in.Idea)+len(in.Plan) > 15000 || !safeLink(in.Link) {
				return bad("Provide an idea, plan, deadline and valid http(s) link")
			}
			p = Proposal{ID: id(), ChallengeID: c.ID, Version: in.Version, TeamID: u.TeamID, Idea: in.Idea, Plan: in.Plan, Deadline: in.Deadline, Link: in.Link, Status: "pending", At: now()}
			s.Proposals = append(s.Proposals, p)
			s.notify(c.OwnerID, c.ID, "proposal", in.Version)
			return nil
		})
		if err == nil {
			respond(w, p)
		}
	case strings.HasPrefix(r.URL.Path, "/api/proposals/") && r.Method == "POST":
		err = a.proposalAPI(w, r)
	case r.URL.Path == "/api/notifications/read" && r.Method == "POST":
		var in struct {
			ID string `json:"id"`
		}
		if err = decode(w, r, &in); err != nil {
			break
		}
		err = a.mutate(r.Context(), func(s *State) error {
			u, e := a.authorized(s, r)
			if e != nil {
				return e
			}
			for i := range s.Notifications {
				if s.Notifications[i].ID == in.ID && s.Notifications[i].UserID == u.ID {
					s.Notifications[i].Read = true
				}
			}
			return nil
		})
		if err == nil {
			respond(w, map[string]bool{"ok": true})
		}
	case r.URL.Path == "/api/subscription" && r.Method == "POST":
		var in struct {
			Plan string `json:"plan"`
		}
		if err = decode(w, r, &in); err != nil {
			break
		}
		err = a.mutate(r.Context(), func(s *State) error {
			u, e := a.authorized(s, r)
			if e != nil {
				return e
			}
			if env("DEMO_MODE", "true") != "true" {
				return forbidden()
			}
			if in.Plan != "free" && in.Plan != "pro" {
				return bad("Invalid plan")
			}
			u.Plan = in.Plan
			return nil
		})
		if err == nil {
			respond(w, map[string]bool{"ok": true})
		}
	case r.URL.Path == "/api/changes" && r.Method == "POST":
		err = a.changeAPI(w, r)
	case r.URL.Path == "/api/ai" && r.Method == "POST":
		err = a.aiAPI(w, r)
	case r.URL.Path == "/api/transcribe" && r.Method == "POST":
		err = a.transcribe(w, r)
	case r.URL.Path == "/api/speech" && r.Method == "POST":
		err = a.speech(w, r)
	case r.URL.Path == "/api/media" && r.Method == "POST":
		err = a.mediaAPI(w, r)
	default:
		err = appError{404, "Not found"}
	}
	if err != nil {
		fail(w, err)
	}
}
func (a *App) challengeAPI(w http.ResponseWriter, r *http.Request) error {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/challenges/"), "/")
	cid := parts[0]
	if r.Method != "POST" {
		return appError{405, "Method not allowed"}
	}
	action := "save"
	if len(parts) > 1 {
		action = parts[1]
	}
	var in struct {
		Revision        int      `json:"revision"`
		Fields          Fields   `json:"fields"`
		Confirm         []string `json:"confirm"`
		Note            string   `json:"note"`
		PreviewApproved bool     `json:"previewApproved"`
		Source          string   `json:"source"`
	}
	if err := decode(w, r, &in); err != nil {
		return err
	}
	var out Challenge
	err := a.mutate(r.Context(), func(s *State) error {
		u, e := a.authorized(s, r)
		if e != nil {
			return e
		}
		c := s.challenge(cid)
		if c == nil {
			return appError{404, "Not found"}
		}
		if c.OwnerID != u.ID {
			return forbidden()
		}
		if in.Revision != c.Revision {
			return appError{409, "The draft changed in another tab. Reload before saving."}
		}
		if action == "publish" {
			if !in.PreviewApproved {
				return bad("Review and approve the preview")
			}
			if e = publish(s, c, in.Note); e != nil {
				return bad(e.Error())
			}
		} else if action == "save" {
			if e = validateFields(in.Fields); e != nil {
				return bad(e.Error())
			}
			changed := false
			for _, k := range fieldKeys {
				if c.Fields[k] != in.Fields[k] {
					delete(c.Approved, k)
					changed = true
				}
			}
			c.Fields = in.Fields
			for _, k := range in.Confirm {
				valid := false
				for _, key := range fieldKeys {
					if key == k {
						valid = true
					}
				}
				if valid && strings.TrimSpace(c.Fields[k]) != "" {
					c.Approved[k] = hash(c.Fields[k])
				}
			}
			c.Score = score(c.Fields, c.Approved)
			c.Revision++
			kind := "edited"
			if len(in.Confirm) > 0 {
				kind = "confirmed"
			}
			if in.Source == "ai" {
				kind = "ai_applied"
			}
			if changed || len(in.Confirm) > 0 || in.Source == "ai" {
				detail := fmt.Sprintf("%d/100", c.Score)
				if kind == "ai_applied" {
					detail = string(serialize(c.Fields))
				}
				c.Activity = append(c.Activity, Activity{kind, now(), detail})
			}
		} else {
			return bad("Unknown action")
		}
		out = *c
		return nil
	})
	if err == nil {
		respond(w, out)
	}
	return err
}
func (a *App) proposalAPI(w http.ResponseWriter, r *http.Request) error {
	pid := strings.TrimPrefix(r.URL.Path, "/api/proposals/")
	var in struct {
		Action     string `json:"action"`
		Submission string `json:"submission"`
		Stars      int    `json:"stars"`
		Text       string `json:"text"`
	}
	if e := decode(w, r, &in); e != nil {
		return e
	}
	err := a.mutate(r.Context(), func(s *State) error {
		u, e := a.authorized(s, r)
		if e != nil {
			return e
		}
		p := s.proposal(pid)
		if p == nil {
			return appError{404, "Not found"}
		}
		c := s.challenge(p.ChallengeID)
		if c == nil {
			return bad("Missing challenge")
		}
		switch in.Action {
		case "accept", "reject":
			if c.OwnerID != u.ID {
				return forbidden()
			}
			if p.Status != "pending" {
				return bad("Only pending proposals can be decided")
			}
			if in.Action == "accept" && p.Version != len(c.Versions) {
				return appError{409, "Team must update its proposal to the current requirements"}
			}
			p.Status = map[string]string{"accept": "accepted", "reject": "rejected"}[in.Action]
		case "reconfirm":
			if p.TeamID != u.TeamID {
				return forbidden()
			}
			if p.Status == "completed" || p.Status == "rejected" {
				return bad("Proposal is closed")
			}
			p.Version = len(c.Versions)
		case "submit":
			if p.TeamID != u.TeamID || p.Status != "accepted" {
				return forbidden()
			}
			if p.Version != len(c.Versions) {
				return appError{409, "Review the changed requirements first"}
			}
			if len(strings.TrimSpace(in.Submission)) < 10 || len(in.Submission) > 5000 {
				return bad("Describe the final result (10–5000 characters)")
			}
			p.Submission = in.Submission
			s.notify(c.OwnerID, c.ID, "submission", p.Version)
		case "milestone":
			if c.OwnerID != u.ID || p.Status != "accepted" {
				return forbidden()
			}
			if p.Version != len(c.Versions) {
				return appError{409, "Review the changed requirements first"}
			}
			if !p.Milestone {
				p.Milestone = true
				s.team(p.TeamID).XP += 50
			}
		case "review":
			if c.OwnerID != u.ID || p.Status != "accepted" || p.Submission == "" {
				return forbidden()
			}
			if p.Version != len(c.Versions) {
				return appError{409, "Review the current requirements first"}
			}
			if in.Stars < 1 || in.Stars > 5 || len(strings.TrimSpace(in.Text)) < 5 || len(in.Text) > 3000 {
				return bad("Provide a rating from 1 to 5 and a review")
			}
			t := s.team(p.TeamID)
			for _, rv := range t.Reviews {
				if rv.ProposalID == p.ID {
					return bad("Already reviewed")
				}
			}
			t.Reviews = append(t.Reviews, Review{p.ID, c.ID, c.Company, in.Stars, in.Text, now()})
			t.XP += 150
			p.Status = "completed"
		default:
			return bad("Unknown action")
		}
		return nil
	})
	if err == nil {
		respond(w, map[string]bool{"ok": true})
	}
	return err
}
func main() {
	loadEnv()
	ctx := context.Background()
	db, e := pgxpool.New(ctx, env("DATABASE_URL", "postgres://sana:sana_local_only@localhost:5434/sana?sslmode=disable"))
	if e != nil {
		log.Fatal("Database configuration error")
	}
	defer db.Close()
	if e = db.Ping(ctx); e != nil {
		log.Fatal("Cannot connect to PostgreSQL; run docker compose up -d db")
	}
	_, e = db.Exec(ctx, "CREATE TABLE IF NOT EXISTS app_state (id integer PRIMARY KEY CHECK(id=1), body jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())")
	if e != nil {
		log.Fatal(e)
	}
	_, e = db.Exec(ctx, "INSERT INTO app_state (id,body) VALUES (1,$1) ON CONFLICT DO NOTHING", serialize(seed()))
	if e != nil {
		log.Fatal(e)
	}
	a := &App{db: db, mediaDir: env("MEDIA_DIR", "data/media")}
	os.MkdirAll(a.mediaDir, 0750)
	a.recoverMedia()
	mux := http.NewServeMux()
	mux.HandleFunc("/api/", a.api)
	mux.HandleFunc("/media/", a.serveMedia)
	static := env("STATIC_DIR", "web/dist")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		p := filepath.Join(static, filepath.Clean("/"+r.URL.Path))
		if info, e := os.Stat(p); e == nil && !info.IsDir() {
			http.ServeFile(w, r, p)
			return
		}
		http.ServeFile(w, r, filepath.Join(static, "index.html"))
	})
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; media-src 'self' blob:; font-src 'self'; frame-ancestors 'none'")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		mux.ServeHTTP(w, r)
	})
	server := http.Server{Addr: ":" + env("PORT", "8080"), Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 70 * time.Second, WriteTimeout: 180 * time.Second, IdleTimeout: 60 * time.Second}
	fmt.Println("Sana Quest is ready at http://localhost:" + env("PORT", "8080"))
	log.Fatal(server.ListenAndServe())
}
