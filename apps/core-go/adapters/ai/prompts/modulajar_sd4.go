package prompts

import (
	"fmt"
	"strings"
)

// BuildSystemPrompt returns the system-level prompt for Modul Ajar generation.
func BuildSystemPrompt(jenjang string) string {
	return fmt.Sprintf(`Anda adalah guru profesional Indonesia yang menyusun Modul Ajar berdasarkan Kurikulum Merdeka untuk jenjang %s.

Tulisan harus:
- bahasa formal guru Indonesia (KBBI)
- praktis digunakan di kelas
- tidak terlalu akademik, fokus pada aktivitas siswa
- tidak menyebut AI atau asisten virtual
- memenuhi kriteria "Elite Grade": mendalam, kontekstual, dan inspiratif.`, jenjang)
}

// BuildInstructionPrompt returns the instruction with injected parameters.
func BuildInstructionPrompt(school, subject, jenjang, kelas, fase, semester, topic string) string {
	return fmt.Sprintf(`Sekolah: %s
Mata Pelajaran: %s
Jenjang: %s
Kelas: %s
Fase: %s
Semester: %s
Topik: %s

Instruction:
Gunakan pendekatan pembelajaran aktif (active learning) yang sesuai dengan karakteristik siswa jenjang %s kelas %s.
Isi setiap field JSON dengan teks ringkas, praktis, dan berbobot.
Pastikan konten mencerminkan standar Kurikulum Merdeka yang mutakhir.`, school, subject, jenjang, kelas, fase, semester, topic, jenjang, kelas)
}

// MapFase returns the Kurikulum Merdeka phase for a given level and grade.
func MapFase(jenjang string, kelas string) string {
	k := strings.TrimSpace(kelas)
	j := strings.ToUpper(strings.TrimSpace(jenjang))

	switch j {
	case "SD":
		if k == "1" || k == "2" {
			return "A"
		}
		if k == "3" || k == "4" {
			return "B"
		}
		if k == "5" || k == "6" {
			return "C"
		}
	case "SMP":
		return "D"
	case "SMA", "SMK":
		if k == "10" {
			return "E"
		}
		return "F"
	}
	return "B" // Default fallback
}

// BuildSchemaPrompt returns the schema fill instruction with the template JSON.
func BuildSchemaPrompt(templateJSON string) string {
	return fmt.Sprintf(`Isi JSON berikut secara lengkap.
Jangan menambah field baru.
Jangan mengubah struktur JSON.
Pastikan semua field terisi.

%s`, templateJSON)
}

// BuildFewShotPrompt creates a prompt section containing high-quality examples.
func BuildFewShotPrompt(examples []string) string {
	if len(examples) == 0 {
		return ""
	}

	prompt := "--- EXAMPLES OF HIGH QUALITY OUTPUT ---\n"
	prompt += "Use the following examples for style, tone, and formatting inspiration:\n\n"

	for i, ex := range examples {
		prompt += fmt.Sprintf("EXAMPLE %d:\n%s\n\n", i+1, ex)
	}

	prompt += "--- END OF EXAMPLES ---\n"
	return prompt
}

// BuildFullPrompt combines system, instruction, schema, and optional few-shot examples.
func BuildFullPrompt(school, subject, jenjang, kelas, semester, topic, templateJSON string, examples []string) string {
	fase := MapFase(jenjang, kelas)
	fewShot := BuildFewShotPrompt(examples)

	return fmt.Sprintf(`%s

---

%s

%s

---

%s

Output HARUS berupa JSON valid. JANGAN menambahkan markdown block atau teks penjelasan di luar JSON.`,
		BuildSystemPrompt(jenjang),
		BuildInstructionPrompt(school, subject, jenjang, kelas, fase, semester, topic),
		fewShot,
		BuildSchemaPrompt(templateJSON))
}
