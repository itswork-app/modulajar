package qeval

import (
	"regexp"
	"strings"

	"modulajar/apps/core-go/curriculum"
)

var (
	placeholderRegex = regexp.MustCompile("(?i)lorem ipsum|placeholder|contoh teks|isi di sini|di sini|\\[isi\\]|\\[fill\\]|todo|tbd|xxx")
	aiRefRegex       = regexp.MustCompile("(?i)ai generated|chatgpt|openai|language model|sebagai ai|kecerdasan buatan")
	markdownRegex    = regexp.MustCompile("(?m)(^#{1,6} |\\*\\*|__|```|^- |^\\d+\\. )")
)

type ScoreBuilder struct {
	Score int
	Flags []string
}

func (s *ScoreBuilder) Penalty(points int, flag string) {
	s.Score -= points
	s.Flags = append(s.Flags, flag)
}

func EvaluateSD4(m *curriculum.ModulAjarSD4) QualityResult {
	sb := &ScoreBuilder{Score: 100, Flags: []string{}}

	// 1. Completeness (25 points)
	if m.TujuanPembelajaran == "" {
		sb.Penalty(10, FlagMissingLearningObjective)
	}
	if m.MateriPembelajaran == "" {
		sb.Penalty(10, FlagMissingMateri)
	}
	if m.Penilaian.Pengetahuan == "" && m.Penilaian.Sikap == "" && m.Penilaian.Keterampilan == "" {
		sb.Penalty(5, FlagMissingAssessment)
	}

	// 2. Pedagogical Clarity (20 points)
	if len(m.KegiatanPembelajaran.Inti) < 50 {
		sb.Penalty(10, FlagShortContent)
	}

	// 3. Assessment Quality (20 points)
	if strings.Contains(strings.ToLower(m.Penilaian.Pengetahuan), "tes tertulis") && len(m.Penilaian.Pengetahuan) < 20 {
		sb.Penalty(5, FlagAssessmentTooGeneric)
	}

	// 4. Curriculum Alignment (15 points)
	if len(m.ProfilPelajarPancasila) == 0 {
		sb.Penalty(10, FlagNoPancasilaProfile)
	}

	// 5. Specificity & Style Safety (20 points)
	allText := strings.Join([]string{
		m.TujuanPembelajaran, m.MateriPembelajaran,
		m.KegiatanPembelajaran.Inti, m.Penilaian.Pengetahuan,
	}, " ")

	if placeholderRegex.MatchString(allText) {
		sb.Penalty(10, FlagPlaceholderText)
	}
	if aiRefRegex.MatchString(allText) {
		sb.Penalty(10, FlagStyleAIReference)
	}
	if markdownRegex.MatchString(allText) {
		sb.Penalty(5, FlagMarkdownDetected)
	}

	if sb.Score < 0 {
		sb.Score = 0
	}

	return QualityResult{
		Score:         sb.Score,
		Verdict:       DetermineVerdict(sb.Score),
		Flags:         sb.Flags,
		RubricVersion: RubricVersion,
	}
}

func EvaluateLegacy(c *curriculum.Curriculum) QualityResult {
	sb := &ScoreBuilder{Score: 100, Flags: []string{}}

	// Similar logic for legacy
	if len(c.TujuanPembelajaran) == 0 {
		sb.Penalty(10, FlagMissingLearningObjective)
	}
	if len(c.MateriInti) == 0 {
		sb.Penalty(10, FlagMissingMateri)
	}
	if len(c.LangkahPembelajaran.Inti) == 0 {
		sb.Penalty(10, FlagShortContent)
	}

	// 4. Specificity & Style
	allText := strings.Join(append(c.TujuanPembelajaran, c.MateriInti...), " ")
	if placeholderRegex.MatchString(allText) {
		sb.Penalty(10, FlagPlaceholderText)
	}
	if aiRefRegex.MatchString(allText) {
		sb.Penalty(10, FlagStyleAIReference)
	}

	if sb.Score < 0 {
		sb.Score = 0
	}

	return QualityResult{
		Score:         sb.Score,
		Verdict:       DetermineVerdict(sb.Score),
		Flags:         sb.Flags,
		RubricVersion: RubricVersion,
	}
}
