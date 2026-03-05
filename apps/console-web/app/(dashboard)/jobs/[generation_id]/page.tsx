'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, AlertCircle, FileText, Download, Link as LinkIcon, CheckCircle2, XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type JobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

interface JobDetail {
    id: string; // generation_id
    status: JobStatus;
    payload: { mapel?: string; semester?: string; subject?: string; };
    created_at: string;
    updated_at: string;
    last_error?: string;

    // Outcome attributes mocked/mapped
    pdf_url?: string;
    public_id?: string;
    html_sha256?: string;
    pdf_sha256?: string;
}

export default function JobDetailPage() {
    const router = useRouter();
    const params = useParams();
    const generationId = params.generation_id as string;

    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [isCheckingPrerequisites, setIsCheckingPrerequisites] = useState(true);
    const [job, setJob] = useState<JobDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingJob, setIsLoadingJob] = useState(true);
    const [isCopied, setIsCopied] = useState(false);
    const [pollCount, setPollCount] = useState(0);
    const [isTimedOut, setIsTimedOut] = useState(false);

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

                if (profileRes.status !== 200) {
                    router.replace('/profile-setup');
                    return;
                }

                const schoolRes = await fetch(`${API_BASE}/w/${workspace.id}/school`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (schoolRes.status !== 200) {
                    router.replace('/workspace/school-setup');
                    return;
                }

                setIsCheckingPrerequisites(false);
            } catch (err) {
                console.error('Prereq check failed:', err);
                setIsCheckingPrerequisites(false);
                setError('Gagal memuat profil ruang kerja.');
            }
        }
        checkPrerequisites();
    }, [isAuthLoaded, isLoadingWorkspace, workspace, getToken, router]);


    // 2. Fetch Detail & Polling
    const fetchJobDetail = async () => {
        if (!workspace?.id || !generationId) return;
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/jobs/${generationId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Dokumen tidak ditemukan atau akses ditolak.');
            }

            const data = await res.json();
            setJob(data);
            setError(null);
        } catch (err: unknown) {
            console.error(err);
            setError((err as Error).message);
        } finally {
            setIsLoadingJob(false);
        }
    };

    // Run poll with exponential backoff IF job is QUEUED or RUNNING
    useEffect(() => {
        if (isCheckingPrerequisites || !workspace || !generationId || isTimedOut) return;

        const isProcessing = !job || job.status === 'QUEUED' || job.status === 'RUNNING';
        if (!isProcessing) return;

        // Stop polling after 5 minutes (approx)
        if (pollCount > 15) { // 1+2+4+8+8... 15 polls is > 2 mins. Let's do a stricter check or just count.
            // Adjusting to properly match 1s, 2s, 4s, 8s (max 8s)
        }

        const fetchWithBackoff = async () => {
            await fetchJobDetail();
            setPollCount(prev => prev + 1);
        };

        // Determine delay: 1, 2, 4, 8, 8, 8...
        const delay = Math.min(Math.pow(2, pollCount), 8) * 1000;

        const timeoutId = setTimeout(fetchWithBackoff, delay);

        // Global timeout (5 minutes)
        const globalTimeout = setTimeout(() => {
            if (isProcessing) {
                setIsTimedOut(true);
                setError('Proses terlalu lama. Silakan muat ulang halaman nanti.');
            }
        }, 5 * 60 * 1000);

        return () => {
            clearTimeout(timeoutId);
            clearTimeout(globalTimeout);
        };
    }, [isCheckingPrerequisites, workspace, generationId, job?.status, pollCount, isTimedOut]);


    // Actions
    const handleCopyLink = () => {
        if (!job?.public_id) return;

        // Assume frontend verifier domain construct
        const verifyUrl = `${window.location.origin}/verify/${job.public_id}`;
        navigator.clipboard.writeText(verifyUrl).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const handleRetry = () => {
        // Forward mapped payload configs to onboarding cache if needed, else dump to onboarding root
        router.push('/onboarding');
    };


    // Core Layout renders
    if (!isAuthLoaded || isLoadingWorkspace || isCheckingPrerequisites || (isLoadingJob && !job)) {
        return (
            <div className="flex flex-col items-center justify-center p-24">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300 mb-4" />
                <span className="text-slate-500 font-medium">Memuat rincian dokumen...</span>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="max-w-3xl mx-auto py-8">
                <Link href="/jobs" className="text-sm font-semibold text-slate-400 hover:text-slate-700 mb-6 inline-flex items-center">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Riwayat
                </Link>
                <div className="p-6 bg-red-50 text-red-600 rounded-2xl flex flex-col items-center text-center border border-red-100 mt-4 shadow-sm">
                    <AlertCircle className="w-12 h-12 mb-4 text-red-500 opacity-80" />
                    <h3 className="text-lg font-bold mb-2">Terjadi Kesalahan</h3>
                    <p className="opacity-90 max-w-sm mb-6">{error || 'Job tidak ditemukan'}</p>
                    <Link href="/jobs" className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition">Kembali</Link>
                </div>
            </div>
        );
    }


    const isDone = job.status === 'DONE';
    const isFailed = job.status === 'FAILED';
    const isProcessing = job.status === 'QUEUED' || job.status === 'RUNNING';

    return (
        <div className="max-w-3xl mx-auto py-8 relative">

            <Link href="/jobs" className="text-sm font-semibold text-slate-400 hover:text-slate-700 mb-6 inline-flex items-center transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Katalog Riwayat
            </Link>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">

                {/* Header Status Block */}
                <div className={cn(
                    "p-8 border-b text-center relative overflow-hidden",
                    isDone ? "bg-emerald-50/50 border-emerald-100" :
                        isFailed ? "bg-red-50/50 border-red-100" :
                            "bg-amber-50/50 border-amber-100"
                )}>

                    <div className="relative z-10 flex flex-col items-center">
                        {isDone && <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />}
                        {isFailed && <XCircle className="w-16 h-16 text-red-500 mb-4" />}
                        {isProcessing && <Loader2 className="w-16 h-16 text-amber-500 mb-4 animate-spin" />}

                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            {job.payload?.mapel || job.payload?.subject || 'Modul Pembelajaran'}
                        </h1>
                        <div className="text-slate-500 font-medium">Semester {job.payload?.semester || '1'}</div>
                    </div>

                </div>

                {/* Body Details */}
                <div className="p-8">

                    {/* Failed Alert */}
                    {isFailed && (
                        <div className="mb-8 p-5 bg-red-50 text-red-700 rounded-2xl border border-red-100">
                            <div className="font-bold flex items-center mb-2">
                                <AlertCircle className="w-5 h-5 mr-2" />
                                Proses Generasi Gagal
                            </div>
                            <p className="text-sm opacity-90 leading-relaxed font-mono bg-red-100/50 p-3 rounded-lg mt-3">
                                {job.last_error || 'Internal system exception during curriculum generation.'}
                            </p>
                            <button
                                onClick={handleRetry}
                                className="mt-4 inline-flex items-center text-sm font-bold bg-white text-red-600 px-4 py-2 rounded-lg border border-red-200 shadow-sm hover:bg-red-50 transition"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" /> Generate Lagi
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-y-6 text-sm mb-10">
                        <div>
                            <div className="text-slate-500 text-xs uppercase tracking-wider font-bold mb-1">Status Sistem</div>
                            <div className="font-bold text-slate-900">{job.status}</div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs uppercase tracking-wider font-bold mb-1">ID Generasi</div>
                            <div className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded inline-block text-[11px] truncate max-w-[150px]">
                                {job.id}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs uppercase tracking-wider font-bold mb-1">Dibuat Pada</div>
                            <div className="text-slate-700">{new Date(job.created_at).toLocaleString('id-ID')}</div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs uppercase tracking-wider font-bold mb-1">Pembaruan Terakhir</div>
                            <div className="text-slate-700">{new Date(job.updated_at).toLocaleString('id-ID')}</div>
                        </div>
                    </div>

                    {/* Masked Metadata Receipts */}
                    {isDone && (job.html_sha256 || job.pdf_sha256) && (
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-8 border-dashed">
                            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 flex items-center">
                                <FileText className="w-4 h-4 mr-2" />
                                Tanda Terima Dokumen (Receipt)
                            </h3>
                            <div className="space-y-3 font-mono text-xs">
                                {job.pdf_sha256 && (
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span>PDF SHA-256</span>
                                        <span className="bg-white border px-2 py-1 rounded text-slate-700">{job.pdf_sha256.substring(0, 8)}...</span>
                                    </div>
                                )}
                                {job.html_sha256 && (
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span>HTML SHA-256</span>
                                        <span className="bg-white border px-2 py-1 rounded text-slate-700">{job.html_sha256.substring(0, 8)}...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* Action Block */}
                    {isDone && (
                        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
                            {job.pdf_url ? (
                                <a
                                    href={job.pdf_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 flex items-center justify-center bg-blue-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-blue-700 hover:-translate-y-0.5 shadow-xl shadow-blue-200 transition-all text-sm sm:text-base"
                                >
                                    <Download className="w-5 h-5 mr-2" /> Unduh Dokumen (PDF)
                                </a>
                            ) : (
                                <button disabled className="flex-1 flex items-center justify-center bg-slate-100 text-slate-400 px-6 py-4 rounded-xl font-bold cursor-not-allowed text-sm sm:text-base">
                                    <Download className="w-5 h-5 mr-2" /> PDF Belum Tersedia
                                </button>
                            )}

                            {job.public_id && (
                                <button
                                    onClick={handleCopyLink}
                                    className={cn(
                                        "sm:w-auto flex items-center justify-center px-6 py-4 rounded-xl font-bold border-2 transition-all text-sm sm:text-base",
                                        isCopied
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                    )}
                                >
                                    {isCopied ? (
                                        <><CheckCircle2 className="w-5 h-5 mr-2" /> Disalin!</>
                                    ) : (
                                        <><LinkIcon className="w-5 h-5 mr-2" /> Bagikan Tautan Uji</>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
