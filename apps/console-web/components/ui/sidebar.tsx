'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, Building, FileSignature } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserButton } from '@clerk/nextjs';

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Buat Baru', href: '/generate', icon: PlusCircle },
    { name: 'Identitas Sekolah', href: '/workspace/school-setup', icon: Building },
    { name: 'Kop Surat', href: '/workspace/letterhead', icon: FileSignature },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full bg-white border-r border-slate-100 w-72 transition-all duration-300 ease-in-out">
            <div className="flex h-24 items-center px-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-200">
                        M
                    </div>
                    <div>
                        <span className="block font-bold text-xl text-slate-900 tracking-tight leading-none">Modulajar</span>
                        <span className="block text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Console</span>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-6 py-4 space-y-2">
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">Menu Utama</p>
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center px-5 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-200",
                                isActive
                                    ? "bg-emerald-50 text-emerald-700 shadow-lg shadow-emerald-100/50"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md hover:shadow-slate-100"
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "mr-4 h-5 w-5 shrink-0 transition-colors",
                                    isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-500"
                                )}
                            />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-6 m-4 bg-slate-50/50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3">
                    <UserButton
                        afterSignOutUrl="/"
                        showName
                        appearance={{
                            elements: {
                                userButtonBox: "flex flex-row-reverse w-full justify-between gap-2",
                                userButtonOuterIdentifier: "font-bold text-slate-700 text-sm",
                                avatarBox: "w-10 h-10 border-4 border-white shadow-md shadow-slate-100"
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
