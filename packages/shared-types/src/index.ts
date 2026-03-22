export type GenerationMode = 'template' | 'edit_template' | 'from_scratch' | 'wizard';

export interface GenerateModuleRequest {
    workspace_id?: string; // Often inferred via auth, but explicitly typed for completeness
    mode: GenerationMode;
    subject: string;
    grade: number;
    semester?: string;
    topic?: string;
    template_id: string | null;
    layout_template_id?: string;
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

export interface ModuleEditorResponse {
    module_id: string;
    version: number;
    module_json: any;
    html_preview: string;
}

export interface ModulePatchRequest {
    workspace_id?: string;
    patch: any;
}

export interface ModulePatchResponse {
    version: number;
    saved: true;
}

export interface AISuggestRequest {
    workspace_id?: string;
    section: string;
    action: 'improve' | 'shorten' | 'expand';
    content: string;
}

export interface AISuggestResponse {
    suggestion: string;
    ai_receipt: {
        model: string;
        input_hash: string;
        output_hash: string;
    };
}

export interface ModuleVersion {
    version: number;
    created_at: string;
    created_by?: string;
}

export type Jenjang = 'SD' | 'SMP' | 'SMA' | 'SMK';

export interface TeacherProfile {
    full_name: string;
    nip?: string;
    primary_subject?: string;
    primary_grade?: number;
    primary_jenjang?: Jenjang;
}

export interface SchoolIdentity {
    school_display_name?: string;
    school_npsn?: string;
    kab_kota?: string;
    provinsi?: string;
    alamat?: string;
    principal_name?: string;
    principal_nip?: string;
    signature_location?: string;
}
