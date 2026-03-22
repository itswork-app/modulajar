package curriculum

import (
	"regexp"
	"strings"
)

var (
	htmlTagRegex     = regexp.MustCompile(`<[^>]*>`)
	exampleJsonRegex = regexp.MustCompile("```json|```")
)

// Sanitize cleans all string fields in the Curriculum struct
func (c *Curriculum) Sanitize() {
	c.Meta.Jenjang = cleanString(c.Meta.Jenjang)
	c.Meta.Kelas = cleanString(c.Meta.Kelas)
	c.Meta.Mapel = cleanString(c.Meta.Mapel)
	c.Meta.Semester = cleanString(c.Meta.Semester)
	c.Meta.TahunAjaran = cleanString(c.Meta.TahunAjaran)

	c.Identitas.Sekolah = cleanString(c.Identitas.Sekolah)
	c.Identitas.Guru = cleanString(c.Identitas.Guru)
	c.Identitas.AlokasiWaktu = cleanString(c.Identitas.AlokasiWaktu)

	c.TujuanPembelajaran = cleanStringSlice(c.TujuanPembelajaran)
	c.MateriInti = cleanStringSlice(c.MateriInti)
	c.ProfilPancasila = cleanStringSlice(c.ProfilPancasila)

	c.LangkahPembelajaran.Pendahuluan = cleanStringSlice(c.LangkahPembelajaran.Pendahuluan)
	c.LangkahPembelajaran.Inti = cleanStringSlice(c.LangkahPembelajaran.Inti)
	c.LangkahPembelajaran.Penutup = cleanStringSlice(c.LangkahPembelajaran.Penutup)

	c.Asesmen.Diagnostik = cleanStringSlice(c.Asesmen.Diagnostik)
	c.Asesmen.Formatif = cleanStringSlice(c.Asesmen.Formatif)
	c.Asesmen.Sumatif = cleanStringSlice(c.Asesmen.Sumatif)

	c.Diferensiasi.Konten = cleanStringSlice(c.Diferensiasi.Konten)
	c.Diferensiasi.Proses = cleanStringSlice(c.Diferensiasi.Proses)
	c.Diferensiasi.Produk = cleanStringSlice(c.Diferensiasi.Produk)

	c.Lampiran.Media = cleanStringSlice(c.Lampiran.Media)
	c.Lampiran.SumberBelajar = cleanStringSlice(c.Lampiran.SumberBelajar)
}

func cleanString(s string) string {
	// 1. Remove Markdown code blocks if present (sometimes AI wraps output)
	s = exampleJsonRegex.ReplaceAllString(s, "")

	// 2. Remove HTML tags
	s = htmlTagRegex.ReplaceAllString(s, "")

	// 3. Normalize whitespace (tabs, newlines -> space)
	s = strings.Join(strings.Fields(s), " ")

	return strings.TrimSpace(s)
}

func cleanStringSlice(slice []string) []string {
	cleaned := make([]string, len(slice))
	for i, s := range slice {
		cleaned[i] = cleanString(s)
	}
	return cleaned
}
