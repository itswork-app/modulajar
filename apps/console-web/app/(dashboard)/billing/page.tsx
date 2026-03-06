'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { TopUpModal } from '@/components/billing/TopUpModal';
import { VoucherModal } from '@/components/billing/VoucherModal';
import {
    CreditCard,
    Wallet,
    FileText,
    Clock,
    ArrowUpRight,
    Gift,
    Loader2,
    AlertCircle,
    Receipt
} from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface UsageSummary {
    credits_remaining: number;
    documents_generated: number;
    jobs_failed: number;
}

export default function BillingPage() {
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [summary, setSummary] = useState<UsageSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal States
    const [isTopUpOpen, setIsTopUpOpen] = useState(false);
    const [isVoucherOpen, setIsVoucherOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;

        async function fetchSummary() {
            if (!isAuthLoaded || isLoadingWorkspace) return;
            if (!workspace) {
                if (isMounted) setIsLoading(false);
                return;
            }

            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspace.id}/usage-summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) {
                    throw new Error('Gagal memuat data billing.');
                }

                const data = await res.json();
                if (isMounted) {
                    setSummary(data);
                    setError(null);
                }
            } catch (err: unknown) {
                if (isMounted) {
                    console.error('Failed to fetch billing data:', err);
                    setError(err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga.');
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        fetchSummary();

        return () => {
            isMounted = false;
        };
    }, [isAuthLoaded, isLoadingWorkspace, workspace, getToken]);

    if (!isAuthLoaded || isLoadingWorkspace || isLoading) {
        return (
            <div className="flex flex-col h-[60vh] items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                <p className="text-slate-500 font-medium">Memuat data billing...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-6xl mx-auto space-y-8 pb-12"
        >
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Billing & Tagihan</h1>
                    <p className="text-slate-500 mt-1.5 text-base">Kelola saldo kredit, pembelian paket, dan riwayat penggunaan Anda.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setIsVoucherOpen(true)}
                        className="inline-flex items-center justify-center px-5 py-2.5 bg-white border-2 border-slate-200 text-slate-700 rounded-xl hover:border-slate-300 hover:bg-slate-50 font-semibold transition-all shadow-sm"
                    >
                        <Gift className="w-4 h-4 mr-2 text-orange-500" />
                        Redeem Voucher
                    </button>
                    <button
                        onClick={() => setIsTopUpOpen(true)}
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:-translate-y-0.5 transition-all font-bold shadow-lg shadow-indigo-200 group"
                    >
                        <CreditCard className="w-5 h-5 mr-2" />
                        Top Up Kredit
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-start text-sm border border-red-100 font-medium">
                    <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                    <div>{error}</div>
                </div>
            )}

            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Saldo Kredit Card (Primary Target) */}
                <div className="bg-linear-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-900/10">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Wallet className="w-48 h-48 transform rotate-12 -mr-12 -mt-12" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="text-indigo-100 font-medium uppercase tracking-wider text-sm mb-1 flex items-center">
                                <Wallet className="w-4 h-4 mr-2" />
                                Saldo Kredit Saat Ini
                            </div>
                            <div className="flex items-baseline gap-3">
                                <span className="text-6xl font-black tracking-tight">
                                    {summary?.credits_remaining ?? 0}
                                </span>
                                <span className="text-xl font-medium text-indigo-200">Token</span>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-white/20 flex items-center justify-between">
                            <span className="text-indigo-100 text-sm">Gunakan kredit untuk generate modul AI cerdas.</span>
                            <button
                                onClick={() => setIsTopUpOpen(true)}
                                className="flex items-center text-sm font-bold text-white hover:text-indigo-200 transition-colors"
                            >
                                Isi Ulang
                                <ArrowUpRight className="w-4 h-4 ml-1" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Secondary Stats */}
                <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center flex-1">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mr-6 shrink-0 border border-emerald-100">
                            <FileText className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Modul Dibuat</div>
                            <div className="text-4xl font-extrabold text-slate-900">{summary?.documents_generated ?? 0}</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl w-full p-6 border border-slate-200 shadow-sm flex items-center justify-between flex-1 relative overflow-hidden group">
                        <div className="flex items-center relative z-10">
                            <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mr-4 shrink-0 border border-slate-100">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-700">Periode Tagihan Aktif</div>
                                <div className="text-xs font-medium text-slate-400 mt-0.5">Berlaku selamanya (Pay-as-you-go)</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Static Pricing Reference */}
            <div className="mt-12">
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                    Paket Pembelian Kredit
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[
                        { id: '10', cr: 10, price: 'Rp 49.000', desc: 'Cocok untuk coba-coba.' },
                        { id: '50', cr: 50, price: 'Rp 199.000', desc: 'Pilihan paling hemat.' },
                        { id: '200', cr: 200, price: 'Rp 699.000', desc: 'Sempurna untuk tim guru.' },
                    ].map(pkg => (
                        <div key={pkg.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-all hover:-translate-y-1">
                            <div className="text-slate-500 font-bold mb-2">Paket Basic</div>
                            <div className="text-3xl font-black text-slate-900 mb-1">{pkg.cr} Token</div>
                            <div className="text-sm text-slate-500 mb-6 pb-6 border-b border-slate-100">{pkg.desc}</div>
                            <div className="text-xl font-bold text-indigo-600 mb-4">{pkg.price}</div>
                            <button
                                onClick={() => setIsTopUpOpen(true)}
                                className="w-full py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors"
                            >
                                Beli Paket Ini
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Riwayat Transaksi Placeholder */}
            <div className="mt-12 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-slate-900 text-lg flex items-center">
                        <Receipt className="w-5 h-5 mr-2 text-slate-400" />
                        Riwayat Transaksi
                    </h3>
                </div>

                <div className="p-16 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-5 border-4 border-white shadow-sm">
                        <Receipt className="w-8 h-8 text-slate-300" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 mb-2">Belum ada transaksi</h4>
                    <p className="text-slate-500 max-w-sm mb-6">
                        Riwayat pembelian paket, penukaran voucher, dan penggunaan kredit akan muncul di sini.
                    </p>
                    <button
                        onClick={() => setIsTopUpOpen(true)}
                        className="text-indigo-600 font-bold hover:text-indigo-700 hover:underline"
                    >
                        Top up kredit sekarang
                    </button>
                </div>
            </div>

            {/* Modals */}
            <TopUpModal isOpen={isTopUpOpen} onClose={() => setIsTopUpOpen(false)} />
            <VoucherModal isOpen={isVoucherOpen} onClose={() => setIsVoucherOpen(false)} />

        </motion.div>
    );
}
