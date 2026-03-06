'use client';

import { useState, useEffect, useCallback } from 'react';
import { ModuleEditorResponse } from 'shared-types';
import { Loader2, Save, ChevronLeft, Eye } from 'lucide-react';
import Link from 'next/link';
import { SectionNav } from '@/components/editor/SectionNav';
import { SectionEditor } from '@/components/editor/SectionEditor';
import { PreviewPane } from '@/components/editor/PreviewPane';
import { AISuggestionModal } from '@/components/editor/AISuggestionModal';

interface ModuleEditorProps {
    workspaceId: string;
    moduleId: string;
}

export function ModuleEditor({ workspaceId, moduleId }: ModuleEditorProps) {
    const [data, setData] = useState<ModuleEditorResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState('identitas');
    const [showAISuggestion, setShowAISuggestion] = useState(false);
    const [aiRequest, setAIRequest] = useState<{ section: string; content: string } | null>(null);

    const handleSave = useCallback(async () => {
        if (!data || saving) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/w/${workspaceId}/modules/${moduleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patch: data.module_json }),
            });
            if (res.ok) {
                const result = await res.json();
                setData(prev => prev ? { ...prev, version: result.version } : null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    }, [data, saving, workspaceId, moduleId]);

    // Debounced Autosave Logic
    useEffect(() => {
        if (!data || loading) return;

        const timer = setTimeout(() => {
            handleSave();
        }, 800);

        return () => clearTimeout(timer);
    }, [data, handleSave, loading]);

    const fetchEditorData = useCallback(async () => {
        try {
            const res = await fetch(`/api/w/${workspaceId}/modules/${moduleId}/editor`);
            if (!res.ok) throw new Error('Failed to load editor data');
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [workspaceId, moduleId]);

    useEffect(() => {
        fetchEditorData();
    }, [fetchEditorData]);

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
    if (!data) return <div className="h-full flex items-center justify-center text-red-500">Failed to load module.</div>;

    return (
        <div className="flex h-full bg-slate-50">
            {/* Left Sidebar: Navigation */}
            <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                    <Link href={`/modules/${moduleId}`} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <ChevronLeft className="w-4 h-4 text-slate-500" />
                    </Link>
                    <span className="font-bold text-slate-900 truncate flex-1">Editor Modul</span>
                </div>
                <SectionNav
                    activeSection={activeSection}
                    onSelect={setActiveSection}
                />
                <div className="p-4 mt-auto border-t border-slate-100">
                    <button
                        onClick={() => handleSave()}
                        disabled={saving}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all font-mono"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save Now'}
                    </button>
                </div>
            </div>

            {/* Center: Editor Form */}
            <div className="flex-1 overflow-y-auto bg-white shadow-inner">
                <div className="max-w-2xl mx-auto py-12 px-8">
                    <SectionEditor
                        key={activeSection}
                        section={activeSection}
                        content={data.module_json[activeSection] || ''}
                        onUpdate={(newContent: string | Record<string, unknown>) => {
                            setData(prev => prev ? {
                                ...prev,
                                module_json: {
                                    ...prev.module_json,
                                    [activeSection]: newContent
                                }
                            } : null);
                        }}
                        onAI={(content: string) => {
                            setAIRequest({ section: activeSection, content });
                            setShowAISuggestion(true);
                        }}
                    />
                </div>
            </div>

            {/* Right: Live Preview */}
            <div className="w-[450px] border-l border-slate-200 bg-slate-100 overflow-hidden flex flex-col">
                <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-600 uppercase tracking-tighter">
                        <Eye className="w-4 h-4" /> Live Preview
                    </div>
                    <div className="text-xs text-slate-400">v{data.version}</div>
                </div>
                <PreviewPane workspaceId={workspaceId} moduleId={moduleId} version={data.version} />
            </div>

            {showAISuggestion && aiRequest && (
                <AISuggestionModal
                    workspaceId={workspaceId}
                    moduleId={moduleId}
                    section={aiRequest.section}
                    content={aiRequest.content}
                    onClose={() => setShowAISuggestion(false)}
                    onApply={(suggestion: string) => {
                        setData(prev => prev ? {
                            ...prev,
                            module_json: {
                                ...prev.module_json,
                                [aiRequest.section]: suggestion
                            }
                        } : null);
                        setShowAISuggestion(false);
                    }}
                />
            )}
        </div>
    );
}
