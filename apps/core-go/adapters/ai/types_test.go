package ai

import (
	"strings"
	"testing"
)

func TestSanitizeJSON(t *testing.T) {
	// Normal JSON extraction
	result := SanitizeJSON("prefix {\"key\": \"value\"} suffix")
	if result != `{"key": "value"}` {
		t.Errorf("unexpected result: %s", result)
	}

	// No JSON braces - should return as-is
	noJSON := SanitizeJSON("no curly braces here")
	if noJSON != "no curly braces here" {
		t.Errorf("expected unchanged string: %s", noJSON)
	}

	// Nested JSON
	nested := SanitizeJSON("```json\n{\"a\": {\"b\": 1}}\n```")
	if !strings.Contains(nested, "\"a\"") {
		t.Errorf("expected nested JSON: %s", nested)
	}

	// End before start (invalid) - returns original
	invalid := SanitizeJSON("}no start{")
	_ = invalid // should not panic
}
