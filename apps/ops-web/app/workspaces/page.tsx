'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { 
  Building2, 
  Search, 
  ArrowRight,
  ShieldCheck,
  Globe,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface Workspace {
  id: string;
  name: string;
  workspace_type: string;
  created_at: string;
  plan_name: string;
  subscription_status: string;
}

export default function WorkspacesPage() {
  const { getToken } = useAuth();
  const [search, setSearch] = useState('');

  const fetcher = async (url: string) => {
    const token = await getToken();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch workspaces');
    return res.json();
  };

  const { data, error, isLoading, mutate } = useSWR(
    `${API_BASE}/platform/workspaces?search=${search}`,
    fetcher
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end border-b border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            Workspace Hub
            <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Global Index</span>
          </h1>
          <p className="text-slate-500 font-bold mt-2 uppercase tracking-[0.2em] text-[10px]">Accounts & Subscription Management</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search ID or School Name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-primary outline-none w-72 transition-all"
            />
          </div>
          <button 
            onClick={() => mutate()}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="py-32 flex flex-col items-center justify-center space-y-4 opacity-50">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Retrieving global accounts...</p>
        </div>
      ) : error ? (
        <div className="glass-card p-20 rounded-4xl text-center border-red-500/20">
          <ShieldCheck className="w-12 h-12 text-red-500 mx-auto mb-6 opacity-20" />
          <h2 className="text-xl font-black text-white">Connection Error</h2>
          <p className="text-slate-500 text-sm font-medium mt-2">Gagal menghubungkan ke registri workspace pusat.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.workspaces?.map((ws: Workspace) => (
            <div key={ws.id} className="glass-card p-6 rounded-3xl group hover:border-indigo-500/30 transition-all bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center group-hover:bg-indigo-600 transition-colors shadow-inner">
                  <Building2 className="w-6 h-6 text-slate-500 group-hover:text-white" />
                </div>
                <div className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                  ws.subscription_status === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/10" : "bg-slate-800 text-slate-500 border-slate-700"
                )}>
                  {ws.plan_name || 'Standard'}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors truncate">{ws.name}</h3>
                  <p className="text-[10px] font-bold text-slate-500 font-mono tracking-tighter truncate opacity-60 uppercase">{ws.id}</p>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Joined</span>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(ws.created_at).toLocaleDateString()}</span>
                  </div>
                  <button className="flex items-center gap-1.5 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">
                    Details <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && data?.workspaces?.length === 0 && (
        <div className="py-32 flex flex-col items-center justify-center space-y-2 opacity-30">
          <Globe className="w-12 h-12" />
          <p className="text-[10px] font-black uppercase tracking-widest">No matching workspaces found</p>
        </div>
      )}
    </div>
  );
}
