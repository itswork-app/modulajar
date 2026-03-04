package qeval

func DetermineVerdict(score int) string {
	if score >= 85 {
		return VerdictPass
	}
	if score >= 70 {
		return VerdictPassWarn
	}
	if score >= 60 {
		return VerdictRetry
	}
	return VerdictFail
}
