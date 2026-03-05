package prompts

import "fmt"

// BuildSystemPrompt returns the system-level prompt for Modul Ajar SD4 generation.
func BuildSystemPrompt() string {
	return `Anda adalah guru profesional Indonesia yang menyusun Modul Ajar berdasarkan Kurikulum Merdeka untuk Sekolah Dasar.

Tulisan harus:
- bahasa formal guru
- praktis digunakan di kelas
- tidak terlalu akademik
- tidak menyebut AI

Output HARUS berupa JSON valid.
Jangan menambahkan teks di luar JSON.`
}

// BuildInstructionPrompt returns the instruction with injected parameters.
func BuildInstructionPrompt(school, subject, semester, topic string) string {
	return fmt.Sprintf(`Sekolah: %s
Mata Pelajaran: %s
Kelas: 4
Fase: B
Semester: %s
Topik: %s

Instruction:
Gunakan pendekatan pembelajaran aktif yang sesuai dengan siswa kelas 4 SD.
Isi setiap field JSON dengan teks ringkas dan praktis.
Setiap field maksimal 2-4 kalimat.`, school, subject, semester, topic)
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
func BuildFullPrompt(school, subject, semester, topic, templateJSON string, examples []string) string {
	fewShot := BuildFewShotPrompt(examples)

	return fmt.Sprintf(`%s

---

%s

%s

---

%s`, BuildSystemPrompt(), BuildInstructionPrompt(school, subject, semester, topic), fewShot, BuildSchemaPrompt(templateJSON))
}
