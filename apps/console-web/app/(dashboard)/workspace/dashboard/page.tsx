'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { useWorkspaceRole } from '@/hooks/use-workspace-role';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';
import {
    Users, BookOpen, TrendingUp, Zap,
    ShieldCheck, Activity, ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

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

function DashboardSkeleton() {
    return (
        <div className="max-w-7xl mx-auto py-10 px-6 space-y-10">
            <div className="flex justify-between items-end">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-64" />
                </div>
                <Skeleton className="h-12 w-48 rounded-2xl" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
            </div>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Skeleton className="lg:col-span-2 h-[350px] rounded-3xl" />
                <Skeleton className="h-[350px] rounded-3xl" />
            </div>
        </div>
    );
}

function MetricCard({
    icon: Icon,
    label,
    value,
    sub,
    colorClass,
    trend,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    colorClass?: string;
    trend?: string;
}) {
    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-4 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden relative border-b-4 hover:border-indigo-500/20">
            <div className={cn("absolute -right-4 -top-4 w-20 h-20 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12", colorClass)}>
                <Icon className="w-full h-full" />
            </div>
            <div className="flex items-center justify-between">
                <div className={cn("p-2.5 rounded-2xl bg-slate-50 transition-all", colorClass?.replace('text-', 'bg-'))}>
                    <Icon className={cn("w-5 h-5", colorClass || 'text-slate-500')} />
                </div>
                {trend && (
                    <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full tracking-widest uppercase">
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">{value}</div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
            {sub && <div className="text-[10px] text-slate-400 font-bold truncate">{sub}</div>}
        </div>
    );
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

    if (isLoadingWorkspace || isLoadingRole || isLoading) return <DashboardSkeleton />;

    if (error) {
        return (
            <div className="max-w-4xl mx-auto py-20 px-4 text-center">
                <div className="bg-red-50 border border-red-100 rounded-3xl p-8 flex flex-col items-center gap-4">
                    <ShieldCheck className="w-12 h-12 text-red-500" />
                    <h2 className="text-xl font-black text-red-900">Akses Terbatas</h2>
                    <p className="text-red-700 font-medium max-w-sm">{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2.5 bg-red-600 text-white font-black rounded-xl text-sm shadow-lg shadow-red-200">Coba Lagi</button>
                </div>
            </div>
        );
    }

    if (!data || !workspace) return null;

    const { overview, teachers, modules_by_subject, daily_modules } = data;
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
        <div className="max-w-7xl mx-auto py-10 px-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded uppercase tracking-widest h-fit">Workspace Admin</div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">{workspace.name}</h1>
                    </div>
                    <p className="text-slate-500 font-bold">Pantau aktivitas guru dan penggunaan kredit sekolah Anda.</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex flex-col items-end px-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan Name</span>
                        <span className="text-sm font-black text-indigo-600 flex items-center gap-1.5 pt-0.5 uppercase">
                            <Zap className="w-3 h-3 fill-current" /> {workspace.workspace_type}
                        </span>
                    </div>
                </div>
            </div>

            {/* 1. Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard icon={Users} label="Total Guru" value={overview.total_teachers} colorClass="text-indigo-500" />
                <MetricCard icon={BookOpen} label="Total Modul" value={overview.total_modules} trend="Done" colorClass="text-emerald-500" />
                <MetricCard icon={TrendingUp} label="30D Modul" value={overview.modules_this_month} sub="Bulan Berjalan" colorClass="text-amber-500" />
                <MetricCard icon={Zap} label="Kredit Sisa" value={overview.credits_remaining} sub={`dari ${overview.credits_total}`} colorClass="text-indigo-600" />
                <MetricCard icon={Activity} label="Konsumsi" value={overview.credits_this_month} sub="Bulan Terakhir" trend="Latest" colorClass="text-emerald-600" />
            </div>

            {/* 2. Credit Usage Bar */}
            <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="space-y-1">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Kesehatan Kredit Workspace</h2>
                        <p className="text-xs font-bold text-slate-400 lowercase tracking-widest">Sisa kapasitas operasional untuk seluruh guru</p>
                    </div>
                    <span className={cn(
                        "text-xl font-black tracking-tighter px-4 py-1.5 rounded-2xl",
                        creditPercent < 20 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                    )}>{creditPercent}% <span className="text-[10px] font-bold uppercase tracking-widest">Sisa</span></span>
                </div>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                    <div
                        className={cn('h-full transition-all duration-1000 ease-out', creditPercent < 20 ? 'bg-red-500' : 'bg-indigo-600')}
                        style={{ width: `${creditPercent}%` }}
                    />
                </div>
                <div className="flex justify-between mt-4">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Terpakai</span>
                            <span className="text-sm font-black text-slate-900">{overview.credits_total - overview.credits_remaining} Token</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tersisa</span>
                            <span className="text-sm font-black text-indigo-600">{overview.credits_remaining} Token</span>
                        </div>
                    </div>
                    <button onClick={() => router.push('/billing')} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2">
                        Buy More Credits <ArrowUpRight className="w-3 h-3" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 3. Module Production Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Timeline Produksi</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Aktivitas 14 hari terakhir</p>
                        </div>
                    </div>
                    {daily_modules.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-slate-300 text-sm font-bold uppercase tracking-widest italic opacity-50">Zero Activity Detected</div>
                    ) : (
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={daily_modules.map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) }))}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} allowDecimals={false} />
                                    <Tooltip
                                        cursor={{fill: '#f8fafc'}}
                                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* 4. Module Distribution by Subject */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col">
                    <div className="mb-6">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Mata Pelajaran</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Distribusi per kategori</p>
                    </div>
                    {modules_by_subject.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center opacity-30 italic font-bold uppercase tracking-widest text-xs">No Data Found</div>
                    ) : (
                        <div className="space-y-4 flex-1 overflow-y-auto scrollbar-hide pr-2">
                            {modules_by_subject.map((item, i) => {
                                const max = modules_by_subject[0]?.count || 1;
                                const pct = Math.round((item.count / max) * 100);
                                return (
                                    <div key={i} className="group">
                                        <div className="flex justify-between text-xs mb-2">
                                            <span className="font-black text-slate-700 truncate">{item.subject}</span>
                                            <span className="font-black text-indigo-600">{item.count}</span>
                                        </div>
                                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full group-hover:bg-indigo-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* 5. Teacher Activity Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Ranking Aktivitas Guru</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Monitoring produktivitas tim pengajar</p>
                    </div>
                    <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                        {(['modules_generated', 'last_activity'] as SortKey[]).map(key => (
                            <button
                                key={key}
                                onClick={() => setSortKey(key)}
                                className={cn(
                                    'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                                    sortKey === key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                )}
                            >
                                {key === 'modules_generated' ? 'By Modules' : 'By Activity'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Guru / Subjek</th>
                                <th className="text-right pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Modul</th>
                                <th className="text-right pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kredit</th>
                                <th className="text-right pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {sortedTeachers.map((teacher, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{teacher.name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{teacher.subject}</span>
                                        </div>
                                    </td>
                                    <td className="text-right font-black text-slate-900">{teacher.modules_generated}</td>
                                    <td className="text-right font-black text-slate-900">{teacher.credits_used}</td>
                                    <td className="text-right">
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest w-fit mb-1">
                                                Active
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {teacher.last_activity ? new Date(teacher.last_activity).toLocaleDateString() : '—'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
