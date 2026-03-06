'use client';

import { useState, useEffect } from 'react';
import { Loader2, Sparkles, X, Check } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { AISuggestResponse } from 'shared-types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AISuggestionModalProps {
    workspaceId: string;
    moduleId: string;
    section: string;
    content: string;
    onClose: () => void;
    onApply: (suggestion: string) => void;
}

export function AISuggestionModal({ workspaceId, moduleId, section, content, onClose, onApply }: AISuggestionModalProps) {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [suggestion, setSuggestion] = useState<string | null>(null);

    useEffect(() => {
        async function getSuggestion() {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspaceId}/modules/${moduleId}/ai-assist`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        section,
                        action: 'improve',
                        content
                    })
                });
                if (!res.ok) throw new Error('AI Assist failed');
                const data: AISuggestResponse = await res.json();
                setSuggestion(data.suggestion);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        getSuggestion();
    }, [workspaceId, moduleId, section, content, getToken]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-purple-50 to-indigo-50">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <h3 className="font-bold text-slate-900">AI Assistant Proposal</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-xl transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
                            <p className="text-slate-500 font-medium italic">Gemini is thinking...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 whitespace-pre-wrap text-slate-800 leading-relaxed font-medium">
                                {suggestion}
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-4">
                                <button onClick={onClose} className="px-6 py-2.5 rounded-xl border-2 border-slate-100 text-slate-600 font-bold hover:bg-slate-50 transition-all">
                                    Tolak
                                </button>
                                <button
                                    onClick={() => suggestion && onApply(suggestion)}
                                    className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> Terima & Terapkan
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
