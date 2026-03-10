'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    PlusCircle,
    FileStack,
    CreditCard,
    Gift,
    Building2,
    Settings,
    BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceRole } from '@/hooks/use-workspace-role';

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Buat Modul', href: '/wizard', icon: PlusCircle },
    { name: 'Riwayat Modul', href: '/modules', icon: FileStack },
    { name: 'Billing', href: '/billing', icon: CreditCard },
    { name: 'Referral', href: '/referral', icon: Gift },
    { name: 'Workspace', href: '/workspace', icon: Building2 },
    { name: 'Pengaturan', href: '/settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { isAdmin } = useWorkspaceRole();

    return (
        <div className="flex flex-col h-full bg-white border-r border-slate-100 w-64 shrink-0">
            {/* Logo */}
            <div className="flex h-16 items-center px-6 shrink-0 border-b border-slate-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                        M
                    </div>
                    <span className="font-black text-lg text-slate-900 tracking-tight leading-none">Modulajar</span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5">
                <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Menu Utama</p>
                {navigation.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'group flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 relative',
                                isActive
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            )}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-r-full" />
                            )}
                            <item.icon
                                className={cn(
                                    'mr-3 h-4 w-4 shrink-0 transition-colors',
                                    isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-500'
                                )}
                            />
                            {item.name}
                        </Link>
                    );
                })}

                {/* Admin-only section */}
                {isAdmin && (
                    <>
                        <p className="px-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 mt-5">Admin Sekolah</p>
                        <Link
                            href="/workspace/dashboard"
                            className={cn(
                                'group flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 relative',
                                pathname.startsWith('/workspace/dashboard')
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-slate-500 hover:bg-indigo-50/50 hover:text-indigo-700'
                            )}
                        >
                            {pathname.startsWith('/workspace/dashboard') && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-500 rounded-r-full" />
                            )}
                            <BarChart3
                                className={cn(
                                    'mr-3 h-4 w-4 shrink-0 transition-colors',
                                    pathname.startsWith('/workspace/dashboard') ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'
                                )}
                            />
                            Dashboard Sekolah
                        </Link>
                    </>
                )}
            </nav>

            {/* Footer hint */}
            <div className="px-6 py-4 border-t border-slate-50">
                <p className="text-[10px] text-slate-300 font-medium uppercase tracking-widest">v0.4 · Beta</p>
            </div>
        </div>
    );
}
