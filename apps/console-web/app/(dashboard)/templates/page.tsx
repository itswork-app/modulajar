'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import {
    Loader2, LayoutTemplate, Plus,
    CheckCircle2, AlertCircle, Edit, Type,
    GripVertical, Eye, EyeOff, Save, X, Star, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// ─── Types ───────────────────────────────────────────────────────────────────

interface TemplateSection {
    id: string;
    enabled: boolean;
}

interface LayoutDefinition {
    sections: TemplateSection[];
    header?: string;
    footer?: string;
}

interface DocumentTemplate {
    id: string;
    workspace_id: string | null;
    name: string;
    description: string | null;
    document_type: string;
    template_version: number;
    layout_definition: LayoutDefinition;
    created_at: string;
    updated_at: string;
}

interface DefaultTemplateMap {
    document_type: string;
    template_id: string;
}

type Toast = { type: 'success' | 'error'; message: string } | null;

const DEFAULT_SECTIONS = [
    { id: 'identitas', label: 'Identitas Modul' },
    { id: 'atp', label: 'Alur Tujuan Pembelajaran' },
    { id: 'kegiatan', label: 'Kegiatan Pembelajaran' },
    { id: 'asesmen', label: 'Asesmen' },
];

const DOC_TYPES = [
    { value: 'modul_ajar', label: 'Modul Ajar' },
    { value: 'atp', label: 'ATP' },
    { value: 'prota', label: 'Prota' },
    { value: 'promes', label: 'Promes' }
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
    const { getToken } = useAuth();
    const { workspace, isLoading: wsLoading } = useWorkspace();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [toast, setToast] = useState<Toast>(null);

    const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
    const [defaults, setDefaults] = useState<DefaultTemplateMap[]>([]);
    const [docTypeFilter, setDocTypeFilter] = useState('modul_ajar');

    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Partial<DocumentTemplate> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const fetchData = useCallback(async () => {
        if (!workspace?.id) return;
        try {
            const token = await getToken();
            const [tplRes, defRes] = await Promise.all([
                fetch(`${API_BASE}/w/${workspace.id}/templates?document_type=${docTypeFilter}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${API_BASE}/w/${workspace.id}/templates/default`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (tplRes.ok) {
                const json = await tplRes.json();
                setTemplates(json.templates || []);
            }
            if (defRes.ok) {
                const json = await defRes.json();
                setDefaults(json.defaults || []);
            }
        } catch (error) {
            console.error('Failed to fetch templates:', error);
            setToast({ type: 'error', message: 'Gagal memuat template.' });
        } finally {
            setIsLoadingData(false);
        }
    }, [workspace?.id, getToken, docTypeFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSetDefault = async (templateId: string, docType: string) => {
        if (!workspace?.id) return;
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/templates/default`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ document_type: docType, template_id: templateId })
            });

            if (res.ok) {
                setToast({ type: 'success', message: 'Template default berhasil diatur.' });
                fetchData();
            } else {
                const err = await res.json();
                setToast({ type: 'error', message: err.error || 'Gagal mengatur default.' });
            }
        } catch {
            setToast({ type: 'error', message: 'Terjadi kesalahan sistem.' });
        }
    };

    const handleOpenEditor = (tpl?: DocumentTemplate) => {
        if (tpl) {
            setEditingTemplate(JSON.parse(JSON.stringify(tpl)));
        } else {
            setEditingTemplate({
                name: '',
                description: '',
                document_type: docTypeFilter,
                layout_definition: {
                    sections: DEFAULT_SECTIONS.map(s => ({ id: s.id, enabled: true })),
                    header: ''
                }
            });
        }
        setIsEditorOpen(true);
    };

    const handleSaveTemplate = async () => {
        if (!workspace?.id || !editingTemplate) return;

        // Basic validation
        if (!editingTemplate.name || !editingTemplate.document_type) {
            setToast({ type: 'error', message: 'Nama dan Tipe Dokumen harus diisi.' });
            return;
        }

        setIsSaving(true);
        try {
            const token = await getToken();
            const isUpdate = !!editingTemplate.id;
            const url = isUpdate
                ? `${API_BASE}/w/${workspace.id}/templates/${editingTemplate.id}`
                : `${API_BASE}/w/${workspace.id}/templates`;

            const res = await fetch(url, {
                method: isUpdate ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: editingTemplate.name,
                    description: editingTemplate.description,
                    document_type: editingTemplate.document_type,
                    layout_definition: editingTemplate.layout_definition
                })
            });

            if (res.ok) {
                setToast({ type: 'success', message: 'Template berhasil disimpan.' });
                setIsEditorOpen(false);
                fetchData();
            } else {
                const err = await res.json();
                setToast({ type: 'error', message: err.error || 'Gagal menyimpan template.' });
            }
        } catch {
            setToast({ type: 'error', message: 'Terjadi kesalahan sistem.' });
        } finally {
            setIsSaving(false);
        }
    };

    const moveSection = (index: number, direction: 'up' | 'down') => {
        if (!editingTemplate?.layout_definition?.sections) return;
        const newSections = [...editingTemplate.layout_definition.sections];
        if (direction === 'up' && index > 0) {
            [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
        } else if (direction === 'down' && index < newSections.length - 1) {
            [newSections[index + 1], newSections[index]] = [newSections[index], newSections[index + 1]];
        }
        setEditingTemplate(prev => ({
            ...prev!,
            layout_definition: { ...prev!.layout_definition!, sections: newSections }
        }));
    };

    const toggleSection = (index: number) => {
        if (!editingTemplate?.layout_definition?.sections) return;
        const newSections = [...editingTemplate.layout_definition.sections];
        newSections[index].enabled = !newSections[index].enabled;
        setEditingTemplate(prev => ({
            ...prev!,
            layout_definition: { ...prev!.layout_definition!, sections: newSections }
        }));
    };

    if (wsLoading || isLoadingData) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="mt-4 text-emerald-700/60 font-medium text-sm">Memuat data...</p>
            </div>
        );
    }

    const defaultTplId = defaults.find(d => d.document_type === docTypeFilter)?.template_id;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 relative">

            {toast && (
                <div className={cn(
                    "fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border animate-in slide-in-from-top-2",
                    toast.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"
                )}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <p className="text-sm font-semibold">{toast.message}</p>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Smart Templates</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Kelola format tata letak dokumen yang dihasilkan.</p>
                </div>
                <button
                    onClick={() => handleOpenEditor()}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    Buat Template
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex p-1 bg-slate-100/50 rounded-2xl border border-slate-200/60 w-fit">
                {DOC_TYPES.map(dt => (
                    <button
                        key={dt.value}
                        onClick={() => setDocTypeFilter(dt.value)}
                        className={cn(
                            "px-5 py-2 text-sm font-bold rounded-xl transition-all",
                            docTypeFilter === dt.value
                                ? "bg-white text-emerald-700 shadow-sm border border-slate-200/50"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                        )}
                    >
                        {dt.label}
                    </button>
                ))}
            </div>

            {/* Template List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest w-5/12">Template</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest w-3/12">Status</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {templates.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">
                                    Belum ada template untuk {DOC_TYPES.find(d => d.value === docTypeFilter)?.label}.
                                </td>
                            </tr>
                        ) : (
                            templates.map((tpl) => {
                                const isGlobal = tpl.workspace_id === null;
                                const isDefault = defaultTplId === tpl.id;

                                return (
                                    <tr key={tpl.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-start gap-4">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                                    isGlobal ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                                                )}>
                                                    <LayoutTemplate className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                                        {tpl.name}
                                                        {isGlobal && (
                                                            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] uppercase font-black">Global</span>
                                                        )}
                                                    </h3>
                                                    <p className="text-sm text-slate-500 line-clamp-1">{tpl.description || 'Tidak ada deskripsi'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isDefault ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200/50">
                                                    <Star className="w-3.5 h-3.5 fill-current" />
                                                    Default Workspace
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold text-slate-400">Alternatif</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!isDefault && (
                                                    <button
                                                        onClick={() => handleSetDefault(tpl.id, tpl.document_type)}
                                                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    >
                                                        Jadikan Default
                                                    </button>
                                                )}
                                                {!isGlobal && (
                                                    <button
                                                        onClick={() => handleOpenEditor(tpl)}
                                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Template Editor Modal */}
            {isEditorOpen && editingTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">
                                    {editingTemplate.id ? 'Edit Template' : 'Buat Template Baru'}
                                </h2>
                                <p className="text-xs font-medium text-slate-500 mt-0.5">Atur struktur dan teks tambahan untuk dokumen.</p>
                            </div>
                            <button onClick={() => setIsEditorOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-emerald-500" />
                                    Informasi Dasar
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-600">Nama Template</label>
                                        <input
                                            type="text"
                                            value={editingTemplate.name || ''}
                                            onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                            className="w-full text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="Contoh: Modul Ajar Standar"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-600">Tipe Dokumen</label>
                                        <select
                                            value={editingTemplate.document_type}
                                            disabled={!!editingTemplate.id}
                                            onChange={e => setEditingTemplate({ ...editingTemplate, document_type: e.target.value })}
                                            className="w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 disabled:opacity-50"
                                        >
                                            {DOC_TYPES.map(dt => (
                                                <option key={dt.value} value={dt.value}>{dt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-xs font-bold text-slate-600">Deskripsi (Opsional)</label>
                                        <input
                                            type="text"
                                            value={editingTemplate.description || ''}
                                            onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                                            className="w-full text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="Penjelasan singkat kegunaan template ini"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section Organizer */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <LayoutTemplate className="w-4 h-4 text-emerald-500" />
                                    Struktur Dokumen
                                </h3>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                                    {editingTemplate.layout_definition?.sections?.map((sec, idx) => {
                                        const secInfo = DEFAULT_SECTIONS.find(s => s.id === sec.id);
                                        return (
                                            <div key={sec.id} className={cn(
                                                "flex items-center gap-3 p-3 bg-white border rounded-xl shadow-sm transition-opacity",
                                                !sec.enabled && "opacity-60"
                                            )}>
                                                <div className="flex flex-col gap-0.5">
                                                    <button onClick={() => moveSection(idx, 'up')} disabled={idx === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><GripVertical className="w-4 h-4 rotate-90" /></button>
                                                    <button onClick={() => moveSection(idx, 'down')} disabled={idx === editingTemplate.layout_definition!.sections.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><GripVertical className="w-4 h-4 rotate-90" /></button>
                                                </div>
                                                <div className="flex-1 font-bold text-slate-800 text-sm">
                                                    {secInfo?.label || sec.id}
                                                </div>
                                                <button
                                                    onClick={() => toggleSection(idx)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors",
                                                        sec.enabled ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                                    )}
                                                >
                                                    {sec.enabled ? <><Eye className="w-3.5 h-3.5" /> Ditampilkan</> : <><EyeOff className="w-3.5 h-3.5" /> Disembunyikan</>}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom HTML Injection */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <Type className="w-4 h-4 text-emerald-500" />
                                    Kustomisasi Lanjutan
                                </h3>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-600 flex justify-between">
                                        <span>HTML Header (Kop Surat Custom)</span>
                                        <span className="text-slate-400 font-medium">Opsional</span>
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={editingTemplate.layout_definition?.header || ''}
                                        onChange={e => setEditingTemplate(prev => ({
                                            ...prev!,
                                            layout_definition: { ...prev!.layout_definition!, header: e.target.value }
                                        }))}
                                        className="w-full text-xs font-mono text-slate-700 bg-slate-900/5 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="<div style='text-align: center'>...</div>"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Jika diisi, HTML ini akan menggantikan Kop Surat standar bawaan workspace.</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsEditorOpen(false)}
                                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSaveTemplate}
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Simpan Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
