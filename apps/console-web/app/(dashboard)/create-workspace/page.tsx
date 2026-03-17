'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useWorkspaces } from '@/hooks/use-workspace';
import { Loader2, Sparkles, Building2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function CreateWorkspacePage() {
    const router = useRouter();
    const { getToken } = useAuth();
    const { user } = useUser();
    const { mutate: refreshWorkspaces } = useWorkspaces();

    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || name.length < 3) return;

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
                body: JSON.stringify({ name: name.trim() })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Gagal membuat workspace.');
            }

            const data = await res.json();
            // Save as active workspace
            localStorage.setItem('modulajar_active_workspace', data.workspaceId);
            
            await refreshWorkspaces();
            router.push('/wizard');
        } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full"
            >
                <div className="text-center space-y-4 mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-4xl bg-indigo-600 text-white shadow-2xl shadow-indigo-200 mb-2">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Selamat Datang{user?.firstName ? `, ${user.firstName}` : ''}!</h1>
                    <p className="text-slate-500 font-medium text-lg leading-relaxed">
                        Langkah awal untuk memulai transformasi digital dokumen sekolah Anda.
                    </p>
                </div>

                <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-2xl shadow-slate-200/50 p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-40 h-40 bg-emerald-50 rounded-full blur-3xl opacity-50" />

                    <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Satuan Pendidikan / Sekolah</label>
                            <div className="relative group">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <input 
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="Contoh: SD Negeri 1 Jakarta"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl pl-14 pr-5 py-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-bold text-slate-900"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium ml-1">Minimal 3 karakter untuk identitas resmi sekolah Anda.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || name.trim().length < 3}
                            className={cn(
                                "w-full py-4 rounded-2xl font-black text-white transition-all flex items-center justify-center gap-2 shadow-xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0",
                                "bg-slate-900 shadow-slate-200 hover:bg-slate-800"
                            )}
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Buat Workspace Sekolah <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center mt-10 text-slate-400 text-[10px] font-black uppercase tracking-widest px-10 leading-loose">
                    Dengan membuat workspace, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi Modulajar.
                </p>
            </motion.div>
        </div>
    );
}
