'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, ArrowRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.modulajar.app';

export default function ProfilePage() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [nip, setNip] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) {
            setError('Nama lengkap harus diisi');
            return;
        }
        setError('');
        setLoading(true);

        try {
            // NOTE: Auth token wiring deferred to auth integration PR
            // For now, navigate to next step
            router.push('/onboarding/school');
        } catch {
            setError('Gagal menyimpan profil');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div className="mb-8">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
                    <User className="w-7 h-7 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Siapa Anda?</h1>
                <p className="text-slate-500">Lengkapi data diri Anda untuk memulai.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-2">
                        Nama Lengkap <span className="text-red-400">*</span>
                    </label>
                    <input
                        id="fullName"
                        type="text"
                        placeholder="Contoh: Reja Putra Perdana"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoFocus
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                    />
                </div>

                <div>
                    <label htmlFor="nip" className="block text-sm font-medium text-slate-700 mb-2">
                        NIP <span className="text-slate-400 font-normal">(opsional)</span>
                    </label>
                    <input
                        id="nip"
                        type="text"
                        placeholder="Contoh: 198765432100001"
                        value={nip}
                        onChange={(e) => setNip(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-500 font-medium">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading || !fullName.trim()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-xl font-semibold text-base hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-200/50 group"
                >
                    {loading ? 'Menyimpan...' : 'Lanjutkan'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </form>
        </motion.div>
    );
}
