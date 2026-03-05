'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WizardState, GenerationMode, WizardInputs } from '@/components/wizard/types';
import { CreationModeStep } from '@/components/wizard/CreationModeStep';
import { InputsStep } from '@/components/wizard/InputsStep';
import { TemplatePickerStep } from '@/components/wizard/TemplatePickerStep';
import { ProgressStep } from '@/components/wizard/ProgressStep';
import { useUser } from '@clerk/nextjs';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export default function NewModulePage({ params }: { params: { workspaceId: string } }) {
    const router = useRouter();
    const { user, isLoaded } = useUser();
    const [state, setState] = useState<WizardState>({ step: 'mode' });

    const workspaceId = params.workspaceId;

    const handleModeSelect = (mode: GenerationMode) => {
        setState({ step: 'inputs', mode, payload: { subject: 'Matematika', grade: 4, topic: '' } });
    };

    const handleInputsSubmit = (payload: WizardInputs) => {
        const currentMode = state.step === 'inputs' || state.step === 'template' ? state.mode : 'from_scratch';

        if (currentMode === 'from_scratch') {
            triggerGeneration(currentMode, payload, null);
        } else {
            setState({ step: 'template', mode: currentMode, payload });
        }
    };

    const handleTemplateSelect = (templateId: string) => {
        if (state.step !== 'template') return;

        if (templateId === 'fallback_scratch') {
            triggerGeneration('from_scratch', state.payload, null);
        } else {
            triggerGeneration(state.mode, state.payload, templateId);
        }
    };

    const triggerGeneration = async (mode: GenerationMode, payload: WizardInputs, templateId: string | null) => {
        try {
            // Optimistic UI
            const tempJobId = 'generating-' + Date.now();
            setState({ step: 'generating', jobId: tempJobId, moduleId: '', mode });

            const res = await fetch(`/api/w/${workspaceId}/modules/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    subject: payload.subject,
                    grade: payload.grade,
                    semester: payload.semester || '1',
                    topic: payload.topic,
                    template_id: templateId
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || err.error || 'Failed to start generation job');
            }

            const data = await res.json();
            setState({ step: 'generating', jobId: data.job_id, moduleId: data.module_id, mode });

        } catch (error: any) {
            setState({
                step: 'failed',
                error: error.message,
                canRetry: true,
                lastMode: mode
            });
        }
    };

    const handleDone = (moduleId: string) => {
        setState({ step: 'done', moduleId });
        router.push(`/w/${workspaceId}/modules/${moduleId}`);
    };

    const handleError = (error: string) => {
        setState({ step: 'failed', error, canRetry: true });
    };

    const goBack = () => {
        if (state.step === 'inputs') {
            setState({ step: 'mode' });
        } else if (state.step === 'template') {
            setState({ step: 'inputs', mode: state.mode, payload: state.payload });
        } else if (state.step === 'failed') {
            setState({ step: 'mode' });
        }
    };

    if (!isLoaded) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 py-12 px-6">

            {/* Nav Header */}
            {state.step !== 'generating' && state.step !== 'done' && state.step !== 'mode' && (
                <div className="max-w-4xl mx-auto mb-8">
                    <button onClick={goBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                </div>
            )}

            {/* Stepper Wizard Content */}
            <div className="flex flex-col items-center justify-center">
                {state.step === 'mode' && <CreationModeStep onSelect={handleModeSelect} />}

                {state.step === 'inputs' && (
                    <InputsStep
                        initialInputs={state.payload}
                        onSubmit={handleInputsSubmit}
                        defaultGrade={4} // TODO: hook into teacher profile
                    />
                )}

                {state.step === 'template' && (
                    <TemplatePickerStep
                        inputs={state.payload}
                        onSelect={handleTemplateSelect}
                        onBack={goBack}
                    />
                )}

                {state.step === 'generating' && (
                    <ProgressStep
                        jobId={state.jobId}
                        workspaceId={workspaceId}
                        onDone={handleDone}
                        onError={handleError}
                    />
                )}

                {state.step === 'failed' && (
                    <div className="text-center bg-white p-8 rounded-3xl border border-red-100 shadow-sm max-w-lg mx-auto">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Generation Failed</h2>
                        <p className="text-slate-600 mb-8">{state.error}</p>

                        <div className="flex gap-4 justify-center">
                            <button onClick={goBack} className="px-6 py-3 rounded-xl border border-slate-200 font-bold hover:bg-slate-50">
                                Start Over
                            </button>
                            {state.canRetry && (
                                <button onClick={() => setState({ step: 'mode' })} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700">
                                    Try Again
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
