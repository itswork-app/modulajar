'use client';

import { Database, ShieldCheck, Zap, Info } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DatasetPage() {
    return (
        <div className="max-w-6xl mx-auto py-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dataset AI</h1>
                    <p className="text-slate-500 mt-1 text-lg">Kelola sumber data dan konteks pembelajaran untuk optimasi AI.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 relative overflow-hidden">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                                <Database className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Training Context</h3>
                        </div>
                        <p className="text-slate-500 mb-8 leading-relaxed font-regular">
                            Fitur ini memungkinkan Anda mengunggah Buku Guru dan Buku Siswa spesifik untuk melatih AI agar menghasilkan modul yang lebih akurat sesuai buku paket sekolah Anda.
                        </p>

                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex items-center gap-4">
                            <Info className="w-6 h-6 text-slate-400" />
                            <p className="text-sm text-slate-600 font-medium">
                                Melatih AI dengan dataset sendiri meningkatkan relevansi materi hingga 85%.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-emerald-900 rounded-3xl p-8 text-white relative overflow-hidden">
                        <ShieldCheck className="w-24 h-24 absolute -bottom-4 -right-4 opacity-10 rotate-12" />
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            Keamanan Data
                        </h3>
                        <p className="text-emerald-100/80 text-sm leading-relaxed mb-6">
                            Semua dokumen dataset dienkripsi dan hanya dapat diakses oleh instruksi AI di workspace Anda.
                        </p>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: '60%' }}
                                transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                                className="h-full bg-emerald-400"
                            />
                        </div>
                        <div className="mt-4 text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                            Encryption Standard: AES-256
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 border border-amber-100">
                    <Zap className="w-10 h-10 text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Fitur ini tersedia untuk Akun Institusi</h2>
                <p className="text-slate-500 max-w-sm mx-auto mb-8 font-medium">
                    Hubungi tim kami untuk mengaktifkan manajemen Dataset AI pada akun sekolah Anda.
                </p>
                <div className="flex gap-4">
                    <button className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">
                        Hubungi Sales
                    </button>
                </div>
            </div>
        </div>
    );
}
