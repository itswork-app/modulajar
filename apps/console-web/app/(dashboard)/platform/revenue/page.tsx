'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import {
    DollarSign, TrendingUp, Users, Activity,
    Globe, ShieldCheck, Wallet, ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface RevenueData {
    total_revenue: number;
    mrr: number;
    growth: {
        month: string;
        rev: string;
        prev_rev: string | null;
    }[];
    top_workspaces: {
        name: string;
        revenue: string;
    }[];
}

function RevenueSkeleton() {
    return (
        <div className="max-w-7xl mx-auto py-10 px-6 space-y-10">
            <div className="flex justify-between items-end">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-64" />
                </div>
                <Skeleton className="h-12 w-40 rounded-2xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Skeleton className="lg:col-span-2 h-[450px] rounded-3xl" />
                <Skeleton className="h-[450px] rounded-3xl" />
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, icon: Icon, trend, colorClass }: { label: string; value: string | number; sub?: string; icon: React.ElementType; trend?: string; colorClass?: string }) {
    return (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col gap-4 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden relative border-b-4 border-slate-50 hover:border-indigo-500/20">
            <div className={cn("absolute -right-4 -top-4 w-24 h-24 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12", colorClass)}>
                <Icon className="w-full h-full" />
            </div>
            <div className="flex items-center justify-between">
                <div className={cn("p-3 rounded-2xl bg-slate-50 group-hover:bg-opacity-10 transition-all", colorClass?.replace('text-', 'bg-'))}>
                    <Icon className={cn("w-6 h-6", colorClass)} />
                </div>
                {trend && (
                    <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                        <TrendingUp className="w-3 h-3" /> {trend}
                    </div>
                )}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h3>
                {sub && <p className="text-xs text-slate-400 font-bold mt-1 truncate">{sub}</p>}
            </div>
        </div>
    );
}

export default function RevenueDashboard() {
    const { getToken } = useAuth();
    const [data, setData] = useState<RevenueData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const formatIDR = (val: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(val);
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/platform/stats/revenue`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Akses ditolak atau gagal memuat data.');
            const json = await res.json();
            // Data is sorted DESC from backend, reverse it for chronological chart
            setData({
                ...json,
                growth: [...json.growth].reverse()
            });
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading) return <RevenueSkeleton />;

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

    if (!data) return null;

    return (
        <div className="max-w-7xl mx-auto py-10 px-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded uppercase tracking-widest h-fit">Investor Grade</div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Revenue Analysis</h1>
                    </div>
                    <p className="text-slate-500 font-bold">Platform-wide financial metrics and 6-month growth indicators.</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex flex-col items-end px-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Status</span>
                        <span className="text-sm font-black text-emerald-600 flex items-center gap-1.5 pt-0.5">
                            <Activity className="w-3 h-3 animate-pulse" /> Live & Stable
                        </span>
                    </div>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    label="Total Lifetime Revenue" 
                    value={formatIDR(data.total_revenue)} 
                    sub="Revenue dari seluruh unit bisnis"
                    icon={DollarSign}
                    colorClass="text-emerald-500"
                />
                <StatCard 
                    label="Monthly Recurring Revenue" 
                    value={formatIDR(data.mrr)} 
                    sub="Berdasarkan langganan aktif"
                    icon={TrendingUp}
                    trend="Plan B2B"
                    colorClass="text-indigo-500"
                />
                <StatCard 
                    label="Average Revenue Per Unit" 
                    value={formatIDR(data.total_revenue / (data.top_workspaces.length || 1))} 
                    sub="Rata-rata kontribusi per sekolah"
                    icon={Users}
                    colorClass="text-amber-500"
                />
                 <StatCard 
                    label="Tokenized Assets" 
                    value={`${(data.total_revenue / 5000).toLocaleString()} TKN`} 
                    sub="Equivalensi kredit berbayar"
                    icon={Wallet}
                    colorClass="text-emerald-600"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Growth Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Revenue Trends</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Last 6 Months Visualization</p>
                        </div>
                        <div className="px-3 py-1 bg-slate-50 rounded-full border border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Currency in IDR
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.growth}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="month" 
                                    tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} 
                                    tickFormatter={(val) => new Date(val).toLocaleDateString('id-ID', { month: 'short' })}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis 
                                    tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} 
                                    tickFormatter={(val) => `Rp ${val/1e6}M`} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip 
                                    cursor={{stroke: '#6366f1', strokeWidth: 2}}
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px' }}
                                    formatter={(value: any) => [formatIDR(value), 'Revenue']}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                />
                                <Area type="monotone" dataKey="rev" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Workspaces */}
                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm flex flex-col">
                    <div className="mb-6">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Top Accounts</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">By Performance contribution</p>
                    </div>
                    <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide">
                        {data.top_workspaces.length > 0 ? data.top_workspaces.map((ws, i) => (
                            <div key={i} className="flex items-center justify-between group p-2 hover:bg-slate-50 rounded-2xl transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        {i + 1}
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{ws.name}</span>
                                </div>
                                <span className="text-xs font-black text-slate-900">{formatIDR(parseInt(ws.revenue))}</span>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-30">
                                <Globe className="w-10 h-10" />
                                <p className="text-xs font-bold uppercase tracking-widest">No Active Accounts</p>
                            </div>
                        )}
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-50">
                        <button className="w-full py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2">
                            Global Workspace List <ArrowUpRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
