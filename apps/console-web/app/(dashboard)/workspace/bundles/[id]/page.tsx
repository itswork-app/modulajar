'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import {
    Loader2, CheckCircle2, Clock, XCircle, Download, ArrowLeft,
    FileText, BookOpen, Calendar, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type JobStatus = 'queued' | 'running' | 'done' | 'failed';
type DocType = 'atp' | 'prota' | 'promes' | 'modul_ajar';

interface BundleJob {
    id: string;
    status: JobStatus;
    doc_type: DocType;
    topic_title?: string | null;
    topic_index?: number | null;
    created_at: string;
}

interface BundleData {
    bundle_id: string;
    subject: string;
    kelas: string;
    semester: string;
    tahun_ajaran: string;
    teacher_name: string | null;
    school_name: string | null;
    status: string;
    topic_count: number;
    modul_progress: { done: number; total: number };
    created_at: string;
    jobs: BundleJob[];
}

const DOC_LABELS: Record<DocType, string> = {
    atp: 'ATP — Alur Tujuan Pembelajaran',
    prota: 'Prota — Program Tahunan',
    promes: 'Promes — Program Semester',
    modul_ajar: 'Modul Ajar',
};

const DOC_ICONS: Record<DocType, React.ElementType> = {
    atp: BarChart3,
    prota: Calendar,
    promes: Calendar,
    modul_ajar: BookOpen,
};

function StatusBadge({ status }: { status: JobStatus }) {
    const config: Record<JobStatus, { label: string; cls: string; icon: React.ElementType }> = {
        queued: { label: 'Menunggu', cls: 'bg-slate-100 text-slate-500', icon: Clock },
        running: { label: 'Diproses', cls: 'bg-amber-50 text-amber-600', icon: Loader2 },
        done: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
        failed: { label: 'Gagal', cls: 'bg-red-50 text-red-500', icon: XCircle },
    };
    const c = config[status] || config.queued;
    const Icon = c.icon;
    return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold', c.cls)}>
            <Icon className={cn('w-3.5 h-3.5', status === 'running' && 'animate-spin')} />
            {c.label}
        </span>
    );
}

export default function BundleResultPage() {
    const params = useParams();
    const bundleId = params.id as string;
    const router = useRouter();
    const { getToken } = useAuth();
    const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();

    const [bundle, setBundle] = useState<BundleData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchBundle = useCallback(async () => {
        if (!workspace) return;
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/bundle/${bundleId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Bundle tidak ditemukan.');
            const data: BundleData = await res.json();
            setBundle(data);
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [workspace, bundleId, getToken]);

    useEffect(() => {
        if (!workspace) return;
        fetchBundle();
    }, [workspace, fetchBundle]);

    // Poll every 3 seconds while in progress
    useEffect(() => {
        if (!bundle || bundle.status === 'done' || bundle.status === 'failed') return;
        const timer = setInterval(fetchBundle, 3000);
        return () => clearInterval(timer);
    }, [bundle, fetchBundle]);

    if (isWorkspaceLoading || isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
        );
    }

    if (error || !bundle) {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center">
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h2 className="font-black text-slate-900 text-xl mb-2">Bundle Tidak Ditemukan</h2>
                <p className="text-slate-500 text-sm mb-6">{error}</p>
                <button onClick={() => router.push('/wizard')}
                    className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-colors">
                    Kembali ke Wizard
                </button>
            </div>
        );
    }

    const adminJobs = bundle.jobs.filter(j => j.doc_type !== 'modul_ajar');
    const modulJobs = bundle.jobs.filter(j => j.doc_type === 'modul_ajar');
    const isComplete = bundle.status === 'done';
    const hasFailed = bundle.status === 'failed';
    const isInProgress = ['pending', 'running'].includes(bundle.status);

    const overallPct = bundle.jobs.length > 0
        ? Math.round((bundle.jobs.filter(j => j.status === 'done').length / bundle.jobs.length) * 100)
        : 0;

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 animate-in fade-in duration-500 space-y-6">

            {/* Back */}
            <button onClick={() => router.push('/wizard')}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-semibold transition-colors">
                <ArrowLeft className="w-4 h-4" /> Wizard
            </button>

            {/* Header */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-violet-50 rounded-full text-violet-600 text-xs font-bold mb-2">
                            Bundle Administrasi
                        </div>
                        <h1 className="text-xl font-black text-slate-900">
                            {bundle.subject} — Kelas {bundle.kelas}
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Semester {bundle.semester} · {bundle.tahun_ajaran}
                            {bundle.teacher_name && ` · ${bundle.teacher_name}`}
                        </p>
                    </div>
                    <StatusBadge status={isComplete ? 'done' : hasFailed ? 'failed' : isInProgress ? 'running' : 'queued'} />
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                        <span>Progress keseluruhan</span>
                        <span>{bundle.jobs.filter(j => j.status === 'done').length} / {bundle.jobs.length} dokumen</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div
                            className={cn('h-2.5 rounded-full transition-all duration-700',
                                isComplete ? 'bg-emerald-500' : hasFailed ? 'bg-red-400' : 'bg-violet-500')}
                            style={{ width: `${overallPct}%` }}
                        />
                    </div>
                </div>

                {isInProgress && (
                    <p className="text-xs text-slate-400 mt-3 animate-pulse">
                        Halaman ini otomatis diperbarui setiap 3 detik...
                    </p>
                )}
            </div>

            {/* Admin docs section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="font-black text-slate-800 text-base mb-4">Dokumen Administrasi</h2>
                <div className="space-y-3">
                    {adminJobs.map(job => {
                        const Icon = DOC_ICONS[job.doc_type] || FileText;
                        return (
                            <div key={job.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                                        <Icon className="w-4 h-4 text-violet-500" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-800">
                                        {DOC_LABELS[job.doc_type]}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={job.status} />
                                    {job.status === 'done' && (
                                        <a
                                            href={`${API_BASE}/verify/${job.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors"
                                        >
                                            <Download className="w-3 h-3" /> Unduh
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Module jobs section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-black text-slate-800 text-base">Modul Ajar</h2>
                    <span className="text-sm font-bold text-violet-600">
                        {bundle.modul_progress.done} / {bundle.modul_progress.total} selesai
                    </span>
                </div>
                <div className="space-y-2">
                    {modulJobs
                        .sort((a, b) => (a.topic_index ?? 0) - (b.topic_index ?? 0))
                        .map((job, i) => (
                            <div key={job.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-black flex items-center justify-center shrink-0">
                                        {(job.topic_index ?? i) + 1}
                                    </span>
                                    <span className="text-sm font-medium text-slate-700">
                                        {job.topic_title || `Modul ${(job.topic_index ?? i) + 1}`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={job.status} />
                                    {job.status === 'done' && (
                                        <a
                                            href={`${API_BASE}/verify/${job.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors"
                                        >
                                            <Download className="w-3 h-3" /> Unduh
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                </div>
            </div>

        </div>
    );
}
