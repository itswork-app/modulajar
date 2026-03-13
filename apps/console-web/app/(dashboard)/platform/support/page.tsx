'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, LineChart, Line
} from 'recharts';
import {
    Server, ShieldCheck, Search, Users, 
    AlertCircle, Clock, Zap, ArrowRight,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface SupportData {
    job_distribution: { status: string; count: string }[];
    errors_24h: number;
    avg_duration_s: number;
    job_trends: { day: string; status: string; count: string }[];
    active_users_24h: number;
    job_trends_formatted?: { day: string; success: number; failed: number }[];
}

interface Workspace {
    id: string;
    name: string;
    workspace_type: string;
    created_at: string;
    plan_name: string;
    subscription_status: string;
}

function SupportSkeleton() {
    return (
        <div className="max-w-7xl mx-auto py-10 px-6 space-y-10">
            <div className="flex justify-between items-end">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-64" />
                </div>
                <Skeleton className="h-12 w-48 rounded-2xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-[400px] rounded-3xl" />
                <Skeleton className="h-[400px] rounded-3xl" />
            </div>
        </div>
    );
}

export default function SupportDashboard() {
    const { getToken } = useAuth();
    const [data, setData] = useState<SupportData | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/platform/stats/technical`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Akses ditolak atau gagal memuat data stats.');
            const json = await res.json();
            
            // Process trends for LineChart
            const trendMap: Record<string, { day: string; success: number; failed: number }> = {};
            json.job_trends.forEach((t: { day: string; status: string; count: string }) => {
                const day = new Date(t.day).toLocaleDateString('id-ID', { weekday: 'short' });
                if (!trendMap[day]) trendMap[day] = { day, success: 0, failed: 0 };
                if (t.status === 'done') trendMap[day].success += parseInt(t.count);
                if (t.status === 'failed') trendMap[day].failed += parseInt(t.count);
            });

            setData({
                ...json,
                job_trends_formatted: Object.values(trendMap).reverse()
            });
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [getToken]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSearching(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/platform/workspaces?search=${search}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            setWorkspaces(json.workspaces);
        } catch (err) {
            console.error('Search failed', err);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading) return <SupportSkeleton />;

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

    const COLORS = {
        done: '#10b981',
        failed: '#ef4444',
        processing: '#6366f1',
        pending: '#f59e0b'
    };

    return (
        <div className="max-w-7xl mx-auto py-10 px-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded uppercase tracking-widest h-fit">Technical Ops</div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">System Health</h1>
                    </div>
                    <p className="text-slate-500 font-bold">Real-time monitoring of generation pipelines and workspace distribution.</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl border border-emerald-100">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-black uppercase tracking-widest">Systems Nominal</span>
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-red-50 text-red-600">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Errors (24h)</p>
                            <h3 className="text-2xl font-black text-slate-900">{data.errors_24h}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Duration</p>
                            <h3 className="text-2xl font-black text-slate-900">{data.avg_duration_s}s</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Users (24h)</p>
                            <h3 className="text-2xl font-black text-slate-900">{data.active_users_24h}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                            <Zap className="w-6 h-6 fill-current" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Success Rate</p>
                            <h3 className="text-2xl font-black text-slate-900">
                                {Math.round((parseInt(data.job_distribution.find(j => j.status === 'done')?.count || '0') / 
                                (data.job_distribution.reduce((acc, curr) => acc + parseInt(curr.count), 0) || 1)) * 100)}%
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Health Trends */}
                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                    <div className="mb-8">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Performance Trends</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">7-Day Generation health</p>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.job_trends_formatted}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line type="monotone" dataKey="success" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Job Distribution Bar Chart */}
                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                    <div className="mb-8">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Status distribution</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Total jobs by current state</p>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.job_distribution}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} tickFormatter={(v) => v.toUpperCase()} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                                <Tooltip 
                                    cursor={{fill: '#f8fafc'}}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                    {data.job_distribution.map((entry, index) => (
                                        <Cell key={index} fill={(COLORS as Record<string, string>)[entry.status] || '#94a3b8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Global Workspace Lookup */}
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10">
                    <Server className="w-64 h-64 rotate-12" />
                </div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black mb-6 flex items-center gap-3">
                        <Search className="w-8 h-8 text-indigo-400" />
                        Global Workspace Lookup
                    </h2>
                    <form onSubmit={handleSearch} className="flex gap-4 max-w-2xl mb-10">
                        <input 
                            type="text" 
                            placeholder="Search by ID or School Name..." 
                            className="flex-1 bg-white/10 border-2 border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500 transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button 
                            disabled={isSearching}
                            className="px-8 py-4 bg-indigo-600 rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
                        </button>
                    </form>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[400px] overflow-y-auto pr-4 scrollbar-hide">
                        {workspaces.map((ws) => (
                            <div key={ws.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all group">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h4 className="font-black text-lg">{ws.name}</h4>
                                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">{ws.id}</p>
                                    </div>
                                    <div className={cn(
                                        "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                                        ws.subscription_status === 'active' ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"
                                    )}>
                                        {ws.plan_name}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <span className="text-xs text-white/50">{new Date(ws.created_at).toLocaleDateString()}</span>
                                    <button className="flex items-center gap-1 text-[10px] font-black text-indigo-400 uppercase tracking-widest group-hover:text-indigo-300 transition-colors">
                                        Manage Access <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
