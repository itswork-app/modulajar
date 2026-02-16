'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, Settings, LogOut, BookOpen, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserButton } from '@clerk/nextjs';

const navigation = [
    { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
    { name: 'Buat Baru', href: '/app/generate', icon: PlusCircle },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64">
            <div className="flex h-16 items-center px-6 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold mr-3">M</div>
                <span className="font-bold text-lg text-slate-900 tracking-tight">Console</span>
            </div>

            <nav className="flex-1 px-3 py-6 space-y-1">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all",
                                isActive
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                                    isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-500"
                                )}
                            />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-100">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <UserButton afterSignOutUrl="/" showName />
                </div>
            </div>
        </div>
    );
}
