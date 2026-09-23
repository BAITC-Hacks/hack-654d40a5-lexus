package main

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInternalErrorsKeepDetailsServerSide(t *testing.T) {
	w := httptest.NewRecorder()
	w.Header().Set("X-Request-ID", "abcdef0123456789abcdef0123456789")
	fail(w, errors.New("database connection unavailable: internal diagnostic"))
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if w.Code != 500 || body["error"] != "Internal server error" || body["requestId"] != w.Header().Get("X-Request-ID") {
		t.Fatalf("unexpected public response: %s", w.Body.String())
	}
	if strings.Contains(w.Body.String(), "internal diagnostic") {
		t.Fatal("internal details escaped to client")
	}
}
