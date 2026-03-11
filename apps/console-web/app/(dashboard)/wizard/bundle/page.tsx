'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import {
    Loader2, ChevronRight, ChevronLeft, Sparkles, BookOpen,
    AlertCircle, Plus, X, Zap, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { JENJANG_OPTIONS, Jenjang, KELAS_OPTIONS, MAPEL_OPTIONS } from '@/lib/constants';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const ATP_COST = 1;
const PROTA_COST = 1;
const PROMES_COST = 1;
const MODUL_COST = 5;
const SEMESTER_OPTIONS = ['1', '2'];


type BundleStep = 'KONTEKS' | 'TOPIK' | 'ESTIMASI' | 'GENERATE';

interface Template {
    id: string;
    name: string;
    workspace_id: string | null;
}

const STEPS: { key: BundleStep; label: string }[] = [
    { key: 'KONTEKS', label: 'Konteks' },
    { key: 'TOPIK', label: 'Topik' },
    { key: 'ESTIMASI', label: 'Estimasi' },
    { key: 'GENERATE', label: 'Generate' },
];




export default function BundleWizardPage() {
    const router = useRouter();
    const { getToken } = useAuth();
    const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();

    const [step, setStep] = useState<BundleStep>('KONTEKS');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingAI, setIsLoadingAI] = useState(false);

    // Context state
    const [ctx, setCtx] = useState({
        jenjang: 'SD',
        kelas: '4',
        subject: '',
        semester: '1',
        tahun_ajaran: '2024/2025',
        teacher_name: '',
        school_name: '',
    });

    // Topics
    const [topics, setTopics] = useState<string[]>([]);
    const [newTopic, setNewTopic] = useState('');
    const [fokusMateri, setFokusMateri] = useState('');

    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');

    // Pre-fill teacher/school from profile
    useEffect(() => {
        if (!workspace) return;
        async function prefill() {
            try {
                const token = await getToken();
                const [pr, sr, tplRes] = await Promise.all([
                    fetch(`${API_BASE}/w/${workspace!.id}/profile`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE}/w/${workspace!.id}/school`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE}/w/${workspace!.id}/templates?document_type=modul_ajar`, { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                if (pr.ok) {
                    const pd = await pr.json();
                    setCtx(prev => ({
                        ...prev,
                        teacher_name: pd.full_name || prev.teacher_name,
                        subject: pd.primary_subject || prev.subject,
                        kelas: String(pd.primary_grade || prev.kelas),
                    }));
                }
                if (sr.ok) {
                    const sd = await sr.json();
                    setCtx(prev => ({ ...prev, school_name: sd.school_display_name || prev.school_name }));
                }
                if (tplRes.ok) {
                    const tData = await tplRes.json();
                    setTemplates(tData.templates || []);
                }
            } catch { /* silent */ }
        }
        prefill();
    }, [workspace, getToken]);

    const estimatedCost = ATP_COST + PROTA_COST + PROMES_COST + topics.length * MODUL_COST;

    const addTopic = () => {
        const t = newTopic.trim();
        if (t && topics.length < 30) {
            setTopics(prev => [...prev, t]);
            setNewTopic('');
        }
    };

    const removeTopic = (i: number) => setTopics(prev => prev.filter((_, idx) => idx !== i));

    const handleGenerateAIPlan = async () => {
        if (!workspace || !ctx.subject || !ctx.kelas) return;
        setIsLoadingAI(true);
        setError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/curriculum/planner`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    jenjang: ctx.jenjang,
                    kelas: ctx.kelas,
                    mata_pelajaran: ctx.subject,
                    semester: ctx.semester,
                    fokus_materi: fokusMateri || undefined,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                const aiTopics: string[] = (data.topics || data.plan || []).map((t: string | { topic: string }) =>
                    typeof t === 'string' ? t : t.topic
                );
                if (aiTopics.length > 0) setTopics(aiTopics);
            }
        } catch { setError('Gagal generate rencana AI. Coba lagi.'); }
        finally { setIsLoadingAI(false); }
    };

    const handleSubmit = async () => {
        if (!workspace) return;
        setIsGenerating(true);
        setError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/bundle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    subject: ctx.subject,
                    kelas: ctx.kelas,
                    semester: ctx.semester,
                    tahun_ajaran: ctx.tahun_ajaran,
                    topics,
                    teacher_name: ctx.teacher_name,
                    school_name: ctx.school_name,
                    template_ids: selectedTemplate ? { modul_ajar: selectedTemplate } : undefined,
                }),
            });
            if (res.status === 402) {
                const err = await res.json();
                setError(err.message || 'Kredit tidak cukup.');
                setIsGenerating(false);
                return;
            }
            if (!res.ok) throw new Error('Gagal membuat bundle administrasi.');
            const data = await res.json();
            router.push(`/workspace/bundles/${data.bundle_id}`);
        } catch (err: unknown) {
            setError((err as Error).message);
            setIsGenerating(false);
        }
    };

    const stepIdx = STEPS.findIndex(s => s.key === step);

    if (isWorkspaceLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-10 px-4 animate-in fade-in duration-500">

            {/* Header */}
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-600 text-xs font-bold uppercase tracking-widest mb-3">
                    <Sparkles className="w-3 h-3" /> Administrasi Lengkap
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bundle Administrasi Guru</h1>
                <p className="text-slate-500 text-sm mt-1">Generate ATP, Prota, Promes, dan semua Modul Ajar dalam satu workflow.</p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-8">
                {STEPS.map((s, i) => (
                    <div key={s.key} className="flex items-center gap-2 flex-1">
                        <div className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all',
                            i < stepIdx ? 'bg-violet-600 text-white' :
                                i === stepIdx ? 'bg-violet-600 text-white ring-4 ring-violet-100' :
                                    'bg-slate-100 text-slate-400'
                        )}>
                            {i < stepIdx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                        </div>
                        <span className={cn('text-xs font-bold hidden sm:block', i === stepIdx ? 'text-violet-700' : 'text-slate-400')}>
                            {s.label}
                        </span>
                        {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-1" />}
                    </div>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-semibold">{error}</span>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">

                {/* ── KONTEKS ─────────────────────────────────────────── */}
                {step === 'KONTEKS' && (
                    <div className="space-y-5">
                        <h2 className="font-black text-slate-900 text-lg mb-2">Konteks Akademik</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Jenjang</label>
                                <select value={ctx.jenjang} onChange={e => {
                                    const newJenjang = e.target.value as Jenjang;
                                    const newKelas = String(KELAS_OPTIONS[newJenjang]?.[0] ?? '1');
                                    setCtx(p => ({ ...p, jenjang: newJenjang, kelas: newKelas, subject: '' }));
                                }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none">
                                    {JENJANG_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Kelas</label>
                                <select value={ctx.kelas} onChange={e => setCtx(p => ({ ...p, kelas: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none">
                                    {(KELAS_OPTIONS[ctx.jenjang as Jenjang] ?? []).map(k => (
                                        <option key={k} value={String(k)}>Kelas {k}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Mata Pelajaran</label>
                                <select value={ctx.subject} onChange={e => setCtx(p => ({ ...p, subject: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none">
                                    <option value="" disabled>Pilih Mata Pelajaran</option>
                                    {(MAPEL_OPTIONS[ctx.jenjang as Jenjang] ?? []).map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                    {ctx.subject && !(MAPEL_OPTIONS[ctx.jenjang as Jenjang] ?? []).includes(ctx.subject) && (
                                        <option value={ctx.subject}>{ctx.subject}</option>
                                    )}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Semester</label>
                                <select value={ctx.semester} onChange={e => setCtx(p => ({ ...p, semester: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none">
                                    {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Tahun Ajaran</label>
                                <input value={ctx.tahun_ajaran} onChange={e => setCtx(p => ({ ...p, tahun_ajaran: e.target.value }))}
                                    placeholder="2024/2025"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Nama Guru</label>
                                <input value={ctx.teacher_name} onChange={e => setCtx(p => ({ ...p, teacher_name: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Nama Sekolah</label>
                                <input value={ctx.school_name} onChange={e => setCtx(p => ({ ...p, school_name: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none" />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TOPIK ───────────────────────────────────────────── */}
                {step === 'TOPIK' && (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="font-black text-slate-900 text-lg">Rencana Topik</h2>
                            <span className="text-xs font-bold text-slate-400">{topics.length} topik</span>
                        </div>

                        {/* AI planner */}
                        <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                            <p className="text-xs font-bold text-violet-700 mb-2">Fokus Materi (opsional)</p>
                            <input value={fokusMateri} onChange={e => setFokusMateri(e.target.value)}
                                placeholder="mis. Bilangan, Geometri, Statistika..."
                                className="w-full bg-white border border-violet-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-violet-400 outline-none mb-3" />
                            <button
                                onClick={handleGenerateAIPlan}
                                disabled={isLoadingAI || !ctx.subject}
                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-50"
                            >
                                {isLoadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {isLoadingAI ? 'Memuat...' : 'Buat Rencana AI'}
                            </button>
                        </div>

                        {/* Manual topic entry */}
                        <div className="flex gap-2">
                            <input value={newTopic} onChange={e => setNewTopic(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addTopic()}
                                placeholder="Tambah topik manual..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none" />
                            <button onClick={addTopic}
                                className="px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Topic list */}
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {topics.map((t, i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                                    <span className="flex-1 text-sm font-medium text-slate-800">{t}</span>
                                    <button onClick={() => removeTopic(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {topics.length === 0 && (
                                <p className="text-center text-slate-400 text-sm py-4">Belum ada topik. Buat via AI atau tambah manual.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── ESTIMASI ────────────────────────────────────────── */}
                {step === 'ESTIMASI' && (
                    <div className="space-y-6">
                        <h2 className="font-black text-slate-900 text-lg">Konfirmasi Bundle</h2>
                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-3">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Dokumen yang akan dibuat</p>
                            {[
                                { label: 'ATP (Alur Tujuan Pembelajaran)', cost: ATP_COST },
                                { label: 'Prota (Program Tahunan)', cost: PROTA_COST },
                                { label: 'Promes (Program Semester)', cost: PROMES_COST },
                            ].map(d => (
                                <div key={d.label} className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-violet-500" />
                                        <span className="text-sm font-semibold text-slate-700">{d.label}</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-500">{d.cost} kredit</span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-violet-500" />
                                    <span className="text-sm font-semibold text-slate-700">{topics.length} Modul Ajar</span>
                                </div>
                                <span className="text-sm font-bold text-slate-500">{topics.length} × {MODUL_COST} = {topics.length * MODUL_COST} kredit</span>
                            </div>
                        </div>

                        {/* Template Override */}
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-3">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Format & Tata Letak Modul Ajar</div>
                            <select
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                className="w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3"
                            >
                                <option value="">(Otomatis berdasarkan pilihan Default Workspace)</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} {t.workspace_id === null ? '(Standard ModulAjar)' : '(School Template)'}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center justify-between px-5 py-4 bg-violet-50 rounded-xl border border-violet-100">
                            <div className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-violet-600" />
                                <span className="font-black text-slate-900">Total Kredit</span>
                            </div>
                            <span className="text-2xl font-black text-violet-700">{estimatedCost}</span>
                        </div>
                        <p className="text-xs text-slate-400 text-center">Kredit akan dikurangi saat Anda menekan Generate.</p>
                    </div>
                )}

                {/* ── GENERATE ────────────────────────────────────────── */}
                {step === 'GENERATE' && (
                    <div className="flex flex-col items-center gap-6 py-4">
                        <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-violet-500 animate-pulse" />
                        </div>
                        <div className="text-center">
                            <h2 className="font-black text-slate-900 text-lg">Memproses Bundle...</h2>
                            <p className="text-slate-500 text-sm mt-1">Sedang membuat ATP, Prota, Promes, dan {topics.length} Modul Ajar.</p>
                        </div>
                        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                    </div>
                )}
            </div>

            {/* Navigation */}
            {step !== 'GENERATE' && (
                <div className="flex items-center justify-between mt-6">
                    <button
                        onClick={() => {
                            if (step === 'KONTEKS') router.push('/wizard');
                            else setStep(STEPS[stepIdx - 1].key);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {step === 'KONTEKS' ? 'Kembali' : 'Sebelumnya'}
                    </button>

                    {step !== 'ESTIMASI' ? (
                        <button
                            onClick={() => setStep(STEPS[stepIdx + 1].key)}
                            disabled={
                                (step === 'KONTEKS' && (!ctx.subject || !ctx.kelas)) ||
                                (step === 'TOPIK' && topics.length === 0)
                            }
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 transition-colors disabled:opacity-40"
                        >
                            Lanjut <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={() => { setStep('GENERATE'); handleSubmit(); }}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 transition-colors disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Generate Bundle ({estimatedCost} kredit)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
