'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { 
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
  AlertTriangle,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AuditLog {
    id: string;
    event_type: string;
    actor_id: string;
    actor_email: string | null;
    target_id: string | null;
    action_details: Record<string, unknown>;
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

  const { data: adminData, mutate: mutateAdmins } = useSWR(
    activeTab === 'admins' ? `${API_BASE}/platform/admins` : null,
    fetcher
  );

  const { data: configData, mutate: mutateConfig } = useSWR(
    activeTab === 'profile' ? `${API_BASE}/platform/config` : null,
    fetcher
  );

  const { data: keysData } = useSWR(
    activeTab === 'api' ? `${API_BASE}/platform/keys` : null,
    fetcher
  );

  const { data: webhooksData } = useSWR(
    activeTab === 'webhooks' ? `${API_BASE}/platform/webhooks` : null,
    fetcher
  );

  const { data: plansData } = useSWR(
    activeTab === 'billing' ? `${API_BASE}/platform/plans` : null,
    fetcher
  );

  const [newAdmin, setNewAdmin] = useState({ clerk_user_id: '', role: 'support' });
  const [configFields, setConfigFields] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ target_url: '', secret_token: '', description: '' });
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);

  useEffect(() => {
    if (configData?.config) {
      setConfigFields(configData.config);
    }
  }, [configData]);

  const handleUpdateConfig = async () => {
    setIsSubmitting(true);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/platform/config`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configFields)
      });
      mutateConfig();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdmin.clerk_user_id) return;
    setIsSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/platform/admins`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newAdmin)
      });
      if (res.ok) {
        setNewAdmin({ clerk_user_id: '', role: 'support' });
        mutateAdmins();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAdmin = async (clerkUserId: string) => {
    if (!confirm('Are you sure you want to remove this admin?')) return;
    const token = await getToken();
    const res = await fetch(`${API_BASE}/platform/admins/${clerkUserId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) mutateAdmins();
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Permanently delete this infrastructure key?')) return;
    const token = await getToken();
    await fetch(`${API_BASE}/platform/keys/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    // Trigger SWR re-fetch if you had a mutate for keys, otherwise simple window.location.reload() for now
    window.location.reload(); 
  };

  const handleRegisterWebhook = async () => {
    if (!newWebhook.target_url) return;
    setIsSubmitting(true);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/platform/webhooks`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newWebhook)
      });
      setIsWebhookModalOpen(false);
      setNewWebhook({ target_url: '', secret_token: '', description: '' });
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    const token = await getToken();
    await fetch(`${API_BASE}/platform/webhooks/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    window.location.reload();
  };

  const handleUpdatePlan = async (id: string, price: number, credits: number) => {
    const token = await getToken();
    await fetch(`${API_BASE}/platform/plans/${id}`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base_price_idr: price, base_credits: credits })
    });
    alert('Plan updated successfully');
  };

  const tabs = [
    { id: 'profile', label: 'General', icon: Building2 },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'admins', label: 'Team Roles', icon: ShieldCheck }, 
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
        <div className="lg:col-span-3 bg-slate-900/50 rounded-3xl border border-slate-800 p-8 shadow-xl min-h-[600px] flex flex-col backdrop-blur-sm relative">
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
                    value={(configFields.platform_name as string) || ''}
                    onChange={(e) => setConfigFields({ ...configFields, platform_name: e.target.value })}
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
                    value={(configFields.support_email as string) || ''}
                    onChange={(e) => setConfigFields({ ...configFields, support_email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none transition-all text-white"
                  />
                </div>
              </div>

              <div className="pt-6 mt-auto">
                <button 
                  onClick={handleUpdateConfig}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/20 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                  Save Changes
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
              </div>

              <div className="space-y-4">
                {keysData?.keys?.map((item: { id: string; service_name: string; key_type: string }) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800 group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-sm">
                        <Lock className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white tracking-tight">{item.service_name}</p>
                        <p className="text-[10px] font-bold text-slate-500 font-mono tracking-widest capitalize">{item.key_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black rounded uppercase border border-emerald-500/20">Active</span>
                       <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><Eye className="w-4 h-4 text-slate-500 hover:text-indigo-400" /></button>
                       <button 
                         onClick={() => handleDeleteKey(item.id)}
                         className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                       >
                         <RefreshCw className="w-4 h-4 text-slate-500 hover:text-red-400" />
                       </button>
                    </div>
                  </div>
                ))}
                {!keysData?.keys?.length && (
                  <div className="py-20 text-center opacity-30">
                    <Key className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">No keys provisioned.</p>
                  </div>
                )}
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
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admins' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="border-b border-slate-800 pb-6 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-white px-2 mb-1">Administrative Team</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Manage global access levels for owners & support</p>
                </div>
              </div>

              {/* Add Admin Form */}
              <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-3xl space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Provision New Access</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input 
                    type="text" 
                    placeholder="Clerk User ID (user_...)"
                    value={newAdmin.clerk_user_id}
                    onChange={(e) => setNewAdmin({ ...newAdmin, clerk_user_id: e.target.value })}
                    className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                  <select 
                    value={newAdmin.role}
                    onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-600 outline-none"
                  >
                    <option value="owner">Owner (Full Access)</option>
                    <option value="investor">Investor (Read-only)</option>
                    <option value="support">Support (Operations)</option>
                  </select>
                  <button 
                    onClick={handleAddAdmin}
                    disabled={isSubmitting || !newAdmin.clerk_user_id}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50 h-[42px]"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Grant Access
                  </button>
                </div>
              </div>

              {/* Admin List */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-3xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900/50 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Identity</th>
                      <th className="px-6 py-4">Clearance</th>
                      <th className="px-6 py-4 text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {adminData?.admins?.map((admin: { clerk_user_id: string; role: string; created_at: string }) => (
                      <tr key={admin.clerk_user_id} className="text-sm font-bold text-slate-300 hover:bg-slate-800/10 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black font-mono text-white tracking-tighter opacity-80">{admin.clerk_user_id}</span>
                            <span className="text-[8px] font-black uppercase text-slate-500 mt-1">First seen: {new Date(admin.created_at).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-0.5 text-[9px] font-black rounded uppercase border",
                            admin.role === 'owner' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                            admin.role === 'investor' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          )}>
                            {admin.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleRemoveAdmin(admin.clerk_user_id)}
                            className="text-[9px] font-black text-slate-500 hover:text-red-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="border-b border-slate-800 pb-6">
                <h3 className="text-xl font-black text-white">Pricing & Revenue Models</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Global Subscription Tiers</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plansData?.plans?.map((plan: { id: string; name: string; slug: string; base_price_idr: number; base_credits: number }) => (
                  <div key={plan.id} className="p-6 bg-slate-950/50 border border-slate-800 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
                    <div className="relative z-10">
                      <h4 className="text-lg font-black text-white mb-1 uppercase tracking-tighter">{plan.name}</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{plan.slug}</p>
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Base Price (IDR)</label>
                          <input 
                            type="number" 
                            defaultValue={plan.base_price_idr}
                            onBlur={(e) => handleUpdatePlan(plan.id, parseInt(e.target.value), plan.base_credits)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Base Credits</label>
                          <input 
                            type="number" 
                            defaultValue={plan.base_credits}
                            onBlur={(e) => handleUpdatePlan(plan.id, plan.base_price_idr, parseInt(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="border-b border-slate-800 pb-6 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-white">Outbound Webhooks</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Real-time Platform Event Export</p>
                </div>
                <button 
                  onClick={() => setIsWebhookModalOpen(true)}
                  className="px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all"
                >
                  Register Endpoint
                </button>
              </div>

              {isWebhookModalOpen && (
                <div className="p-6 bg-slate-950/80 border border-indigo-500/30 rounded-3xl animate-in fade-in zoom-in-95 duration-200">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4">Register New Webhook</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input 
                      type="url" 
                      placeholder="Target URL (https://...)"
                      value={newWebhook.target_url}
                      onChange={(e) => setNewWebhook({ ...newWebhook, target_url: e.target.value })}
                      className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input 
                      type="text" 
                      placeholder="Secret Token"
                      value={newWebhook.secret_token}
                      onChange={(e) => setNewWebhook({ ...newWebhook, secret_token: e.target.value })}
                      className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input 
                      type="text" 
                      placeholder="Description"
                      value={newWebhook.description}
                      onChange={(e) => setNewWebhook({ ...newWebhook, description: e.target.value })}
                      className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button onClick={() => setIsWebhookModalOpen(false)} className="px-4 py-2 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancel</button>
                    <button 
                      onClick={handleRegisterWebhook}
                      disabled={isSubmitting || !newWebhook.target_url}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {webhooksData?.webhooks?.map((webhook: { id: string; target_url: string; event_filters: string[]; status: string }) => (
                  <div key={webhook.id} className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                        <Cloud className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white truncate max-w-[300px]">{webhook.target_url}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{webhook.event_filters.join(', ') || 'All Events'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[8px] font-black rounded uppercase border border-indigo-500/20">{webhook.status}</span>
                      <button 
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors group"
                      >
                         <X className="w-4 h-4 text-slate-500 group-hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
                {!webhooksData?.webhooks?.length && (
                   <div className="py-20 text-center opacity-30">
                    <Cloud className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">No webhooks configured.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
