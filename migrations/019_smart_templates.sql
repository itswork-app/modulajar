-- Migration: 019_smart_templates
-- Description: Adds Smart Template System tables and relates them to generation jobs

-- document_templates: stores layout structure and metadata
CREATE TABLE document_templates (
    id CHAR(26) PRIMARY KEY,
    workspace_id CHAR(26) REFERENCES workspaces(id), -- NULL means it's a global template
    name TEXT NOT NULL,
    description TEXT,
    document_type TEXT NOT NULL, -- e.g., 'atp', 'prota', 'promes', 'modul_ajar'
    template_version INT NOT NULL DEFAULT 1,
    layout_definition JSONB NOT NULL, -- { sections: [{id, enabled, order}], header: "...", footer: "..." }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quickly finding templates belonging to a specific workspace
CREATE INDEX idx_document_templates_workspace ON document_templates(workspace_id);

-- workspace_default_templates: tracks the chosen default template for a workspace per document type
CREATE TABLE workspace_default_templates (
    workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
    document_type TEXT NOT NULL,
    template_id CHAR(26) NOT NULL REFERENCES document_templates(id),
    PRIMARY KEY (workspace_id, document_type)
);

-- Add template_id to generation_jobs to track which template was used for the job
ALTER TABLE generation_jobs 
ADD COLUMN template_id CHAR(26) REFERENCES document_templates(id);
