package ai

import (
	"crypto/sha256"
	"encoding/hex"
)

// GenerateRequest encapsulates input for generation
type GenerateRequest struct {
	Prompt string
}

// GenerateResponse encapsulates output and receipt data
type GenerateResponse struct {
	Content     string
	PromptHash  string // SHA256 of prompt
	OutputHash  string // SHA256 of content
	TokenInput  int
	TokenOutput int
	ModelName   string
	DurationMs  int64
}

func sha256Sum(s string) string {
	h := sha256.New()
	h.Write([]byte(s))
	return hex.EncodeToString(h.Sum(nil))
}

// SanitizeJSON strips markdown code blocks (e.g., ```json ... ```) from a string
func SanitizeJSON(s string) string {
	// Simple approach: find first '{' and last '}'
	// This is often more robust than regex for AI-generated content
	start := -1
	end := -1
	for i := 0; i < len(s); i++ {
		if s[i] == '{' {
			start = i
			break
		}
	}
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == '}' {
			end = i
			break
		}
	}

	if start != -1 && end != -1 && end > start {
		return s[start : end+1]
	}
	return s
}
