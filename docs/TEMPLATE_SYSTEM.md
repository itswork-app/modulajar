# Template Quality System (SD Kelas 4)

This document describes the schema-guided AI generation system introduced in PR-060 to ensure high-quality, practical, and teacher-friendly "Modul Ajar" documents.

## Architecture

The system follows a contract-first approach where AI generation is guided by predefined JSON templates.

1. **Template Loading**: The worker identifies the subject (e.g., Matematika) and loads the corresponding template from `templates/sd4/`.
2. **Structured Prompting**: A multi-stage prompt is built:
   - **System Prompt**: Defines the professional teacher persona.
   - **Instruction Prompt**: Injects parameters (school, subject, semester) and pedagogical guidelines.
   - **Schema Prompt**: Provides the exact JSON structure to be filled.
3. **AI Generation (Gemini)**: The AI fills the JSON fields.
4. **Validation Pipeline**:
   - **Schema Validation**: Ensures all required fields like `tujuan_pembelajaran` and `kegiatan_pembelajaran.inti` are present and correctly formatted.
   - **AI Quality Evaluator**: Rejects "lazy" or "AI-ish" output (short text, placeholder words, AI self-references, or markdown syntax in fields).
   - **Sanitization**: Standardizes whitespace and removes unwanted HTML/Markdown.
5. **Retry Logic**: If any validation step fails, the worker retries up to 2 times (total 3 attempts) before failing the job.
6. **AI-Guided Rendering**: The final HTML and PDF are rendered using the validated AI content instead of generic placeholders.

## Directory Structure

- `templates/sd4/`: JSON template files.
- `apps/core-go/curriculum/modulajar_sd4.go`: Schema definition and evaluator logic.
- `apps/core-go/adapters/ai/prompts/modulajar_sd4.go`: Structured prompt builder.
- `apps/core-go/curriculum/template_loader.go`: Filesystem-based template resolver.

## Quality Rules (Evaluator)

- **Minimum Length**: Critical fields must be >= 10 characters.
- **No Placeholders**: Rejects words like "lorem ipsum", "[isi]", "todo", etc.
- **No AI Mentions**: Rejects "sebagai AI", "kecerdasan buatan", etc.
- **Plain Text Only**: Rejects markdown headings, bolding, or code blocks within fields to ensure clean PDF rendering.

## Deterministic Rendering

The rendering engine in `render/composer.go` ensures that the same AI input produces the exact same HTML output hash by using stable key ordering and normalized values, which is critical for document integrity and verification.
