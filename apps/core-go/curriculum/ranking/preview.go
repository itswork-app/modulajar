package ranking

import "encoding/json"

// Preview contains truncated, safe-to-expose fields from a module.
type Preview struct {
	TujuanPembelajaran string `json:"tujuan_pembelajaran"`
	RingkasanKegiatan  string `json:"ringkasan_kegiatan"`
	AssessmentSummary  string `json:"assessment_summary"`
}

const maxPreviewLen = 200

func truncateStr(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}

// BuildPreview extracts and truncates preview fields from raw module JSON.
func BuildPreview(moduleJSON []byte) Preview {
	var raw map[string]interface{}
	if err := json.Unmarshal(moduleJSON, &raw); err != nil {
		return Preview{}
	}

	tujuan := extractString(raw, "tujuan_pembelajaran")
	kegiatan := extractNestedString(raw, "kegiatan_pembelajaran", "inti")
	assessment := extractNestedString(raw, "penilaian", "pengetahuan")

	return Preview{
		TujuanPembelajaran: truncateStr(tujuan, maxPreviewLen),
		RingkasanKegiatan:  truncateStr(kegiatan, maxPreviewLen),
		AssessmentSummary:  truncateStr(assessment, maxPreviewLen),
	}
}

func extractString(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case []interface{}:
		result := ""
		for i, item := range val {
			if s, ok := item.(string); ok {
				if i > 0 {
					result += "; "
				}
				result += s
			}
		}
		return result
	default:
		return ""
	}
}

func extractNestedString(m map[string]interface{}, parentKey, childKey string) string {
	parent, ok := m[parentKey]
	if !ok {
		return ""
	}
	switch val := parent.(type) {
	case string:
		return val
	case map[string]interface{}:
		if child, ok := val[childKey]; ok {
			if s, ok := child.(string); ok {
				return s
			}
		}
		return ""
	default:
		return ""
	}
}
