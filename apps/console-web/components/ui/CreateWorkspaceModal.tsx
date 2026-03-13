'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building, Loader2, Plus } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspaces } from '@/hooks/use-workspace';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface CreateWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { getToken } = useAuth();
    const { mutate } = useWorkspaces();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || name.length < 3) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/workspaces`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name })
            });

            if (res.ok) {
                const data = await res.json();
                await mutate(); // Refresh workspace list
                localStorage.setItem('modulajar_active_workspace', data.workspaceId);
                onClose();
                window.location.reload(); // Hard refresh to update all hooks
            } else {
                const errData = await res.json();
                setError(errData.message || 'Gagal membuat workspace');
            }
        } catch (err) {
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
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <Building className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 leading-none">Buat Workspace</h2>
                                        <p className="text-sm text-slate-500 mt-1">Kelola sekolah atau institusi baru Anda.</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
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
                                </div>

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
                                        disabled={isSubmitting || name.length < 3}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                                    >
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        Buat Workspace
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
