'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, Sparkles, BookOpen, AlertCircle, ArrowRight, Zap, School, User, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressStep } from '@/components/wizard/ProgressStep';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type WizardStep = 'IDENTITAS' | 'TARGET' | 'MATERI' | 'REVIEW' | 'GENERATING';

interface TeacherProfile {
    full_name: string;
    nip?: string;
    primary_subject?: string;
    primary_grade?: number;
}

interface SchoolIdentity {
    school_display_name?: string;
    school_npsn?: string;
    kab_kota?: string;
    provinsi?: string;
    alamat?: string;
    principal_name?: string;
    principal_nip?: string;
    signature_location?: string;
}

interface UsageSummary {
    credits_remaining: number;
    documents_generated: number;
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

    const [formData, setFormData] = useState({
        mapel: '',
        semester: '1',
        tema: '',
        topik: '',
        catatan: '',
    });

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
                const usageRes = await fetch(`${API_BASE}/w/${workspace.id}/usage-summary`, opts);
                if (usageRes.ok) {
                    const uData: UsageSummary = await usageRes.json();
                    if (isMounted) setUsageSummary(uData);
                }

                // Pre-fill form from profile or saved draft
                const draft = localStorage.getItem('wizard_draft');
                if (draft) {
                    setFormData(JSON.parse(draft));
                } else if (pData.primary_subject) {
                    setFormData(prev => ({ ...prev, mapel: pData.primary_subject! }));
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
                    grade: teacherProfile?.primary_grade ?? 4,
                    topic: formData.tema || formData.topik,
                    semester: formData.semester,
                    notes: formData.catatan || undefined,
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
                    <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                    <span className="text-slate-500 font-medium text-sm">Memuat profil ruang kerja...</span>
                </div>
            </div>
        );
    }

    // ── Step indicator ───────────────────────────────────────────────────────
    const stepOrder: WizardStep[] = ['IDENTITAS', 'TARGET', 'MATERI', 'REVIEW'];
    const currentIndex = stepOrder.indexOf(currentStep);

    return (
        <div className="max-w-3xl mx-auto py-8 lg:py-12 animate-in fade-in duration-500">

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
                                        <div className="font-bold text-slate-800">{teacherProfile?.primary_grade ? `Kelas ${teacherProfile.primary_grade}` : '—'}</div>
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
                            className="w-full bg-slate-900 text-white rounded-[1.25rem] py-5 font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2 group"
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
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Jenjang</label>
                                    <div className="px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 flex justify-between items-center cursor-not-allowed">
                                        <span className="font-bold">SD</span>
                                        <span className="text-[9px] font-black bg-slate-200 px-2 py-0.5 rounded text-slate-600 uppercase tracking-tighter">Locked v1</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Fase / Kelas</label>
                                    <div className="px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 flex justify-between items-center cursor-not-allowed">
                                        <span className="font-bold">Fase B (Kelas {teacherProfile?.primary_grade ?? 4})</span>
                                        <span className="text-[9px] font-black bg-emerald-100 px-2 py-0.5 rounded text-emerald-600 uppercase tracking-tighter">Profil</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Mata Pelajaran <span className="text-emerald-500">*</span></label>
                                <select
                                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-bold transition-all shadow-sm"
                                    value={formData.mapel}
                                    onChange={(e) => handleChange('mapel', e.target.value)}
                                >
                                    <option value="" disabled>Pilih Mata Pelajaran</option>
                                    {['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPAS', 'PPKn', 'PJOK', 'Seni Budaya'].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Semester <span className="text-emerald-500">*</span></label>
                                <div className="flex gap-4">
                                    {[['1', 'Ganjil (1)'], ['2', 'Genap (2)']].map(([val, label]) => (
                                        <label key={val} className={cn(
                                            'flex-1 cursor-pointer border-2 rounded-2xl p-5 text-center font-bold transition-all shadow-sm',
                                            formData.semester === val ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                        )}>
                                            <input type="radio" value={val} checked={formData.semester === val} onChange={(e) => handleChange('semester', e.target.value)} className="hidden" />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => setCurrentStep('MATERI')}
                                disabled={!formData.mapel}
                                className="w-full mt-6 bg-slate-900 text-white rounded-[1.25rem] py-5 font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-slate-200 group flex items-center justify-center gap-2"
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

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Topik Utama / Materi Pokok <span className="text-emerald-500">*</span></label>
                                <input
                                    type="text"
                                    placeholder="misal: Pecahan Senilai atau Ekosistem Laut"
                                    value={formData.tema}
                                    onChange={(e) => handleChange('tema', e.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Tujuan Pembelajaran / Fokus Utama <span className="text-slate-300">(opsional)</span></label>
                                <input
                                    type="text"
                                    placeholder="misal: Memahami pembilang dan penyebut"
                                    value={formData.topik}
                                    onChange={(e) => handleChange('topik', e.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 font-medium text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Catatan untuk AI <span className="text-slate-300">(opsional)</span></label>
                                <textarea
                                    rows={4}
                                    placeholder="misal: Tekankan pada kegiatan berkelompok dengan media kartu angka, kelas sangat aktif bergerak..."
                                    value={formData.catatan}
                                    onChange={(e) => handleChange('catatan', e.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm resize-none"
                                />
                            </div>

                            <button
                                onClick={() => setCurrentStep('REVIEW')}
                                disabled={!formData.tema}
                                className="w-full mt-6 bg-slate-900 text-white rounded-[1.25rem] py-5 font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-slate-200 group flex items-center justify-center gap-2"
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

                            {/* Credit Card */}
                            <div className={cn(
                                'rounded-2xl p-5 flex items-center justify-between border transition-all',
                                noCredits
                                    ? 'bg-red-50 border-red-100'
                                    : 'bg-emerald-600 border-emerald-500 shadow-lg shadow-emerald-200'
                            )}>
                                <div className="flex items-center gap-4">
                                    <div className={cn('p-2.5 rounded-xl', noCredits ? 'bg-red-200/50' : 'bg-white/20')}>
                                        <Zap className={cn('w-5 h-5', noCredits ? 'text-red-600' : 'text-white')} />
                                    </div>
                                    <div>
                                        <div className={cn('text-[10px] font-black uppercase tracking-widest', noCredits ? 'text-red-400' : 'text-emerald-100')}>Credit Tersedia</div>
                                        <div className={cn('text-2xl font-black', noCredits ? 'text-red-700' : 'text-white')}>
                                            {usageSummary?.credits_remaining ?? '—'} Token
                                        </div>
                                    </div>
                                </div>
                                {noCredits && (
                                    <button
                                        onClick={() => router.push('/billing')}
                                        className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-red-700 shadow-lg transition-colors"
                                    >
                                        Isi Saldo
                                    </button>
                                )}
                            </div>
                        </div>

                        {noCredits && (
                            <p className="text-center text-xs font-bold text-red-500 uppercase tracking-widest mb-4">
                                Saldo tidak mencukupi. Isi credit untuk melanjutkan generasi.
                            </p>
                        )}

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
