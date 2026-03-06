'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    PlusCircle,
    FileStack,
    LayoutTemplate,
    Database,
    CreditCard,
    Users,
    Building,
    Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Buat Modul', href: '/wizard', icon: PlusCircle },
    { name: 'Riwayat Modul', href: '/modules', icon: FileStack },
    { name: 'Template Library', href: '/templates', icon: LayoutTemplate },
    { name: 'Dataset AI', href: '/dataset', icon: Database },
    { name: 'Billing', href: '/billing', icon: CreditCard },
    { name: 'Referral Program', href: '/referral', icon: Users },
    { name: 'Workspace', href: '/workspace', icon: Building },
    { name: 'Pengaturan', href: '/settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full bg-white border-r border-slate-100 w-72 shrink-0 transition-all duration-300 ease-in-out">
            <div className="flex h-16 items-center px-8 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                        M
                    </div>
                    <div>
                        <span className="block font-bold text-lg text-slate-900 tracking-tight leading-none">Modulajar</span>
                    </div>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Menu Utama</p>
                {navigation.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
                                isActive
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "mr-3 h-5 w-5 shrink-0 transition-colors",
                                    isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-500"
                                )}
                            />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
