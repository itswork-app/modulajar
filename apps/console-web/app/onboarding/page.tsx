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
        async function checkPrerequisites() {
            if (!isAuthLoaded || isLoadingWorkspace) return;
            if (!workspace) {
                setIsCheckingPrerequisites(false);
                return;
            }

            try {
                const token = await getToken();

                // A) Teacher Profile
                const profileRes = await fetch(`${API_BASE}/w/${workspace.id}/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (profileRes.status === 404) {
                    router.replace('/profile-setup');
                    return;
                }
                const pData = await profileRes.json();
                setTeacherProfile(pData);

                // B) School Identity
                const schoolRes = await fetch(`${API_BASE}/w/${workspace.id}/school`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (schoolRes.status === 404) {
                    router.replace('/workspace/school-setup');
                    return;
                }
                const sData = await schoolRes.json();
                setSchoolIdentity(sData);

                // C) Pre-fill defaults or drafts
                const draft = localStorage.getItem('onboarding_draft');
                if (draft) {
                    setFormData(JSON.parse(draft));
                } else if (pData.primary_subject) {
                    setFormData(prev => ({ ...prev, mapel: pData.primary_subject }));
                }

                setIsCheckingPrerequisites(false);
            } catch (err) {
                console.error('Prereq check failed:', err);
                setIsCheckingPrerequisites(false);
                setError('Gagal memuat profil. Silakan muat ulang.');
            }
        }

        checkPrerequisites();
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
            const res = await fetch(`${API_BASE}/w/${workspace.id}/internal/generate-semester`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    jenjang: 'SD',
                    kelas: '4', // Locked v1
                    subject: formData.mapel,
                    semester: formData.semester,
                    tema: formData.tema || undefined,
                    topik: formData.topik || undefined,
                    teacher_notes: formData.catatan || undefined,
                }) // Existing schema mapped softly for now
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Gagal memulai proses generasi AI.');
            }

            // Clean draft
            localStorage.removeItem('onboarding_draft');
            router.push('/jobs');
        } catch (err: unknown) {
            setError((err as Error).message);
            setIsSubmitting(false);
        }
    };


    // Loaders
    if (!isAuthLoaded || isLoadingWorkspace || isCheckingPrerequisites) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                    <span className="text-slate-500 font-medium">Memverifikasi profil ruang kerja...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden font-sans">
            <div className="max-w-4xl mx-auto px-4 py-12 lg:py-20 relative">

                {/* Header Status Bar (Optional) */}
                <div className="mb-8 flex items-center gap-3 text-sm text-slate-500 justify-center font-medium">
                    <span className={cn("px-3 py-1 rounded-full", currentStep === 'CHOOSE_PATH' ? "bg-blue-100 text-blue-700 font-bold" : "bg-white")}>1. Alur</span>
                    <ArrowRight className="w-4 h-4 opacity-40" />
                    <span className={cn("px-3 py-1 rounded-full", currentStep === 'FORM' ? "bg-blue-100 text-blue-700 font-bold" : "bg-white")}>2. Target Ajar</span>
                    <ArrowRight className="w-4 h-4 opacity-40" />
                    <span className={cn("px-3 py-1 rounded-full", currentStep === 'REVIEW' ? "bg-blue-100 text-blue-700 font-bold" : "bg-white")}>3. Review</span>
                </div>

                {/* Main Card Wrap */}
                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 sm:p-12 relative overflow-hidden">

                    {error && (
                        <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-xl flex items-start text-sm border border-red-100">
                            <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                            <div>{error}</div>
                        </div>
                    )}

                    {currentStep === 'CHOOSE_PATH' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-10 max-w-2xl mx-auto">
                                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 mb-4">Pilih Cara Mulai</h1>
                                <p className="text-slate-500 text-lg">Bagaimana Anda ingin membuat perangkat ajar hari ini?</p>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6">
                                {/* Option A (Active) */}
                                <button
                                    onClick={() => setCurrentStep('FORM')}
                                    className="group text-left border-2 border-slate-200 hover:border-blue-500 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100 hover:-translate-y-1 bg-white relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-5 relative z-10">
                                        <LayoutTemplate className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2 relative z-10">Generate dari Template</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed relative z-10 mb-4">Otomatis buat menggunakan struktur RPP/Modul standar yang direkomendasikan sistem.</p>
                                    <div className="inline-flex items-center text-sm font-semibold text-blue-600">
                                        Pilih Alur <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>

                                {/* Option B */}
                                <div className="text-left border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-6 opacity-70 cursor-not-allowed">
                                    <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center text-slate-500 mb-5">
                                        <PlusCircle className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Edit Template</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-4">Mulai dengan template yang sudah ada lalu modifikasi kurikulumnya sesuka hati.</p>
                                    <span className="inline-block px-3 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-full">Coming Soon</span>
                                </div>

                                {/* Option C */}
                                <div className="text-left border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-6 opacity-70 cursor-not-allowed">
                                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-500 mb-5">
                                        <Sparkles className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Buat dari Nol AI Assist</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-4">Diktekan kebutuhan Anda lewat chat dan biarkan AI merangkai semuanya dari nol.</p>
                                    <span className="inline-block px-3 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-full">Coming Soon</span>
                                </div>
                            </div>
                        </div>
                    )}


                    {currentStep === 'FORM' && (
                        <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                            <div className="mb-8">
                                <button onClick={() => setCurrentStep('CHOOSE_PATH')} className="text-sm font-semibold text-slate-400 hover:text-slate-700 mb-4 inline-block">&larr; Kembali</button>
                                <h2 className="text-3xl font-bold text-slate-900 mb-2">Target Pengajaran</h2>
                                <p className="text-slate-500">Tentukan konteks pembelajaran yang ingin Modulajar ciptakan.</p>
                            </div>

                            <div className="space-y-6">
                                {/* Disabled Constraints v1 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Jenjang</label>
                                        <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 flex justify-between items-center cursor-not-allowed">
                                            <span>Sekolah Dasar (SD)</span>
                                            <span className="text-[10px] font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-600">LOCKED v1</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Kelas</label>
                                        <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 flex justify-between items-center cursor-not-allowed">
                                            <span>Kelas 4</span>
                                            <span className="text-[10px] font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-600">LOCKED v1</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Mata Pelajaran <span className="text-red-500">*</span></label>
                                    <select
                                        className="w-full rounded-xl border-slate-200 px-4 py-3 bg-white focus:ring-blue-500 focus:border-blue-500 text-slate-900"
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

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Semester <span className="text-red-500">*</span></label>
                                    <div className="flex gap-4">
                                        <label className={cn("flex-1 cursor-pointer border-2 rounded-xl p-4 text-center font-bold transition-all", formData.semester === '1' ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                                            <input type="radio" value="1" checked={formData.semester === '1'} onChange={(e) => handleChange('semester', e.target.value)} className="hidden" />
                                            Ganjil (1)
                                        </label>
                                        <label className={cn("flex-1 cursor-pointer border-2 rounded-xl p-4 text-center font-bold transition-all", formData.semester === '2' ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                                            <input type="radio" value="2" checked={formData.semester === '2'} onChange={(e) => handleChange('semester', e.target.value)} className="hidden" />
                                            Genap (2)
                                        </label>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center">
                                        <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
                                        Instruksi Spesifik (Opsional)
                                    </h4>

                                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-2">
                                            <input type="text" placeholder="Fokus Tema (misal: Pecahan)" value={formData.tema} onChange={(e) => handleChange('tema', e.target.value)} className="w-full rounded-xl border-slate-200 px-4 py-2.5 text-sm" />
                                        </div>
                                        <div className="space-y-2">
                                            <input type="text" placeholder="Unit Khusus (misal: Unit 2)" value={formData.topik} onChange={(e) => handleChange('topik', e.target.value)} className="w-full rounded-xl border-slate-200 px-4 py-2.5 text-sm" />
                                        </div>
                                    </div>

                                    <textarea
                                        rows={3}
                                        placeholder="Catatan tambahan untuk AI... (misal: Tekankan pada studi kasus visual karena kelas sangat aktif bergerak)"
                                        value={formData.catatan}
                                        onChange={(e) => handleChange('catatan', e.target.value)}
                                        className="w-full rounded-xl border-slate-200 px-4 py-3 text-sm resize-none"
                                    />
                                </div>

                                <button
                                    onClick={() => setCurrentStep('REVIEW')}
                                    disabled={!formData.mapel}
                                    className="w-full mt-6 bg-slate-900 text-white rounded-xl py-4 font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Review Data &rarr;
                                </button>
                            </div>
                        </div>
                    )}


                    {currentStep === 'REVIEW' && (
                        <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto">
                            <div className="mb-8">
                                <button onClick={() => setCurrentStep('FORM')} className="text-sm font-semibold text-slate-400 hover:text-slate-700 mb-4 inline-block">&larr; Koreksi Form</button>
                                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600 mb-2">Konfirmasi Generasi</h2>
                                <p className="text-slate-500">AI kami akan menyusun silabus dan alat ajar berdasarkan identitas berikut.</p>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 md:p-8 space-y-6">

                                <div className="grid grid-cols-2 gap-y-4 text-sm">
                                    <div className="text-slate-500">Guru Pengampu</div>
                                    <div className="font-bold text-slate-900">{teacherProfile?.full_name || user?.fullName || 'Teacher'}</div>

                                    <div className="text-slate-500">Institusi</div>
                                    <div className="font-bold text-slate-900">{schoolIdentity?.school_display_name || 'School'}</div>

                                    <div className="col-span-2 my-2 border-b border-slate-200 border-dashed" />

                                    <div className="text-slate-500">Target Kurikulum</div>
                                    <div className="font-bold text-slate-900 bg-blue-100 text-blue-700 px-2 py-0.5 rounded inline-block w-max">SD Kelas 4</div>

                                    <div className="text-slate-500">Mata Pelajaran</div>
                                    <div className="font-bold text-slate-900">{formData.mapel}</div>

                                    <div className="text-slate-500">Semester</div>
                                    <div className="font-bold text-slate-900">{formData.semester === '1' ? 'Ganjil (1)' : 'Genap (2)'}</div>
                                </div>

                                {(formData.tema || formData.topik || formData.catatan) && (
                                    <div className="mt-4 pt-4 border-t border-slate-200 border-dashed">
                                        <b className="text-xs text-slate-400 uppercase tracking-widest mb-2 block">Instruksi Khusus:</b>
                                        <div className="text-sm space-y-1">
                                            {formData.tema && <div>• Tema: <span className="font-medium text-slate-700">{formData.tema}</span></div>}
                                            {formData.topik && <div>• Unit: <span className="font-medium text-slate-700">{formData.topik}</span></div>}
                                            {formData.catatan && <div className="mt-2 p-3 bg-white border border-slate-100 rounded-lg text-slate-600 italic">&quot;{formData.catatan}&quot;</div>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isSubmitting}
                                className="w-full mt-8 bg-emerald-600 text-white rounded-xl py-4 font-bold text-lg hover:bg-emerald-700 hover:-translate-y-0.5 shadow-xl shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                        Membangun Kurikulum AI...
                                    </>
                                ) : (
                                    <>
                                        <BookOpen className="w-5 h-5 mr-3" />
                                        Mulai Generate AI Sekarang
                                    </>
                                )}
                            </button>
                            <p className="text-center text-xs text-slate-400 mt-4">Proses ini memakan waktu maksimal 3 menit.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
