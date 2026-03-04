package qeval

const (
	VerdictPass     = "pass"
	VerdictPassWarn = "pass_warn"
	VerdictRetry    = "retry"
	VerdictFail     = "fail"
)

type QualityResult struct {
	Score         int      `json:"score"`
	Verdict       string   `json:"verdict"`
	Flags         []string `json:"flags"`
	RubricVersion string   `json:"rubric_version"`
}
