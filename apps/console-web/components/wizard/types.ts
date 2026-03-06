export type WizardStep = 'mode' | 'inputs' | 'template' | 'generating' | 'done' | 'failed';

export type GenerationMode = 'template' | 'edit_template' | 'from_scratch' | 'wizard';

export interface WizardInputs {
    subject: string;
    grade: number;
    topic: string;
    semester?: string;
}

export type WizardState =
    | { step: 'mode'; mode?: GenerationMode }
    | { step: 'inputs'; mode: GenerationMode; payload: WizardInputs }
    | { step: 'template'; mode: GenerationMode; payload: WizardInputs; selectedTemplateId?: string }
    | { step: 'generating'; jobId: string; moduleId: string; mode: GenerationMode }
    | { step: 'done'; moduleId: string }
    | { step: 'failed'; error: string; canRetry: boolean; lastMode?: GenerationMode };
