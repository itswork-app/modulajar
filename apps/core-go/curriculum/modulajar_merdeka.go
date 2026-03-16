package curriculum

import (
	"fmt"
	"regexp"
	"strings"
)

// ModulAjarMerdeka represents the Kurikulum Merdeka module schema.
type ModulAjarMerdeka struct {
	Identitas              IdentitasMerdeka            `json:"identitas"`
	KompetensiAwal         string                      `json:"kompetensi_awal"`
	ProfilPelajarPancasila []string                    `json:"profil_pelajar_pancasila"`
	SaranaPrasarana        []string                    `json:"sarana_prasarana"`
	TargetPesertaDidik     string                      `json:"target_peserta_didik"`
	ModelPembelajaran      string                      `json:"model_pembelajaran"`
	PemahamanBermakna      string                      `json:"pemahaman_bermakna"`
	PertanyaanPemantik     []string                    `json:"pertanyaan_pemantik"`
	TujuanPembelajaran     string                      `json:"tujuan_pembelajaran"`
	MateriPembelajaran     string                      `json:"materi_pembelajaran"`
	KegiatanPembelajaran   KegiatanPembelajaranMerdeka `json:"kegiatan_pembelajaran"`
	Penilaian              PenilaianMerdeka            `json:"penilaian"`
	RefleksiGuru           string                      `json:"refleksi_guru"`
	Lampiran               LampiranMerdeka             `json:"lampiran"`
}

// IdentitasMerdeka holds identity metadata for the module.
type IdentitasMerdeka struct {
	NamaGuru      string `json:"nama_guru"`
	Sekolah       string `json:"sekolah"`
	MataPelajaran string `json:"mata_pelajaran"`
	Kelas         int    `json:"kelas"`
	Fase          string `json:"fase"`
	Semester      string `json:"semester"`
	Topik         string `json:"topik"`
	AlokasiWaktu  string `json:"alokasi_waktu"`
}

// KegiatanPembelajaranMerdeka holds learning activity descriptions.
type KegiatanPembelajaranMerdeka struct {
	Pendahuluan string `json:"pendahuluan"`
	Inti        string `json:"inti"`
	Penutup     string `json:"penutup"`
}

// PenilaianMerdeka holds assessment descriptions.
type PenilaianMerdeka struct {
	Sikap        string `json:"sikap"`
	Pengetahuan  string `json:"pengetahuan"`
	Keterampilan string `json:"keterampilan"`
}

// LampiranMerdeka holds supplementary materials.
type LampiranMerdeka struct {
	Glosarium      string `json:"glosarium"`
	DaftarPustaka string `json:"daftar_pustaka"`
}

// ValidateModulAjar checks required fields in the module.
func ValidateModulAjar(m *ModulAjarMerdeka) error {
	if m.TujuanPembelajaran == "" {
		return fmt.Errorf("tujuan_pembelajaran is required")
	}
	if m.MateriPembelajaran == "" {
		return fmt.Errorf("materi_pembelajaran is required")
	}
	if len(m.PertanyaanPemantik) < 1 {
		return fmt.Errorf("pertanyaan_pemantik must have at least 1 item")
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
func EvaluateModulAjar(m *ModulAjarMerdeka) error {
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

	// Check for minimum length in new fields
	if len(m.PemahamanBermakna) > 0 && len(m.PemahamanBermakna) < 10 {
		return fmt.Errorf("field pemahaman_bermakna too short")
	}
	if len(m.Lampiran.Glosarium) > 0 && len(m.Lampiran.Glosarium) < 5 {
		return fmt.Errorf("field lampiran.glosarium too short")
	}

	// Check for \"AI\" self-reference
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

func SanitizeModulAjar(m *ModulAjarMerdeka) {
	m.Identitas.NamaGuru = cleanString(m.Identitas.NamaGuru)
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

	m.PemahamanBermakna = cleanString(m.PemahamanBermakna)
	m.Lampiran.Glosarium = cleanString(m.Lampiran.Glosarium)
	m.Lampiran.DaftarPustaka = cleanString(m.Lampiran.DaftarPustaka)

	m.ProfilPelajarPancasila = cleanStringSlice(m.ProfilPelajarPancasila)
	m.SaranaPrasarana = cleanStringSlice(m.SaranaPrasarana)
	m.PertanyaanPemantik = cleanStringSlice(m.PertanyaanPemantik)
}
