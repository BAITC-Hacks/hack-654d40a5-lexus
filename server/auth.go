package main

import (
	"context"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

// Credentials are persisted separately from public User objects and never serialized to clients.
type Account struct {
	UserID       string `json:"userId"`
	Email        string `json:"email"`
	PasswordHash string `json:"passwordHash"`
}
type AdminEvent struct {
	ActorID string `json:"actorId"`
	UserID  string `json:"userId"`
	Before  string `json:"before"`
	After   string `json:"after"`
	At      string `json:"at"`
}
type authWindow struct {
	mu    sync.Mutex
	Start time.Time
	Count int
}

func normalizeEmail(email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email || len(email) > 254 || !strings.Contains(email, ".") {
		return "", bad("Enter a valid email address")
	}
	return email, nil
}
func validatePassword(password string) error {
	if utf8.RuneCountInString(password) < 8 || len(password) > 72 {
		return bad("Password must contain at least 8 characters and at most 72 bytes")
	}
	return nil
}
func (a *App) authLimit(r *http.Request) error {
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	v, _ := a.limits.LoadOrStore("auth:"+ip, &authWindow{})
	q := v.(*authWindow)
	q.mu.Lock()
	defer q.mu.Unlock()
	if time.Since(q.Start) > time.Minute {
		q.Start = time.Now()
		q.Count = 0
	}
	q.Count++
	if q.Count > 20 {
		return appError{429, "Too many attempts. Please try again in a minute"}
	}
	return nil
}
func (a *App) createSession(w http.ResponseWriter, r *http.Request, uid string) error {
	token := id() + id()
	_, err := a.db.Exec(r.Context(), "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '24 hours')", hash(token), uid)
	if err != nil {
		return err
	}
	if c, e := r.Cookie("sana_session"); e == nil {
		_, _ = a.db.Exec(r.Context(), "DELETE FROM auth_sessions WHERE token_hash=$1", hash(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: "sana_session", Value: token, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: 86400, Secure: r.TLS != nil})
	return nil
}
func (a *App) migrateAccounts(ctx context.Context) error {
	if _, e := a.db.Exec(ctx, `CREATE TABLE IF NOT EXISTS auth_sessions(token_hash text PRIMARY KEY,user_id text NOT NULL,expires_at timestamptz NOT NULL); CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at); DELETE FROM auth_sessions WHERE expires_at<now()`); e != nil {
		return e
	}
	// Install only missing accounts. Never reset passwords, plans, or existing project data on restart.
	return a.mutate(ctx, func(s *State) error {
		if env("SEED_ACCOUNTS", "true") != "true" {
			return nil
		}
		if s.user("admin") == nil {
			s.Users = append(s.Users, User{ID: "admin", Name: "Администратор", Role: "admin", Plan: "free"})
		}
		if s.user("customer") == nil {
			s.Users = append(s.Users, User{ID: "customer", Name: "Мой бизнес", Role: "business", Plan: "free"})
		}
		emails := map[string]string{"customer": "customer@alemhack.ai", "admin": "admin@alemhack.ai", "b1": "business@alemhack.ai", "b2": "pro@alemhack.ai", "ut1": "student@alemhack.ai", "ut2": "qadam@alemhack.ai", "ut3": "nomad@alemhack.ai", "ut4": "data@alemhack.ai", "ut5": "makers@alemhack.ai"}
		for uid, email := range emails {
			u := s.user(uid)
			if u == nil {
				continue
			}
			found := false
			for _, ac := range s.Accounts {
				if ac.UserID == uid || ac.Email == email {
					found = true
					break
				}
			}
			if found {
				continue
			}
			p := env("SEED_PASSWORD", "Pass1234!")
			h, e := bcrypt.GenerateFromPassword([]byte(p), bcrypt.DefaultCost)
			if e != nil {
				return e
			}
			s.Accounts = append(s.Accounts, Account{uid, email, string(h)})
			u.Email = email
		}
		return nil
	})
}
func (a *App) authAPI(w http.ResponseWriter, r *http.Request) error {
	if r.Method != "POST" {
		return appError{405, "Method not allowed"}
	}
	switch r.URL.Path {
	case "/api/auth/logout":
		if c, e := r.Cookie("sana_session"); e == nil {
			if _, e = a.db.Exec(r.Context(), "DELETE FROM auth_sessions WHERE token_hash=$1", hash(c.Value)); e != nil {
				return e
			}
		}
		http.SetCookie(w, &http.Cookie{Name: "sana_session", Value: "", Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1, Secure: r.TLS != nil})
		respond(w, map[string]bool{"ok": true})
		return nil
	case "/api/auth/login", "/api/auth/register":
		if e := a.authLimit(r); e != nil {
			return e
		}
		var in struct {
			Email           string `json:"email"`
			Password        string `json:"password"`
			ConfirmPassword string `json:"confirmPassword"`
		}
		if e := decode(w, r, &in); e != nil {
			return e
		}
		email, e := normalizeEmail(in.Email)
		if e != nil {
			return e
		}
		var out User
		if r.URL.Path == "/api/auth/register" {
			if e = validatePassword(in.Password); e != nil {
				return e
			}
			if in.Password != in.ConfirmPassword {
				return bad("Passwords do not match")
			}
			h, e := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
			if e != nil {
				return e
			}
			e = a.mutate(r.Context(), func(s *State) error {
				for _, ac := range s.Accounts {
					if ac.Email == email {
						return appError{409, "This email is already registered"}
					}
				}
				out = User{ID: id(), Email: email, Role: "pending", Plan: "free"}
				s.Users = append(s.Users, out)
				s.Accounts = append(s.Accounts, Account{out.ID, email, string(h)})
				return nil
			})
			if e != nil {
				return e
			}
		} else {
			s, e := a.read(r.Context())
			if e != nil {
				return e
			}
			// Valid cost-10 dummy hash keeps unknown-email attempts on the same expensive path.
			passwordHash := "$2a$10$7EqJtq98hPqEX7fNZaFWoO5uV6hFJ6VnqI.HbYAz1NO6OLI/2eKxS"
			uid := ""
			for _, ac := range s.Accounts {
				if ac.Email == email {
					uid = ac.UserID
					passwordHash = ac.PasswordHash
					break
				}
			}
			if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(in.Password)) != nil || uid == "" {
				return appError{401, "Incorrect email or password"}
			}
			u := s.user(uid)
			if u == nil {
				return appError{401, "Incorrect email or password"}
			}
			out = *u
		}
		if e = a.createSession(w, r, out.ID); e != nil {
			return e
		}
		respond(w, out)
		return nil
	case "/api/auth/onboard":
		var in struct {
			Role         string `json:"role"`
			Name         string `json:"name"`
			Organization string `json:"organization"`
			Description  string `json:"description"`
			Skills       string `json:"skills"`
			TeamName     string `json:"teamName"`
		}
		if e := decode(w, r, &in); e != nil {
			return e
		}
		if in.Role != "student" && in.Role != "business" {
			return bad("Choose student or business")
		}
		in.Name = strings.TrimSpace(in.Name)
		in.Organization = strings.TrimSpace(in.Organization)
		in.TeamName = strings.TrimSpace(in.TeamName)
		if utf8.RuneCountInString(in.Name) < 2 || len(in.Name) > 240 || len(in.Organization) > 300 || len(in.TeamName) > 240 || len(in.Description) > 3000 || len(in.Skills) > 500 {
			return bad("Complete your profile within the field limits")
		}
		if in.Role == "student" && (in.Organization == "" || strings.TrimSpace(in.Skills) == "") {
			return bad("Enter your university and skills")
		}
		var out User
		e := a.mutate(r.Context(), func(s *State) error {
			u, e := a.authorized(s, r)
			if e != nil {
				return e
			}
			if u.Role != "pending" {
				return appError{409, "Profile is already configured"}
			}
			u.Role = in.Role
			u.Name = in.Name
			u.Organization = in.Organization
			u.Description = strings.TrimSpace(in.Description)
			if u.Role == "student" {
				name := in.TeamName
				if name == "" {
					name = in.Name
				}
				skills := []string{}
				for _, v := range strings.Split(in.Skills, ",") {
					if v = strings.TrimSpace(v); v != "" && len(skills) < 8 {
						skills = append(skills, v)
					}
				}
				tid := id()
				u.TeamID = tid
				s.Teams = append(s.Teams, Team{ID: tid, Name: name, Description: u.Description, University: in.Organization, Skills: skills, Members: 1, Color: "mint", Emoji: "✦", Reviews: []Review{}})
			}
			out = *u
			return nil
		})
		if e != nil {
			return e
		}
		respond(w, out)
		return nil
	}
	return appError{404, "Not found"}
}
func (a *App) adminAPI(w http.ResponseWriter, r *http.Request) error {
	s, e := a.read(r.Context())
	if e != nil {
		return e
	}
	u, e := a.authorized(&s, r)
	if e != nil {
		return e
	}
	if u.Role != "admin" {
		return forbidden()
	}
	if r.Method == "GET" {
		respond(w, map[string]any{"users": s.Users, "events": s.AdminEvents})
		return nil
	}
	if r.Method != "POST" {
		return appError{405, "Method not allowed"}
	}
	var in struct {
		UserID string `json:"userId"`
		Role   string `json:"role"`
		Plan   string `json:"plan"`
	}
	if e = decode(w, r, &in); e != nil {
		return e
	}
	if (in.Role != "business" && in.Role != "student" && in.Role != "admin") || (in.Plan != "free" && in.Plan != "pro") {
		return bad("Invalid role or plan")
	}
	e = a.mutate(r.Context(), func(s *State) error {
		actor, err := a.authorized(s, r)
		if err != nil {
			return err
		}
		if actor.Role != "admin" {
			return forbidden()
		}
		target := s.user(in.UserID)
		if target == nil {
			return appError{404, "User not found"}
		}
		before := target.Role + "/" + target.Plan
		if target.Role != in.Role {
			if target.ID == actor.ID {
				return bad("You cannot change your own administrator role")
			}
			if target.Role == "pending" {
				return bad("The user must finish registration first")
			}
			for _, c := range s.Challenges {
				if c.OwnerID == target.ID {
					return appError{409, "Role cannot change while this user owns projects"}
				}
			}
			for _, p := range s.Proposals {
				if p.TeamID == target.TeamID {
					return appError{409, "Role cannot change while this team has proposals"}
				}
			}
			if in.Role == "student" && target.TeamID == "" {
				tid := id()
				target.TeamID = tid
				s.Teams = append(s.Teams, Team{ID: tid, Name: target.Name, Description: target.Description, University: target.Organization, Skills: []string{}, Members: 1, Color: "mint", Emoji: "✦", Reviews: []Review{}})
			}
			target.Role = in.Role
		}
		target.Plan = in.Plan
		if before != target.Role+"/"+target.Plan {
			s.AdminEvents = append(s.AdminEvents, AdminEvent{actor.ID, target.ID, before, target.Role + "/" + target.Plan, now()})
		}
		return nil
	})
	if e != nil {
		return e
	}
	respond(w, map[string]bool{"ok": true})
	return nil
}
