'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Building2, 
  User, 
  Clock,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function FailureCenterPage() {
  const { getToken } = useAuth();
  
  const fetcher = async (url: string) => {
    const token = await getToken();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  };

  const { data, mutate, isLoading } = useSWR(`${API_BASE}/platform/jobs/failed`, fetcher);
  const [retrying, setRetrying] = useState<string | null>(null);

  const handleRetry = async (jobId: string) => {
    setRetrying(jobId);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/platform/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        mutate();
      }
    } catch (err) {
      console.error('Retry failed', err);
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end border-b border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            Failure Center
            <span className="text-xs bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Live Monitoring</span>
          </h1>
          <p className="text-slate-500 font-bold mt-2 uppercase tracking-[0.2em] text-[10px]">Technical Interventions & Recovery</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search Workspace/Error..." 
              className="bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-primary outline-none w-64 transition-all"
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

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-50">
          <RefreshCw className="w-12 h-12 text-primary animate-spin" />
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Scanning platform for failures...</p>
        </div>
      ) : data?.failed_jobs?.length === 0 ? (
        <div className="glass-card p-20 rounded-4xl text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-white">All Systems Nominal</h2>
          <p className="text-slate-500 font-medium max-w-sm mx-auto mt-2">
            No failed generation jobs detected in the last 24 hours. Your users are having a great experience.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.failed_jobs?.map((job: { id: string; last_error: string; workspace_name: string; teacher_name: string; school_name: string; created_at: string; attempt_count: number }) => (
            <div key={job.id} className="glass-card p-6 rounded-3xl group hover:border-red-500/30 transition-all">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-tight">
                      Job Failure
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">{job.id}</span>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-black text-white leading-tight mb-2 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      {job.last_error || 'Unknown technical failure'}
                    </h3>
                    
                    <div className="flex flex-wrap gap-6 text-[11px]">
                      <div className="flex items-center gap-2 text-slate-400 font-bold">
                        <Building2 className="w-4 h-4" />
                        {job.workspace_name}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 font-bold">
                        <User className="w-4 h-4" />
                        {job.teacher_name} ({job.school_name})
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 font-bold">
                        <Clock className="w-4 h-4" />
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 font-bold">
                        <RefreshCw className="w-4 h-4" />
                        Attempts: {job.attempt_count}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => handleRetry(job.id)}
                    disabled={retrying === job.id}
                    className="bg-white text-slate-950 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-white/5 disabled:opacity-50 flex items-center gap-2"
                  >
                    {retrying === job.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Retry Job
                  </button>
                  <button className="bg-slate-900 text-slate-400 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-white transition-all flex items-center gap-2">
                    Logs <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
