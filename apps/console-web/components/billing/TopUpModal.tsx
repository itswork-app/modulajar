'use client';

import { useState } from 'react';
import { X, CheckCircle2, ChevronRight, Gem } from 'lucide-react';

interface TopUpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PACKAGES = [
    { id: 'pkg_10', credits: 10, price: 'Rp 49.000', popular: false, desc: 'Cocok untuk coba-coba.' },
    { id: 'pkg_50', credits: 50, price: 'Rp 199.000', popular: true, desc: 'Pilihan paling hemat untuk guru aktif.' },
    { id: 'pkg_200', credits: 200, price: 'Rp 699.000', popular: false, desc: 'Untuk sekolah atau institusi.' }
];

export function TopUpModal({ isOpen, onClose }: TopUpModalProps) {
    const [selectedPkg, setSelectedPkg] = useState<string | null>(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Gem className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Top Up Kredit</h2>
                            <p className="text-sm font-medium text-slate-500">Pilih paket yang sesuai kebutuhan Anda</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 overflow-y-auto space-y-4">
                    {PACKAGES.map((pkg) => {
                        const isSelected = selectedPkg === pkg.id;
                        return (
                            <div
                                key={pkg.id}
                                onClick={() => setSelectedPkg(pkg.id)}
                                className={`relative flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all ${isSelected
                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                    }`}
                            >
                                {pkg.popular && (
                                    <div className="absolute -top-3 left-6 px-3 py-0.5 bg-linear-to-r from-indigo-500 to-purple-500 text-white text-[11px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                                        Paling Populer
                                    </div>
                                )}

                                <div className="flex items-center gap-5">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                                        }`}>
                                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                    </div>
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-extrabold text-slate-900">{pkg.credits} Token</span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-500 mt-0.5">{pkg.desc}</p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-lg font-bold text-slate-900">{pkg.price}</div>
                                </div>
                            </div>
                        );
                    })}

                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium text-center shadow-sm">
                        🚧 Fitur pembayaran (Xendit) sedang dalam tahap integrasi dan akan aktif segera.
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        disabled={!selectedPkg}
                        className={`inline-flex items-center px-6 py-2.5 rounded-xl font-bold shadow-sm transition-all ${selectedPkg
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-md'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        onClick={() => {
                            // Placeholder logic - no real payment yet
                            alert('Payment Gateway integration coming in PR-071!');
                            onClose();
                        }}
                    >
                        Lanjutkan Pembayaran
                        <ChevronRight className="w-4 h-4 ml-1.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
