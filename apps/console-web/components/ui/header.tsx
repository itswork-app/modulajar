'use client';

import Link from 'next/link';
import { UserButton, useAuth } from '@clerk/nextjs';
import { Zap, Building } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export function Header() {
    const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();
    const { getToken } = useAuth();
    const [balance, setBalance] = useState<number | null>(null);

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

    const isZero = balance !== null && balance === 0;
    const isLow = balance !== null && balance > 0 && balance <= 3;

    return (
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-sm font-medium text-slate-700">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <span>{isWorkspaceLoading ? 'Loading...' : (workspace?.school_name || workspace?.name || 'My Workspace')}</span>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Credit balance — links to /billing */}
                <Link href="/billing" className={cn(
                    'flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-full border transition-colors',
                    isZero
                        ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                        : isLow
                            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                )}>
                    <Zap className="w-3.5 h-3.5" />
                    <span>{balance !== null ? `${balance} Token` : '...'}</span>
                </Link>

                {/* User menu */}
                <UserButton
                    afterSignOutUrl="/"
                    appearance={{ elements: { avatarBox: 'w-8 h-8 rounded-full border border-slate-200' } }}
                />
            </div>
        </header>
    );
}
