'use client';

import { Sparkles, Star, Zap, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TemplatesPage() {
    const categories = [
        { name: 'Populer', icon: Star, color: 'text-amber-500' },
        { name: 'Baru', icon: Zap, color: 'text-indigo-500' },
        { name: 'Komunitas', icon: Sparkles, color: 'text-emerald-500' },
    ];

    return (
        <div className="max-w-6xl mx-auto py-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Template Library</h1>
                    <p className="text-slate-500 mt-1 text-lg">Pilih blueprint siap pakai untuk generasi yang lebih konsisten.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {categories.map((cat, i) => (
                    <motion.div
                        key={cat.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-default group"
                    >
                        <div className={`w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100`}>
                            <cat.icon className={`w-6 h-6 ${cat.color}`} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">{cat.name}</h3>
                        <p className="text-slate-500 text-sm mt-1">Menampilkan koleksi terbaik untuk kategori ini.</p>
                    </motion.div>
                ))}
            </div>

            <div className="relative overflow-hidden bg-indigo-900 rounded-[2rem] p-12 text-center text-white border-8 border-indigo-950/20">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-[120px] translate-x-1/3 translate-y-1/3" />
                </div>

                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-8 border border-white/20">
                        <Clock className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-4xl font-black mb-4 tracking-tight">Katalog Sedang Dikurasi</h2>
                    <p className="text-indigo-100 max-w-lg mx-auto text-xl font-medium leading-relaxed mb-8 opacity-80">
                        Tim kami sedang mengkurasi ratusan template Modul Ajar terbaik agar sesuai dengan standar Kemdikbud terbaru.
                    </p>
                    <div className="inline-flex items-center px-4 py-2 bg-indigo-800/50 backdrop-blur-md rounded-full border border-white/10 text-sm font-bold tracking-widest uppercase">
                        Coming Q2 2026
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-30 grayscale pointer-events-none select-none">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="aspect-[3/4] bg-slate-200 rounded-2xl border border-slate-300 border-dashed" />
                ))}
            </div>
        </div>
    );
}
