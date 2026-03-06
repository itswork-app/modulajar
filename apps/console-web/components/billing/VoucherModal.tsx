'use client';

import { useState } from 'react';
import { X, Ticket, HelpCircle, Loader2 } from 'lucide-react';

interface VoucherModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function VoucherModal({ isOpen, onClose }: VoucherModalProps) {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRedeem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;

        setIsLoading(true);
        setError(null);

        // Placeholder delay to simulate API verification
        setTimeout(() => {
            setError('Fitur penukaran voucher akan aktif secara penuh pada update selanjutnya.');
            setIsLoading(false);
        }, 800);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                            <Ticket className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Redeem Voucher</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleRedeem} className="p-6">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Masukkan Kode Voucher
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value.toUpperCase());
                                setError(null);
                            }}
                            placeholder="M-AJAR-ABC"
                            className="w-full pl-4 pr-10 py-3 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all font-mono text-lg tracking-wider bg-slate-50"
                            disabled={isLoading}
                        />
                    </div>

                    {error && (
                        <div className="mt-3 text-sm font-medium text-red-600 flex items-start gap-1.5">
                            <HelpCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="mt-8 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                            disabled={isLoading}
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={!code.trim() || isLoading}
                            className={`flex-2 flex items-center justify-center py-3 rounded-xl font-bold text-white transition-all shadow-md ${!code.trim() || isLoading
                                ? 'bg-slate-300 shadow-none cursor-not-allowed'
                                : 'bg-orange-500 hover:bg-orange-600 hover:-translate-y-0.5'
                                }`}
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Klaim Kredit'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
