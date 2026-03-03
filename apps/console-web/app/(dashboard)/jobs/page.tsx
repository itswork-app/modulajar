'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, AlertCircle, FileText, Download, Eye, Clock, CheckCircle2, XCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type JobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

interface Job {
    id: string; // generation_id
    status: JobStatus;
    payload: { mapel?: string; semester?: string; subject?: string; }; // Handles varying property shapes
    created_at: string;
    updated_at: string;
}

export default function JobsListPage() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [isCheckingPrerequisites, setIsCheckingPrerequisites] = useState(true);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);

    // 1. Route Guards
    useEffect(() => {
        async function checkPrerequisites() {
            if (!isAuthLoaded || isLoadingWorkspace) return;
            if (!workspace) {
                setIsCheckingPrerequisites(false);
                return;
            }

            try {
                const token = await getToken();
                const profileRes = await fetch(`${API_BASE}/w/${workspace.id}/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (profileRes.status === 404) {
                    router.replace('/profile-setup');
                    return;
                }

                const schoolRes = await fetch(`${API_BASE}/w/${workspace.id}/school`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (schoolRes.status === 404) {
                    router.replace('/workspace/school-setup');
                    return;
                }

                setIsCheckingPrerequisites(false);
            } catch (err) {
                console.error('Prereq check failed:', err);
                setIsCheckingPrerequisites(false);
                setError('Gagal memuat profil. Silakan muat ulang halaman.');
            }
        }

        checkPrerequisites();
    }, [isAuthLoaded, isLoadingWorkspace, workspace, getToken, router]);


    // 2. Fetch Jobs & Polling
    const fetchJobs = async () => {
        if (!workspace?.id) return;
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/jobs`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Gagal mengambil data jobs.');
            }

            const data = await res.json();
            // Expected data shape matches standard list returns.
            // If data is wrapped in `{ jobs: [] }` handle it gracefully
            const jobsList: Job[] = Array.isArray(data) ? data : data.jobs || [];

            // Sort Descending by default natively in UI if not guaranteed by API
            const sortedJobs = jobsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setJobs(sortedJobs);
            setError(null);
        } catch (err: unknown) {
            console.error(err);
            setError((err as Error).message);
        } finally {
            setIsLoadingJobs(false);
        }
    };

    // Run interval poll every 3 seconds IF there are active jobs
    useEffect(() => {
        if (isCheckingPrerequisites || !workspace) return;

        fetchJobs(); // initial fetch

        const hasActiveJobs = jobs.some(j => j.status === 'QUEUED' || j.status === 'RUNNING');

        // Wait till we have initial load to lock intervals or unconditionally poll
        const interval = setInterval(() => {
            fetchJobs();
        }, 3000);

        return () => clearInterval(interval);
    }, [isCheckingPrerequisites, workspace, getToken]);


    const renderStatusChip = (status: JobStatus) => {
        switch (status) {
            case 'DONE':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Sukses</span>;
            case 'FAILED':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Gagal</span>;
            case 'RUNNING':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Memproses</span>;
            case 'QUEUED':
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800"><Clock className="w-3 h-3 mr-1" /> Antrean</span>;
        }
    };


    // Core UI Wrappers
    if (!isAuthLoaded || isLoadingWorkspace || isCheckingPrerequisites) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-8">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Riwayat Generasi</h1>
                    <p className="text-slate-500 mt-1">Lacak dan unduh kurikulum AI yang telah dibuat oleh sekolah Anda.</p>
                </div>
                <Link
                    href="/onboarding"
                    className="inline-flex items-center justify-center bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors"
                >
                    + Buat Baru
                </Link>
            </div>

            {error && (
                <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-xl flex items-start text-sm border border-red-100">
                    <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                    <div>{error}</div>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoadingJobs && jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-4" />
                        <p>Memuat riwayat...</p>
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                        <div className="w-16 h-16 bg-slate-50 flex items-center justify-center rounded-2xl mb-4 border border-slate-100 text-slate-400">
                            <Search className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Belum ada dokumen</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-6">Mulai rakit Modul Ajar dan RPP modern pertama Anda dalam hitungan menit.</p>
                        <Link
                            href="/onboarding"
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition"
                        >
                            Buat Sekarang
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Dokumen</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium hidden sm:table-cell">Waktu</th>
                                    <th className="px-6 py-4 font-medium text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {jobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 mr-4 border border-indigo-100/50">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">
                                                        {job.payload?.mapel || job.payload?.subject || 'Format Template'}
                                                    </div>
                                                    <div className="text-slate-500 text-xs mt-0.5">
                                                        Semester {job.payload?.semester || '1'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {renderStatusChip(job.status)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap hidden sm:table-cell">
                                            {new Date(job.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            {job.status === 'DONE' ? (
                                                <Link
                                                    href={`/jobs/${job.id}`}
                                                    className="inline-flex items-center text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                                                >
                                                    <Download className="w-4 h-4 mr-1.5" />
                                                    Unduh
                                                </Link>
                                            ) : (
                                                <Link
                                                    href={`/jobs/${job.id}`}
                                                    className="inline-flex items-center text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
                                                >
                                                    <Eye className="w-4 h-4 mr-1.5" />
                                                    Lihat Detail
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
