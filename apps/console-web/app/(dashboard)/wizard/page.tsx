'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, PlusCircle, LayoutTemplate, Sparkles, BookOpen, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type WizardStep = 'CHOOSE_PATH' | 'FORM' | 'REVIEW';

export default function OnboardingWizardPage() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { user } = useUser();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [currentStep, setCurrentStep] = useState<WizardStep>('CHOOSE_PATH');
    const [isCheckingPrerequisites, setIsCheckingPrerequisites] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Profile & School Summary Context
    const [teacherProfile, setTeacherProfile] = useState<{ full_name: string; } | null>(null);
    const [schoolIdentity, setSchoolIdentity] = useState<{ school_display_name: string; } | null>(null);

    // Draft State
    const [formData, setFormData] = useState({
        mapel: '',
        semester: '1',
        tema: '',
        topik: '',
        catatan: ''
    });

    // 1. Guard & Prerequisites Load
    useEffect(() => {
        let isMounted = true;
        const abortController = new AbortController();

        async function checkPrerequisites() {
            if (!isAuthLoaded || isLoadingWorkspace) return;
            if (!workspace) {
                if (isMounted) setIsCheckingPrerequisites(false);
                return;
            }

            try {
                const token = await getToken();

                // A) Teacher Profile
                const profileRes = await fetch(`${API_BASE}/w/${workspace.id}/profile`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: abortController.signal
                });

                if (profileRes.status === 404) {
                    if (isMounted) router.replace('/profile-setup');
                    return;
                }
                const pData = await profileRes.json();
                if (!isMounted) return;
                setTeacherProfile(pData);

                // B) School Identity
                const schoolRes = await fetch(`${API_BASE}/w/${workspace.id}/school`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: abortController.signal
                });

                if (schoolRes.status === 404) {
                    if (isMounted) router.replace('/workspace/school-setup');
                    return;
                }
                const sData = await schoolRes.json();
                if (!isMounted) return;
                setSchoolIdentity(sData);

                // C) Pre-fill defaults or drafts
                const draft = localStorage.getItem('onboarding_draft');
                if (draft) {
                    setFormData(JSON.parse(draft));
                } else if (pData.primary_subject) {
                    setFormData(prev => ({ ...prev, mapel: pData.primary_subject }));
                }

                setIsCheckingPrerequisites(false);
            } catch (err: unknown) {
                if (!isMounted) return;
                if ((err as Error).name !== 'AbortError') {
                    console.error('Prereq check failed:', err);
                    setIsCheckingPrerequisites(false);
                    setError('Gagal memuat profil. Silakan muat ulang.');
                }
            }
        }

        checkPrerequisites();

        return () => {
            isMounted = false;
            abortController.abort();
        };
    }, [isAuthLoaded, isLoadingWorkspace, workspace, getToken, router]);

    // Update draft on change
    const handleChange = (field: string, val: string) => {
        setFormData(prev => {
            const next = { ...prev, [field]: val };
            localStorage.setItem('onboarding_draft', JSON.stringify(next));
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
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    mode: 'wizard',
                    subject: formData.mapel,
                    grade: 4, // SD Kelas 4 locked v1
                    topic: formData.tema || formData.topik, // Simplified for wizard
                    semester: formData.semester,
                    notes: formData.catatan || undefined,
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || errData.message || 'Gagal memulai proses generasi AI.');
            }

            const data = await res.json();

            // Clean draft
            localStorage.removeItem('onboarding_draft');

            // UX: Go directly to the detail page
            if (data.job_id) {
                router.push(`/modules/${data.job_id}`);
            } else {
                router.push('/modules');
            }
        } catch (err: unknown) {
            setError((err as Error).message);
            setIsSubmitting(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };


    // Loaders
    if (!isAuthLoaded || isLoadingWorkspace || isCheckingPrerequisites) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
                    <span className="text-slate-500 font-medium text-sm">Memverifikasi profil ruang kerja...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 lg:py-12 relative animate-in fade-in duration-500">
            {/* Header Status Bar */}
            <div className="mb-10 flex items-center gap-3 text-xs text-slate-400 justify-center font-bold uppercase tracking-widest">
                <span className={cn("px-4 py-1.5 rounded-full border transition-all", currentStep === 'CHOOSE_PATH' ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200" : "bg-white border-slate-200")}>1. Alur</span>
                <ArrowRight className="w-4 h-4 opacity-20" />
                <span className={cn("px-4 py-1.5 rounded-full border transition-all", currentStep === 'FORM' ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200" : "bg-white border-slate-200")}>2. Target Ajar</span>
                <ArrowRight className="w-4 h-4 opacity-20" />
                <span className={cn("px-4 py-1.5 rounded-full border transition-all", currentStep === 'REVIEW' ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200" : "bg-white border-slate-200")}>3. Review</span>
            </div>

            {/* Main Card Wrap */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 p-8 sm:p-12 relative overflow-hidden">

                {error && (
                    <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-2xl flex items-start text-sm border border-red-100">
                        <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                        <div>{error}</div>
                    </div>
                )}

                {currentStep === 'CHOOSE_PATH' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-12 max-w-2xl mx-auto">
                            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Pilih Cara Mulai</h1>
                            <p className="text-slate-500 text-lg font-medium">Bagaimana Anda ingin membuat perangkat ajar hari ini?</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Option A (Active) */}
                            <button
                                onClick={() => setCurrentStep('FORM')}
                                className="group text-left border-2 border-slate-100 hover:border-emerald-500 rounded-3xl p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-100 hover:-translate-y-2 bg-slate-50/30 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 relative z-10 border border-emerald-50">
                                    <LayoutTemplate className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2 relative z-10">Generate dari Template</h3>
                                <p className="text-slate-500 text-sm leading-relaxed relative z-10 mb-6 font-medium">Otomatis buat menggunakan struktur RPP/Modul standar yang direkomendasikan sistem.</p>
                                <div className="inline-flex items-center text-sm font-bold text-emerald-600">
                                    Pilih Alur <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>

                            {/* Option B */}
                            <div className="text-left border-2 border-slate-100 bg-white rounded-3xl p-8 opacity-50 cursor-not-allowed">
                                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-6">
                                    <PlusCircle className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Edit Template</h3>
                                <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">Mulai dengan template yang sudah ada lalu modifikasi kurikulumnya sesuka hati.</p>
                                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-black uppercase rounded-lg tracking-widest">Coming Soon</span>
                            </div>

                            {/* Option C */}
                            <div className="text-left border-2 border-slate-100 bg-white rounded-3xl p-8 opacity-50 cursor-not-allowed">
                                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-6">
                                    <Sparkles className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Buat dari Nol AI Assist</h3>
                                <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">Diktekan kebutuhan Anda lewat chat dan biarkan AI merangkai semuanya dari nol.</p>
                                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-black uppercase rounded-lg tracking-widest">Coming Soon</span>
                            </div>
                        </div>
                    </div>
                )}


                {currentStep === 'FORM' && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="mb-10">
                            <button onClick={() => setCurrentStep('CHOOSE_PATH')} className="text-xs font-bold text-slate-400 hover:text-slate-900 mb-4 inline-flex items-center transition-colors uppercase tracking-widest">
                                &larr; Kembali
                            </button>
                            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Target Pengajaran</h2>
                            <p className="text-slate-500 font-medium text-lg">Tentukan konteks pembelajaran yang ingin Modulajar ciptakan.</p>
                        </div>

                        <div className="space-y-8">
                            {/* Disabled Constraints v1 */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Jenjang</label>
                                    <div className="px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 flex justify-between items-center cursor-not-allowed">
                                        <span className="font-bold">SD</span>
                                        <span className="text-[9px] font-black bg-slate-200 px-2 py-0.5 rounded text-slate-600 uppercase tracking-tighter">Locked v1</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Kelas</label>
                                    <div className="px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 flex justify-between items-center cursor-not-allowed">
                                        <span className="font-bold">Kelas 4</span>
                                        <span className="text-[9px] font-black bg-slate-200 px-2 py-0.5 rounded text-slate-600 uppercase tracking-tighter">Locked v1</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Mata Pelajaran <span className="text-emerald-500">*</span></label>
                                <select
                                    className="w-full rounded-2xl border-slate-200 px-5 py-4 bg-white focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-bold transition-all shadow-sm"
                                    value={formData.mapel}
                                    onChange={(e) => handleChange('mapel', e.target.value)}
                                >
                                    <option value="" disabled>Pilih Mata Pelajaran</option>
                                    <option value="Matematika">Matematika</option>
                                    <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                                    <option value="Bahasa Inggris">Bahasa Inggris</option>
                                    <option value="IPAS">IPAS (IPA & IPS)</option>
                                    <option value="PPKn">PPKn</option>
                                    <option value="PJOK">PJOK</option>
                                    <option value="Seni Budaya">Seni Budaya (Lainnya)</option>
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Semester <span className="text-emerald-500">*</span></label>
                                <div className="flex gap-4">
                                    <label className={cn("flex-1 cursor-pointer border-2 rounded-2xl p-5 text-center font-bold transition-all shadow-sm", formData.semester === '1' ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-white text-slate-400 hover:border-slate-200")}>
                                        <input type="radio" value="1" checked={formData.semester === '1'} onChange={(e) => handleChange('semester', e.target.value)} className="hidden" />
                                        Ganjil (1)
                                    </label>
                                    <label className={cn("flex-1 cursor-pointer border-2 rounded-2xl p-5 text-center font-bold transition-all shadow-sm", formData.semester === '2' ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-white text-slate-400 hover:border-slate-200")}>
                                        <input type="radio" value="2" checked={formData.semester === '2'} onChange={(e) => handleChange('semester', e.target.value)} className="hidden" />
                                        Genap (2)
                                    </label>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-slate-100">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center px-1">
                                    <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                                    Instruksi Spesifik (Opsional)
                                </h4>

                                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <input type="text" placeholder="Fokus Tema (misal: Pecahan)" value={formData.tema} onChange={(e) => handleChange('tema', e.target.value)} className="w-full rounded-2xl border-slate-200 px-5 py-3.5 text-sm font-medium shadow-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <input type="text" placeholder="Unit Khusus (misal: Unit 2)" value={formData.topik} onChange={(e) => handleChange('topik', e.target.value)} className="w-full rounded-2xl border-slate-200 px-5 py-3.5 text-sm font-medium shadow-sm" />
                                    </div>
                                </div>

                                <textarea
                                    rows={3}
                                    placeholder="Catatan tambahan untuk AI... (misal: Tekankan pada studi kasus visual karena kelas sangat aktif bergerak)"
                                    value={formData.catatan}
                                    onChange={(e) => handleChange('catatan', e.target.value)}
                                    className="w-full rounded-2xl border-slate-200 px-5 py-4 text-sm font-medium resize-none shadow-sm"
                                />
                            </div>

                            <button
                                onClick={() => setCurrentStep('REVIEW')}
                                disabled={!formData.mapel}
                                className="w-full mt-6 bg-slate-900 text-white rounded-[1.25rem] py-5 font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-slate-200 group"
                            >
                                Review Data <ArrowRight className="inline-block w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                )}


                {currentStep === 'REVIEW' && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                        <div className="mb-10">
                            <button onClick={() => setCurrentStep('FORM')} className="text-xs font-bold text-slate-400 hover:text-slate-900 mb-4 inline-flex items-center transition-colors uppercase tracking-widest">
                                &larr; Koreksi Form
                            </button>
                            <h2 className="text-3xl font-black bg-clip-text text-transparent bg-linear-to-r from-emerald-600 to-teal-600 mb-2 tracking-tight">Konfirmasi Generasi</h2>
                            <p className="text-slate-500 font-medium text-lg">AI kami akan menyusun silabus dan alat ajar berdasarkan identitas berikut.</p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-4xl p-8 md:p-10 space-y-8 shadow-inner">

                            <div className="grid grid-cols-2 gap-y-6 text-sm">
                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Guru Pengampu</div>
                                <div className="font-bold text-slate-900 text-right">{teacherProfile?.full_name || user?.fullName || 'Teacher'}</div>

                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Institusi</div>
                                <div className="font-bold text-slate-900 text-right">{schoolIdentity?.school_display_name || 'School'}</div>

                                <div className="col-span-2 my-2 border-b border-slate-200 border-dashed" />

                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Target Kurikulum</div>
                                <div className="text-right"><span className="font-black bg-emerald-600 text-white px-3 py-1 rounded-lg inline-block w-max text-[10px] uppercase tracking-wider">SD Kelas 4</span></div>

                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Mata Pelajaran</div>
                                <div className="font-bold text-slate-900 text-right">{formData.mapel}</div>

                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Semester</div>
                                <div className="font-bold text-slate-900 text-right">{formData.semester === '1' ? 'Ganjil (1)' : 'Genap (2)'}</div>
                            </div>

                            {(formData.tema || formData.topik || formData.catatan) && (
                                <div className="mt-4 pt-6 border-t border-slate-200 border-dashed">
                                    <b className="text-[10px] text-slate-400 uppercase tracking-widest mb-4 block">Instruksi Khusus:</b>
                                    <div className="text-sm space-y-2">
                                        {formData.tema && <div className="font-medium text-slate-700 bg-white p-3 rounded-xl border border-slate-100 flex items-center"><Sparkles className="w-4 h-4 mr-2 text-amber-500" /> Tema: {formData.tema}</div>}
                                        {formData.topik && <div className="font-medium text-slate-700 bg-white p-3 rounded-xl border border-slate-100 flex items-center"><Sparkles className="w-4 h-4 mr-2 text-emerald-500" /> Unit: {formData.topik}</div>}
                                        {formData.catatan && <div className="mt-2 p-5 bg-white border border-slate-100 rounded-2xl text-slate-600 italic leading-relaxed text-[13px] shadow-sm">&quot;{formData.catatan}&quot;</div>}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isSubmitting}
                            className="w-full mt-10 bg-emerald-600 text-white rounded-3xl py-6 font-black text-xl hover:bg-emerald-700 hover:-translate-y-1 shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center animate-bounce-subtle"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                                    Membangun Kurikulum AI...
                                </>
                            ) : (
                                <>
                                    <BookOpen className="w-6 h-6 mr-3" />
                                    Mulai Generate AI Sekarang
                                </>
                            )}
                        </button>
                        <p className="text-center text-[10px] font-bold text-slate-400 mt-6 uppercase tracking-widest">Estimasi waktu pemrosesan: 3 menit</p>
                    </div>
                )}
            </div>
        </div>
    );
}
