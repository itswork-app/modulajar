'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, AlertCircle, Copy, Check, Users, Gift, Link as LinkIcon, Share2 } from 'lucide-react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ReferralInfo {
    referral_code: string;
    referral_link: string;
    total_referrals: number;
}

export default function ReferralPage() {
    const { getToken } = useAuth();
    const { currentWorkspace } = useWorkspace();
    const [info, setInfo] = useState<ReferralInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!currentWorkspace) return;
        const fetchReferral = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${currentWorkspace.id}/referral`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to load referral info');
                const data: ReferralInfo = await res.json();
                setInfo(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };
        fetchReferral();
    }, [currentWorkspace, getToken]);

    const handleCopy = async () => {
        if (!info?.referral_link) return;
        try {
            await navigator.clipboard.writeText(info.referral_link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = info.referral_link;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-slate-600">{error}</p>
                <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700 font-medium">
                    ← Kembali ke Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <Share2 className="h-7 w-7 text-indigo-600" />
                    Referral Program
                </h1>
                <p className="text-slate-500 mt-1">
                    Ajak rekan guru menggunakan Modulajar dan dapatkan credit gratis!
                </p>
            </div>

            {/* Referral Link Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-6 space-y-4">
                <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                    <LinkIcon className="h-5 w-5" />
                    Link Referral Anda
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white rounded-xl border border-indigo-200 px-4 py-3 font-mono text-sm text-slate-700 truncate">
                        {info?.referral_link || '—'}
                    </div>
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shrink-0"
                    >
                        {copied ? (
                            <>
                                <Check className="h-4 w-4" />
                                Tersalin!
                            </>
                        ) : (
                            <>
                                <Copy className="h-4 w-4" />
                                Salin
                            </>
                        )}
                    </button>
                </div>

                <p className="text-sm text-indigo-600/70">
                    Bagikan link ini di grup WhatsApp guru untuk mengundang rekan Anda.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-blue-50 rounded-xl">
                            <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-500">Total Referral</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">
                        {info?.total_referrals ?? 0}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">guru yang bergabung</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-emerald-50 rounded-xl">
                            <Gift className="h-5 w-5 text-emerald-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-500">Credit Diperoleh</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">
                        {(info?.total_referrals ?? 0) * 5}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">+5 credit per referral aktif</p>
                </div>
            </div>

            {/* How it Works */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Cara Kerja</h2>
                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm shrink-0">1</div>
                        <div>
                            <p className="font-medium text-slate-800">Bagikan link</p>
                            <p className="text-sm text-slate-500">Salin link referral dan kirim ke rekan guru Anda</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm shrink-0">2</div>
                        <div>
                            <p className="font-medium text-slate-800">Guru bergabung</p>
                            <p className="text-sm text-slate-500">Rekan Anda membuat akun melalui link tersebut</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm shrink-0">3</div>
                        <div>
                            <p className="font-medium text-slate-800">Dapatkan reward</p>
                            <p className="text-sm text-slate-500">Setelah mereka membuat dokumen pertama, Anda mendapat +5 credit</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
