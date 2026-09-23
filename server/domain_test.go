package main

import (
	"strings"
	"testing"
)

func TestReadinessUsesConfirmedContent(t *testing.T) {
	f := Fields{}
	a := map[string]string{}
	for _, k := range fieldKeys {
		f[k] = "Verified content for " + k
		a[k] = hash(f[k])
	}
	if got := score(f, a); got != 100 {
		t.Fatalf("want100 got%d", got)
	}
	f["context"] = "Changed context"
	if got := score(f, a); got != 80 {
		t.Fatalf("changed context must invalidate20, got%d", got)
	}
	a["context"] = hash(f["context"])
	delete(a, "data")
	if got := score(f, a); got != 80 {
		t.Fatalf("missing approval: %d", got)
	}
	f["data"] = " "
	a["data"] = hash(" ")
	if got := score(f, a); got != 80 {
		t.Fatalf("blank confirmation: %d", got)
	}
}
func TestPublishedVersionsAreImmutableAndLowScoreAllowed(t *testing.T) {
	s := seed()
	c := Challenge{ID: "test", OwnerID: "b1", Fields: Fields{"title": "Test title", "need": "Short need"}, Approved: map[string]string{"need": hash("Short need")}}
	if err := publish(&s, &c, "first"); err != nil {
		t.Fatal(err)
	}
	if !c.Published || c.Score != 0 || len(c.Versions) != 1 {
		t.Fatal("short need should publish at 0")
	}
	c.Fields["need"] = "Changed need"
	if c.Versions[0].Fields["need"] != "Short need" {
		t.Fatal("version mutated")
	}
	if err := publish(&s, &c, "second"); err == nil {
		t.Fatal("unconfirmed changes must not publish")
	}
	c.Approved["need"] = hash(c.Fields["need"])
	if err := publish(&s, &c, "second"); err != nil {
		t.Fatal(err)
	}
	if c.Versions[0].Approved["need"] != hash("Short need") {
		t.Fatal("approval snapshot mutated")
	}
}
func TestVersionChangeNotifiesEachTeamOnce(t *testing.T) {
	s := seed()
	c := s.challenge("q1")
	c.Fields["constraints"] = "New scope"
	delete(c.Approved, "constraints")
	if err := publish(&s, c, "changed"); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, n := range s.Notifications {
		if n.Kind == "changed" {
			if seen[n.UserID] {
				t.Fatal("duplicate notice")
			}
			seen[n.UserID] = true
		}
	}
	if len(seen) != 3 {
		t.Fatalf("want3 teams got%d", len(seen))
	}
}
func TestValidation(t *testing.T) {
	if validateFields(Fields{"title": "ab"}) == nil {
		t.Fatal("short title accepted")
	}
	if validateFields(Fields{"title": "valid", "other": "bad"}) == nil {
		t.Fatal("unknown field accepted")
	}
	if validateFields(Fields{"title": "valid", "need": strings.Repeat("a", 5001)}) == nil {
		t.Fatal("unbounded input")
	}
	for _, url := range []string{"javascript:alert(1)", "file:///tmp/test", "https://user:password@example.org"} {
		if safeLink(url) {
			t.Fatal("unsafe URL", url)
		}
	}
}
func TestLocalAssistantDoesNotInventFacts(t *testing.T) {
	for _, l := range []string{"ru", "kk", "en"} {
		r := localAI("We need better forecasts", l)
		if len(r.Questions) < 3 || r.Fields["need"] != "We need better forecasts" || len(r.Fields) != 1 {
			t.Fatal("invalid local AI contract")
		}
	}
}
func TestCaptionChunking(t *testing.T) {
	text := "Біз студенттерге арналған түсінікті тапсырмалар платформасын жасаймыз. Нақты нәтиже және пайдалы тәжірибе."
	parts := captionChunks(text)
	if strings.Join(parts, " ") != text {
		t.Fatal("caption text was lost")
	}
	if stamp(45) != "00:00:01.500" {
		t.Fatal("bad timestamp")
	}
}

func TestVideoCaptionsFollowNarrationNotSilentTail(t *testing.T) {
	paragraphs := []string{"A clear business need with verified facts.", "A practical result that the team will deliver and test."}
	scenes, captions := mediaTimeline(paragraphs, []string{"Need", "Result"}, 45, 22.1)
	if len(scenes) != 2 || scenes[0].From != 0 || scenes[1].From != scenes[0].Duration {
		t.Fatal("scene timeline has gaps")
	}
	if scenes[1].From+scenes[1].Duration != 45*30 {
		t.Fatal("video duration not preserved")
	}
	if len(captions) == 0 || captions[len(captions)-1].To > int(22.1*30) {
		t.Fatal("captions continued after narration")
	}
	for _, c := range captions {
		if c.To <= c.From {
			t.Fatal("empty caption interval")
		}
	}
}
