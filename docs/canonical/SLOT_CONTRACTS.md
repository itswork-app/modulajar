# Slot Contracts (Content Generation)

ModulAjar v1 prioritizes **Structure-First** generation. AI is a fallback, not the driver.

## Philosophy
1. **Templates are King**: The pedagogical structure (RPP/Modul Ajar) is defined by rigid JSON templates.
2. **Slots**: Templates contain "Slots" that need filling.
3. **Fill Strategy**:
    - **Static**: Hardcoded values (e.g., "Semester Ganjil").
    - **User**: Input from the teacher (e.g., "Nama Sekolah").
    - **AI**: Only used for creative filler (e.g., "Contoh Apersepsi").

## Constraint
- NEVER let the AI hallucinate the document structure.
- The structure is deterministic and versioned.
