import { UserButton, useAuth } from '@clerk/nextjs';
import { CreditCard, Building } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export function Header() {
    const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();
    const { getToken } = useAuth();
    const [balance, setBalance] = useState<number | null>(null);

    useEffect(() => {
        async function fetchBalance() {
            if (!workspace?.id) return;
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspace.id}/usage-summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setBalance(data.credits_remaining);
                }
            } catch (err) {
                console.error('Failed to fetch balance:', err);
            }
        }
        fetchBalance();
    }, [workspace?.id, getToken]);

    return (
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
                {/* Workspace Switcher */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <span>{isWorkspaceLoading ? 'Loading...' : (workspace?.school_name || workspace?.name || 'My Workspace')}</span>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Credit Balance */}
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>{balance !== null ? `${balance} Token` : '...'}</span>
                </div>

                {/* User Menu */}
                <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                        elements: {
                            avatarBox: "w-8 h-8 rounded-full border border-slate-200"
                        }
                    }}
                />
            </div>
        </header>
    );
}
