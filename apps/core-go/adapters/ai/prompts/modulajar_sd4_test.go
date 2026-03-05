package prompts

import (
	"strings"
	"testing"
)

func TestPromptContainsSchool(t *testing.T) {
	prompt := BuildInstructionPrompt("SD Negeri 1 Jakarta", "Matematika", "1", "Pecahan")
	if !strings.Contains(prompt, "SD Negeri 1 Jakarta") {
		t.Error("expected prompt to contain school name")
	}
}

func TestPromptContainsSubject(t *testing.T) {
	prompt := BuildInstructionPrompt("SD Negeri 1", "Bahasa Indonesia", "2", "Puisi")
	if !strings.Contains(prompt, "Bahasa Indonesia") {
		t.Error("expected prompt to contain subject name")
	}
}

func TestSchemaInjected(t *testing.T) {
	schema := `{"identitas": {"sekolah": ""}}`
	prompt := BuildSchemaPrompt(schema)
	if !strings.Contains(prompt, `"identitas"`) {
		t.Error("expected schema to be injected into prompt")
	}
	if !strings.Contains(prompt, "Jangan menambah field baru") {
		t.Error("expected fill instruction")
	}
}

func TestBuildFullPrompt(t *testing.T) {
	full := BuildFullPrompt("SD Test", "Math", "1", "Algebra", `{"identitas":1}`, nil)
	if !strings.Contains(full, "guru profesional") {
		t.Error("expected system prompt in full prompt")
	}
	if !strings.Contains(full, "SD Test") {
		t.Error("expected school in full prompt")
	}
	if !strings.Contains(full, "Math") {
		t.Error("expected subject in full prompt")
	}
	if !strings.Contains(full, `"identitas"`) {
		t.Error("expected schema in full prompt")
	}
}

func TestSystemPromptNoAI(t *testing.T) {
	sys := BuildSystemPrompt()
	if !strings.Contains(sys, "tidak menyebut AI") {
		t.Error("expected system prompt to instruct no AI mention")
	}
}
