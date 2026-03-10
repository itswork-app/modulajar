'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { WizardInputs } from './types';
import { TemplatePreview } from 'shared-types';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

interface TemplatePickerStepProps {
    inputs: WizardInputs;
    onSelect: (templateId: string) => void;
    onBack: () => void;
}

export function TemplatePickerStep({ inputs, onSelect, onBack }: TemplatePickerStepProps) {
    const [templates, setTemplates] = useState<TemplatePreview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTemplates() {
            try {
                const params = new URLSearchParams({
                    subject: inputs.subject,
                    grade: inputs.grade.toString(),
                    topic: inputs.topic
                });

                const res = await fetch(`/api/templates/recommended?${params}`);
                if (!res.ok) throw new Error('Failed to fetch templates');

                const data = await res.json();
                setTemplates(data.templates || []);
            } catch (err: unknown) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError('An unknown error occurred');
                }
            } finally {
                setLoading(false);
            }
        }

        fetchTemplates();
    }, [inputs]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                <p className="text-slate-600 font-medium">Finding the best templates for {inputs.topic}...</p>
            </div>
        );
    }

    if (error || templates.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-slate-600 mb-6">{error || "No templates found for this specific topic."}</p>
                <div className="flex justify-center gap-4">
                    <button onClick={onBack} className="px-6 py-2 rounded-xl border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors">
                        Go Back
                    </button>
                    {/* Fallback to scratch if no template found */}
                    <button onClick={() => onSelect('fallback_scratch')} className="px-6 py-2 rounded-xl bg-emerald-600 font-bold text-white shadow-lg hover:bg-emerald-700 transition-colors">
                        Generate from Scratch
                    </button>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl mx-auto"
        >
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Recommended Templates</h2>
                <p className="text-slate-600">Based on your topic: <span className="font-semibold">{inputs.topic}</span></p>
            </div>

            <div className="grid gap-4 mb-8">
                {templates.map((tpl) => {
                    const isSelected = selectedId === tpl.id;
                    return (
                        <button
                            key={tpl.id}
                            onClick={() => setSelectedId(tpl.id)}
                            className={`flex text-left p-6 rounded-2xl border-2 transition-all duration-200 ${isSelected
                                ? 'bg-emerald-50 border-emerald-500 shadow-md ring-4 ring-emerald-500/10'
                                : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                                }`}
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{tpl.topic}</h3>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg whitespace-nowrap">
                                        Score: {Math.round(tpl.score)}
                                    </span>
                                </div>
                                <div className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                                    <span className="font-semibold text-slate-700">Tujuan:</span> {tpl.preview.tujuan}
                                </div>
                            </div>
                            <div className="ml-4 flex items-center justify-center">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                                    }`}>
                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex justify-between items-center">
                <button
                    onClick={onBack}
                    className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={() => selectedId && onSelect(selectedId)}
                    disabled={!selectedId}
                    className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg ${selectedId
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200/50 cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-70 shadow-none'
                        }`}
                >
                    {selectedId ? 'Use Selected Template' : 'Select a Template Above'} <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}
