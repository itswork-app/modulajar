'use client';

import { useState, useEffect } from 'react';

import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { useWorkspaceStore } from '@/store/workspace-store';
import { Loader2, AlertCircle, FileText, Download, Eye, Clock, CheckCircle2, XCircle, Search, Layers, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type JobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

interface BatchSession {
    batch_id: string;
    job_ids: string[];
    subject: string;
    semester: string;
    total: number;
}

interface Job {
    id: string; // generation_id
    status: JobStatus;
    payload: { mapel?: string; semester?: string; subject?: string; topic?: string; materi?: string; }; // Handles varying property shapes
    created_at: string;
    updated_at: string;
}

const ModulesSkeleton = () => (
    <div className="max-w-6xl mx-auto py-8 lg:py-12 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-12 w-40 rounded-2xl" />
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                <Skeleton className="h-4 w-48" />
            </div>
            <div className="p-6 space-y-6">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-4 flex-1">
                            <Skeleton className="w-12 h-12 rounded-2xl" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-5 w-1/3" />
                                <Skeleton className="h-4 w-1/4" />
                            </div>
                        </div>
                        <Skeleton className="h-8 w-24 rounded-full" />
                        <div className="flex gap-2">
                            <Skeleton className="h-10 w-24 rounded-xl" />
                            <Skeleton className="h-10 w-24 rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default function JobsListPage() {

    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
    const { isProfileLoading } = useWorkspaceStore();

    const [jobs, setJobs] = useState<Job[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [activeBatch, setActiveBatch] = useState<BatchSession | null>(null);

    // Load batch context if exists
    useEffect(() => {
        const batchData = sessionStorage.getItem('modulajar_batch');
        if (batchData) {
            try {
                setActiveBatch(JSON.parse(batchData));
            } catch {
                sessionStorage.removeItem('modulajar_batch');
            }
        }
    }, []);

    // Run interval poll every 3 seconds IF there are active jobs
    useEffect(() => {
        let isMounted = true;
        const abortController = new AbortController();

        const doFetch = async () => {
            if (!workspace?.id) return;
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspace.id}/documents`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: abortController.signal
                });
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || 'Gagal mengambil data modul.');
                }
                const data = await res.json();
                if (!isMounted) return;

                const jobsList = (data.documents || []) as Job[];
                const sortedJobs = jobsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setJobs(sortedJobs);
                setError(null);
            } catch (err: unknown) {
                if (!isMounted) return;
                if ((err as Error).name !== 'AbortError') {
                    console.error(err);
                    setError((err as Error).message);
                }
            } finally {
                if (isMounted) setIsLoadingJobs(false);
            }
        };

        if (isProfileLoading || !workspace) return;

        doFetch(); // initial fetch

        // Wait till we have initial load to lock intervals or unconditionally poll
        const interval = setInterval(() => {
            doFetch();
        }, 3000);

        return () => {
            isMounted = false;
            abortController.abort();
            clearInterval(interval);
        };
    }, [isProfileLoading, workspace, getToken]);


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


    if (!isAuthLoaded || isLoadingWorkspace || isProfileLoading || (isLoadingJobs && jobs.length === 0)) {
        return <ModulesSkeleton />;
    }

    return (
        <div className="max-w-6xl mx-auto py-8 lg:py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded uppercase tracking-widest h-fit">History</div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Riwayat Generasi</h1>
                    </div>
                    <p className="text-slate-500 font-bold">Lacak dan unduh kurikulum AI yang telah dibuat oleh sekolah Anda.</p>
                </div>
                <Link
                    href="/wizard"
                    className="inline-flex items-center justify-center bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 hover:-translate-y-1"
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

            {activeBatch && (
                <div className="mb-8 bg-emerald-50 border border-emerald-100 rounded-2xl p-6 relative overflow-hidden shadow-sm">
                    <button
                        onClick={() => {
                            sessionStorage.removeItem('modulajar_batch');
                            setActiveBatch(null);
                        }}
                        className="absolute top-4 right-4 text-emerald-600/50 hover:text-emerald-700 hover:bg-emerald-100/50 p-2 rounded-xl transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 border border-emerald-200/50 shadow-inner">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-emerald-900 font-black text-lg">Batch: {activeBatch.subject}</h3>
                            <p className="text-emerald-700/80 font-medium text-sm mt-0.5">Memproses {activeBatch.total} topik semester {activeBatch.semester}</p>
                        </div>
                    </div>

                    {(() => {
                        const batchJobs = jobs.filter(j => activeBatch.job_ids.includes(j.id));
                        const done = batchJobs.filter(j => j.status === 'DONE').length;
                        const failed = batchJobs.filter(j => j.status === 'FAILED').length;
                        const processing = batchJobs.length - done - failed;
                        const progressPct = activeBatch.total === 0 ? 0 : ((done + failed) / activeBatch.total) * 100;
                        const isAllComplete = (done + failed) === activeBatch.total && activeBatch.total > 0;

                        return (
                            <div>
                                <div className="flex justify-between items-end mb-2 text-sm">
                                    <div className="font-bold text-emerald-800">
                                        Progres Eksekusi
                                    </div>
                                    <div className="text-emerald-700 font-medium space-x-3">
                                        <span>✓ {done} selesai</span>
                                        {failed > 0 && <span className="text-red-500">✗ {failed} gagal</span>}
                                        {processing > 0 && <span>⏳ {processing} antre/jalan</span>}
                                    </div>
                                </div>
                                <div className="w-full h-3 bg-emerald-200/50 rounded-full overflow-hidden mb-3 shadow-inner">
                                    <div
                                        className={cn("h-full transition-all duration-500", failed > 0 ? "bg-amber-400" : "bg-emerald-500")}
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                                {isAllComplete && (
                                    <div className="text-emerald-800 font-black text-sm flex items-center gap-1 mt-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Semua selesai. Batch dapat ditutup.
                                    </div>
                                )}
                            </div>
                        );
                    })()}
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
                        <div className="w-20 h-20 bg-slate-50 flex items-center justify-center rounded-3xl mb-6 border border-slate-100 text-slate-300">
                            <Search className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Belum ada dokumen</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-10 font-medium">Mulai rakit Modul Ajar dan RPP modern pertama Anda dalam hitungan menit.</p>
                        <Link
                            href="/wizard"
                            className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all hover:-translate-y-1"
                        >
                            Buat Sekarang
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Tanggal</th>
                                    <th className="px-6 py-4 font-medium">Mata Pelajaran</th>
                                    <th className="px-6 py-4 font-medium">Topik</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {jobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                            {new Date(job.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
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
                                        <td className="px-6 py-4 text-slate-700">
                                            {/* Assuming topic or default text */}
                                            {job.payload?.topic || job.payload?.materi || 'Tanpa Topik'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {renderStatusChip(job.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                                            <Link
                                                href={`/modules/${job.id}`}
                                                className="inline-flex items-center text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
                                            >
                                                <Eye className="w-4 h-4 mr-1.5" />
                                                Detail
                                            </Link>
                                            {job.status === 'DONE' && (
                                                <>
                                                    <Link
                                                        href={`/modules/${job.id}/edit`}
                                                        className="inline-flex items-center text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                                                    >
                                                        Edit Modul
                                                    </Link>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const token = await getToken();
                                                                // Use public_id if available, else id (job_id)
                                                                const pid = (job as Job).id;
                                                                const res = await fetch(`${API_BASE}/w/${workspace?.id}/documents/${pid}/download`, {
                                                                    headers: { Authorization: `Bearer ${token}` }
                                                                });
                                                                if (res.ok) {
                                                                    const { download_url } = await res.json();
                                                                    window.location.href = download_url;
                                                                } else {
                                                                    alert('Gagal mengunduh dokumen.');
                                                                }
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert('Terjadi kesalahan saat mengunduh.');
                                                            }
                                                        }}
                                                        className="inline-flex items-center text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                                                    >
                                                        <Download className="w-4 h-4 mr-1.5" />
                                                        Download
                                                    </button>
                                                </>
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
