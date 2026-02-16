'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserButton } from '@clerk/nextjs';

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Buat Baru', href: '/generate', icon: PlusCircle },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full bg-white border-r border-slate-200 w-72 transition-all duration-300 ease-in-out">
            <div className="flex h-20 items-center px-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <div>
                        <span className="block font-bold text-xl text-slate-900 tracking-tight leading-none">Modulajar</span>
                        <span className="block text-xs font-medium text-slate-500 mt-0.5">Console v1.0</span>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-4 py-8 space-y-2">
                <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Menu</p>
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                                isActive
                                    ? "bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1"
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

            <div className="p-4 m-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                    <UserButton
                        afterSignOutUrl="/"
                        showName
                        appearance={{
                            elements: {
                                userButtonBox: "flex flex-row-reverse w-full justify-between",
                                userButtonOuterIdentifier: "font-semibold text-slate-900 text-sm",
                                avatarBox: "w-9 h-9 border-2 border-white shadow-sm"
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
