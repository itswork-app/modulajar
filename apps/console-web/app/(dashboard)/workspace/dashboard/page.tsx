'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { useWorkspaceRole } from '@/hooks/use-workspace-role';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    Users, BookOpen, TrendingUp, Zap, Loader2, AlertCircle,
    ArrowUpDown, BookMarked
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface DashboardData {
    overview: {
        total_teachers: number;
        total_modules: number;
        modules_this_month: number;
        credits_remaining: number;
        credits_this_month: number;
        credits_total: number;
    };
    teachers: {
        name: string;
        subject: string;
        modules_generated: number;
        last_activity: string | null;
        credits_used: number;
    }[];
    activity_feed: {
        teacher_name: string;
        subject: string;
        grade: string;
        action: string;
        created_at: string;
    }[];
    modules_by_subject: { subject: string; count: number }[];
    daily_modules: { date: string; count: number }[];
}

type SortKey = 'modules_generated' | 'last_activity';

function MetricCard({
    icon: Icon,
    label,
    value,
    sub,
    accent,
    trend,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    accent?: string;
    trend?: string;
}) {
    return (
        <div className={cn(
            'bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group',
            accent
        )}>
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                <Icon className="w-20 h-20 -rotate-12 translate-x-4 -translate-y-4" />
            </div>
            
            <div className="flex items-center justify-between">
                <div className="p-2.5 bg-slate-50 group-hover:bg-indigo-50 transition-colors rounded-2xl">
                    <Icon className="w-5 h-5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
                </div>
                {trend && (
                    <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full tracking-widest uppercase">
                        {trend}
                    </span>
                )}
            </div>
            
            <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight mb-0.5">{value}</div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] shrink-0">{label}</span>
            </div>
            
            {sub && <div className="text-xs text-slate-400 font-bold leading-relaxed">{sub}</div>}
        </div>
    );
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function AdminDashboardPage() {
    const router = useRouter();
    const { getToken } = useAuth();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
    const { isAdmin, isLoading: isLoadingRole } = useWorkspaceRole();

    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('modules_generated');

    const fetchData = useCallback(async () => {
        if (!workspace) return;
        setIsLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/admin/dashboard`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 403) {
                router.replace('/modules');
                return;
            }
            if (!res.ok) throw new Error('Gagal memuat data dashboard.');
            const json = await res.json();
            setData(json);
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [workspace, getToken, router]);

    useEffect(() => {
        if (!isLoadingWorkspace && !isLoadingRole) {
            if (!isAdmin) {
                router.replace('/modules');
                return;
            }
            fetchData();
        }
    }, [isLoadingWorkspace, isLoadingRole, isAdmin, fetchData, router]);

    if (isLoadingWorkspace || isLoadingRole || isLoading) {
        return (
            <div className="flex h-[65vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                    <span className="text-slate-500 font-medium text-sm">Memuat Dashboard Sekolah...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto py-16 text-center">
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { overview, teachers, activity_feed, modules_by_subject, daily_modules } = data;
    const creditPercent = overview.credits_total > 0
        ? Math.min(100, Math.round((overview.credits_remaining / overview.credits_total) * 100))
        : 100;

    const sortedTeachers = [...teachers].sort((a, b) => {
        if (sortKey === 'modules_generated') return b.modules_generated - a.modules_generated;
        if (!a.last_activity) return 1;
        if (!b.last_activity) return -1;
        return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
    });

    return (
        <div className="max-w-6xl mx-auto py-8 lg:py-12 px-4 animate-in fade-in duration-500 space-y-10">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Sekolah</h1>
                <p className="text-slate-500 font-medium mt-1">Pantau aktivitas guru, produksi modul, dan penggunaan kredit di seluruh workspace sekolah.</p>
            </div>

            {/* 1. Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard icon={Users} label="Total Guru" value={overview.total_teachers} />
                <MetricCard icon={BookOpen} label="Total Modul" value={overview.total_modules} trend="Active" />
                <MetricCard icon={TrendingUp} label="Modul Bulan Ini" value={overview.modules_this_month} sub="dalam 30 hari terakhir" />
                <MetricCard icon={Zap} label="Kredit Tersisa" value={overview.credits_remaining} sub={`dari ${overview.credits_total} total`} />
                <MetricCard icon={Zap} label="Kredit Bulan Ini" value={overview.credits_this_month} sub="dikonsumsi bulan ini" trend="Latest" />
            </div>

            {/* 2. Credit Usage Bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-black text-slate-900">Penggunaan Kredit</h2>
                    <span className="text-sm font-bold text-slate-500">{creditPercent}% tersisa</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={cn('h-full rounded-full transition-all duration-700', creditPercent < 20 ? 'bg-red-500' : creditPercent < 50 ? 'bg-amber-400' : 'bg-emerald-500')}
                        style={{ width: `${creditPercent}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs font-medium text-slate-400">
                    <span>Terpakai: {overview.credits_total - overview.credits_remaining}</span>
                    <span>Tersisa: {overview.credits_remaining}</span>
                </div>
                <div className="mt-4 text-sm text-slate-500">
                    Rata-rata per guru: <span className="font-bold text-slate-700">{overview.total_teachers > 0 ? Math.round((overview.credits_total - overview.credits_remaining) / overview.total_teachers) : 0} kredit</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 3. Module Production Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h2 className="font-black text-slate-900 mb-6">Produksi Modul (14 Hari Terakhir)</h2>
                    {daily_modules.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-slate-400 text-sm font-medium">Belum ada data produksi.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={daily_modules.map(d => ({ ...d, date: formatShortDate(d.date) }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                                    labelStyle={{ fontWeight: 'bold' }}
                                />
                                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Modul" />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* 4. Module Distribution by Subject */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h2 className="font-black text-slate-900 mb-5 flex items-center gap-2">
                        <BookMarked className="w-4 h-4 text-indigo-500" /> Per Mata Pelajaran
                    </h2>
                    {modules_by_subject.length === 0 ? (
                        <div className="text-slate-400 text-sm font-medium">Belum ada data.</div>
                    ) : (
                        <div className="space-y-3">
                            {modules_by_subject.map((item) => {
                                const max = modules_by_subject[0]?.count || 1;
                                const pct = Math.round((item.count / max) * 100);
                                return (
                                    <div key={item.subject}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold text-slate-700 truncate">{item.subject}</span>
                                            <span className="font-black text-slate-900 ml-2">{item.count}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* 5. Teacher Activity Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-black text-slate-900">Aktivitas Guru</h2>
                    <div className="flex gap-2">
                        {(['modules_generated', 'last_activity'] as SortKey[]).map(key => (
                            <button
                                key={key}
                                onClick={() => setSortKey(key)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                    sortKey === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                )}
                            >
                                <ArrowUpDown className="w-3 h-3" />
                                {key === 'modules_generated' ? 'Modul' : 'Aktivitas'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Guru</th>
                                <th className="text-left pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mata Pelajaran</th>
                                <th className="text-right pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Modul</th>
                                <th className="text-right pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Terakhir Aktif</th>
                                <th className="text-right pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kredit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {sortedTeachers.map((teacher, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3 font-semibold text-slate-900">{teacher.name}</td>
                                    <td className="py-3 text-slate-500">{teacher.subject}</td>
                                    <td className="py-3 text-right font-black text-indigo-600">{teacher.modules_generated}</td>
                                    <td className="py-3 text-right text-slate-400">{formatDate(teacher.last_activity)}</td>
                                    <td className="py-3 text-right font-bold text-slate-700">{teacher.credits_used}</td>
                                </tr>
                            ))}
                            {sortedTeachers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">Belum ada aktivitas guru.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 6. Recent Activity Feed */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="font-black text-slate-900 mb-5">Aktivitas Terbaru</h2>
                {activity_feed.length === 0 ? (
                    <div className="text-slate-400 font-medium text-sm">Belum ada aktivitas di workspace ini.</div>
                ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {activity_feed.map((event, idx) => (
                            <div key={idx} className="flex items-start gap-3 text-sm">
                                <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="font-bold text-slate-800">{event.teacher_name}</span>
                                    <span className="text-slate-500"> membuat modul </span>
                                    <span className="font-semibold text-slate-700">{event.subject || 'Modul Ajar'}</span>
                                    {event.grade && <span className="text-slate-500"> kelas {event.grade}</span>}
                                </div>
                                <span className="text-xs text-slate-400 shrink-0">{formatDate(event.created_at)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
