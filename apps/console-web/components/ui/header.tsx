'use client';

import { UserButton } from '@clerk/nextjs';
import { CreditCard, Building } from 'lucide-react';

export function Header() {
    return (
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
                {/* Workspace Switcher Placeholder */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <span>My Workspace</span>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Credit Balance Placeholder */}
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>128 Kredit</span>
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
