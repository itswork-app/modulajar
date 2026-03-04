package curriculum

import (
	"fmt"
	"regexp"
	"strings"
)

// ModulAjarSD4 represents the Kurikulum Merdeka module schema for SD Grade 4.
type ModulAjarSD4 struct {
	Identitas              IdentitasSD4            `json:"identitas"`
	KompetensiAwal         string                  `json:"kompetensi_awal"`
	ProfilPelajarPancasila []string                `json:"profil_pelajar_pancasila"`
	SaranaPrasarana        []string                `json:"sarana_prasarana"`
	TargetPesertaDidik     string                  `json:"target_peserta_didik"`
	ModelPembelajaran      string                  `json:"model_pembelajaran"`
	TujuanPembelajaran     string                  `json:"tujuan_pembelajaran"`
	MateriPembelajaran     string                  `json:"materi_pembelajaran"`
	KegiatanPembelajaran   KegiatanPembelajaranSD4 `json:"kegiatan_pembelajaran"`
	Penilaian              PenilaianSD4            `json:"penilaian"`
	RefleksiGuru           string                  `json:"refleksi_guru"`
}

// IdentitasSD4 holds identity metadata for the module.
type IdentitasSD4 struct {
	Sekolah       string `json:"sekolah"`
	MataPelajaran string `json:"mata_pelajaran"`
	Kelas         int    `json:"kelas"`
	Fase          string `json:"fase"`
	Semester      string `json:"semester"`
	Topik         string `json:"topik"`
	AlokasiWaktu  string `json:"alokasi_waktu"`
}

// KegiatanPembelajaranSD4 holds learning activity descriptions.
type KegiatanPembelajaranSD4 struct {
	Pendahuluan string `json:"pendahuluan"`
	Inti        string `json:"inti"`
	Penutup     string `json:"penutup"`
}

// PenilaianSD4 holds assessment descriptions.
type PenilaianSD4 struct {
	Sikap        string `json:"sikap"`
	Pengetahuan  string `json:"pengetahuan"`
	Keterampilan string `json:"keterampilan"`
}

// ValidateModulAjar checks required fields in the module.
func ValidateModulAjar(m *ModulAjarSD4) error {
	if m.TujuanPembelajaran == "" {
		return fmt.Errorf("tujuan_pembelajaran is required")
	}
	if m.MateriPembelajaran == "" {
		return fmt.Errorf("materi_pembelajaran is required")
	}
	if m.KegiatanPembelajaran.Inti == "" {
		return fmt.Errorf("kegiatan_pembelajaran.inti is required")
	}
	if m.Penilaian.Pengetahuan == "" {
		return fmt.Errorf("penilaian.pengetahuan is required")
	}
	if len(m.ProfilPelajarPancasila) < 1 {
		return fmt.Errorf("profil_pelajar_pancasila must have at least 1 item")
	}
	if len(m.SaranaPrasarana) < 1 {
		return fmt.Errorf("sarana_prasarana must have at least 1 item")
	}
	return nil
}

var (
	placeholderWords = []string{
		"lorem ipsum", "placeholder", "contoh teks", "isi di sini",
		"[isi]", "[fill]", "todo", "tbd", "xxx",
	}
	markdownRegex = regexp.MustCompile("(?m)(^#{1,6} |\\*\\*|__|```|^- |^\\d+\\. )")
)

// EvaluateModulAjar performs quality checks on the AI output.
// Returns an error describing the first quality issue found.
func EvaluateModulAjar(m *ModulAjarSD4) error {
	// Check critical text fields for minimum length
	fields := map[string]string{
		"tujuan_pembelajaran":        m.TujuanPembelajaran,
		"materi_pembelajaran":        m.MateriPembelajaran,
		"kompetensi_awal":            m.KompetensiAwal,
		"kegiatan_pembelajaran.inti": m.KegiatanPembelajaran.Inti,
		"penilaian.pengetahuan":      m.Penilaian.Pengetahuan,
		"refleksi_guru":              m.RefleksiGuru,
	}

	for name, val := range fields {
		if len(val) > 0 && len(val) < 10 {
			return fmt.Errorf("field %s too short (%d chars, minimum 10)", name, len(val))
		}
	}

	// Check all text fields for placeholder words
	allText := strings.Join([]string{
		m.TujuanPembelajaran, m.MateriPembelajaran, m.KompetensiAwal,
		m.KegiatanPembelajaran.Pendahuluan, m.KegiatanPembelajaran.Inti, m.KegiatanPembelajaran.Penutup,
		m.Penilaian.Sikap, m.Penilaian.Pengetahuan, m.Penilaian.Keterampilan,
		m.RefleksiGuru, m.TargetPesertaDidik, m.ModelPembelajaran,
	}, " ")
	lower := strings.ToLower(allText)

	for _, pw := range placeholderWords {
		if strings.Contains(lower, pw) {
			return fmt.Errorf("output contains placeholder word: %q", pw)
		}
	}

	// Check for "AI" self-reference
	if strings.Contains(allText, " AI ") || strings.Contains(lower, "kecerdasan buatan") ||
		strings.Contains(lower, "sebagai ai") || strings.Contains(lower, "saya adalah ai") {
		return fmt.Errorf("output contains AI self-reference")
	}

	// Check for markdown syntax in output
	if markdownRegex.MatchString(allText) {
		return fmt.Errorf("output contains markdown syntax")
	}

	return nil
}

// SanitizeModulAjar cleans all string fields in the module.
func SanitizeModulAjar(m *ModulAjarSD4) {
	m.Identitas.Sekolah = cleanString(m.Identitas.Sekolah)
	m.Identitas.MataPelajaran = cleanString(m.Identitas.MataPelajaran)
	m.Identitas.Fase = cleanString(m.Identitas.Fase)
	m.Identitas.Semester = cleanString(m.Identitas.Semester)
	m.Identitas.Topik = cleanString(m.Identitas.Topik)
	m.Identitas.AlokasiWaktu = cleanString(m.Identitas.AlokasiWaktu)

	m.KompetensiAwal = cleanString(m.KompetensiAwal)
	m.TargetPesertaDidik = cleanString(m.TargetPesertaDidik)
	m.ModelPembelajaran = cleanString(m.ModelPembelajaran)
	m.TujuanPembelajaran = cleanString(m.TujuanPembelajaran)
	m.MateriPembelajaran = cleanString(m.MateriPembelajaran)
	m.RefleksiGuru = cleanString(m.RefleksiGuru)

	m.KegiatanPembelajaran.Pendahuluan = cleanString(m.KegiatanPembelajaran.Pendahuluan)
	m.KegiatanPembelajaran.Inti = cleanString(m.KegiatanPembelajaran.Inti)
	m.KegiatanPembelajaran.Penutup = cleanString(m.KegiatanPembelajaran.Penutup)

	m.Penilaian.Sikap = cleanString(m.Penilaian.Sikap)
	m.Penilaian.Pengetahuan = cleanString(m.Penilaian.Pengetahuan)
	m.Penilaian.Keterampilan = cleanString(m.Penilaian.Keterampilan)

	m.ProfilPelajarPancasila = cleanStringSlice(m.ProfilPelajarPancasila)
	m.SaranaPrasarana = cleanStringSlice(m.SaranaPrasarana)
}
