'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, PlusCircle, AlertCircle, Wallet, FileText, XCircle, FileOutput, Clock, Eye, Download, Search } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type JobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

interface RecentJob {
    generation_id: string;
    subject: string;
    semester: number;
    status: JobStatus;
    created_at: string;
}

interface UsageSummary {
    credits_remaining: number;
    documents_generated: number;
    jobs_failed: number;
    recent_jobs: RecentJob[];
}

export default function DashboardPage() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [summary, setSummary] = useState<UsageSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function fetchSummary() {
            if (!isAuthLoaded || isLoadingWorkspace) return;
            if (!workspace) {
                if (isMounted) setIsLoading(false);
                return;
            }

            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspace.id}/usage-summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) {
                    throw new Error('Gagal memuat data ringkasan penggunaan.');
                }

                const data = await res.json();
                if (isMounted) {
                    setSummary(data);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error('Failed to fetch usage summary:', err);
                    setError(err.message || 'Terjadi kesalahan tidak terduga.');
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        fetchSummary();

        return () => {
            isMounted = false;
        };
    }, [isAuthLoaded, isLoadingWorkspace, workspace, getToken]);

    const renderStatusChip = (status: JobStatus) => {
        switch (status) {
            case 'DONE':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 tracking-wide uppercase">Selesai</span>;
            case 'FAILED':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 tracking-wide uppercase">Gagal</span>;
            case 'RUNNING':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 tracking-wide uppercase">Memproses</span>;
            case 'QUEUED':
            default:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 tracking-wide uppercase">Antrean</span>;
        }
    };

    if (!isAuthLoaded || isLoadingWorkspace || isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    // Empty State (No jobs at all and 0 generated)
    const isCompletelyEmpty = summary && summary.documents_generated === 0 && summary.jobs_failed === 0 && summary.recent_jobs.length === 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-6xl mx-auto space-y-8"
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard Overview</h1>
                    <p className="text-slate-500 mt-1 text-base">Pantau penggunaan kredit dan riwayat dokumen yang dihasilkan Edukasi AI.</p>
                </div>
                {!isCompletelyEmpty && (
                    <Link
                        href="/onboarding"
                        className="inline-flex items-center justify-center px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 hover:-translate-y-0.5 transition-all font-semibold shadow-lg shadow-emerald-200 group"
                    >
                        <PlusCircle className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                        Generate Baru
                    </Link>
                )}
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-start text-sm border border-red-100">
                    <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                    <div>{error}</div>
                </div>
            )}

            {isCompletelyEmpty && !error ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center mt-8">
                    <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border-8 border-emerald-50/50">
                        <FileOutput className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Belum ada dokumen dibuat</h2>
                    <p className="text-slate-500 max-w-md mx-auto mb-8 text-lg">
                        Mulai pengalaman revolusioner membuat Modul Ajar dan RPP modern pertama Anda dalam hitungan menit saja.
                    </p>
                    <Link
                        href="/onboarding"
                        className="inline-flex items-center justify-center px-8 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-1 transition-all font-bold text-lg shadow-lg shadow-emerald-600/30 group"
                    >
                        <PlusCircle className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                        Buat Modul Pertama
                    </Link>
                </div>
            ) : (
                summary && (
                    <>
                        {/* Metrics Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <motion.div whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Wallet className="w-24 h-24 text-blue-600 -mr-6 -mt-6 transform rotate-12" />
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                                        <Wallet className="w-6 h-6" />
                                    </div>
                                    <div className="text-sm font-bold text-slate-400 tracking-wider uppercase">Sisa Kredit</div>
                                </div>
                                <div className="text-4xl font-extrabold text-slate-900">{summary.credits_remaining}</div>
                                <div className="mt-2 text-sm text-slate-500 font-medium tracking-wide">Tersedia di Wallet Ledger</div>
                            </motion.div>

                            <motion.div whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <FileText className="w-24 h-24 text-emerald-600 -mr-6 -mt-6 transform rotate-12" />
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <div className="text-sm font-bold text-slate-400 tracking-wider uppercase">Dokumen Selesai</div>
                                </div>
                                <div className="text-4xl font-extrabold text-slate-900">{summary.documents_generated}</div>
                                <div className="mt-2 text-sm text-slate-500 font-medium tracking-wide">Total file Modul Ajar</div>
                            </motion.div>

                            <motion.div whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <XCircle className="w-24 h-24 text-red-600 -mr-6 -mt-6 transform rotate-12" />
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600 border border-red-100">
                                        <XCircle className="w-6 h-6" />
                                    </div>
                                    <div className="text-sm font-bold text-slate-400 tracking-wider uppercase">Generasi Gagal</div>
                                </div>
                                <div className="text-4xl font-extrabold text-slate-900">{summary.jobs_failed}</div>
                                <div className="mt-2 text-sm text-slate-500 font-medium tracking-wide">Kesalahan pemrosesan AI</div>
                            </motion.div>
                        </div>

                        {/* Recent Jobs Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="font-bold text-slate-900 text-lg flex items-center">
                                    <Clock className="w-5 h-5 mr-2 text-slate-400" />
                                    Aktivitas Terbaru
                                </h3>
                                <Link href="/jobs" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                                    Lihat Semua &rarr;
                                </Link>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-400 uppercase bg-white border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 font-bold">Mata Pelajaran</th>
                                            <th className="px-6 py-4 font-bold">Status</th>
                                            <th className="px-6 py-4 font-bold hidden sm:table-cell">Waktu Dibuat</th>
                                            <th className="px-6 py-4 font-bold text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {summary.recent_jobs.map((job) => (
                                            <tr key={job.generation_id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 mr-4 border border-indigo-100/50">
                                                            <FileText className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 text-base">
                                                                {job.subject}
                                                            </div>
                                                            <div className="text-slate-500 font-medium text-[13px] mt-0.5">
                                                                Semester {job.semester}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {renderStatusChip(job.status)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 whitespace-nowrap font-medium hidden sm:table-cell tracking-wide">
                                                    {new Date(job.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    <span className="text-slate-300 mx-2">|</span>
                                                    {new Date(job.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    {job.status === 'DONE' ? (
                                                        <Link
                                                            href={`/jobs/${job.generation_id}`}
                                                            className="inline-flex items-center text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50 px-4 py-2 rounded-xl font-bold transition-all hover:shadow-sm"
                                                        >
                                                            <Download className="w-4 h-4 mr-2" />
                                                            Unduh
                                                        </Link>
                                                    ) : (
                                                        <Link
                                                            href={`/jobs/${job.generation_id}`}
                                                            className="inline-flex items-center text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl font-bold transition-all hover:shadow-sm"
                                                        >
                                                            <Eye className="w-4 h-4 mr-2" />
                                                            Pantau
                                                        </Link>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )
            )}
        </motion.div>
    );
}
