'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, AlertCircle, FileText, Download, Eye, Clock, CheckCircle2, XCircle, Search, Layers, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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

export default function JobsListPage() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [isCheckingPrerequisites, setIsCheckingPrerequisites] = useState(true);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [activeBatch, setActiveBatch] = useState<BatchSession | null>(null);

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

        // Load batch context if exists
        const batchData = sessionStorage.getItem('modulajar_batch');
        if (batchData) {
            try {
                setActiveBatch(JSON.parse(batchData));
            } catch {
                sessionStorage.removeItem('modulajar_batch');
            }
        }
    }, [isAuthLoaded, isLoadingWorkspace, workspace, getToken, router]);

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

        if (isCheckingPrerequisites || !workspace) return;

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
                    href="/wizard"
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
                        <div className="w-16 h-16 bg-slate-50 flex items-center justify-center rounded-2xl mb-4 border border-slate-100 text-slate-400">
                            <Search className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Belum ada dokumen</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-6">Mulai rakit Modul Ajar dan RPP modern pertama Anda dalam hitungan menit.</p>
                        <Link
                            href="/wizard"
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
