import useSWR from 'swr';
import {
    Download, ShieldCheck, Loader2, FileText, Calendar,
    Calculator, FlaskConical, Languages, BookOpen, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useWorkspace } from '@/hooks/use-workspace';
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

const getSubjectIcon = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('matematika')) return Calculator;
    if (s.includes('ipa') || s.includes('sains') || s.includes('fisika') || s.includes('kimia') || s.includes('biologi')) return FlaskConical;
    if (s.includes('bahasa') || s.includes('inggris') || s.includes('indonesia')) return Languages;
    return BookOpen;
};

const getSubjectColor = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('matematika')) return "bg-blue-100 text-blue-600";
    if (s.includes('ipa')) return "bg-purple-100 text-purple-600";
    if (s.includes('bahasa')) return "bg-rose-100 text-rose-600";
    return "bg-emerald-100 text-emerald-600";
};

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
            <div className="flex flex-col items-center justify-center p-24 text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                <p className="font-medium">Memuat dokumen...</p>
            </div>
        );
    }

    if (documents.length === 0) {
        return (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed shadow-sm">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50/50">
                    <FileText className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Belum ada modul ajar</h3>
                <p className="text-slate-500 max-w-sm mx-auto mb-8 leading-relaxed">
                    Mulai buat modul ajar pertama Anda dengan mudah. Pilih jenjang dan mata pelajaran.
                </p>
                <Link
                    href="/generate"
                    className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 hover:-translate-y-0.5 transition-all font-semibold shadow-lg shadow-emerald-200"
                >
                    Buat Modul Sekarang
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ring-1 ring-slate-900/5">
            <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-[#FAFAFA]">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Mata Pelajaran</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Jenjang / Kelas</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Periode</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                    {documents.map((doc: Document) => {
                        const Icon = getSubjectIcon(doc.subject);
                        const colorClass = getSubjectColor(doc.subject);

                        return (
                            <tr key={doc.id || doc.public_id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className={cn("shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", colorClass)}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-bold text-slate-900">{doc.subject}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(doc.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                        {doc.jenjang || 'SD'}
                                    </span>
                                    <div className="text-xs text-slate-500 mt-1.5 font-medium ml-1">Kelas {doc.kelas}</div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="text-sm font-medium text-slate-900">{doc.tahun_ajaran}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">Semester {doc.semester}</div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                    <StatusBadge status={doc.status} />
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                                    {doc.status === 'ready' && (
                                        <div className="flex justify-end gap-2 opacity-100">
                                            <button
                                                onClick={async () => {
                                                    const token = await getToken();
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
                                                className="inline-flex items-center justify-center p-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200"
                                                title="Download PDF"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <a
                                                href={`${VERIFY_BASE}/verify/${doc.public_id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center justify-center p-2 rounded-lg text-slate-600 bg-white hover:bg-slate-50 transition-colors border border-slate-200 hover:border-slate-300"
                                                title="Verify Document"
                                            >
                                                <ShieldCheck className="w-4 h-4" />
                                            </a>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        queued: "bg-slate-100 text-slate-600 border-slate-200",
        running: "bg-blue-50 text-blue-600 border-blue-200 animate-pulse",
        ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
        failed: "bg-red-50 text-red-700 border-red-200",
    };

    const labels = {
        queued: "Antrian",
        running: "Memproses...",
        ready: "Selesai",
        failed: "Gagal",
    };

    return (
        <span className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
            styles[status as keyof typeof styles] || styles.queued
        )}>
            {status === 'running' && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
            {status === 'ready' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />}
            {labels[status as keyof typeof labels] || status}
        </span>
    );
}
