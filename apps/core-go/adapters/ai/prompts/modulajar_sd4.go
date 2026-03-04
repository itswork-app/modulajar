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

// BuildFullPrompt combines system, instruction, and schema prompts into one.
func BuildFullPrompt(school, subject, semester, topic, templateJSON string) string {
	return fmt.Sprintf(`%s

---

%s

---

%s`, BuildSystemPrompt(), BuildInstructionPrompt(school, subject, semester, topic), BuildSchemaPrompt(templateJSON))
}
