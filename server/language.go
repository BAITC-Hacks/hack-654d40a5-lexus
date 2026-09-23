package main

import (
	"net/http"
	"regexp"
	"strings"
	"unicode"
)

type LanguageAudit struct {
	Warning  bool   `json:"warning"`
	Expected string `json:"expected"`
	Detected string `json:"detected"`
	Reason   string `json:"reason"`
	Method   string `json:"method"`
}

var languageWords = regexp.MustCompile(`[\p{L}][\p{L}\p{M}+#.-]*`)
var languageNoise = regexp.MustCompile("(?s)```.*?```|`[^`]*`|https?://[^\\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}")
var technicalTerms = func() map[string]bool {
	m := map[string]bool{}
	for _, w := range strings.Fields("api ai ui ux go golang react typescript javascript python java c++ c# sql postgresql postgres mysql mongodb docker kubernetes k8s node node.js next.js nextjs vue angular figma github gitlab git openai chatgpt gpt llm ai ml html css http https rest graphql json xml csv pdf docx xlsx mvp crm erp saas ios android web frontend backend fullstack devops figma slack notion youtube google apple microsoft windows linux macos macbook elevenlabs whisper scribe rag grpc redis clickhouse numpy pandas pytorch tensorflow data science ci cd tdd jwt oauth jwt sdk url id xp kpi okr qr telegram whatsapp excel powerpoint word npm vite tailwind remotion ffmpeg stt tts ui/ux frontend backend scrum kanban jira jira ux research") {
		m[w] = true
	}
	return m
}()

func auditLanguage(text, expected string) LanguageAudit {
	if expected != "kk" && expected != "en" {
		expected = "ru"
	}
	result := LanguageAudit{Expected: expected, Detected: "unknown", Method: "conservative-script-heuristic-v1"}
	text = languageNoise.ReplaceAllString(text, " ")
	if len(text) > 60000 {
		text = text[:60000]
	}
	total, latin, cyr, kazakh, other := 0, 0, 0, 0, 0
	for _, word := range languageWords.FindAllString(text, -1) {
		w := strings.ToLower(strings.Trim(word, ".-"))
		if technicalTerms[w] || len([]rune(w)) < 2 {
			continue
		}
		letters, lc, cc, kc := 0, 0, 0, false
		for _, r := range w {
			if !unicode.IsLetter(r) {
				continue
			}
			letters++
			if unicode.In(r, unicode.Latin) {
				lc++
			}
			if unicode.In(r, unicode.Cyrillic) {
				cc++
			}
			if strings.ContainsRune("әғқңөұүһ", r) {
				kc = true
			}
		}
		if letters < 2 {
			continue
		}
		total++
		if lc*2 > letters {
			latin++
		} else if cc*2 > letters {
			cyr++
		} else {
			other++
		}
		if kc {
			kazakh++
		}
	}
	// Short phrases, company names, code and isolated foreign terms are intentionally inconclusive.
	if total < 8 {
		return result
	}
	if kazakh >= 3 && kazakh*5 >= total {
		result.Detected = "kk"
	} else if cyr*100/total >= 65 {
		result.Detected = "ru"
	} else if latin*100/total >= 65 {
		result.Detected = "latin"
	} else if other*100/total >= 55 {
		result.Detected = "other"
	}
	if expected == "ru" {
		result.Warning = result.Detected == "kk" || result.Detected == "latin" || result.Detected == "other"
	} else if expected == "en" {
		result.Warning = result.Detected == "ru" || result.Detected == "kk" || result.Detected == "other"
	} else {
		result.Warning = result.Detected == "latin" || result.Detected == "other"
	}
	if result.Warning {
		result.Reason = "Значительная часть материала похожа на другой язык. Автопроверка может ошибаться; отдельные иностранные слова и технические термины допустимы."
	}
	return result
}
func auditFields(f Fields, locale string) LanguageAudit {
	result := LanguageAudit{Expected: locale, Detected: "unknown", Method: "conservative-script-heuristic-v1"}
	for _, k := range fieldKeys {
		a := auditLanguage(f[k], locale)
		if a.Warning {
			return a
		}
	}
	return result
}
func challengeLanguage(c *Challenge, s *State) LanguageAudit {
	audit := auditFields(c.Fields, c.Locale)
	if audit.Warning {
		return audit
	}
	for _, fid := range c.AttachmentIDs {
		for _, f := range s.Attachments {
			if f.ID == fid && auditForLocale(f.Audit, c.Locale).Warning {
				return auditForLocale(f.Audit, c.Locale)
			}
		}
	}
	return audit
}
func languageFingerprint(c *Challenge) string {
	return hash(string(serialize(struct {
		Fields Fields
		Files  []string
	}{c.Fields, c.AttachmentIDs})))
}
func syncLanguage(c *Challenge, s *State, accept bool) {
	c.LanguageAudit = challengeLanguage(c, s)
	fp := languageFingerprint(c)
	if !c.LanguageAudit.Warning {
		c.LanguageAcknowledged = ""
		c.LanguagePenalty = 0
		return
	}
	if accept {
		c.LanguageAcknowledged = fp
	}
	c.LanguagePenalty = 0
	if c.LanguageAcknowledged == fp {
		c.LanguagePenalty = 5
	} else {
		c.LanguageAcknowledged = ""
	}
}
func challengeScore(c *Challenge) int {
	base := score(c.Fields, c.Approved)
	return max(0, base-c.LanguagePenalty)
}
func (a *App) auditAPI(w http.ResponseWriter, r *http.Request) error {
	s, e := a.read(r.Context())
	if e != nil {
		return e
	}
	if _, e = a.authorized(&s, r); e != nil {
		return e
	}
	var in struct {
		Text   string `json:"text"`
		Fields Fields `json:"fields"`
		Locale string `json:"locale"`
	}
	if e = decode(w, r, &in); e != nil {
		return e
	}
	if len(in.Text) > 60000 {
		return bad("Текст для проверки слишком длинный")
	}
	if in.Locale == "" {
		in.Locale = "ru"
	}
	result := auditLanguage(in.Text, in.Locale)
	if in.Fields != nil {
		result = auditFields(in.Fields, in.Locale)
	}
	respond(w, result)
	return nil
}

func auditForLocale(a LanguageAudit, locale string) LanguageAudit {
	a.Expected = locale
	if locale == "ru" {
		a.Warning = a.Detected == "kk" || a.Detected == "latin" || a.Detected == "other"
	} else if locale == "en" {
		a.Warning = a.Detected == "ru" || a.Detected == "kk" || a.Detected == "other"
	} else {
		a.Warning = a.Detected == "latin" || a.Detected == "other"
	}
	return a
}
