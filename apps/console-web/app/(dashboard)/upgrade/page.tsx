'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { 
    Check, Sparkles, Building2, Users, 
    ArrowRight, Loader2, ShieldCheck, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface Plan {
    id: string;
    name: string;
    slug: string;
    base_price_idr: number;
    base_credits: number;
    features: string[];
}

export default function UpgradePage() {
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [upgradingSlug, setUpgradingSlug] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchPlans = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/plans`);
            const json = await res.json();
            setPlans(json.plans);
        } catch (err) {
            console.error('Failed to fetch plans', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    const handleUpgrade = async (slug: string) => {
        if (!workspace) return;
        setUpgradingSlug(slug);
        setError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/subscription/upgrade`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ plan_slug: slug })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal memulai upgrade.');

            if (json.payment_url) {
                // Redirect to payment
                window.location.href = json.payment_url;
            } else if (json.status === 'success') {
                // Reload to see changes
                window.location.reload();
            }
        } catch (err: unknown) {
            setError((err as Error).message);
            setUpgradingSlug(null);
        }
    };

    if (isLoading || !isAuthLoaded || isLoadingWorkspace) {
        return (
            <div className="flex h-[70vh] items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-12 px-6">
            <div className="text-center mb-16 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Self-Service Upgrade</span>
                </div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tight">Pilih Masa Depan Sekolah Anda</h1>
                <p className="text-slate-500 font-bold max-w-2xl mx-auto text-lg leading-relaxed">
                    Transformasikan cara guru Anda bekerja dengan fitur kolaborasi tingkat institusi dan kontrol admin penuh.
                </p>
            </div>

            {error && (
                <div className="max-w-md mx-auto mb-10 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-bold">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                {plans.map((plan) => {
                    const isCurrent = workspace?.plan_id === plan.id;
                    const isInstitutional = plan.slug === 'institutional';
                    
                    return (
                        <motion.div
                            key={plan.id}
                            whileHover={{ y: -8 }}
                            className={cn(
                                "relative bg-white rounded-[2.5rem] p-10 flex flex-col border-2 transition-all duration-300",
                                isInstitutional 
                                    ? "border-indigo-500 shadow-2xl shadow-indigo-100 ring-8 ring-indigo-50" 
                                    : "border-slate-100 shadow-xl shadow-slate-100 hover:border-slate-200",
                                isCurrent && "opacity-75 grayscale-[0.5]"
                            )}
                        >
                            {isInstitutional && (
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-6 py-2 bg-indigo-600 text-white text-xs font-black rounded-full shadow-lg shadow-indigo-200 uppercase tracking-widest">
                                    Paling Populer
                                </div>
                            )}

                            <div className="mb-8">
                                <div className={cn(
                                    "w-14 h-14 rounded-3xl flex items-center justify-center mb-6",
                                    isInstitutional ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
                                )}>
                                    {isInstitutional ? <Building2 className="w-7 h-7" /> : <Users className="w-7 h-7" />}
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                                        {plan.base_price_idr === 0 ? 'Gratis' : `Rp ${(plan.base_price_idr / 1000).toLocaleString()}k`}
                                    </span>
                                    {plan.base_price_idr > 0 && <span className="text-slate-400 font-bold">/ selamanya</span>}
                                </div>
                            </div>

                            <ul className="space-y-4 mb-10 flex-1">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-slate-600 font-bold text-sm">
                                        <div className={cn(
                                            "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                                            isInstitutional ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
                                        )}>
                                            <Check className="w-3 h-3" />
                                        </div>
                                        {feature}
                                    </li>
                                ))}
                                <li className="flex items-start gap-3 text-slate-900 font-black text-sm">
                                    <div className={cn(
                                        "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                                        isInstitutional ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
                                    )}>
                                        <Zap className="w-3 h-3 fill-current" />
                                    </div>
                                    Include {plan.base_credits} Token Awal
                                </li>
                            </ul>

                            <button
                                onClick={() => !isCurrent && handleUpgrade(plan.slug)}
                                disabled={isCurrent || (upgradingSlug !== null)}
                                className={cn(
                                    "w-full py-5 rounded-3xl font-black text-base transition-all flex items-center justify-center gap-2",
                                    isCurrent 
                                        ? "bg-emerald-50 text-emerald-600 cursor-default"
                                        : isInstitutional
                                            ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200"
                                            : "bg-slate-900 text-white hover:bg-slate-800",
                                    upgradingSlug === plan.slug && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isCurrent ? (
                                    <>Terpasang <Check className="w-5 h-5" /></>
                                ) : upgradingSlug === plan.slug ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>{plan.base_price_idr === 0 ? 'Pilih Paket' : 'Upgrade Sekarang'} <ArrowRight className="w-5 h-5" /></>
                                )}
                            </button>
                        </motion.div>
                    );
                })}
            </div>

            <div className="mt-20 max-w-3xl mx-auto bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 flex flex-col md:flex-row items-center gap-8">
                <div className="w-20 h-20 rounded-3xl bg-white shadow-sm flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-10 h-10 text-emerald-500" />
                </div>
                <div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">Keamanan & Dukungan Prioritas</h4>
                    <p className="text-slate-500 font-bold text-sm leading-relaxed">
                        Seluruh transaksi diproses melalui gateway pembayaran resmi (Xendit) dengan enkripsi tingkat bank. Tim support kami siap membantu 24/7 jika Anda mengalami kendala saat upgrade.
                    </p>
                </div>
            </div>
        </div>
    );
}
