'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Loader2, AlertCircle, Save, LayoutTemplate, Trash2, Image as ImageIcon } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface LetterheadConfig {
    letterhead_line1: string;
    letterhead_line2: string;
    letterhead_line3: string;
    letterhead_line4: string;
    letterhead_contact: string;
    logo_file_path?: string | null;
    logo_preview_url?: string | null;
}

export default function LetterheadSetupPage() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [formData, setFormData] = useState<LetterheadConfig>({
        letterhead_line1: '',
        letterhead_line2: '',
        letterhead_line3: '',
        letterhead_line4: '',
        letterhead_contact: ''
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        async function fetchLetterhead() {
            if (!isAuthLoaded || isLoadingWorkspace || !workspace) {
                if (!isLoadingWorkspace && !workspace) {
                    setIsLoadingData(false);
                }
                return;
            }

            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspace.id}/letterhead`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    setFormData({
                        letterhead_line1: data.letterhead_line1 || '',
                        letterhead_line2: data.letterhead_line2 || '',
                        letterhead_line3: data.letterhead_line3 || '',
                        letterhead_line4: data.letterhead_line4 || '',
                        letterhead_contact: data.letterhead_contact || '',
                        logo_preview_url: data.logo_preview_url || null,
                    });
                    if (data.logo_preview_url) {
                        setPreviewUrl(data.logo_preview_url);
                    }
                }
            } catch (err) {
                console.error('Fetch error:', err);
                setError('Gagal memuat konfigurasi kop surat.');
            } finally {
                setIsLoadingData(false);
            }
        }

        fetchLetterhead();
    }, [isAuthLoaded, isLoadingWorkspace, workspace, getToken]);

    const handleChange = (field: keyof LetterheadConfig, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setSuccessMsg(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 512 * 1024) {
                setError("Ukuran logo maksimal 512KB.");
                return;
            }
            if (!['image/jpeg', 'image/png'].includes(file.type)) {
                setError("Hanya format JPG atau PNG yang diperbolehkan.");
                return;
            }

            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setError(null);
            setSuccessMsg(null);
        }
    };

    const handleRemoveLogo = async () => {
        if (selectedFile) {
            setSelectedFile(null);
            setPreviewUrl(formData.logo_preview_url || null); // revert to saved or none
            return;
        }

        if (!workspace?.id) return;

        try {
            setIsSubmitting(true);
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/letterhead/clear-logo`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Gagal menghapus logo");

            setPreviewUrl(null);
            setFormData(prev => ({ ...prev, logo_preview_url: null }));
            setSuccessMsg("Logo berhasil dihapus.");
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Gagal menghapus logo.");
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!workspace?.id) {
            setError('Workspace belum siap. Mohon tunggu.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const token = await getToken();
            const submitData = new FormData();

            submitData.append('letterhead_line1', formData.letterhead_line1);
            submitData.append('letterhead_line2', formData.letterhead_line2);
            submitData.append('letterhead_line3', formData.letterhead_line3);
            submitData.append('letterhead_line4', formData.letterhead_line4);
            submitData.append('letterhead_contact', formData.letterhead_contact);

            if (selectedFile) {
                submitData.append('logo', selectedFile);
            }

            const res = await fetch(`${API_BASE}/w/${workspace.id}/letterhead`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: submitData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || err.message || 'Gagal menyimpan kop surat');
            }

            const data = await res.json();

            setFormData(prev => ({
                ...prev,
                logo_preview_url: data.logo_preview_url || prev.logo_preview_url
            }));

            if (data.logo_preview_url) {
                setPreviewUrl(data.logo_preview_url);
            }

            setSelectedFile(null); // Clear selected file as it's now saved
            setSuccessMsg("Konfigurasi kop surat berhasil disimpan!");

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Terjadi kesalahan yang tidak diketahui');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingWorkspace || isLoadingData) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                    <span className="text-slate-500 font-medium">Memuat konfigurasi...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-50 p-4 sm:p-8 relative overflow-hidden">
            <div className="max-w-6xl mx-auto w-full z-10 pt-4 sm:pt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                {/* Form Section */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-8 sm:p-10 border-b border-slate-100">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                            <LayoutTemplate className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">Pengaturan Kop Surat</h1>
                        <p className="text-slate-500 leading-relaxed text-lg">Konfigurasi tampilan kop surat (header) pada setiap dokumen PDF yang dihasilkan oleh ModulAjar.</p>
                    </div>

                    <div className="p-8 sm:p-10 bg-slate-50/50">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50/80 backdrop-blur text-red-600 rounded-xl text-sm flex items-start border border-red-100 shadow-sm">
                                <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-bold block mb-0.5">Terjadi Kesalahan:</span>
                                    {error}
                                </div>
                            </div>
                        )}

                        {successMsg && (
                            <div className="mb-6 p-4 bg-green-50/80 backdrop-blur text-green-700 rounded-xl text-sm flex items-start border border-green-200 shadow-sm">
                                <Save className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-bold block mb-0.5">Berhasil:</span>
                                    {successMsg}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">

                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-900 ml-1">Logo Instansi <span className="text-slate-400 font-normal">(Maks 512KB, JPG/PNG)</span></label>

                                <div className="flex items-center gap-4">
                                    <div className="relative group w-20 h-20 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden shrink-0 transition-colors hover:border-indigo-400">
                                        {previewUrl ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src={previewUrl} alt="Logo Preview" className="w-full h-full object-contain p-1" />
                                        ) : (
                                            <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                                        )}

                                        <input
                                            type="file"
                                            accept="image/png, image/jpeg"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={handleFileChange}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="text-sm text-slate-600">
                                            {selectedFile ? selectedFile.name : previewUrl ? "Logo tersimpan" : "Belum ada logo dipilih"}
                                        </div>
                                        {(previewUrl || selectedFile) && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveLogo}
                                                className="text-xs text-red-600 font-medium hover:text-red-700 flex items-center gap-1 w-fit"
                                                disabled={isSubmitting}
                                            >
                                                <Trash2 className="w-3 h-3" /> Hapus Logo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1">Baris 1 (Nama Yayasan / Dinas) <span className="text-slate-400 font-normal">(Opsional)</span></label>
                                <input
                                    type="text"
                                    placeholder="YAYASAN PENDIDIKAN NUSANTARA"
                                    maxLength={120}
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-all duration-200"
                                    value={formData.letterhead_line1}
                                    onChange={(e) => handleChange('letterhead_line1', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1">Baris 2 (Nama Sekolah) <span className="text-slate-400 font-normal">(Opsional)</span></label>
                                <input
                                    type="text"
                                    placeholder="SD NEGERI 1 MERDEKA"
                                    maxLength={120}
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 text-lg font-bold placeholder-slate-300 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-all duration-200"
                                    value={formData.letterhead_line2}
                                    onChange={(e) => handleChange('letterhead_line2', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1">Baris 3 (Akreditasi / Info Tambahan) <span className="text-slate-400 font-normal">(Opsional)</span></label>
                                <input
                                    type="text"
                                    placeholder="Terakreditasi A"
                                    maxLength={120}
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-all duration-200"
                                    value={formData.letterhead_line3}
                                    onChange={(e) => handleChange('letterhead_line3', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1">Baris 4 (Info Tambahan) <span className="text-slate-400 font-normal">(Opsional)</span></label>
                                <input
                                    type="text"
                                    placeholder="NSS: 123456789 | NPSN: 98765432"
                                    maxLength={120}
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-all duration-200"
                                    value={formData.letterhead_line4}
                                    onChange={(e) => handleChange('letterhead_line4', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-900 ml-1">Kontak & Alamat <span className="text-slate-400 font-normal">(Opsional)</span></label>
                                <textarea
                                    placeholder="Jl. Merdeka No 1, Bandung | Telp: (022) 123456 | Email: sd1@contoh.com"
                                    rows={2}
                                    maxLength={250}
                                    className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-all duration-200 resize-none text-sm"
                                    value={formData.letterhead_contact}
                                    onChange={(e) => handleChange('letterhead_contact', e.target.value)}
                                />
                            </div>

                            <div className="pt-6 border-t border-slate-200 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => router.push('/generate')}
                                    className="flex-1 px-6 py-4 rounded-xl text-slate-700 bg-white border border-slate-200 font-semibold transition-all duration-200 hover:bg-slate-50"
                                >
                                    Kembali
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={cn(
                                        "flex-[2] inline-flex items-center justify-center px-6 py-4 rounded-xl text-white font-semibold transition-all duration-200 shadow-xl shadow-indigo-200/50",
                                        isSubmitting ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5 mr-2" />
                                            Simpan Pengaturan
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Preview Section - Sticky */}
                <div className="lg:sticky lg:top-10 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-lg font-bold text-slate-800">Preview (Estimasi)</h2>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full tracking-wide">UKURAN A4</span>
                    </div>

                    {/* A4 Proportion Container */}
                    <div className="w-full aspect-[1/1.4142] bg-white rounded-xl shadow border border-slate-200 overflow-hidden relative p-8 sm:p-12">
                        {/* Fallback if all empty */}
                        {!formData.letterhead_line1 && !formData.letterhead_line2 && !previewUrl && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50">
                                <p className="text-slate-400 text-sm">Preview akan muncul di sini saat Anda mengetik.</p>
                            </div>
                        )}

                        {/* Actual Render Preview matching deterministic core-go template struct closely */}
                        <div className="w-full flex items-center border-b-[3px] border-double border-slate-900 pb-4 mb-8">
                            {/* Logo */}
                            {previewUrl && (
                                <div className="mr-6 shrink-0 flex items-center h-24">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={previewUrl} alt="Logo Instansi" className="h-full object-contain max-w-[100px]" />
                                </div>
                            )}

                            {/* Text Content */}
                            <div className={cn("flex-1 text-center font-serif flex flex-col justify-center", !previewUrl && "items-center")}>
                                {formData.letterhead_line1 && (
                                    <div className="text-[14px] leading-tight font-semibold tracking-wide uppercase">
                                        {formData.letterhead_line1}
                                    </div>
                                )}
                                {formData.letterhead_line2 && (
                                    <div className="text-[20px] leading-tight font-bold tracking-wider uppercase mt-1">
                                        {formData.letterhead_line2}
                                    </div>
                                )}
                                {formData.letterhead_line3 && (
                                    <div className="text-[12px] leading-tight mt-1.5 font-sans">
                                        {formData.letterhead_line3}
                                    </div>
                                )}
                                {formData.letterhead_line4 && (
                                    <div className="text-[12px] leading-tight mt-1 font-sans">
                                        {formData.letterhead_line4}
                                    </div>
                                )}
                                {formData.letterhead_contact && (
                                    <div className="text-[10px] leading-relaxed mt-2.5 pt-1.5 border-t border-slate-400/30 text-slate-700 italic font-sans max-w-[80%] mx-auto">
                                        {formData.letterhead_contact}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dummy PDF Body context to simulate document */}
                        <div className="w-full space-y-6 opacity-30 pointer-events-none select-none">
                            <div className="w-full text-center">
                                <div className="h-6 w-48 bg-slate-800 rounded mx-auto mb-2"></div>
                                <div className="h-4 w-32 bg-slate-400 rounded mx-auto"></div>
                            </div>
                            <div className="space-y-2 mt-8">
                                <div className="h-3 w-full bg-slate-300 rounded"></div>
                                <div className="h-3 w-[90%] bg-slate-300 rounded"></div>
                                <div className="h-3 w-[85%] bg-slate-300 rounded"></div>
                            </div>
                            <div className="space-y-2 mt-4">
                                <div className="h-3 w-full bg-slate-300 rounded"></div>
                                <div className="h-3 w-[92%] bg-slate-300 rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
