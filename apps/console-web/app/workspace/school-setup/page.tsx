'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Loader2, AlertCircle, Save, Building } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function SchoolSetupPage() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingSchool, setIsLoadingSchool] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        school_display_name: '',
        kab_kota: '',
        provinsi: '',
        alamat: '',
        school_npsn: ''
    });

    // Load draft from local storage
    useEffect(() => {
        const draft = localStorage.getItem('school_identity_draft');
        if (draft) {
            try {
                const parsed = JSON.parse(draft);
                setFormData(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error('Failed to parse draft', e);
            }
        }
    }, []);

    // Check if school already exists
    useEffect(() => {
        async function checkSchool() {
            if (!isAuthLoaded || isLoadingWorkspace || !workspace) {
                if (!isLoadingWorkspace && !workspace) {
                    setIsLoadingSchool(false); // No workspace yet
                }
                return;
            }

            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspace.id}/school`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    // School identity exists, redirect out
                    router.replace('/generate');
                    return;
                }

                // 404 means we need to set it up
                setIsLoadingSchool(false);
            } catch (err) {
                console.error('School fetch error:', err);
                setIsLoadingSchool(false);
            }
        }

        checkSchool();
    }, [isAuthLoaded, isLoadingWorkspace, workspace, getToken, router]);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            localStorage.setItem('school_identity_draft', JSON.stringify(next));
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!workspace?.id) {
            setError('Workspace belum siap. Mohon tunggu.');
            return;
        }

        if (!formData.school_display_name || formData.school_display_name.trim().length < 3) {
            setError('Nama sekolah wajib diisi dengan minimal 3 karakter.');
            return;
        }

        if (formData.school_npsn && !/^[0-9]{8}$/.test(formData.school_npsn)) {
            setError('NPSN harus berupa 8 digit angka murni.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/school`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    school_display_name: formData.school_display_name,
                    kab_kota: formData.kab_kota || undefined,
                    provinsi: formData.provinsi || undefined,
                    alamat: formData.alamat || undefined,
                    school_npsn: formData.school_npsn || undefined
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || err.message || 'Gagal menyimpan identitas sekolah');
            }

            // Clear draft and proceed to generation hub
            localStorage.removeItem('school_identity_draft');
            router.push('/generate');
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Terjadi kesalahan yang tidak diketahui');
            }
            setIsSubmitting(false);
        }
    };

    if (isLoadingWorkspace || isLoadingSchool) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                    <span className="text-slate-500 font-medium">Memuat identitas ekosistem...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-50 p-4 sm:p-8 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-100/50 mix-blend-multiply blur-3xl opacity-70 pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-indigo-100/50 mix-blend-multiply blur-3xl opacity-70 pointer-events-none" />

            <div className="max-w-xl mx-auto w-full z-10 pt-10 sm:pt-20">
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">

                    <div className="p-8 sm:p-10 border-b border-slate-100">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                            <Building className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">Identitas Sekolah</h1>
                        <p className="text-slate-500 leading-relaxed text-lg">Sesuaikan profil institusi agar Modul Ajar, RPP, dan Kop Surat dibuat lebih profesional sesuai lingkungan kerja Anda.</p>
                    </div>

                    <div className="p-8 sm:p-10 bg-slate-50/50">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50/80 backdrop-blur text-red-600 rounded-xl text-sm flex items-start border border-red-100 shadow-sm">
                                <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-bold block mb-0.5">Penyimpanan gagal:</span>
                                    {error}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1">Nama Sekolah / Lembaga <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Contoh: SD Negeri 1 Nusantara"
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 shadow-sm transition-all duration-200"
                                    value={formData.school_display_name}
                                    onChange={(e) => handleChange('school_display_name', e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-900 ml-1">Kab / Kota <span className="text-slate-400 font-normal">(Opsional)</span></label>
                                    <input
                                        type="text"
                                        placeholder="Contoh: Kota Bandung"
                                        className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 shadow-sm transition-all duration-200"
                                        value={formData.kab_kota}
                                        onChange={(e) => handleChange('kab_kota', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-900 ml-1">Provinsi <span className="text-slate-400 font-normal">(Opsional)</span></label>
                                    <input
                                        type="text"
                                        placeholder="Contoh: Jawa Barat"
                                        className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 shadow-sm transition-all duration-200"
                                        value={formData.provinsi}
                                        onChange={(e) => handleChange('provinsi', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1">Alamat Lengkap <span className="text-slate-400 font-normal">(Opsional)</span></label>
                                <textarea
                                    placeholder="Jl. Merdeka No. 45, Kecamatan Sukajadi"
                                    rows={3}
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 shadow-sm transition-all duration-200 resize-none"
                                    value={formData.alamat}
                                    onChange={(e) => handleChange('alamat', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1 flex justify-between">
                                    <span>NPSN <span className="text-slate-400 font-normal">(Opsional)</span></span>
                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium tracking-wide">VERIFIKASI MANUAL</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="8 Digit Nomor Pokok Sekolah Nasional"
                                    maxLength={8}
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 shadow-sm transition-all duration-200 font-mono tracking-widest"
                                    value={formData.school_npsn}
                                    onChange={(e) => handleChange('school_npsn', e.target.value)}
                                />
                                <p className="text-xs text-slate-500 ml-1 mt-1.5">Membantu validasi keamanan identitas di masa mendatang.</p>
                            </div>

                            <div className="pt-6 border-t border-slate-200">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={cn(
                                        "w-full inline-flex items-center justify-center px-6 py-4 rounded-xl text-white font-semibold transition-all duration-200 shadow-xl shadow-blue-200/50",
                                        isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Menyimpan Identitas...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5 mr-2" />
                                            Lanjutkan Ke Dashboard
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
