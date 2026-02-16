'use client';

import useSWR from 'swr';
import { Download, ShieldCheck, Loader2, FileText, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useWorkspace } from '@/hooks/use-workspace'; // New Hook
import { useAuth } from '@clerk/nextjs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const VERIFY_BASE = process.env.NEXT_PUBLIC_VERIFY_BASE_URL;

const fetcher = (url: string, token: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.json());

interface Document {
    id?: string;
    public_id: string;
    subject: string;
    jenjang?: string;
    kelas: string;
    semester: string;
    tahun_ajaran: string;
    status: string;
    created_at: string;
}

export function DocumentTable() {
    const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();
    const { getToken } = useAuth();

    const { data, isLoading } = useSWR(
        workspace?.id ? [`${API_BASE}/w/${workspace.id}/documents`, 'token'] : null,
        async ([url]) => {
            const token = await getToken();
            if (!token) return { documents: [] };
            return fetcher(url, token);
        },
        {
            refreshInterval: 3000,
        }
    );

    const documents: Document[] = data?.documents || [];
    const loading = isLoading || isWorkspaceLoading;

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center p-12 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading documents...
            </div>
        );
    }

    if (documents.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">Belum ada dokumen</h3>
                <p className="text-slate-500 mt-1 mb-6">Mulai buat modul ajar pertama Anda.</p>
                <Link href="/app/generate" className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium">
                    Buat Sekarang
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mata Pelajaran</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Jenjang / Kelas</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tahun / Sem</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {documents.map((doc: Document) => (
                        <tr key={doc.id || doc.public_id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-8 w-8 rounded bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-slate-900">{doc.subject}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(doc.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-slate-900">{doc.jenjang || 'SD'}</div>
                                <div className="text-xs text-slate-500">Kelas {doc.kelas}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-slate-900">{doc.tahun_ajaran}</div>
                                <div className="text-xs text-slate-500">Semester {doc.semester}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <StatusBadge status={doc.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                {doc.status === 'ready' && (
                                    <>
                                        <button
                                            onClick={async () => {
                                                const token = await getToken();
                                                // 1. Get Signed URL
                                                const res = await fetch(`${API_BASE}/documents/${doc.public_id}/download`, {
                                                    headers: { Authorization: `Bearer ${token}` }
                                                });
                                                if (res.ok) {
                                                    const { download_url } = await res.json();
                                                    window.location.href = download_url;
                                                } else {
                                                    alert('Gagal download');
                                                }
                                            }}
                                            className="text-emerald-600 hover:text-emerald-900 inline-flex items-center gap-1 border border-emerald-200 px-3 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download
                                        </button>
                                        <a
                                            href={`${VERIFY_BASE}/verify/${doc.public_id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 px-3 py-1 hover:bg-slate-100 rounded-md transition-colors"
                                        >
                                            <ShieldCheck className="w-4 h-4" />
                                        </a>
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        queued: "bg-slate-100 text-slate-600",
        running: "bg-blue-50 text-blue-600 animate-pulse",
        ready: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
        failed: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10",
    };

    const labels = {
        queued: "Antrian",
        running: "Memproses...",
        ready: "Selesai",
        failed: "Gagal",
    };

    return (
        <span className={cn(
            "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-slate-500/10",
            styles[status as keyof typeof styles] || styles.queued
        )}>
            {status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {labels[status as keyof typeof labels] || status}
        </span>
    );
}
