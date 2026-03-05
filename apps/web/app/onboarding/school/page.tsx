'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { School, ArrowRight } from 'lucide-react';

export default function SchoolPage() {
    const router = useRouter();
    const [schoolName, setSchoolName] = useState('');
    const [province, setProvince] = useState('');
    const [city, setCity] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schoolName.trim()) {
            setError('Nama sekolah harus diisi');
            return;
        }
        setError('');
        setLoading(true);

        try {
            router.push('/onboarding/assignment');
        } catch {
            setError('Gagal menyimpan info sekolah');
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
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
                    <School className="w-7 h-7 text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Sekolah Anda</h1>
                <p className="text-slate-500">Informasi sekolah tempat Anda mengajar.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="schoolName" className="block text-sm font-medium text-slate-700 mb-2">
                        Nama Sekolah <span className="text-red-400">*</span>
                    </label>
                    <input
                        id="schoolName"
                        type="text"
                        placeholder="Contoh: SDN Mekargalih 3"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        autoFocus
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="province" className="block text-sm font-medium text-slate-700 mb-2">
                            Provinsi
                        </label>
                        <input
                            id="province"
                            type="text"
                            placeholder="Jawa Barat"
                            value={province}
                            onChange={(e) => setProvince(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base"
                        />
                    </div>
                    <div>
                        <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-2">
                            Kabupaten/Kota
                        </label>
                        <input
                            id="city"
                            type="text"
                            placeholder="Garut"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base"
                        />
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-500 font-medium">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading || !schoolName.trim()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-xl font-semibold text-base hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-200/50 group"
                >
                    {loading ? 'Menyimpan...' : 'Lanjutkan'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </form>
        </motion.div>
    );
}
