package curriculum

import (
	"testing"
)

func TestTemplateLoader(t *testing.T) {
	if HasTemplateMerdeka("MAT") != true {
		t.Error("Expected MAT to have template")
	}
	if HasTemplateMerdeka("UNKNOWN") == true {
		t.Error("Expected UNKNOWN to not have template")
	}

	_, err := LoadTemplateMerdeka("UNKNOWN")
	if err == nil {
		t.Error("Expected error loading unknown template")
	}

	_, _ = LoadTemplateMerdeka("MAT")
	_, _ = LoadTemplateMerdekaStruct("MAT")
}
