'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { Loader2, AlertCircle, Save } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function ProfileSetupPage() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { user } = useUser();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        full_name: '',
        primary_subject: '',
        primary_grade: '4', // Locked to 4 in v1
        nip: ''
    });

    // Load draft from local storage
    useEffect(() => {
        const draft = localStorage.getItem('teacher_profile_draft');
        if (draft) {
            try {
                const parsed = JSON.parse(draft);
                setFormData(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error('Failed to parse draft', e);
            }
        }
    }, []);

    // Load user name default
    useEffect(() => {
        if (user?.fullName && !formData.full_name) {
            setFormData(prev => ({ ...prev, full_name: user.fullName || '' }));
        }
    }, [user, formData.full_name]);


    // Check if profile already exists
    useEffect(() => {
        async function checkProfile() {
            if (!isAuthLoaded || isLoadingWorkspace || !workspace) {
                if (!isLoadingWorkspace && !workspace) {
                    setIsLoadingProfile(false); // No workspace yet
                }
                return;
            }

            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspace.id}/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    // Profile exists, redirect out
                    router.replace('/generate');
                    return;
                }

                // 404 means we need to set it up
                setIsLoadingProfile(false);
            } catch (err) {
                console.error('Profile fetch error:', err);
                setIsLoadingProfile(false);
            }
        }

        checkProfile();
    }, [isAuthLoaded, isLoadingWorkspace, workspace, getToken, router]);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            localStorage.setItem('teacher_profile_draft', JSON.stringify(next));
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!workspace?.id) {
            setError('Workspace belum siap. Mohon tunggu.');
            return;
        }

        if (!formData.full_name || formData.full_name.length < 2) {
            setError('Nama lengkap minimal 2 karakter.');
            return;
        }

        if (!formData.primary_subject) {
            setError('Mata pelajaran wajib disi.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    full_name: formData.full_name,
                    primary_subject: formData.primary_subject,
                    primary_grade: parseInt(formData.primary_grade),
                    nip: formData.nip || null
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || err.message || 'Gagal menyimpan profil');
            }

            // Clear draft and proceed
            localStorage.removeItem('teacher_profile_draft');
            router.push('/generate');
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred');
            }
            setIsSubmitting(false);
        }
    };

    if (isLoadingWorkspace || isLoadingProfile) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
                    <span className="text-slate-500 font-medium">Menyiapkan profil guru...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-50 p-4 sm:p-8 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-emerald-100/50 mix-blend-multiply blur-3xl opacity-70 pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-sky-100/50 mix-blend-multiply blur-3xl opacity-70 pointer-events-none" />

            <div className="max-w-xl mx-auto w-full z-10 pt-10 sm:pt-20">
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">

                    <div className="p-8 sm:p-10 border-b border-slate-100">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                            <span className="text-2xl">👩‍🏫</span>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">Profil Guru</h1>
                        <p className="text-slate-500 leading-relaxed text-lg">Sebelum mulai membuat modul, mari lengkapi profil Anda. Data ini akan digunakan sebagai informasi default di setiap modul ajar.</p>
                    </div>

                    <div className="p-8 sm:p-10 bg-slate-50/50">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50/80 backdrop-blur text-red-600 rounded-xl text-sm flex items-start border border-red-100 shadow-sm">
                                <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-bold block mb-0.5">Tidak dapat menyimpan:</span>
                                    {error}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1">Nama Lengkap <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Masukkan nama lengkap beserta gelar"
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500 shadow-sm transition-all duration-200"
                                    value={formData.full_name}
                                    onChange={(e) => handleChange('full_name', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1">NIP <span className="text-slate-400 font-normal">(Opsional)</span></label>
                                <input
                                    type="text"
                                    placeholder="Masukkan NIP jika ada"
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500 shadow-sm transition-all duration-200"
                                    value={formData.nip}
                                    onChange={(e) => handleChange('nip', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1">Mata Pelajaran Utama <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:ring-emerald-500 shadow-sm transition-all duration-200 appearance-none"
                                    value={formData.primary_subject}
                                    onChange={(e) => handleChange('primary_subject', e.target.value)}
                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                                >
                                    <option value="" disabled>Pilih mata pelajaran pengampu...</option>
                                    <option value="Matematika">Matematika</option>
                                    <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                                    <option value="Bahasa Inggris">Bahasa Inggris</option>
                                    <option value="IPA">IPA / IPAS</option>
                                    <option value="IPS">IPS</option>
                                    <option value="PPKn">PPKn</option>
                                    <option value="Pendidikan Agama">Pendidikan Agama</option>
                                    <option value="Seni Budaya">Seni Budaya</option>
                                    <option value="PJOK">PJOK</option>
                                    <option value="Informatika">Informatika / TIK</option>
                                    <option value="Lainnya">Lainnya...</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1 flex justify-between">
                                    <span>Kelas Utama</span>
                                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Terkunci untuk v1</span>
                                </label>
                                <div className="relative">
                                    <select
                                        disabled
                                        className="w-full rounded-xl border-slate-200 bg-slate-50 text-slate-500 px-4 py-3 focus:ring-0 opacity-80 cursor-not-allowed appearance-none"
                                        value={formData.primary_grade}
                                        readOnly
                                    >
                                        <option value="4">Kelas 4 (SD)</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                        <span className="text-sm text-slate-400">🔒</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 ml-1 mt-1.5">Saat ini generasi modul difokuskan pada kurikulum Kelas 4 SD.</p>
                            </div>

                            <div className="pt-6">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={cn(
                                        "w-full inline-flex items-center justify-center px-6 py-4 rounded-xl text-white font-semibold transition-all duration-200 shadow-xl shadow-emerald-200/50",
                                        isSubmitting ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Menyimpan Profil...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5 mr-2" />
                                            Simpan & Mulai Buat Modul
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
