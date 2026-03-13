'use client';

import Link from 'next/link';
import { UserButton, useAuth, useClerk } from '@clerk/nextjs';
import { Zap, Building, ChevronDown, Settings, CreditCard, Plus, HelpCircle, LogOut } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export function Header() {
    const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();
    const { getToken } = useAuth();
    const { signOut } = useClerk();
    const [balance, setBalance] = useState<number | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;
        async function fetchBalance() {
            if (!workspace?.id) return;
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspace.id}/wallet/summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) setBalance(data.credits_remaining);
                }
            } catch {
                // non-fatal, badge stays at '...'
            }
        }
        fetchBalance();
        return () => { isMounted = false; };
    }, [workspace?.id, getToken]);

    // Handle clicks outside of dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isZero = balance !== null && balance === 0;
    const isLow = balance !== null && balance > 0 && balance <= 3;

    const workspaceName = isWorkspaceLoading ? 'Loading...' : (workspace?.school_name || workspace?.name || 'My Workspace');

    return (
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0 relative z-30">
            <div className="flex items-center gap-4">
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={cn(
                            "group flex items-center gap-2.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all active:scale-95 dropdown-trigger",
                            isMenuOpen && "ring-2 ring-emerald-500/20 border-emerald-500/50 bg-white"
                        )}
                    >
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-xs group-hover:bg-emerald-200 transition-colors">
                            <Building className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col items-start leading-none gap-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Workspace</span>
                            <span className="text-sm font-bold text-slate-900 truncate max-w-[160px]">{workspaceName}</span>
                        </div>
                        <ChevronDown className={cn("ml-1 w-4 h-4 text-slate-400 transition-transform duration-200", isMenuOpen && "rotate-180")} />
                    </button>

                    <AnimatePresence>
                        {isMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className="absolute top-[calc(100%+8px)] left-0 w-64 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/50 p-2 overflow-hidden overflow-y-auto max-h-[400px]"
                            >
                                <div className="px-3 py-2 border-b border-slate-50 mb-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Daftar Workspace</p>
                                </div>

                                {/* Current Workspace (Active) */}
                                <div className="p-1">
                                    <div className="flex items-center gap-3 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white">
                                            {workspaceName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-bold text-emerald-900 truncate">{workspaceName}</span>
                                            <span className="text-[10px] font-medium text-emerald-600/70 truncate uppercase tracking-tighter">Active Workspace</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="mt-2 space-y-0.5 border-t border-slate-50 pt-2 px-1">
                                    <Link
                                        href="/workspace"
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors group font-medium text-sm"
                                    >
                                        <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center group-hover:bg-white border border-transparent group-hover:border-slate-200 transition-all">
                                            <Settings className="w-3.5 h-3.5" />
                                        </div>
                                        Pengaturan Workspace
                                    </Link>
                                    <Link
                                        href="/billing"
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors group font-medium text-sm"
                                    >
                                        <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center group-hover:bg-white border border-transparent group-hover:border-slate-200 transition-all">
                                            <CreditCard className="w-3.5 h-3.5" />
                                        </div>
                                        Billing & Token
                                    </Link>
                                </div>

                                {/* Placeholder: Create New Workspace */}
                                <div className="mt-2 pt-2 border-t border-slate-50 px-1">
                                    <button
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors group font-bold text-sm border-dashed border-2 border-emerald-100/50"
                                    >
                                        <div className="w-7 h-7 rounded-md bg-emerald-100/50 flex items-center justify-center group-hover:bg-white transition-all">
                                            <Plus className="w-3.5 h-3.5" />
                                        </div>
                                        Buat Workspace Baru
                                    </button>
                                    <p className="px-3 py-2 text-[9px] font-medium text-slate-400 italic">Mendukung banyak institusi/sekolah segera.</p>
                                </div>

                                <div className="mt-2 pt-2 border-t border-slate-100 px-1">
                                    <button
                                        onClick={() => { setIsMenuOpen(false); signOut(); }}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors group font-medium text-sm"
                                    >
                                        <div className="w-7 h-7 rounded-md bg-red-100/50 flex items-center justify-center group-hover:bg-white transition-all">
                                            <LogOut className="w-3.5 h-3.5" />
                                        </div>
                                        Keluar Sesi
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Credit balance — links to /billing */}
                <Link href="/billing" className={cn(
                    'flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95 shadow-sm',
                    isZero
                        ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300'
                        : isLow
                            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200'
                )}>
                    <Zap className="w-3.5 h-3.5" />
                    <span>{balance !== null ? `${balance} Token` : '...'}</span>
                </Link>

                {/* User menu */}
                <UserButton
                    afterSignOutUrl="/"
                    appearance={{ elements: { avatarBox: 'w-8 h-8 rounded-full border border-slate-200 shadow-xs hover:border-emerald-500 transition-all' } }}
                />
            </div>
        </header>
    );
}
