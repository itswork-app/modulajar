'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { 
  TrendingUp, 
  Users, 
  ShieldCheck, 
  Activity,
  Zap,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function DashboardPage() {
  const { getToken } = useAuth();

  const fetcher = async (url: string) => {
    const token = await getToken();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  };

  const { data: revStats, isLoading: revLoading } = useSWR(`${API_BASE}/platform/stats/revenue`, fetcher);
  const { data: techStats, isLoading: techLoading } = useSWR(`${API_BASE}/platform/stats/technical`, fetcher);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const stats = [
    { 
      label: 'Total Revenue', 
      value: revLoading ? '...' : formatIDR(revStats?.total_revenue || 0), 
      trend: '+12%', 
      icon: TrendingUp, 
      color: 'text-emerald-400' 
    },
    { 
      label: 'Active Users (24h)', 
      value: techLoading ? '...' : (techStats?.active_users_24h || 0).toLocaleString(), 
      trend: '+5%', 
      icon: Users, 
      color: 'text-indigo-400' 
    },
    { 
      label: 'Gen Success Rate', 
      value: techLoading ? '...' : `${Math.round((parseInt(techStats?.job_distribution?.find((j: { status: string; count: string }) => j.status === 'done')?.count || '0') / 
        (techStats?.job_distribution?.reduce((acc: number, curr: { count: string }) => acc + parseInt(curr.count), 0) || 1)) * 100)}%`, 
      trend: '+0.4%', 
      icon: Zap, 
      color: 'text-amber-400' 
    },
    { 
      label: 'Errors (24h)', 
      value: techLoading ? '...' : (techStats?.errors_24h || 0), 
      trend: 'Warning', 
      icon: Activity, 
      color: techStats?.errors_24h > 5 ? 'text-red-400' : 'text-emerald-500' 
    },
  ];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Welcome Title */}
      <div className="flex justify-between items-end">
        <div className="relative">
          <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary rounded-full blur-sm opacity-50" />
          <h1 className="text-5xl font-black text-white tracking-tighter">
            Command Center
          </h1>
          <p className="text-slate-400 font-bold mt-2 uppercase tracking-[0.2em] text-[10px]">Modulajar HQ Platform Operations</p>
        </div>
        {(revLoading || techLoading) && (
          <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Syncing Live Data
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="glass-card p-6 rounded-3xl relative group overflow-hidden transition-all hover:-translate-y-1">
            <div className="flex items-start justify-between relative z-10">
              <div className={cn("p-3 rounded-2xl bg-slate-950 border border-slate-900", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "text-[10px] font-black bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-500/10",
                stat.color === 'text-red-400' ? 'text-red-400 bg-red-400/10 border-red-500/10' : 'text-emerald-400'
              )}>
                {stat.trend}
              </span>
            </div>
            <div className="mt-6 relative z-10">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-black text-white mt-1">{stat.value}</h3>
            </div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mb-12 group-hover:bg-primary/10 transition-colors" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-8 rounded-4xl relative overflow-hidden group border-indigo-500/10">
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-white mb-2">Revenue Intelligence</h2>
              <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-lg mb-8">
                Deep-dive ke analisis pendapatan realtime, status langganan, dan proyeksi churn untuk mengoptimalkan unit ekonomi platform.
              </p>
              <Link href="/revenue" className="inline-flex items-center gap-2 bg-white text-slate-950 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-white/5">
                Investigate Revenue <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none group-hover:bg-primary/20 transition-all duration-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/monitoring/failures" className="glass-card p-6 rounded-3xl border-red-500/10 hover:border-red-500/30 transition-all group bg-red-500/5">
              <h3 className="text-lg font-black mb-1 text-red-500">Failure Center</h3>
              <p className="text-xs font-bold leading-relaxed text-red-400/60">Monitor & recovery failed jobs.</p>
            </Link>
            <Link href="/support" className="glass-card p-6 rounded-3xl hover:border-primary/30 transition-all group">
              <h3 className="text-lg font-black text-white mb-1">Support & Ops</h3>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">Ticketing & troubleshooting.</p>
            </Link>
            <Link href="/settings" className="glass-card p-6 rounded-3xl hover:border-secondary/30 transition-all group">
              <h3 className="text-lg font-black text-white mb-1">System Settings</h3>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">Roles & audit logs.</p>
            </Link>
          </div>
        </div>

        {/* Global Status Bar */}
        <div className="lg:col-span-1 glass-card p-8 rounded-4xl border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-xs font-black text-white uppercase tracking-widest">Service Status</h4>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_oklch(0.64_0.17_160)]" />
              <span className="text-[8px] font-black text-emerald-400 uppercase">Operational</span>
            </div>
          </div>
          
          <div className="space-y-6">
            {[
              { name: 'API Gateway', status: '99ms', health: 'Healthy' },
              { name: 'Core Engine', status: 'Optimal', health: 'Healthy' },
              { name: 'GCS Storage', status: 'Active', health: 'Healthy' },
              { name: 'Database Cl.', status: 'Healthy', health: 'Healthy' }
            ].map((service, i) => (
              <div key={i} className="flex items-center justify-between pb-4 border-b border-slate-800/50 last:border-0 last:pb-0">
                <span className="text-[10px] font-bold text-slate-400">{service.name}</span>
                <span className="text-[10px] font-black text-emerald-400 font-mono tracking-tighter">{service.status}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-tight">Access Verified</p>
                <p className="text-[8px] font-bold text-slate-600">Superadmin clearance active</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
