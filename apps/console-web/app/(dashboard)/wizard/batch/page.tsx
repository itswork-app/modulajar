'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, Sparkles, BookOpen, AlertCircle, ArrowRight, Layers, ChevronRight, Plus, Trash2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { JENJANG_OPTIONS, Jenjang, KELAS_OPTIONS, MAPEL_OPTIONS } from '@/lib/constants';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type BatchStep = 'KONTEKS' | 'TOPIK' | 'REVIEW' | 'GENERATING';

interface TeacherProfile {
    full_name: string;
    nip?: string;
    primary_subject?: string;
    primary_grade?: number;
}

interface SchoolIdentity {
    school_display_name?: string;
    school_npsn?: string;
}

interface UsageSummary {
    credits_remaining: number;
    documents_generated: number;
}

interface CurriculumTopic {
    id: string;
    jenjang: string;
    kelas: number;
    mata_pelajaran: string;
    semester: number;
    title: string;
    display_order: number;
    cp_reference?: string;
    notes?: string;
}

const STEPS: { key: BatchStep; label: string }[] = [
    { key: 'KONTEKS', label: '1. Konteks' },
    { key: 'TOPIK', label: '2. Daftar Topik' },
    { key: 'REVIEW', label: '3. Review' },
];

export default function BatchWizardPage() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { user } = useUser();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [currentStep, setCurrentStep] = useState<BatchStep>('KONTEKS');
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
    const [schoolIdentity, setSchoolIdentity] = useState<SchoolIdentity | null>(null);
    const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);

    const [contextData, setContextData] = useState({
        jenjang: 'SD' as Jenjang,
        kelas: '4',
        mapel: '',
        semester: '1',
        fokusMateri: '',
    });

    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');

    const [topics, setTopics] = useState<string[]>(['']);
    const [progress, setProgress] = useState({ done: 0, total: 0 });

    // Curriculum Integration
    const [recommendedTopics, setRecommendedTopics] = useState<CurriculumTopic[]>([]);
    const [isLoadingTopics, setIsLoadingTopics] = useState(false);

    // AI Integration
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

    // ── Load profile/school/usage data ──────────────────────────────────────
    useEffect(() => {
        let isMounted = true;
        const ctrl = new AbortController();

        async function loadWizardData() {
            if (!isAuthLoaded || isLoadingWorkspace) return;
            if (!workspace) { setIsLoadingData(false); return; }

            try {
                const token = await getToken();
                const headers = { Authorization: `Bearer ${token}` };
                const opts = { headers, signal: ctrl.signal };

                const [profileRes, schoolRes, usageRes, tplRes] = await Promise.all([
                    fetch(`${API_BASE}/w/${workspace.id}/profile`, opts),
                    fetch(`${API_BASE}/w/${workspace.id}/school`, opts),
                    fetch(`${API_BASE}/w/${workspace.id}/wallet/summary`, opts),
                    fetch(`${API_BASE}/w/${workspace.id}/templates?document_type=modul_ajar`, opts),
                ]);

                if (profileRes.status === 404 || schoolRes.status === 404) {
                    if (isMounted) router.replace('/onboarding');
                    return;
                }

                const [pData, sData] = await Promise.all([
                    profileRes.json(),
                    schoolRes.json()
                ]);

                if (!isMounted) return;
                setTeacherProfile(pData);
                setSchoolIdentity(sData);

                if (usageRes.ok) {
                    const uData: UsageSummary = await usageRes.json();
                    setUsageSummary(uData);
                }

                if (tplRes.ok) {
                    const tData = await tplRes.json();
                    if (isMounted) setTemplates(tData.templates || []);
                }

                if (pData) {
                    const grade = pData.primary_grade ?? 4;
                    let jenjang: Jenjang = 'SD';
                    if (grade >= 10) jenjang = 'SMA';
                    else if (grade >= 7) jenjang = 'SMP';

                    setContextData(prev => ({
                        ...prev,
                        jenjang,
                        kelas: grade.toString(),
                        mapel: pData.primary_subject || ''
                    }));
                }

                setIsLoadingData(false);
            } catch (err: unknown) {
                if (!isMounted) return;
                if ((err as Error).name !== 'AbortError') {
                    console.error('Wizard data load failed:', err);
                    setError('Gagal memuat data. Silakan muat ulang halaman.');
                    setIsLoadingData(false);
                }
            }
        }

        loadWizardData();
        return () => { isMounted = false; ctrl.abort(); };
    }, [isAuthLoaded, isLoadingWorkspace, workspace, getToken, router]);

    // ── Load Recommended Topics ──────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;

        async function fetchTopics() {
            if (!workspace || !contextData.jenjang || !contextData.kelas || !contextData.mapel || currentStep !== 'TOPIK') return;

            setIsLoadingTopics(true);
            try {
                const token = await getToken();
                const params = new URLSearchParams({
                    jenjang: contextData.jenjang,
                    kelas: contextData.kelas,
                    mapel: contextData.mapel,
                    semester: contextData.semester
                });

                const res = await fetch(`${API_BASE}/w/${workspace.id}/curriculum/topics?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) setRecommendedTopics(data.topics || []);
                }
            } catch (err) {
                console.error('Failed to load recommended topics', err);
            } finally {
                if (isMounted) setIsLoadingTopics(false);
            }
        }

        fetchTopics();
        return () => { isMounted = false; };
    }, [workspace, getToken, contextData.jenjang, contextData.kelas, contextData.mapel, contextData.semester, currentStep]);

    const handleGenerateAIPlan = async () => {
        if (!workspace || !contextData.jenjang || !contextData.kelas || !contextData.mapel) return;

        setIsGeneratingPlan(true);
        setCurrentStep('TOPIK');
        setError(null);

        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/curriculum/planner`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    jenjang: contextData.jenjang,
                    kelas: contextData.kelas,
                    mapel: contextData.mapel,
                    semester: contextData.semester,
                    fokus_materi: contextData.fokusMateri
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Server gagal memproses rencana AI.');
            }

            const data = await res.json();
            if (data.plan && data.plan.length > 0) {
                setTopics(data.plan.map((t: CurriculumTopic) => t.title).slice(0, 16));
            } else {
                throw new Error('AI tidak mengembalikan topik yang valid.');
            }
        } catch (err: unknown) {
            console.error('Failed to generate AI plan', err);
            setError((err as Error).message);
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    const handleAddTopic = () => {
        if (topics.length >= 16) return;
        setTopics([...topics, '']);
    };

    const handleRemoveTopic = (index: number) => {
        if (topics.length <= 1) return;
        const newTopics = [...topics];
        newTopics.splice(index, 1);
        setTopics(newTopics);
    };

    const handleTopicChange = (index: number, val: string) => {
        const newTopics = [...topics];
        newTopics[index] = val;
        setTopics(newTopics);
    };

    const handleApplyRecommended = () => {
        if (recommendedTopics.length === 0) return;
        setTopics(recommendedTopics.map(t => t.title).slice(0, 16));
    };

    const validTopics = topics.filter(t => t.trim().length > 0);
    const cost = validTopics.length;
    const credits = usageSummary?.credits_remaining ?? 0;
    const noCredits = usageSummary !== null && credits < cost;

    const handleGenerateBatch = async () => {
        if (!workspace?.id || validTopics.length === 0) return;
        setIsSubmitting(true);
        setError(null);
        setCurrentStep('GENERATING');
        setProgress({ done: 0, total: validTopics.length });

        try {
            const token = await getToken();
            const jobIds: string[] = [];
            const batchId = crypto.randomUUID();

            for (let i = 0; i < validTopics.length; i++) {
                const topic = validTopics[i];
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per call

                const res = await fetch(`${API_BASE}/w/${workspace.id}/modules/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        mode: 'wizard',
                        subject: contextData.mapel,
                        grade: parseInt(contextData.kelas, 10),
                        topic: topic,
                        semester: contextData.semester,
                        template_id: selectedTemplate || undefined,
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (res.status === 402) {
                    // Out of credits mid-batch
                    const errData = await res.json().catch(() => ({}));
                    setError(errData.message || 'Kredit habis di tengah proses batch.');
                    break;
                }

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    console.error('Batch item failed:', errData);
                    // Continue with next, don't break the whole batch
                    continue;
                }

                const data = await res.json();
                if (data.job_id) {
                    jobIds.push(data.job_id);
                    setProgress(prev => ({ ...prev, done: prev.done + 1 }));
                }

                // Small delay to prevent hammering
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            if (jobIds.length > 0) {
                sessionStorage.setItem('modulajar_batch', JSON.stringify({
                    batch_id: batchId,
                    job_ids: jobIds,
                    subject: contextData.mapel,
                    semester: contextData.semester,
                    total: validTopics.length
                }));
            }

            // Redirect to modules list to monitor batch
            router.push('/modules');

        } catch (err: unknown) {
            setError((err as Error).message);
            setIsSubmitting(false);
            setCurrentStep('REVIEW');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // ── Loading state ────────────────────────────────────────────────────────
    if (!isAuthLoaded || isLoadingWorkspace || isLoadingData) {
        return (
            <div className="flex h-[65vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                    <span className="text-slate-500 font-medium text-sm">Memuat sesi batch...</span>
                </div>
            </div>
        );
    }

    const stepOrder: BatchStep[] = ['KONTEKS', 'TOPIK', 'REVIEW'];
    const currentIndex = stepOrder.indexOf(currentStep);

    return (
        <div className="max-w-3xl mx-auto py-8 lg:py-12 animate-in fade-in duration-500">

            {/* Mode Selector */}
            {currentStep !== 'GENERATING' && (
                <div className="flex justify-center mb-8">
                    <div className="bg-slate-100 p-1 rounded-2xl inline-flex shadow-inner border border-slate-200/60">
                        <Link href="/wizard" className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-slate-500 font-medium hover:text-slate-800 hover:bg-slate-200/50 transition-all">
                            <BookOpen className="w-4 h-4" />
                            Single Modul
                        </Link>
                        <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-slate-900 font-bold shadow-sm shadow-slate-200/50 transition-all border border-slate-200/50 cursor-default">
                            <Layers className="w-4 h-4 text-emerald-600" />
                            Batch Semester
                        </button>
                    </div>
                </div>
            )}

            {/* Step Breadcrumbs */}
            {currentStep !== 'GENERATING' && (
                <div className="mb-10 flex items-center gap-2 justify-center">
                    {STEPS.map((s, i) => {
                        const isDone = stepOrder.indexOf(s.key) < currentIndex;
                        const isActive = s.key === currentStep;
                        return (
                            <div key={s.key} className="flex items-center gap-2">
                                <span className={cn(
                                    'px-4 py-1.5 rounded-full border text-xs font-black uppercase tracking-widest transition-all duration-300',
                                    isActive && 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200',
                                    isDone && !isActive && 'bg-emerald-50 text-emerald-600 border-emerald-200',
                                    !isActive && !isDone && 'bg-white border-slate-200 text-slate-400',
                                )}>
                                    {isDone ? '✓ ' : ''}{s.label}
                                </span>
                                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Main Card */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-100/80 p-8 sm:p-12 overflow-hidden">
                {error && (
                    <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-2xl flex items-start text-sm border border-red-100 gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>{error}</div>
                    </div>
                )}

                {/* ── STEP 1: KONTEKS ── */}
                {currentStep === 'KONTEKS' && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="text-center mb-10">
                            <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Konteks Semester</h1>
                            <p className="text-slate-500 font-medium">Informasi ini akan berlaku untuk semua modul dalam batch ini.</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6 flex justify-between items-center">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Identitas (Read Only)</div>
                                <div className="font-bold text-slate-800">{teacherProfile?.full_name || user?.fullName}</div>
                                <div className="text-sm text-slate-500">{schoolIdentity?.school_display_name}</div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-900 ml-1">Jenjang <span className="text-emerald-500">*</span></label>
                                    <select
                                        className="w-full rounded-2xl border border-slate-200 px-5 py-4 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-bold transition-all shadow-sm"
                                        value={contextData.jenjang}
                                        onChange={(e) => {
                                            const newJenjang = e.target.value as Jenjang;
                                            const newKelas = KELAS_OPTIONS[newJenjang][0].toString();
                                            setContextData(prev => ({ ...prev, jenjang: newJenjang, kelas: newKelas, mapel: '' }));
                                        }}
                                    >
                                        {JENJANG_OPTIONS.map(j => (
                                            <option key={j} value={j}>{j}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-900 ml-1">Fase / Kelas <span className="text-emerald-500">*</span></label>
                                    <select
                                        className="w-full rounded-2xl border border-slate-200 px-5 py-4 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-bold transition-all shadow-sm"
                                        value={contextData.kelas}
                                        onChange={(e) => setContextData({ ...contextData, kelas: e.target.value })}
                                    >
                                        {KELAS_OPTIONS[contextData.jenjang as Jenjang]?.map(k => (
                                            <option key={k} value={k.toString()}>Kelas {k}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1">Mata Pelajaran <span className="text-emerald-500">*</span></label>
                                <select
                                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-bold transition-all shadow-sm"
                                    value={contextData.mapel}
                                    onChange={(e) => setContextData({ ...contextData, mapel: e.target.value })}
                                >
                                    <option value="" disabled>Pilih Mata Pelajaran</option>
                                    {MAPEL_OPTIONS[contextData.jenjang as Jenjang]?.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                    {contextData.mapel && !MAPEL_OPTIONS[contextData.jenjang as Jenjang]?.includes(contextData.mapel) && (
                                        <option value={contextData.mapel}>{contextData.mapel}</option>
                                    )}
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1 flex justify-between">
                                    Semester
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { val: '1', label: 'Ganjil (1)' },
                                        { val: '2', label: 'Genap (2)' }
                                    ].map(opt => (
                                        <button
                                            key={opt.val}
                                            onClick={() => setContextData({ ...contextData, semester: opt.val })}
                                            className={cn(
                                                'py-4 rounded-2xl font-bold border-2 transition-all flex flex-col items-center justify-center gap-1',
                                                contextData.semester === opt.val
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-100'
                                                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300 hover:bg-slate-50'
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-100">
                                <label className="text-sm font-bold text-slate-900 ml-1">
                                    Fokus Materi / Konteks Lokal <span className="text-slate-400 font-normal ml-1">(Opsional)</span>
                                </label>
                                <textarea
                                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-medium transition-all shadow-sm min-h-[100px] resize-none"
                                    placeholder="Contoh: Fokus pada pemahaman lingkungan sekitar sekolah, atau sesuaikan dengan gaya belajar visual anak-anak."
                                    value={contextData.fokusMateri}
                                    onChange={(e) => setContextData({ ...contextData, fokusMateri: e.target.value })}
                                />
                                <p className="text-xs text-slate-500 px-2 leading-relaxed">
                                    Beritahu AI jika ada spesifikasi khusus agar rencana semester lebih kontekstual untuk siswa Anda.
                                </p>
                            </div>
                        </div>

                        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => setCurrentStep('TOPIK')}
                                disabled={!contextData.mapel}
                                className="w-full bg-slate-50 text-slate-700 border-2 border-slate-200 rounded-[1.25rem] py-5 font-bold hover:bg-slate-100 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Input Manual Topik
                            </button>
                            <button
                                onClick={handleGenerateAIPlan}
                                disabled={!contextData.mapel || isGeneratingPlan}
                                className="w-full bg-linear-to-r from-emerald-600 to-indigo-600 text-white rounded-[1.25rem] py-5 font-bold hover:from-emerald-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-200 group flex items-center justify-center gap-2"
                            >
                                <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" /> Buat Rencana Semester AI
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: TOPIK ── */}
                {currentStep === 'TOPIK' && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Daftar Topik Utama</h1>
                            <p className="text-slate-500 font-medium">Masukkan topik untuk masing-masing modul. Satu baris mewakili satu modul.</p>
                        </div>

                        {/* AI Content Loading State */}
                        {isGeneratingPlan ? (
                            <div className="bg-white border-2 border-dashed border-indigo-200 rounded-4xl p-12 text-center shadow-lg shadow-indigo-50 flex flex-col items-center justify-center gap-4 animate-in zoom-in-95 duration-500">
                                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-2">
                                    <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">AI Sedang Menyusun Rencana</h3>
                                <p className="text-slate-500 font-medium max-w-sm leading-relaxed">
                                    Menganalisis Kurikulum Merdeka untuk <b>{contextData.mapel}</b> kelas <b>{contextData.kelas}</b> dan menyusun urutan pembelajaran terbaik...
                                </p>
                                <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full w-full animate-progress origin-left" style={{ animationDuration: '3s' }} />
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Kurikulum Merdeka Injection UI */}
                                {isLoadingTopics ? (
                                    <div className="flex bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                                        <span className="text-sm font-medium text-slate-500">Mencari referensi Kurikulum Merdeka...</span>
                                    </div>
                                ) : recommendedTopics.length > 0 ? (
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-6 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
                                                    <Sparkles className="w-4 h-4" />
                                                </div>
                                                <h3 className="font-bold text-emerald-900">Rekomendasi Kurikulum Merdeka</h3>
                                            </div>
                                            <span className="text-xs font-black bg-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md uppercase tracking-widest">{recommendedTopics.length} Topik</span>
                                        </div>
                                        <p className="text-sm text-emerald-700/80 font-medium mb-4">Kami menemukan referensi daftar topik untuk semester ini berdasarkan pilihan kelas dan mata pelajaran.</p>
                                        <button
                                            onClick={handleApplyRecommended}
                                            className="w-full bg-white border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all rounded-xl py-3 font-bold text-emerald-700 shadow-sm"
                                        >
                                            Gunakan Topik Kemdikbud &rarr;
                                        </button>
                                    </div>
                                ) : null}

                                <div className="space-y-3 mb-6">
                                    {topics.map((topic, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-10 h-12 flex items-center justify-center bg-slate-100 text-slate-400 font-black rounded-xl border border-slate-200 shrink-0">
                                                {i + 1}
                                            </div>
                                            <input
                                                type="text"
                                                value={topic}
                                                onChange={(e) => handleTopicChange(i, e.target.value)}
                                                placeholder={`Modul ${i + 1} (Contoh: Rantai Makanan)`}
                                                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-emerald-500 focus:ring-emerald-500 font-medium shadow-sm transition-all"
                                                autoFocus={i === topics.length - 1}
                                            />
                                            <button
                                                onClick={() => handleRemoveTopic(i)}
                                                disabled={topics.length <= 1}
                                                className="w-12 h-12 flex flex-col items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-between items-center mb-10 pt-4 border-t border-slate-100">
                                    <button
                                        onClick={handleAddTopic}
                                        disabled={topics.length >= 16}
                                        className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 disabled:opacity-50 transition-colors bg-indigo-50 px-4 py-2 rounded-xl"
                                    >
                                        <Plus className="w-4 h-4" /> Tambah Topik Baru
                                    </button>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 font-medium">Est Biaya</div>
                                        <div className="font-black text-slate-900 flex items-center gap-1 justify-end">
                                            <Zap className="w-4 h-4 text-emerald-500" /> {topics.filter(t => t.trim().length > 0).length} token
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setCurrentStep('KONTEKS')}
                                        className="w-1/3 bg-slate-100 text-slate-600 rounded-[1.25rem] py-5 font-bold hover:bg-slate-200 transition-all"
                                    >
                                        Kembali
                                    </button>
                                    <button
                                        onClick={() => setCurrentStep('REVIEW')}
                                        disabled={validTopics.length === 0}
                                        className="w-2/3 bg-emerald-600 text-white rounded-[1.25rem] py-5 font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-emerald-200 group flex items-center justify-center gap-2"
                                    >
                                        Review Batch <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── STEP 3: REVIEW ── */}
                {currentStep === 'REVIEW' && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-black bg-clip-text text-transparent bg-linear-to-r from-emerald-600 to-teal-600 mb-2 tracking-tight">Review Batch Generasi</h2>
                            <p className="text-slate-500 font-medium">Sistem akan mengeksekusi {validTopics.length} generasi modul berurutan.</p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-4xl p-7 space-y-5 shadow-inner mb-8">
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-3">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Generasi</div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 font-medium">Mata Pelajaran</span>
                                    <span className="font-bold text-slate-900">{contextData.mapel}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 font-medium">Semester / Kelas</span>
                                    <span className="font-bold text-slate-900 text-right">Sem {contextData.semester} — Kelas {contextData.kelas}</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                                    <span>{validTopics.length} Topik Tersusun</span>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {validTopics.map((t, index) => (
                                        <div key={index} className="flex items-center gap-3 text-sm font-medium pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                                            <span className="text-slate-400 w-5">{index + 1}.</span>
                                            <span className="text-slate-700">{t}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Template Override */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-3">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Format & Tata Letak Template</div>
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

                            <div className={cn(
                                'rounded-2xl p-5 flex items-center justify-between border transition-all',
                                noCredits ? 'bg-red-50 border-red-100' : 'bg-white border-emerald-100'
                            )}>
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Kredit</div>
                                    <div className="flex items-center gap-2">
                                        <Zap className={cn("w-4 h-4", noCredits ? "text-red-500" : "text-emerald-500")} />
                                        <span className="font-bold text-slate-900">
                                            {credits} Teredia <span className="text-slate-400 mx-1">|</span> Butuh {cost}
                                        </span>
                                    </div>
                                </div>
                                {noCredits ? (
                                    <Link href="/billing" className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-red-700 shadow-md">
                                        Isi Saldo
                                    </Link>
                                ) : (
                                    <div className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest">
                                        Cukup
                                    </div>
                                )}
                            </div>
                        </div>

                        {noCredits && (
                            <p className="text-center text-xs font-bold text-red-500 uppercase tracking-widest mb-4">
                                Saldo tidak mencukupi untuk batch ini.
                            </p>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={() => setCurrentStep('TOPIK')}
                                disabled={isSubmitting}
                                className="w-1/3 bg-slate-100 text-slate-600 rounded-3xl py-6 font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleGenerateBatch}
                                disabled={isSubmitting || noCredits || validTopics.length === 0}
                                className="w-2/3 bg-slate-900 text-white rounded-3xl py-6 font-black text-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 group"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        Mulai Batch...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-6 h-6" /> Eksekusi Batch
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── GENERATING ── */}
                {currentStep === 'GENERATING' && (
                    <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center justify-center py-24 text-center">
                        <div className="relative mb-8">
                            <div className="w-24 h-24 rounded-full border-4 border-slate-100 absolute inset-0"></div>
                            <div className="w-24 h-24 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                                <Layers className="w-8 h-8" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Memulai Batch...</h2>
                        <p className="text-slate-500 font-medium max-w-sm mb-6">
                            Mendaftarkan {validTopics.length} antrean ke dalam worker pipeline. Memproses {progress.done} dari {progress.total}...
                        </p>
                        <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${progress.total === 0 ? 0 : (progress.done / progress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
