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
    TrendingUp,
    Server,
    Settings,
    BarChart3,
    Database,
    LayoutTemplate,
    Type,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceRole } from '@/hooks/use-workspace-role';
import { usePlatformRole } from '@/hooks/use-platform-role';
import { useWorkspace } from '@/hooks/use-workspace';
import { BadgeCheck, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const learningJourneyNav = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Buat Modul', href: '/wizard', icon: PlusCircle },
    { name: 'Riwayat Modul', href: '/modules', icon: FileStack },
    { name: 'Dataset AI', href: '/dataset', icon: Database },
];

const toolsNav = [
    { name: 'Smart Templates', href: '/templates', icon: LayoutTemplate },
    { name: 'Letterhead', href: '/workspace/letterhead', icon: Type },
];

const accountNav = [
    { name: 'Billing', href: '/billing', icon: CreditCard },
    { name: 'Referral', href: '/referral', icon: Gift },
    { name: 'Workspace', href: '/workspace', icon: Building2 },
    { name: 'Pengaturan', href: '/settings', icon: Settings },
];

function SidebarLink({ 
    href, 
    icon: Icon, 
    children, 
    active,
    color = 'emerald',
    onClose
}: { 
    href: string, 
    icon: React.ElementType, 
    children: React.ReactNode, 
    active: boolean,
    color?: 'emerald' | 'indigo' | 'amber',
    onClose?: () => void
}) {
    const colorMap = {
        emerald: 'bg-emerald-50/50 text-emerald-700 hover:bg-slate-50 hover:text-slate-900',
        indigo: 'bg-indigo-50/50 text-indigo-700 hover:bg-slate-50 hover:text-slate-900',
        amber: 'bg-amber-50/50 text-amber-700 hover:bg-slate-50 hover:text-slate-900'
    };

    const iconColorMap = {
        emerald: 'text-emerald-600',
        indigo: 'text-indigo-600',
        amber: 'text-amber-500'
    };

    return (
        <Link
            href={href}
            onClick={onClose}
            className={cn(
                'group flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 relative truncate',
                active
                    ? colorMap[color].split(' hover:')[0]
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            )}
        >
            {active && (
                <motion.span 
                    layoutId="active-indicator"
                    className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full", 
                        color === 'emerald' ? 'bg-emerald-500' : color === 'indigo' ? 'bg-indigo-500' : 'bg-amber-500'
                    )} 
                />
            )}
            <Icon
                className={cn(
                    'mr-3 h-4 w-4 shrink-0 transition-colors',
                    active ? iconColorMap[color] : 'text-slate-400 group-hover:text-emerald-500'
                )}
            />
            {children}
        </Link>
    );
}

export function Sidebar({ className, onClose }: { className?: string, onClose?: () => void }) {
    const pathname = usePathname();
    const { isAdmin } = useWorkspaceRole();
    const { isPlatformAdmin } = usePlatformRole();
    const { workspace } = useWorkspace();

    const isElite = workspace?.workspace_type === 'institution';
    const isVerified = workspace?.is_verified;

    return (
        <div className={cn(
            "flex flex-col h-full bg-white/80 backdrop-blur-xl border-r border-slate-100 w-64 shrink-0 transition-all duration-300",
            className
        )}>
            {/* Logo */}
            <div className="flex h-16 items-center px-6 shrink-0 border-b border-slate-50">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-sm transition-colors",
                        isElite ? "bg-indigo-600" : "bg-emerald-600"
                    )}>
                        {isElite ? <Sparkles className="w-4 h-4" /> : "M"}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-lg text-slate-900 tracking-tight leading-none flex items-center gap-1">
                            Modulajar
                            {isVerified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                        </span>
                        {isElite && <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none mt-1">Elite Grade</span>}
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-0.5 scrollbar-hide">
                <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Master Journey</p>
                {learningJourneyNav.map((item) => (
                    <SidebarLink
                        key={item.name}
                        href={item.href}
                        icon={item.icon}
                        active={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
                        onClose={onClose}
                    >
                        {item.name}
                    </SidebarLink>
                ))}

                <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 mt-8">Professional Tools</p>
                {toolsNav.map((item) => (
                    <SidebarLink
                        key={item.name}
                        href={item.href}
                        icon={item.icon}
                        active={pathname.startsWith(item.href)}
                        onClose={onClose}
                    >
                        {item.name}
                    </SidebarLink>
                ))}

                <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 mt-8">Accounts</p>
                {accountNav.map((item) => (
                    <SidebarLink
                        key={item.name}
                        href={item.href}
                        icon={item.icon}
                        active={pathname.startsWith(item.href)}
                        onClose={onClose}
                    >
                        {item.name}
                    </SidebarLink>
                ))}

                {/* Admin-only section */}
                {isAdmin && (
                    <div className="mt-6">
                        <p className="px-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">School Management</p>
                        <SidebarLink 
                            href="/workspace/dashboard" 
                            icon={BarChart3} 
                            active={pathname.startsWith('/workspace/dashboard')}
                            color="indigo"
                            onClose={onClose}
                        >
                            School Insights
                        </SidebarLink>
                    </div>
                )}

                {/* Platform-only section */}
                {isPlatformAdmin && (
                    <>
                        <p className="px-3 text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 mt-6">Platform Systems</p>
                        <SidebarLink 
                            href="/platform/revenue" 
                            icon={TrendingUp} 
                            active={pathname.startsWith('/platform/revenue')}
                            color="amber"
                            onClose={onClose}
                        >
                            Revenue Analysis
                        </SidebarLink>
                        <SidebarLink 
                            href="/platform/support" 
                            icon={Server} 
                            active={pathname.startsWith('/platform/support')}
                            color="amber"
                            onClose={onClose}
                        >
                            Tech Support Ops
                        </SidebarLink>
                    </>
                )}
            </nav>

            {/* Footer hint */}
            <div className="px-6 py-4 border-t border-slate-50">
                <p className="text-[10px] text-slate-300 font-medium uppercase tracking-widest">
                    v0.5.0 · {isElite ? 'Elite Grade' : 'Professional'}
                </p>
            </div>
        </div>
    );
}
