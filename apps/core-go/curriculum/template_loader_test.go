package curriculum

import (
	"testing"
)

func TestTemplateLoader(t *testing.T) {
	if HasTemplateSD4("MAT") != true {
		t.Error("Expected MAT to have template")
	}
	if HasTemplateSD4("UNKNOWN") == true {
		t.Error("Expected UNKNOWN to not have template")
	}

	_, err := LoadTemplateSD4("UNKNOWN")
	if err == nil {
		t.Error("Expected error loading unknown template")
	}

	_, _ = LoadTemplateSD4("MAT")
	_, _ = LoadTemplateSD4Struct("MAT")
}
