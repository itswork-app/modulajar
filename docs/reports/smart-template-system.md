# Smart Template System Architecture

## Overview
The Smart Template System allows Modulajar to generate documents that match specific institutional standards, layout structures, and formatting rules. It enables the creation of dynamic, customizable templates that dictate the section ordering, visibility, and custom headers/footers for various document types.

## Architecture & Rendering Pipeline
The system relies on a hybrid generation pipeline that separates AI content generation from the final structural composition.

1. **AI Content Generation (`composer.go` / AI Models):** 
   - The AI generates the content for each functional section of the Modul Ajar or other document type. 
   - Instead of the AI worrying about the exact HTML presentation order or what sections the user wants to hide, it focuses solely on producing high-quality pedagogical content matching specific placeholder tags (e.g., `{{IDENTITAS}}`, `{{ATP}}`, `{{ACTIVITY_SECTIONS}}`).

2. **Template Composition Engine (`worker-go`):**
   - When a job is picked up by the background worker, it retrieves the associated `template_id` (resolved during the API call from user input or fallback defaults).
   - If a template exists, the worker fetches its `layout_definition`.
   - The Go HTML renderer (`core-go/render/composer.go`) dynamically iterates through the `layout_definition.sections` array.
   - For each section marked `enabled: true`, the engine retrieves the corresponding HTML snippet, injects the AI-generated content into its placeholders, and appends it to a unified `{{ALL_SECTIONS}}` stream.
   - Custom headers injected via `layout_definition.custom_header_html` will override the standard `KopSurat`.

## JSON Structure Format (`LayoutDefinition`)
The core behavior of a template is driven by its `LayoutDefinition`:

```typescript
interface LayoutDefinition {
  sections: Array<{
    id: string;          // e.g., 'identitas', 'atp', 'kegiatan', 'asesmen'
    label: string;       // Human-readable label
    enabled: boolean;    // Whether this section is rendered
    order: number;       // Display order
    settings?: Record<string, any>;
  }>;
  custom_header_html?: string;
  custom_footer_html?: string;
}
```

## Versioning Resilience & Resolution
- **Resolution Hierarchy:** When a user requests a module generation, the API resolves the template using a cascading hierarchy:
  1. `template_id` passed directly from the Wizard.
  2. Workspace Default Template mapping (`workspace_default_templates` for `document_type = 'modul_ajar'`).
  3. No template (falls back to hardcoded default renderer behavior).
- **Immutability Principle:** When a document generation job is queued, the resolved `template_id` is permanently attached to the `generation_jobs.metadata`. In future iterations, to increase point-in-time resilience, the exact snapshot of the `layout_definition` at the time of queueing could be stored in `metadata` to prevent changes in the template from affecting pending jobs.

## Permissions & Scope
- **Global Templates:** Templates with `workspace_id IS NULL` serve as platform-wide defaults. They can only be managed by system administrators.
- **Workspace Templates:** Templates mapped to a specific `workspace_id`. Workspace Admins can create, edit, and designate these as default templates for their organization, ensuring consistent branding across all generated documents within that workspace.
