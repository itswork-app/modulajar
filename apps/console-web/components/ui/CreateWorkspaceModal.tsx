'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building, Loader2, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@clerk/nextjs';
import { useWorkspaces } from '@/hooks/use-workspace';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface CreateWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
    const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
    const [name, setName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { getToken } = useAuth();
    const { mutate } = useWorkspaces();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (activeTab === 'create' && (!name || name.length < 3)) return;
        if (activeTab === 'join' && (!joinCode || joinCode.length < 5)) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const token = await getToken();
            const endpoint = activeTab === 'create' ? '/workspaces' : '/workspaces/join';
            const body = activeTab === 'create' ? { name } : { code: joinCode };
            
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                const data = await res.json();
                await mutate(); // Refresh workspace list
                localStorage.setItem('modulajar_active_workspace', data.workspaceId);
                onClose();
                window.location.reload(); // Hard refresh to update all hooks
            } else {
                const errData = await res.json();
                setError(errData.message || 'Gagal memproses permintaan');
            }
        } catch {
            setError('Terjadi kesalahan koneksi');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <Building className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 leading-none">Workspace</h2>
                                        <p className="text-sm text-slate-500 mt-1">Kelola sekolah atau institusi Anda.</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
                                <button
                                    onClick={() => setActiveTab('create')}
                                    className={cn(
                                        "flex-1 py-2 text-sm font-bold rounded-xl transition-all",
                                        activeTab === 'create' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    Buat Baru
                                </button>
                                <button
                                    onClick={() => setActiveTab('join')}
                                    className={cn(
                                        "flex-1 py-2 text-sm font-bold rounded-xl transition-all",
                                        activeTab === 'join' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    Gabung Sekolah
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {activeTab === 'create' ? (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key="create-tab"
                                    >
                                        <label htmlFor="name" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                            Nama Workspace / Sekolah
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            autoFocus
                                            required
                                            minLength={3}
                                            maxLength={50}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Contoh: SMA Negeri 1 Jakarta"
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-900 placeholder:text-slate-300"
                                        />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key="join-tab"
                                    >
                                        <label htmlFor="joinCode" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                            Kode Sekolah / Referral
                                        </label>
                                        <input
                                            type="text"
                                            id="joinCode"
                                            autoFocus
                                            required
                                            minLength={5}
                                            maxLength={10}
                                            value={joinCode}
                                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                            placeholder="Masukkan kode sekolah"
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-900 placeholder:text-slate-300 tracking-wider text-center uppercase"
                                        />
                                        <p className="text-[11px] text-slate-400 mt-3 px-1">Dapatkan kode dari Kepala Sekolah atau Admin Modulajar di sekolah Anda.</p>
                                    </motion.div>
                                )}

                                {error && (
                                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || (activeTab === 'create' ? name.length < 3 : joinCode.length < 5)}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                                    >
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : activeTab === 'create' ? <Plus className="w-4 h-4" /> : <Building className="w-4 h-4" />}
                                        {activeTab === 'create' ? 'Buat Workspace' : 'Gabung Sekarang'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
