'use client';

import Link from 'next/link';
import { CreditCard, AlertCircle, AlertTriangle, CheckCircle2, ArrowUpRight, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditPanelProps {
    credits: number | null;
}

export function CreditPanel({ credits }: CreditPanelProps) {
    const isLoading = credits === null;
    const isZero = !isLoading && credits === 0;
    const isLow = !isLoading && !isZero && credits! <= 3;
    const isOk = !isLoading && !isZero && !isLow;

    return (
        <div className={cn(
            'rounded-2xl border p-4',
            isZero ? 'bg-red-50 border-red-100' :
                isLow ? 'bg-amber-50 border-amber-100' :
                    'bg-emerald-50 border-emerald-100'
        )}>
            {/* Credit balance row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isZero && <AlertCircle className="w-4 h-4 text-red-500" />}
                    {isLow && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    {isOk && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {isLoading && <CreditCard className="w-4 h-4 text-slate-400" />}
                    <span className={cn(
                        'text-xs font-black uppercase tracking-widest',
                        isZero ? 'text-red-700' : isLow ? 'text-amber-700' : isLoading ? 'text-slate-400' : 'text-emerald-700'
                    )}>
                        Kredit Tersisa
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className={cn(
                        'text-lg font-black',
                        isZero ? 'text-red-700' : isLow ? 'text-amber-700' : isLoading ? 'text-slate-400' : 'text-emerald-700'
                    )}>
                        {isLoading ? '—' : `${credits} Token`}
                    </span>
                    <span className={cn(
                        'text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full',
                        isZero ? 'bg-red-600 text-white' : isLow ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white',
                        isLoading && 'bg-slate-200 text-slate-400'
                    )}>
                        {isLoading ? '...' : isZero ? 'Habis' : isLow ? 'Hampir Habis' : 'Tersedia'}
                    </span>
                </div>
            </div>

            {/* Perkiraan biaya */}
            {!isZero && (
                <p className={cn(
                    'text-xs font-medium mt-2',
                    isLow ? 'text-amber-600' : 'text-emerald-600'
                )}>
                    Perkiraan biaya generasi: 1 token
                </p>
            )}

            {/* Low credit warning */}
            {isLow && (
                <div className="mt-3 pt-3 border-t border-amber-200 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-amber-700">Kredit Anda hampir habis. Isi ulang agar tidak terganggu.</p>
                    <Link href="/billing" className="shrink-0 flex items-center gap-1 text-xs font-black text-amber-700 hover:text-amber-900 transition">
                        Isi Ulang <ArrowUpRight className="w-3 h-3" />
                    </Link>
                </div>
            )}

            {/* Zero credit block */}
            {isZero && (
                <div className="mt-3 pt-3 border-t border-red-200 space-y-3">
                    <p className="text-xs font-bold text-red-700">
                        Kredit Anda habis. Silakan isi ulang untuk melanjutkan generasi.
                    </p>
                    <div className="flex gap-2">
                        <Link href="/billing"
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black hover:bg-red-700 transition shadow-lg shadow-red-100">
                            <CreditCard className="w-3.5 h-3.5" /> Isi Ulang Kredit
                        </Link>
                        <Link href="/billing"
                            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-black hover:bg-red-50 transition">
                            <Receipt className="w-3.5 h-3.5" /> Lihat Transaksi
                        </Link>
                    </div>
                </div>
            )}

            {/* Normal billing links */}
            {isOk && (
                <div className="mt-2 flex gap-3">
                    <Link href="/billing" className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 transition flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> Isi Ulang
                    </Link>
                    <Link href="/billing" className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 transition flex items-center gap-1">
                        <Receipt className="w-3 h-3" /> Lihat Transaksi
                    </Link>
                </div>
            )}
        </div>
    );
}
