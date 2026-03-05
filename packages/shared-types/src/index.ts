export type GenerationMode = 'template' | 'edit_template' | 'from_scratch';

export interface GenerateModuleRequest {
    workspace_id?: string; // Often inferred via auth, but explicitly typed for completeness
    mode: GenerationMode;
    subject: string;
    grade: number;
    semester?: string;
    topic: string;
    template_id: string | null;
    template_overrides?: Record<string, any>;
}

export interface GenerateModuleResponse {
    job_id: string;
    module_id?: string;
    status: 'pending' | 'queued' | 'running' | 'done' | 'failed';
    pid?: string;
    package_id?: string;
    trace_id?: string;
    idempotent?: boolean;
}

export interface JobStatusResponse {
    job_id: string;
    module_id: string;
    pid: string;
    status: 'queued' | 'running' | 'done' | 'failed';
    progress: { phase: string; pct: number };
    error: string | null;
}

export interface ModuleDetailResponse {
    module_id: string;
    subject: string;
    grade: number;
    topic: string;
    status: 'draft' | 'generating' | 'ready' | 'failed';
    pdf: { download_url: string; sha256: string } | null;
    verify: { public_id: string; url: string } | null;
}

export interface TemplatePreview {
    id: string;
    subject: string;
    grade: number;
    topic: string;
    score: number;
    preview: {
        tujuan: string;
        kegiatan: string;
    };
}

export interface TemplateRecommendedResponse {
    templates: TemplatePreview[];
}
