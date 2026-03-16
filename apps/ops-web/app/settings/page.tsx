'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { 
  Settings, 
  Building2, 
  Key, 
  ShieldCheck, 
  CreditCard,
  Cloud,
  ChevronRight,
  Save,
  Lock,
  Eye,
  RefreshCw,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AuditLog {
    id: string;
    event_type: string;
    actor_id: string;
    actor_email: string | null;
    target_id: string | null;
    action_details: any;
    severity: string;
    created_at: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const { getToken } = useAuth();

  const fetcher = async (url: string) => {
    const token = await getToken();
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Ops! Gagal mengambil data log.');
    return res.json();
  };

  const { data: logData, error: logError, isLoading: logLoading } = useSWR(
    activeTab === 'security' ? `${API_BASE}/platform/audit-logs?limit=50` : null,
    fetcher
  );

  const tabs = [
    { id: 'profile', label: 'General', icon: Building2 },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'billing', label: 'Billing & Plans', icon: CreditCard },
    { id: 'webhooks', label: 'Webhooks', icon: Cloud },
  ];

  return (
    <div className="max-w-7xl mx-auto py-10 px-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 text-slate-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-black rounded uppercase tracking-widest h-fit border border-indigo-500/20">Platform Config</div>
            <h1 className="text-4xl font-black text-white tracking-tight">System Settings</h1>
          </div>
          <p className="text-slate-400 font-bold">Manage global platform parameters, security policies, and integrations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all group",
                activeTab === tab.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                  : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <div className="flex items-center gap-3">
                <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "" : "text-slate-400 group-hover:text-slate-900")} />
                <span className="font-bold text-sm tracking-wide">{tab.label}</span>
              </div>
              <ChevronRight className={cn("w-4 h-4 opacity-0 transition-opacity", activeTab === tab.id && "opacity-100")} />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 bg-slate-900/50 rounded-3xl border border-slate-800 p-8 shadow-xl min-h-[600px] flex flex-col backdrop-blur-sm">
          {activeTab === 'profile' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="border-b border-slate-800 pb-6">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                   General Configuration
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Industrial Metadata & Core Branding</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Name</label>
                  <input 
                    type="text" 
                    defaultValue="MODULAJAR HQ"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none transition-all text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrative Domain</label>
                  <input 
                    type="text" 
                    defaultValue="ops.modulajar.app"
                    disabled
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 cursor-not-allowed uppercase tracking-wide"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Support Email</label>
                  <input 
                    type="email" 
                    defaultValue="support@modulajar.app"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none transition-all text-white"
                  />
                </div>
              </div>

              <div className="pt-6 mt-auto">
                <button className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/20">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="border-b border-slate-800 pb-6 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-white">Infrastructure Keys</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Secure Internal API Communication</p>
                </div>
                <button className="px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all">
                  Generate New Key
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { name: 'Xendit Webhook Secret', key: '••••••••••••••••••••••••', status: 'Live' },
                  { name: 'OpenAI Enterprise Key', key: '••••••••••••••••••••••••', status: 'Active' },
                  { name: 'Clerk Backend Interface', key: '••••••••••••••••••••••••', status: 'Connected' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800 group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-sm">
                        <Lock className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white tracking-tight">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-500 font-mono tracking-widest">{item.key}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black rounded uppercase border border-emerald-500/20">{item.status}</span>
                       <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><Eye className="w-4 h-4 text-slate-500 hover:text-indigo-400" /></button>
                       <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><RefreshCw className="w-4 h-4 text-slate-500 hover:text-indigo-400" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in duration-300 flex flex-col h-full">
              <div className="border-b border-slate-800 pb-6 flex justify-between items-end">
                <div>
                  <h3 className="text-xl font-black text-white">Platform Audit Trail</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Immutable record of mission-critical events</p>
                </div>
                <div className="flex gap-2">
                   <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", logLoading ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
                      <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400">{logLoading ? 'Connecting...' : 'Live Feed'}</span>
                   </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="bg-slate-950/50 border border-slate-800 rounded-3xl overflow-hidden flex flex-col h-[500px]">
                   <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <div className="col-span-3">Timestamp</div>
                      <div className="col-span-3">Event</div>
                      <div className="col-span-4">Actor</div>
                      <div className="col-span-2 text-right">Severity</div>
                   </div>
                   <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-1">
                      {logLoading && (
                        <div className="flex flex-col items-center justify-center h-full opacity-40">
                           <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                           <p className="text-[10px] font-black uppercase tracking-widest">Decrypting logs from central registry...</p>
                        </div>
                      )}

                      {logError && (
                        <div className="flex flex-col items-center justify-center h-full text-red-400 opacity-80">
                           <AlertTriangle className="w-8 h-8 mb-4 border-2 border-red-500/20 rounded-full p-2" />
                           <p className="text-sm font-black mb-1">Central Registry Connection Failure</p>
                           <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Verification of security handshake failed</p>
                        </div>
                      )}

                      {!logLoading && !logError && logData?.logs?.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30">
                           <ShieldCheck className="w-12 h-12 mb-4" />
                           <p className="text-[10px] font-black uppercase tracking-widest">No security events recorded in this cycle.</p>
                        </div>
                      )}

                      {!logLoading && !logError && logData?.logs?.map((log: AuditLog, i: number) => (
                        <div key={log.id} className="grid grid-cols-12 gap-4 px-4 py-3 rounded-2xl hover:bg-slate-800/30 transition-all group items-center animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                           <div className="col-span-3 text-[10px] font-bold text-slate-400 font-mono">{new Date(log.created_at).toLocaleString('id-ID')}</div>
                           <div className="col-span-3 flex items-center gap-2">
                              <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px]", log.severity === 'critical' ? 'bg-red-500 shadow-red-500/50' : log.severity === 'warn' ? 'bg-amber-500 shadow-amber-500/50' : 'bg-indigo-500 shadow-indigo-500/50')} />
                              <span className="text-[11px] font-black text-white tracking-tight">{log.event_type}</span>
                           </div>
                           <div className="col-span-4 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[8px] font-black text-slate-400 shadow-inner">
                                 {(log.actor_email || log.actor_id)[0].toUpperCase()}
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                 <span className="text-[10px] font-bold text-white leading-none truncate">{log.actor_email || 'System'}</span>
                                 <span className="text-[8px] font-bold text-slate-500 leading-none mt-0.5 truncate opacity-60">
                                    {log.target_id ? `Target: ${log.target_id}` : log.actor_id}
                                 </span>
                              </div>
                           </div>
                           <div className="col-span-2 text-right">
                              <span className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded uppercase border",
                                log.severity === 'critical' ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                                log.severity === 'warn' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : 
                                "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              )}>
                                 {log.severity}
                              </span>
                           </div>
                        </div>
                      ))}
                      
                      {!logLoading && !logError && (
                        <div className="flex flex-col items-center justify-center py-10 opacity-10 group">
                           <ShieldCheck className="w-10 h-10 text-slate-600 mb-2 group-hover:animate-bounce" />
                           <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">End of visible audit trail</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* Fallback for unconfigured tabs */}
          {activeTab !== 'profile' && activeTab !== 'api' && activeTab !== 'security' && (
            <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4 py-20">
              <div className="w-20 h-20 bg-slate-900/50 rounded-3xl flex items-center justify-center shadow-inner border border-slate-800">
                <Settings className="w-8 h-8 text-slate-600 animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">Module Configuration</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Advanced parameters for billing and integrations are globally managed.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Add a simple animation to tailwind config or global css
// For this standalone file we'll assume basic transition-all works
