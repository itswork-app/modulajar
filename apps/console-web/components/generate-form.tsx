'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { ChevronRight, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export function GenerateForm() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { user } = useUser();

    // State
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        jenjang: 'SD',
        kelas: '4',
        mapel: 'Matematika',
        semester: '1',
        tahun_ajaran: '2025/2026',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Workspace on Mount
    useEffect(() => {
        async function fetchWorkspace() {
            if (!isAuthLoaded) return;
            try {
                const token = await getToken();
                // 1. Try to get existing workspaces
                const res = await fetch(`${API_BASE}/workspaces`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.workspaces && data.workspaces.length > 0) {
                        setWorkspaceId(data.workspaces[0].id);
                        setIsLoadingWorkspace(false);
                        return;
                    }
                }

                // 2. If no workspace, create one (Personal Defaults)
                const createRes = await fetch(`${API_BASE}/workspaces`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ name: 'My Workspace' })
                });

                if (createRes.ok) {
                    const ws = await createRes.json();
                    setWorkspaceId(ws.id);
                } else {
                    setError('Gagal membuat workspace. Silakan refresh.');
                }
            } catch (err) {
                console.error('Workspace fetch error:', err);
                setError('Network error getting workspace');
            } finally {
                setIsLoadingWorkspace(false);
            }
        }

        fetchWorkspace();
    }, [isAuthLoaded, getToken]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!workspaceId) {
            setError('Workspace belum siap. Mohon tunggu.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const token = await getToken();
            const payload = {
                pack_id: `pack-${formData.mapel.toLowerCase().replace(/\s/g, '-')}`, // Mock pack_id
                semester: formData.semester,
                tahun_ajaran: formData.tahun_ajaran,
                kelas: formData.kelas,
                teacher_name: user?.fullName || 'Teacher',
                school_name: 'School' // Default for v0
            };

            const res = await fetch(`${API_BASE}/w/${workspaceId}/internal/generate-semester`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || err.message || 'Failed to generate');
            }

            const data = await res.json();
            // TODO: Start polling or redirect
            router.push('/app');
        } catch (err: any) {
            setError(err.message);
            setIsSubmitting(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (isLoadingWorkspace) {
        return (
            <div className="flex items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mr-2" />
                <span className="text-slate-500">Menyiapkan workspace...</span>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="mb-8">
                <div className="flex items-center space-x-2 text-sm text-slate-500 mb-2">
                    <span className={cn(step >= 1 ? "text-emerald-600 font-medium" : "")}>Parameter</span>
                    <ChevronRight className="w-4 h-4" />
                    <span className={cn(step >= 2 ? "text-emerald-600 font-medium" : "")}>Konfirmasi</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Buat Modul Ajar</h2>
                <p className="text-slate-500">Isi detail berikut untuk mulai generate dokumen.</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span className="font-bold mr-1">Error:</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">Jenjang</label>
                        <select
                            className="w-full rounded-lg border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                            value={formData.jenjang}
                            onChange={(e) => handleChange('jenjang', e.target.value)}
                        >
                            <option value="SD">SD</option>
                            <option value="SMP">SMP</option>
                            <option value="SMA">SMA</option>
                            <option value="SMK">SMK</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">Kelas</label>
                        <select
                            className="w-full rounded-lg border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                            value={formData.kelas}
                            onChange={(e) => handleChange('kelas', e.target.value)}
                        >
                            <option value="1">Kelas 1</option>
                            <option value="2">Kelas 2</option>
                            <option value="3">Kelas 3</option>
                            <option value="4">Kelas 4</option>
                            <option value="5">Kelas 5</option>
                            <option value="6">Kelas 6</option>
                            <option value="7">Kelas 7</option>
                            <option value="8">Kelas 8</option>
                            <option value="9">Kelas 9</option>
                            <option value="10">Kelas 10</option>
                            <option value="11">Kelas 11</option>
                            <option value="12">Kelas 12</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">Mata Pelajaran</label>
                        <select
                            className="w-full rounded-lg border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                            value={formData.mapel}
                            onChange={(e) => handleChange('mapel', e.target.value)}
                        >
                            <option value="Matematika">Matematika</option>
                            <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                            <option value="IPAS">IPAS</option>
                            <option value="PPKn">PPKn</option>
                            <option value="Bahasa Inggris">Bahasa Inggris</option>
                            <option value="Seni Musik">Seni Musik</option>
                            <option value="Seni Rupa">Seni Rupa</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">Semester</label>
                        <select
                            className="w-full rounded-lg border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                            value={formData.semester}
                            onChange={(e) => handleChange('semester', e.target.value)}
                        >
                            <option value="1">Ganjil (1)</option>
                            <option value="2">Genap (2)</option>
                        </select>
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-2">
                        <label className="text-sm font-medium text-slate-900">Tahun Ajaran</label>
                        <input
                            type="text"
                            className="w-full rounded-lg border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                            value={formData.tahun_ajaran}
                            onChange={(e) => handleChange('tahun_ajaran', e.target.value)}
                        />
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={cn(
                            "inline-flex items-center px-6 py-3 rounded-xl text-white font-medium transition-all shadow-lg shadow-emerald-200",
                            isSubmitting ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-1"
                        )}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5 mr-2" />
                                Generate Dokumen
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
