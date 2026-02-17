package curriculum

import (
	"fmt"
)

type Curriculum struct {
	Meta                Meta                `json:"meta"`
	Identitas           Identitas           `json:"identitas"`
	TujuanPembelajaran  []string            `json:"tujuan_pembelajaran"`
	MateriInti          []string            `json:"materi_inti"`
	LangkahPembelajaran LangkahPembelajaran `json:"langkah_pembelajaran"`
	Asesmen             Asesmen             `json:"asesmen"`
	Diferensiasi        Diferensiasi        `json:"diferensiasi"`
	ProfilPancasila     []string            `json:"profil_pancasila"`
	Lampiran            Lampiran            `json:"lampiran"`
}

type Meta struct {
	Jenjang     string `json:"jenjang"`
	Kelas       string `json:"kelas"`
	Mapel       string `json:"mapel"`
	Semester    string `json:"semester"`
	TahunAjaran string `json:"tahun_ajaran"`
}

type Identitas struct {
	Sekolah      string `json:"sekolah"`
	Guru         string `json:"guru"`
	AlokasiWaktu string `json:"alokasi_waktu"`
}

type LangkahPembelajaran struct {
	Pendahuluan []string `json:"pendahuluan"`
	Inti        []string `json:"inti"`
	Penutup     []string `json:"penutup"`
}

type Asesmen struct {
	Diagnostik []string `json:"diagnostik"`
	Formatif   []string `json:"formatif"`
	Sumatif    []string `json:"sumatif"`
}

type Diferensiasi struct {
	Konten []string `json:"konten"`
	Proses []string `json:"proses"`
	Produk []string `json:"produk"`
}

type Lampiran struct {
	Media         []string `json:"media"`
	SumberBelajar []string `json:"sumber_belajar"`
}

// Validate checks for required fields and basic constraints
func (c *Curriculum) Validate() error {
	if c.Meta.Jenjang == "" {
		return fmt.Errorf("meta.jenjang is required")
	}
	if c.Meta.Kelas == "" {
		return fmt.Errorf("meta.kelas is required")
	}
	if c.Meta.Mapel == "" {
		return fmt.Errorf("meta.mapel is required")
	}
	if len(c.TujuanPembelajaran) == 0 {
		return fmt.Errorf("tujuan_pembelajaran is required")
	}
	if len(c.MateriInti) == 0 {
		return fmt.Errorf("materi_inti is required")
	}
	if len(c.LangkahPembelajaran.Inti) == 0 {
		return fmt.Errorf("langkah_pembelajaran.inti is required")
	}
	return nil
}
