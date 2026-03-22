'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { useWorkspaceStore } from '@/store/workspace-store';
import {
    Loader2, AlertCircle, FileText, Download, CheckCircle2, XCircle,
    ArrowLeft, RefreshCw, Copy, Clock, Sparkles, BookOpen,
    User, School, ChevronDown, ChevronUp, ExternalLink, Eye, Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';


const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// ─── Types ───────────────────────────────────────────────────────────────────

type JobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

interface JobPayload {
    mapel?: string;
    subject?: string;
    semester?: string;
    grade?: number;
    topic?: string;
    notes?: string;
}

interface JobDetail {
    id: string;
    module_id?: string;
    status: JobStatus;
    payload: JobPayload;
    created_at: string;
    updated_at: string;
    last_error?: string;
    pdf_url?: string;
    public_id?: string;
    html_sha256?: string;
    pdf_sha256?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RUNNING_STAGES = [
    'Menyiapkan struktur dokumen...',
    'Memproses konteks pembelajaran...',
    'AI menyusun konten...',
    'Merender dokumen akhir...',
];

function MetaItem({ label, value }: { label: string; value?: string | number }) {
    return (
        <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-sm font-semibold text-slate-800">{value || <span className="text-slate-300 italic">—</span>}</div>
        </div>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ModuleResultPage() {
    const router = useRouter();
    const params = useParams();
    const generationId = params.generation_id as string;

    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: wsLoading } = useWorkspace();
    const { teacherProfile, schoolIdentity, isProfileLoading } = useWorkspaceStore();

    const [job, setJob] = useState<JobDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pollCount, setPollCount] = useState(0);
    const [stageIndex, setStageIndex] = useState(0);
    const [isCopied, setIsCopied] = useState(false);
    const [showTechDetail, setShowTechDetail] = useState(false);
    const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
    const [docVersion, setDocVersion] = useState<number | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    // ── Rotate running stage label ─────────────────────────────────────────
    useEffect(() => {
        if (job?.status !== 'RUNNING') return;
        const t = setInterval(() => setStageIndex(i => (i + 1) % RUNNING_STAGES.length), 3500);
        return () => clearInterval(t);
    }, [job?.status]);

    // ── Fetch job detail ───────────────────────────────────────────────────
    useEffect(() => {
        if (job?.status !== 'DONE' || !workspace?.id || !generationId || htmlPreview !== null) return;
        let isMounted = true;
        setIsLoadingPreview(true);
        getToken().then(token => {
            fetch(`${API_BASE}/w/${workspace.id}/modules/${generationId}/editor`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(r => {
                if (r.ok) return r.json();
                throw new Error('preview unavailable');
            }).then(d => {
                if (isMounted) {
                    setHtmlPreview(d.html_preview);
                    setDocVersion(d.version);
                }
            }).catch(() => {
                /* graceful: preview stays null */
            }).finally(() => {
                if (isMounted) setIsLoadingPreview(false);
            });
        });
        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [job?.status, workspace?.id, generationId]);

    // ── Fetch job detail ───────────────────────────────────────────────────
    const fetchJob = useCallback(async () => {
        if (!workspace?.id || !generationId) return;
        try {
            const token = await getToken();
            const h = { Authorization: `Bearer ${token}` };

            const res = await fetch(`${API_BASE}/w/${workspace.id}/jobs/${generationId}`, { headers: h });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e.error || 'Dokumen tidak ditemukan atau akses ditolak.');
            }
            const data: JobDetail = await res.json();

            // If DONE, enrich with module artifact URLs
            if (data.status === 'DONE') {
                try {
                    const mr = await fetch(`${API_BASE}/w/${workspace.id}/modules/${generationId}`, { headers: h });
                    if (mr.ok) {
                        const md = await mr.json();
                        data.pdf_url = md.pdf?.download_url || md.pdf_url;
                        data.public_id = md.public_id || data.public_id;
                        data.module_id = md.id || data.module_id;
                    }
                } catch { /* non-fatal */ }
            }

            setJob(data);
            setError(null);
        } catch (err: unknown) {
            setError((err as Error).message);
        }
    }, [workspace?.id, generationId, getToken]);

    // ── Polling (stops on terminal state) ─────────────────────────────────
    useEffect(() => {
        if (isProfileLoading || !workspace || !generationId) return;
        const isTerminal = job?.status === 'DONE' || job?.status === 'FAILED';
        if (isTerminal) return; // no more polling

        const delay = pollCount === 0 ? 0 : Math.min(Math.pow(2, pollCount - 1), 8) * 1000;
        const t = setTimeout(async () => {
            await fetchJob();
            setPollCount(c => c + 1);
        }, delay);
        return () => clearTimeout(t);
    }, [isProfileLoading, workspace, generationId, job?.status, pollCount, fetchJob]);

    // ── Actions ────────────────────────────────────────────────────────────
    const handleCopyLink = () => {
        if (!job?.public_id) return;
        navigator.clipboard.writeText(`${window.location.origin}/verify/${job.public_id}`).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    // ── Derived state ──────────────────────────────────────────────────────
    const isDone = job?.status === 'DONE';
    const isFailed = job?.status === 'FAILED';
    const isProcessing = !job || job.status === 'QUEUED' || job.status === 'RUNNING';
    const subjectLabel = job?.payload?.mapel || job?.payload?.subject || 'Modul Pembelajaran';
    const semesterLabel = job?.payload?.semester === '2' ? 'Genap (2)' : 'Ganjil (1)';

    // ── Loading skeleton ───────────────────────────────────────────────────
    if (!isAuthLoaded || wsLoading || isProfileLoading) {
        return (
            <div className="max-w-3xl mx-auto py-8 space-y-4">
                <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="bg-white rounded-3xl border border-slate-100 h-52 animate-pulse" />
                <div className="bg-white rounded-3xl border border-slate-100 h-32 animate-pulse" />
            </div>
        );
    }

    // ── Error (not found) ──────────────────────────────────────────────────
    if (error && !job) {
        return (
            <div className="max-w-3xl mx-auto py-8">
                <Link href="/modules" className="text-sm font-bold text-slate-400 hover:text-slate-700 mb-6 inline-flex items-center gap-2 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Kembali ke Riwayat
                </Link>
                <div className="mt-6 p-8 bg-red-50 text-red-600 rounded-3xl flex flex-col items-center text-center border border-red-100">
                    <AlertCircle className="w-12 h-12 mb-4 opacity-80" />
                    <h3 className="text-lg font-black mb-2">Dokumen Tidak Ditemukan</h3>
                    <p className="text-sm max-w-xs opacity-90 mb-6">{error}</p>
                    <Link href="/modules" className="bg-red-600 text-white px-6 py-3 rounded-xl font-black hover:bg-red-700 transition text-sm">
                        Kembali ke Riwayat Modul
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-8 space-y-4 animate-in fade-in duration-500">

            {/* Back nav */}
            <Link href="/modules" className="text-xs font-black text-slate-400 hover:text-slate-700 inline-flex items-center gap-1.5 uppercase tracking-widest transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Riwayat Modul
            </Link>

            {/* ─── A: Status Ringkas ──────────────────────────────────────── */}
            <div className={cn(
                'rounded-3xl border p-8 text-center relative overflow-hidden',
                isDone ? 'bg-emerald-50 border-emerald-100' :
                    isFailed ? 'bg-red-50 border-red-100' :
                        'bg-amber-50 border-amber-100'
            )}>
                {/* Background icon */}
                <div className="absolute right-6 top-6 opacity-5 pointer-events-none">
                    {isDone ? <CheckCircle2 className="w-32 h-32 text-emerald-600" /> :
                        isFailed ? <XCircle className="w-32 h-32 text-red-600" /> :
                            <Sparkles className="w-32 h-32 text-amber-500" />}
                </div>

                <div className="relative z-10 flex flex-col items-center gap-3">
                    {/* Status icon */}
                    {isDone && <CheckCircle2 className="w-14 h-14 text-emerald-500" />}
                    {isFailed && <XCircle className="w-14 h-14 text-red-500" />}
                    {job?.status === 'QUEUED' && <Clock className="w-14 h-14 text-amber-500 animate-pulse" />}
                    {job?.status === 'RUNNING' && <Loader2 className="w-14 h-14 text-amber-500 animate-spin" />}
                    {!job && <Loader2 className="w-14 h-14 text-slate-300 animate-spin" />}

                    {/* Title */}
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">{subjectLabel}</h1>

                    {/* Status badge */}
                    <div className={cn(
                        'px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest',
                        isDone ? 'bg-emerald-600 text-white' :
                            isFailed ? 'bg-red-600 text-white' :
                                job?.status === 'RUNNING' ? 'bg-amber-500 text-white' :
                                    'bg-slate-200 text-slate-600'
                    )}>
                        {isDone ? 'Selesai' :
                            isFailed ? 'Gagal' :
                                job?.status === 'RUNNING' ? 'Sedang Dibuat' :
                                    job?.status === 'QUEUED' ? 'Antrean' : 'Memuat...'}
                    </div>

                    {/* Running stage */}
                    {job?.status === 'RUNNING' && (
                        <p className="text-sm font-medium text-amber-700 animate-pulse">
                            {RUNNING_STAGES[stageIndex]}
                        </p>
                    )}
                    {job?.status === 'QUEUED' && (
                        <p className="text-sm font-medium text-amber-600">
                            Dokumen sedang masuk antrean. Proses akan dimulai sebentar lagi.
                        </p>
                    )}

                    {/* Timestamps */}
                    {job && (
                        <div className="flex items-center gap-4 text-xs text-slate-400 font-medium mt-1">
                            <span>Dibuat {new Date(job.created_at).toLocaleString('id-ID')}</span>
                            {isDone && <span className="text-emerald-600 font-bold">· Selesai {new Date(job.updated_at).toLocaleString('id-ID')}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── FAILED state recovery ──────────────────────────────────── */}
            {isFailed && (
                <div className="bg-white rounded-3xl border border-red-100 p-6">
                    <div className="flex items-start gap-3 mb-5">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-black text-slate-900 mb-1">Proses pembuatan dokumen gagal</p>
                            <p className="text-xs font-mono bg-red-50 text-red-700 p-3 rounded-xl leading-relaxed border border-red-100 mt-2">
                                {job?.last_error || 'Terjadi kesalahan internal saat menyusun dokumen.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => router.push('/wizard')}
                            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 transition shadow-lg shadow-emerald-100">
                            <RefreshCw className="w-4 h-4" /> Coba Generate Ulang
                        </button>
                        <Link href="/wizard"
                            className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-black hover:bg-slate-200 transition">
                            <BookOpen className="w-4 h-4" /> Buka Wizard
                        </Link>
                        <Link href="/billing"
                            className="flex items-center gap-2 px-5 py-3 border border-slate-200 text-slate-500 rounded-xl text-sm font-bold hover:bg-slate-50 transition">
                            <AlertCircle className="w-4 h-4" /> Cek Saldo Kredit
                        </Link>
                    </div>
                </div>
            )}

            {/* ─── B: Aksi Utama (Done only) ─────────────────────────────── */}
            {isDone && (
                <div className="bg-white rounded-3xl border border-slate-100 p-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Aksi Utama</p>

                    {/* Primary */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        {job?.pdf_url ? (
                            <a href={job.pdf_url} target="_blank" rel="noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-emerald-700 hover:-translate-y-0.5 shadow-xl shadow-emerald-200 transition-all">
                                <Download className="w-5 h-5" /> Unduh Dokumen (PDF)
                            </a>
                        ) : (
                            <button disabled className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-400 px-6 py-4 rounded-2xl font-black text-sm cursor-not-allowed">
                                <Download className="w-5 h-5" /> PDF Belum Tersedia
                            </button>
                        )}
                    </div>

                    {/* Secondary */}
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => router.push('/wizard')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black transition">
                            <RefreshCw className="w-3.5 h-3.5" /> Generate Ulang
                        </button>
                        <button onClick={() => router.push('/wizard')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black transition">
                            <Sparkles className="w-3.5 h-3.5" /> Duplikasi untuk Topik Baru
                        </button>
                        {job?.public_id && (
                            <button onClick={handleCopyLink}
                                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition border',
                                    isCopied ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')}>
                                {isCopied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Disalin!</> : <><Copy className="w-3.5 h-3.5" /> Salin Verify Link</>}
                            </button>
                        )}
                        <Link href={`/modules/${job?.id}/edit`}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black transition">
                            <ExternalLink className="w-3.5 h-3.5" /> Edit Modul
                        </Link>
                        <Link href="/modules"
                            className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-slate-700 rounded-xl text-xs font-bold transition">
                            <ArrowLeft className="w-3.5 h-3.5" /> Riwayat Modul
                        </Link>
                    </div>
                </div>
            )}

            {/* ─── C: Ringkasan Dokumen (Done only) ──────────────────────── */}
            {isDone && job && (
                <div className="bg-white rounded-3xl border border-slate-100 p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ringkasan Dokumen</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                        <MetaItem label="Mata Pelajaran" value={subjectLabel} />
                        <MetaItem label="Semester" value={semesterLabel} />
                        <MetaItem label="Kelas" value={job.payload?.grade ? `Kelas ${job.payload.grade}` : undefined} />
                        <MetaItem label="Topik" value={job.payload?.topic} />
                        <MetaItem label="Nama Guru" value={teacherProfile?.full_name} />
                        <MetaItem label="Nama Sekolah" value={schoolIdentity?.school_display_name} />
                    </div>
                    {job.payload?.notes && (
                        <div className="mt-5 pt-5 border-t border-slate-50">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Catatan untuk AI</p>
                            <p className="text-sm text-slate-600 italic leading-relaxed">&ldquo;{job.payload.notes}&rdquo;</p>
                        </div>
                    )}
                </div>
            )}

            {/* ─── D: Identitas Dokumen (Done only) ──────────────────────── */}
            {isDone && (teacherProfile || schoolIdentity) && (
                <div className="bg-white rounded-3xl border border-slate-100 p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <User className="w-4 h-4 text-emerald-600" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identitas Dokumen</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                        <div className="col-span-2">
                            <div className="flex items-center gap-2 mb-3">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guru</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                <MetaItem label="Nama Guru" value={teacherProfile?.full_name} />
                                <MetaItem label="NIP Guru" value={teacherProfile?.nip} />
                            </div>
                        </div>
                        <div className="col-span-2 pt-4 border-t border-slate-50">
                            <div className="flex items-center gap-2 mb-3">
                                <School className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sekolah</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                <MetaItem label="Nama Sekolah" value={schoolIdentity?.school_display_name} />
                                <MetaItem label="NPSN" value={schoolIdentity?.school_npsn} />
                                <MetaItem label="Kab/Kota" value={schoolIdentity?.kab_kota} />
                                <MetaItem label="Provinsi" value={schoolIdentity?.provinsi} />
                                <MetaItem label="Kepala Sekolah" value={schoolIdentity?.principal_name} />
                                <MetaItem label="NIP Kepala Sekolah" value={schoolIdentity?.principal_nip} />
                                <MetaItem label="Kota Tanda Tangan" value={schoolIdentity?.signature_location} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── E: Detail Teknis (collapsible, Done only) ─────────────── */}
            {isDone && job && (job.pdf_sha256 || job.html_sha256 || job.id) && (
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                    <button
                        onClick={() => setShowTechDetail(v => !v)}
                        className="w-full flex items-center justify-between px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-colors"
                    >
                        <span>Detail Teknis</span>
                        {showTechDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showTechDetail && (
                        <div className="px-6 pb-6 border-t border-slate-50 pt-4 space-y-3 font-mono text-xs text-slate-600">
                            {[
                                ['ID Generasi', job.id],
                                ['PDF SHA-256', job.pdf_sha256 ? `${job.pdf_sha256.substring(0, 16)}...` : undefined],
                                ['HTML SHA-256', job.html_sha256 ? `${job.html_sha256.substring(0, 16)}...` : undefined],
                                ['Dibuat', new Date(job.created_at).toISOString()],
                                ['Selesai', new Date(job.updated_at).toISOString()],
                            ].map(([label, value]) => value ? (
                                <div key={label} className="flex justify-between items-center">
                                    <span className="text-slate-400">{label}</span>
                                    <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-slate-700">{value}</span>
                                </div>
                            ) : null)}
                        </div>
                    )}
                </div>
            )}

            {/* ─── F: Pratinjau Dokumen (Done only) ──────────────────────── */}
            {isDone && (
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                                <Eye className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pratinjau Dokumen</p>
                                {docVersion !== null && (
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                        {docVersion === 1 ? `Versi ${docVersion} – Hasil AI` : `Versi ${docVersion} – Revisi Manual`}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Link
                            href={`/modules/${generationId}/edit`}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                        >
                            <Pencil className="w-3.5 h-3.5" /> Edit Cepat
                        </Link>
                    </div>

                    {isLoadingPreview && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                        </div>
                    )}

                    {!isLoadingPreview && htmlPreview && (
                        <div className="h-[520px] overflow-hidden">
                            <iframe
                                srcDoc={htmlPreview}
                                title="Pratinjau Dokumen"
                                sandbox="allow-same-origin"
                                className="w-full h-full border-0"
                                style={{ background: '#f8fafc' }}
                            />
                        </div>
                    )}

                    {!isLoadingPreview && !htmlPreview && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                            <FileText className="w-10 h-10 text-slate-200" />
                            <p className="text-sm font-bold text-slate-400">Pratinjau belum tersedia</p>
                            <p className="text-xs text-slate-400 max-w-xs">
                                Dokumen mungkin masih diproses. Buka editor untuk melihat isi lengkap.
                            </p>
                            <Link
                                href={`/modules/${generationId}/edit`}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black hover:bg-indigo-100 transition mt-1"
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> Buka Editor
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Processing state secondary hint ───────────────────────── */}
            {isProcessing && job && (
                <div className="text-center py-6">
                    <p className="text-xs text-slate-400 font-medium">
                        Halaman ini memperbarui otomatis. Tidak perlu reload.
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-3">
                        <Link href="/modules" className="text-xs font-black text-slate-400 hover:text-slate-700 inline-flex items-center gap-1.5 uppercase tracking-widest transition-colors">
                            <ArrowLeft className="w-3 h-3" /> Kembali ke Riwayat
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
