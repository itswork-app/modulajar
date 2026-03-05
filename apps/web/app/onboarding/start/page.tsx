'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, FileCheck } from 'lucide-react';

export default function StartPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div className="mb-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200">
                    <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Profil Anda Siap!</h1>
                <p className="text-slate-500">Saatnya buat modul ajar pertama Anda.</p>
            </div>

            {/* Template Preview Cards */}
            <div className="space-y-3 mb-8">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Template rekomendasi</p>

                {[
                    { title: 'Pecahan Biasa', score: 92, icon: <FileCheck className="w-5 h-5 text-emerald-500" /> },
                    { title: 'Bilangan Bulat', score: 88, icon: <FileCheck className="w-5 h-5 text-blue-500" /> },
                    { title: 'Operasi Hitung', score: 85, icon: <FileCheck className="w-5 h-5 text-amber-500" /> },
                ].map((tmpl, i) => (
                    <motion.div
                        key={tmpl.title}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * (i + 1), duration: 0.3 }}
                        className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                                {tmpl.icon}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900 text-sm">{tmpl.title}</p>
                                <p className="text-xs text-slate-400">SD Kelas 4 · Matematika</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                                {tmpl.score}%
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>

            <button
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-linear-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-bold text-base hover:from-emerald-700 hover:to-emerald-600 transition-all shadow-xl shadow-emerald-200/50 group"
            >
                <Zap className="w-5 h-5" />
                Generate Modul Pertama
            </button>

            <p className="text-center text-xs text-slate-400 mt-4">
                Proses generate memakan waktu kurang dari 60 detik.
            </p>
        </motion.div>
    );
}
