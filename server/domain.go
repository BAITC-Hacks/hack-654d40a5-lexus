package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

type Fields map[string]string
type User struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	TeamID string `json:"teamId"`
	Plan   string `json:"plan"`
}
type Version struct {
	Number   int               `json:"number"`
	Fields   Fields            `json:"fields"`
	Approved map[string]string `json:"approved"`
	Score    int               `json:"score"`
	At       string            `json:"at"`
	Note     string            `json:"note"`
}
type Challenge struct {
	ID        string            `json:"id"`
	OwnerID   string            `json:"ownerId"`
	Company   string            `json:"company"`
	Category  string            `json:"category"`
	Locale    string            `json:"locale"`
	Fields    Fields            `json:"fields"`
	Approved  map[string]string `json:"approved"`
	Revision  int               `json:"revision"`
	Versions  []Version         `json:"versions"`
	Score     int               `json:"score"`
	Published bool              `json:"published"`
	CreatedAt string            `json:"createdAt"`
	Activity  []Activity        `json:"activity"`
}
type Activity struct {
	Kind   string `json:"kind"`
	At     string `json:"at"`
	Detail string `json:"detail"`
}
type Team struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	University  string   `json:"university"`
	Skills      []string `json:"skills"`
	Members     int      `json:"members"`
	Color       string   `json:"color"`
	Emoji       string   `json:"emoji"`
	XP          int      `json:"xp"`
	Reviews     []Review `json:"reviews"`
}
type Review struct {
	ProposalID  string `json:"proposalId"`
	ChallengeID string `json:"challengeId"`
	Company     string `json:"company"`
	Stars       int    `json:"stars"`
	Text        string `json:"text"`
	At          string `json:"at"`
}
type Proposal struct {
	ID          string `json:"id"`
	ChallengeID string `json:"challengeId"`
	Version     int    `json:"version"`
	TeamID      string `json:"teamId"`
	Idea        string `json:"idea"`
	Plan        string `json:"plan"`
	Deadline    string `json:"deadline"`
	Link        string `json:"link"`
	Status      string `json:"status"`
	Submission  string `json:"submission"`
	Milestone   bool   `json:"milestone"`
	At          string `json:"at"`
}
type Notification struct {
	ID          string `json:"id"`
	UserID      string `json:"userId"`
	ChallengeID string `json:"challengeId"`
	Version     int    `json:"version"`
	Kind        string `json:"kind"`
	Read        bool   `json:"read"`
	At          string `json:"at"`
}
type State struct {
	Changes       []ChangeAdvice `json:"changes"`
	Users         []User         `json:"users"`
	Challenges    []Challenge    `json:"challenges"`
	Teams         []Team         `json:"teams"`
	Proposals     []Proposal     `json:"proposals"`
	Notifications []Notification `json:"notifications"`
	Media         []Media        `json:"media"`
}
type Criterion struct {
	ID     string   `json:"id"`
	Weight int      `json:"weight"`
	Fields []string `json:"fields"`
}

var criteria = []Criterion{{"context", 20, []string{"context", "need"}}, {"data", 20, []string{"data"}}, {"result", 15, []string{"result"}}, {"success", 15, []string{"success"}}, {"constraints", 10, []string{"constraints"}}, {"users", 10, []string{"users"}}, {"contact", 10, []string{"contact", "interaction"}}}
var fieldKeys = []string{"title", "context", "need", "users", "data", "constraints", "result", "success", "contact", "interaction"}

func now() string { return time.Now().UTC().Format(time.RFC3339) }
func hash(v string) string {
	h := sha256.Sum256([]byte(strings.TrimSpace(v)))
	return hex.EncodeToString(h[:])
}
func score(f Fields, a map[string]string) int {
	s := 0
	for _, c := range criteria {
		ok := true
		for _, k := range c.Fields {
			if utf8.RuneCountInString(strings.TrimSpace(f[k])) < 3 || a[k] != hash(f[k]) {
				ok = false
			}
		}
		if ok {
			s += c.Weight
		}
	}
	return s
}
func copyFields(f Fields) Fields {
	n := Fields{}
	for k, v := range f {
		n[k] = v
	}
	return n
}
func copyApproved(a map[string]string) map[string]string {
	n := map[string]string{}
	for k, v := range a {
		n[k] = v
	}
	return n
}
func validateFields(f Fields) error {
	if utf8.RuneCountInString(f["title"]) > 160 {
		return errors.New("title is limited to 160 characters")
	}
	for k, v := range f {
		found := false
		for _, a := range fieldKeys {
			if a == k {
				found = true
			}
		}
		if !found {
			return errors.New("invalid field")
		}
		if utf8.RuneCountInString(v) > 5000 {
			return errors.New("field too long (maximum 5000)")
		}
	}
	if utf8.RuneCountInString(strings.TrimSpace(f["title"])) < 3 {
		return errors.New("title must contain at least 3 characters")
	}
	return nil
}
func (s *State) user(id string) *User {
	for i := range s.Users {
		if s.Users[i].ID == id {
			return &s.Users[i]
		}
	}
	return nil
}
func (s *State) challenge(id string) *Challenge {
	for i := range s.Challenges {
		if s.Challenges[i].ID == id {
			return &s.Challenges[i]
		}
	}
	return nil
}
func (s *State) proposal(id string) *Proposal {
	for i := range s.Proposals {
		if s.Proposals[i].ID == id {
			return &s.Proposals[i]
		}
	}
	return nil
}
func (s *State) team(id string) *Team {
	for i := range s.Teams {
		if s.Teams[i].ID == id {
			return &s.Teams[i]
		}
	}
	return nil
}
func (s *State) notify(uid, cid, kind string, version int) {
	s.Notifications = append(s.Notifications, Notification{ID: id(), UserID: uid, ChallengeID: cid, Kind: kind, Version: version, At: now()})
}
func publish(s *State, c *Challenge, note string) error {
	if strings.TrimSpace(c.Fields["need"]) == "" {
		return errors.New("describe the need before publishing")
	}
	if c.Approved["need"] != hash(c.Fields["need"]) {
		return errors.New("confirm the need before publishing")
	}
	if err := validateFields(c.Fields); err != nil {
		return err
	}
	c.Score = score(c.Fields, c.Approved)
	n := len(c.Versions) + 1
	c.Versions = append(c.Versions, Version{n, copyFields(c.Fields), copyApproved(c.Approved), c.Score, now(), note})
	c.Published = true
	c.Revision++
	c.Activity = append(c.Activity, Activity{"published", now(), fmt.Sprintf("v%d · %d/100", n, c.Score)})
	if n > 1 {
		seen := map[string]bool{}
		for _, p := range s.Proposals {
			if p.ChallengeID == c.ID {
				for _, u := range s.Users {
					if u.TeamID == p.TeamID && !seen[u.ID] {
						s.notify(u.ID, c.ID, "changed", n)
						seen[u.ID] = true
					}
				}
			}
		}
	}
	return nil
}
func serialize(v any) []byte { b, _ := json.Marshal(v); return b }
