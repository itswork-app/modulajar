'use client';

import { useState } from 'react';
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
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

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
              <div className="border-b border-slate-50 pb-6">
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
              <div className="border-b border-slate-50 pb-6 flex justify-between items-center">
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

          {/* Placeholder for other tabs */}
          {activeTab !== 'profile' && activeTab !== 'api' && (
            <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4 py-20">
              <div className="w-20 h-20 bg-slate-900/50 rounded-3xl flex items-center justify-center shadow-inner border border-slate-800">
                <Settings className="w-8 h-8 text-slate-600 animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">Under Refinement</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">This module is currently being optimized for &quot;Elite Grade&quot; production.</p>
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
