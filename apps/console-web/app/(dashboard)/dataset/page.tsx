'use client';

import { Sparkles } from 'lucide-react';

export default function DatasetPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[65vh] text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-slate-400" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Dataset AI</h1>
            <p className="text-slate-500 font-medium max-w-xs leading-relaxed">Fitur ini akan segera hadir. Kami sedang menyiapkan sesuatu yang lebih cerdas.</p>
            <div className="mt-6 px-4 py-2 bg-slate-100 text-slate-400 text-xs font-black uppercase rounded-xl tracking-widest">Coming Soon</div>
        </div>
    );
}
