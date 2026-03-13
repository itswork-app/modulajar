'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, Sparkles, BookOpen, AlertCircle, ArrowRight, School, User, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressStep } from '@/components/wizard/ProgressStep';
import { CreditPanel } from '@/components/wizard/CreditPanel';
import { TeacherProfile, SchoolIdentity } from 'shared-types';

import { JENJANG_OPTIONS, Jenjang, KELAS_OPTIONS, MAPEL_OPTIONS } from '@/lib/constants';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type WizardStep = 'IDENTITAS' | 'TARGET' | 'MATERI' | 'REVIEW' | 'GENERATING';

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

interface UsageSummary {
    credits_remaining: number;
    documents_generated: number;
}

interface Template {
    id: string;
    name: string;
    workspace_id: string | null;
}

const STEPS: { key: WizardStep; label: string }[] = [
    { key: 'IDENTITAS', label: '1. Identitas' },
    { key: 'TARGET', label: '2. Target' },
    { key: 'MATERI', label: '3. Materi' },
    { key: 'REVIEW', label: '4. Review' },
];

export default function WizardV2Page() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { user } = useUser();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [currentStep, setCurrentStep] = useState<WizardStep>('IDENTITAS');
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);

    const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
    const [schoolIdentity, setSchoolIdentity] = useState<SchoolIdentity | null>(null);
    const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);

    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');

    const [formData, setFormData] = useState({
        jenjang: 'SD' as Jenjang,
        kelas: '4',
        mapel: '',
        semester: '1',
        tema: '',
        topik: '',
        catatan: '',
        isCustomTopic: false,
    });

    const [recommendedTopics, setRecommendedTopics] = useState<CurriculumTopic[]>([]);
    const [isLoadingTopics, setIsLoadingTopics] = useState(false);

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

                // Profile
                const profileRes = await fetch(`${API_BASE}/w/${workspace.id}/profile`, opts);
                if (profileRes.status === 404) { if (isMounted) router.replace('/onboarding'); return; }
                const pData: TeacherProfile = await profileRes.json();
                if (!isMounted) return;
                setTeacherProfile(pData);

                // School
                const schoolRes = await fetch(`${API_BASE}/w/${workspace.id}/school`, opts);
                if (schoolRes.status === 404) { if (isMounted) router.replace('/onboarding'); return; }
                const sData: SchoolIdentity = await schoolRes.json();
                if (!isMounted) return;
                setSchoolIdentity(sData);

                // Usage / Credits
                const usageRes = await fetch(`${API_BASE}/w/${workspace.id}/wallet/summary`, opts);
                if (usageRes.ok) {
                    const uData: UsageSummary = await usageRes.json();
                    if (isMounted) setUsageSummary(uData);
                }

                // Templates
                const tplRes = await fetch(`${API_BASE}/w/${workspace.id}/templates?document_type=modul_ajar`, opts);
                if (tplRes.ok) {
                    const tData = await tplRes.json();
                    if (isMounted) setTemplates(tData.templates || []);
                }

                // Pre-fill form from profile or saved draft
                const draft = localStorage.getItem('wizard_draft');
                if (draft) {
                    setFormData(JSON.parse(draft));
                } else if (pData) {
                    const grade = pData.primary_grade ?? 4;
                    const jenjang: Jenjang = pData.primary_jenjang ?? (grade >= 10 ? 'SMA' : grade >= 7 ? 'SMP' : 'SD');

                    setFormData(prev => ({
                        ...prev,
                        jenjang,
                        kelas: grade.toString(),
                        mapel: pData.primary_subject || ''
                    }));
                }

                if (isMounted) setIsLoadingData(false);
            } catch (err: unknown) {
                if (!isMounted) return;
                if ((err as Error).name !== 'AbortError') {
                    console.error('Wizard data load failed:', err);
                    setError('Gagal memuat profil. Silakan muat ulang halaman.');
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
            if (!workspace || !formData.jenjang || !formData.kelas || !formData.mapel || currentStep !== 'MATERI') return;

            setIsLoadingTopics(true);
            try {
                const token = await getToken();
                const params = new URLSearchParams({
                    jenjang: formData.jenjang,
                    kelas: formData.kelas,
                    mapel: formData.mapel,
                    semester: formData.semester
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
    }, [workspace, getToken, formData.jenjang, formData.kelas, formData.mapel, formData.semester, currentStep]);

    const handleChange = (field: string, val: string) => {
        setFormData(prev => {
            const next = { ...prev, [field]: val };
            localStorage.setItem('wizard_draft', JSON.stringify(next));
            return next;
        });
    };

    const handleGenerate = async () => {
        if (!workspace?.id) return;
        setIsSubmitting(true);
        setError(null);

        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/modules/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    mode: 'wizard',
                    subject: formData.mapel,
                    grade: parseInt(formData.kelas, 10),
                    topic: formData.tema || formData.topik,
                    semester: formData.semester,
                    notes: formData.catatan || undefined,
                    template_id: selectedTemplate || undefined,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || errData.message || 'Gagal memulai generasi AI.');
            }

            const data = await res.json();
            if (data.job_id) {
                localStorage.removeItem('wizard_draft');
                setJobId(data.job_id);
                setCurrentStep('GENERATING');
            } else {
                router.push('/modules');
            }
        } catch (err: unknown) {
            setError((err as Error).message);
            setIsSubmitting(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const noCredits = (usageSummary?.credits_remaining ?? 1) <= 0;

    // ── Loading state ────────────────────────────────────────────────────────
    if (!isAuthLoaded || isLoadingWorkspace || isLoadingData) {
        return (
            <div className="flex h-[65vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                    <span className="text-slate-500 font-bold text-sm">Menyiapkan Ruang Kerja...</span>
                </div>
            </div>
        );
    }

    // ── Step indicator ───────────────────────────────────────────────────────
    const stepOrder: WizardStep[] = ['IDENTITAS', 'TARGET', 'MATERI', 'REVIEW'];
    const currentIndex = stepOrder.indexOf(currentStep);

    return (
        <div className="max-w-3xl mx-auto py-8 lg:py-12 animate-in fade-in duration-500">

            {currentStep !== 'GENERATING' && (
                <div className="flex justify-center mb-8">
                    <div className="relative w-full max-w-xs">
                        <select
                            defaultValue="single"
                            onChange={e => {
                                const v = e.target.value;
                                if (v === 'batch') router.push('/wizard/batch');
                                else if (v === 'ai-planner') router.push('/wizard/batch?mode=ai-planner');
                                else if (v === 'bundle') router.push('/wizard/bundle');
                            }}
                            className="w-full appearance-none bg-white border border-slate-200 rounded-3xl px-6 py-4 pr-10 text-sm font-black text-slate-800 shadow-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 cursor-pointer transition-all"
                        >
                            <option value="single">📄 Single Modul</option>
                            <option value="batch">🗂️ Batch Semester</option>
                            <option value="ai-planner">✨ Rencana Semester AI</option>
                            <option value="bundle">🗃️ Administrasi Lengkap</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>
            )}


            {/* Step Breadcrumbs (hidden during generation) */}
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

                {/* Global Error */}
                {error && (
                    <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-2xl flex items-start text-sm border border-red-100 gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>{error}</div>
                    </div>
                )}

                {/* ─────────────────── STEP 1: Identitas ─────────────────── */}
                {currentStep === 'IDENTITAS' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
                        <div className="text-center mb-10">
                            <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Identitas Dokumen</h1>
                            <p className="text-slate-500 font-medium">Verifikasi data guru dan sekolah yang akan tercantum di Modul Ajar.</p>
                        </div>

                        <div className="space-y-4 mb-8">
                            {/* Teacher Card */}
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <User className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identitas Guru</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Nama Lengkap</div>
                                        <div className="font-bold text-slate-800">{teacherProfile?.full_name || user?.fullName || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">NIP</div>
                                        <div className="font-bold text-slate-800">{teacherProfile?.nip || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Mata Pelajaran</div>
                                        <div className="font-bold text-slate-800">{teacherProfile?.primary_subject || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Kelas</div>
                                        <div className="font-bold text-slate-800">{formData.semester && formData.kelas ? <span className="font-bold text-slate-900 text-right">Sem {formData.semester} — Kelas {formData.kelas}</span> : '—'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* School Card */}
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <School className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identitas Sekolah</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="col-span-2">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Nama Sekolah</div>
                                        <div className="font-bold text-slate-800">{schoolIdentity?.school_display_name || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">NPSN</div>
                                        <div className="font-bold text-slate-800">{schoolIdentity?.school_npsn || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Kab/Kota</div>
                                        <div className="font-bold text-slate-800">{schoolIdentity?.kab_kota || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Kepala Sekolah</div>
                                        <div className="font-bold text-slate-800">{schoolIdentity?.principal_name || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Kota Tanda Tangan</div>
                                        <div className="font-bold text-slate-800">{schoolIdentity?.signature_location || '—'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center px-1">
                                <span className="text-[11px] text-slate-400 italic">* Data diambil otomatis dari profil Anda.</span>
                                <button onClick={() => router.push('/onboarding')} className="text-[11px] font-black text-emerald-600 hover:underline uppercase tracking-widest">
                                    Ubah Profil
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => setCurrentStep('TARGET')}
                            className="w-full bg-slate-900 text-white rounded-3xl py-6 font-black text-lg hover:bg-slate-800 transition-all shadow-[0_20px_50px_-12px_rgba(15,23,42,0.15)] hover:-translate-y-1 flex items-center justify-center gap-2 group"
                        >
                            Lanjut ke Target Ajar <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                )}

                {/* ─────────────────── STEP 2: Target Ajar ─────────────────── */}
                {currentStep === 'TARGET' && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="mb-10">
                            <button onClick={() => setCurrentStep('IDENTITAS')} className="text-xs font-bold text-slate-400 hover:text-slate-900 mb-4 inline-flex items-center transition-colors uppercase tracking-widest">
                                &larr; Identitas
                            </button>
                            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Target Pengajaran</h2>
                            <p className="text-slate-500 font-medium text-lg">Sesuaikan jenjang dan mata pelajaran untuk modul ini.</p>
                        </div>

                        <div className="space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Jenjang <span className="text-emerald-500">*</span></label>
                                    <select
                                        className="w-full rounded-2xl border border-slate-200 px-6 py-5 bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-slate-900 font-bold transition-all shadow-sm outline-none"
                                        value={formData.jenjang}
                                        onChange={(e) => {
                                            const newJenjang = e.target.value as Jenjang;
                                            const newKelas = KELAS_OPTIONS[newJenjang]?.[0]?.toString() || '4';
                                            handleChange('jenjang', newJenjang);
                                            handleChange('kelas', newKelas);
                                            handleChange('mapel', ''); // reset mapel
                                        }}
                                    >
                                        {JENJANG_OPTIONS.map(j => (
                                            <option key={j} value={j}>{j}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Fase / Kelas <span className="text-emerald-500">*</span></label>
                                    <select
                                        className="w-full rounded-2xl border border-slate-200 px-6 py-5 bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-slate-900 font-bold transition-all shadow-sm outline-none"
                                        value={formData.kelas}
                                        onChange={(e) => handleChange('kelas', e.target.value)}
                                    >
                                        {KELAS_OPTIONS[formData.jenjang as Jenjang]?.map(k => (
                                            <option key={k} value={k.toString()}>Kelas {k}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1">Mata Pelajaran <span className="text-emerald-500">*</span></label>
                                <select
                                    className="w-full rounded-2xl border border-slate-200 px-6 py-5 bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-slate-900 font-bold transition-all shadow-sm outline-none"
                                    value={formData.mapel}
                                    onChange={(e) => handleChange('mapel', e.target.value)}
                                >
                                    <option value="" disabled>Pilih Mata Pelajaran</option>
                                    {MAPEL_OPTIONS[formData.jenjang as Jenjang]?.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                    {/* Enable rendering custom/old mapel if it's not in the list but stored in draft/profile */}
                                    {formData.mapel && !MAPEL_OPTIONS[formData.jenjang as Jenjang]?.includes(formData.mapel) && (
                                        <option value={formData.mapel}>{formData.mapel}</option>
                                    )}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1">Semester <span className="text-emerald-500">*</span></label>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { val: '1', label: 'Ganjil (1)' },
                                        { val: '2', label: 'Genap (2)' }
                                    ].map(opt => (
                                        <button
                                            key={opt.val}
                                            onClick={() => handleChange('semester', opt.val)}
                                            className={cn(
                                                'py-4 rounded-2xl font-bold border-2 transition-all flex flex-col items-center justify-center gap-1',
                                                formData.semester === opt.val
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-100'
                                                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300 hover:bg-slate-50'
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => setCurrentStep('MATERI')}
                                disabled={!formData.mapel}
                                className="w-full mt-6 bg-slate-900 text-white rounded-3xl py-6 font-black text-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_20px_50px_-12px_rgba(15,23,42,0.15)] hover:-translate-y-1 group flex items-center justify-center gap-2"
                            >
                                {formData.mapel ? 'Lanjut ke Materi' : 'Pilih Mata Pelajaran'} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ─────────────────── STEP 3: Materi & Fokus ─────────────────── */}
                {currentStep === 'MATERI' && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="mb-10">
                            <button onClick={() => setCurrentStep('TARGET')} className="text-xs font-bold text-slate-400 hover:text-slate-900 mb-4 inline-flex items-center transition-colors uppercase tracking-widest">
                                &larr; Target Ajar
                            </button>
                            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Materi & Fokus</h2>
                            <p className="text-slate-500 font-medium text-lg">Tentukan topik utama yang ingin dibahas dalam modul ini.</p>
                        </div>

                        <div className="space-y-8">
                            {/* Kurikulum Merdeka Topic Selector */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between ml-1 mb-2">
                                    <label className="text-sm font-bold text-slate-900">Topik Utama / Materi Pokok <span className="text-emerald-500">*</span></label>
                                </div>

                                {isLoadingTopics ? (
                                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
                                        <span className="text-sm text-slate-500 font-medium">Memuat referensi Kurikulum Merdeka...</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* MODE SWITCHER */}
                                        <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                                            <button
                                                onClick={() => setFormData({ ...formData, isCustomTopic: false, tema: '' })}
                                                className={cn(
                                                    "flex-1 py-2.5 text-sm font-bold rounded-lg transition-all",
                                                    !formData.isCustomTopic
                                                        ? "bg-white text-slate-900 shadow-sm"
                                                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                                )}
                                            >
                                                Topik Rekomendasi
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, isCustomTopic: true, tema: '' })}
                                                className={cn(
                                                    "flex-1 py-2.5 text-sm font-bold rounded-lg transition-all",
                                                    formData.isCustomTopic
                                                        ? "bg-white text-slate-900 shadow-sm"
                                                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                                )}
                                            >
                                                Topik Manual
                                            </button>
                                        </div>

                                        {!formData.isCustomTopic ? (
                                            recommendedTopics.length > 0 ? (
                                                <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2 pb-2">
                                                    {recommendedTopics.map(topic => (
                                                        <button
                                                            key={topic.id}
                                                            onClick={() => handleChange('tema', topic.title)}
                                                            className={cn(
                                                                "text-left p-4 rounded-xl border-2 transition-all flex items-start gap-4 focus:outline-none",
                                                                formData.tema === topic.title
                                                                    ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100"
                                                                    : "border-slate-100 bg-white hover:border-emerald-300 hover:bg-emerald-50/50"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-6 h-6 rounded-full border-2 flex shrink-0 mt-0.5 transition-colors",
                                                                formData.tema === topic.title ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                                                            )}>
                                                                {formData.tema === topic.title && (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className={cn("font-bold text-base mb-1", formData.tema === topic.title ? "text-emerald-900" : "text-slate-800")}>
                                                                    {topic.title}
                                                                </div>
                                                                <div className="text-xs text-slate-500 font-medium inline-flex items-center gap-2">
                                                                    <span className="bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider text-[10px]">Sem {topic.semester}</span>
                                                                    Sesuai Kurikulum Merdeka
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
                                                    <div className="text-slate-600 font-medium">Belum ada data topik rekomendasi untuk Jenjang dan Kelas ini.</div>
                                                    <button
                                                        onClick={() => setFormData({ ...formData, isCustomTopic: true })}
                                                        className="text-emerald-600 font-bold hover:underline"
                                                    >
                                                        Tulis Topik Secara Manual &rarr;
                                                    </button>
                                                </div>
                                            )
                                        ) : (
                                            <input
                                                type="text"
                                                placeholder="Tulis topik secara bebas (Contoh: Sejarah Kemerdekaan Era 90an)"
                                                value={formData.tema}
                                                onChange={(e) => handleChange('tema', e.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 px-6 py-5 font-bold text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm outline-none"
                                                autoFocus
                                            />
                                        )}
                                    </>
                                )}
                            </div>

                            <hr className="border-slate-100" />

                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1">Tujuan Pembelajaran / Fokus Khusus <span className="text-slate-400 font-normal">(opsional)</span></label>
                                <input
                                    type="text"
                                    placeholder="misal: Memahami pembilang dan penyebut"
                                    value={formData.topik}
                                    onChange={(e) => handleChange('topik', e.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 px-6 py-5 font-bold text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm outline-none"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1">Catatan untuk AI <span className="text-slate-400 font-normal">(opsional)</span></label>
                                <textarea
                                    rows={4}
                                    placeholder="misal: Tekankan pada kegiatan berkelompok dengan kartu angka..."
                                    value={formData.catatan}
                                    onChange={(e) => handleChange('catatan', e.target.value)}
                                    className="w-full rounded-3xl border border-slate-200 px-6 py-5 font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm resize-none outline-none"
                                />
                            </div>

                            <button
                                onClick={() => setCurrentStep('REVIEW')}
                                disabled={!formData.tema}
                                className="w-full mt-6 bg-slate-900 text-white rounded-3xl py-6 font-black text-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_20px_50px_-12px_rgba(15,23,42,0.15)] hover:-translate-y-1 group flex items-center justify-center gap-2"
                            >
                                {formData.tema ? 'Review & Generate' : 'Isi Topik Terlebih Dulu'} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ─────────────────── STEP 4: Review & Generate ─────────────────── */}
                {currentStep === 'REVIEW' && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="mb-8 text-center">
                            <h2 className="text-3xl font-black bg-clip-text text-transparent bg-linear-to-r from-emerald-600 to-teal-600 mb-2 tracking-tight">Review Sebelum Generasi</h2>
                            <p className="text-slate-500 font-medium">Pastikan data berikut sudah benar sebelum AI memproses dokumen.</p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-7 space-y-5 shadow-inner mb-8 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                <Sparkles className="w-24 h-24 text-emerald-600" />
                            </div>

                            {/* Identity Summary */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Identitas Dokumen</div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-slate-900">{teacherProfile?.full_name || user?.fullName}</div>
                                        <div className="text-slate-500 text-xs">{schoolIdentity?.school_display_name}</div>
                                    </div>
                                    <div className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                                        Kelas {teacherProfile?.primary_grade ?? 4}
                                    </div>
                                </div>
                            </div>

                            {/* Academic Target */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-3">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Konten & Target</div>
                                {[
                                    { label: 'Mata Pelajaran', value: formData.mapel },
                                    { label: 'Semester', value: formData.semester === '1' ? 'Ganjil (1)' : 'Genap (2)' },
                                    { label: 'Topik Utama', value: formData.tema },
                                    ...(formData.topik ? [{ label: 'Tujuan Pembelajaran', value: formData.topik }] : []),
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-medium">{label}</span>
                                        <span className="font-bold text-slate-900 text-right max-w-[60%]">{value}</span>
                                    </div>
                                ))}
                                {formData.catatan && (
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                        <p className="text-xs text-slate-500 italic leading-relaxed">&ldquo;{formData.catatan}&rdquo;</p>
                                    </div>
                                )}
                            </div>

                            {/* Template Selection */}
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

                            {/* Credit Panel */}
                            <CreditPanel credits={usageSummary?.credits_remaining ?? null} />
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isSubmitting || noCredits}
                            className="w-full bg-emerald-600 text-white rounded-3xl py-6 font-black text-xl hover:bg-emerald-700 hover:-translate-y-1 shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Sedang Memproses...
                                </>
                            ) : (
                                <>
                                    <BookOpen className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                    Generate Modul Sekarang
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => setCurrentStep('MATERI')}
                            className="w-full mt-4 text-slate-400 font-bold text-xs hover:text-slate-600 py-2 uppercase tracking-widest transition-colors"
                        >
                            &larr; Ubah Detail Materi
                        </button>
                        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Estimasi waktu: 1–3 menit</p>
                    </div>
                )}

                {/* ─────────────────── GENERATING ─────────────────── */}
                {currentStep === 'GENERATING' && jobId && workspace && (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                        <ProgressStep
                            jobId={jobId}
                            workspaceId={workspace.id}
                            onDone={(moduleId) => router.push(`/modules/${moduleId}`)}
                            onError={(err) => {
                                setError(err);
                                setCurrentStep('REVIEW');
                                setIsSubmitting(false);
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
