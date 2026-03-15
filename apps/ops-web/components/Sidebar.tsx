'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart3, 
  ShieldAlert, 
  LayoutDashboard, 
  Globe, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UserButton } from '@clerk/nextjs';

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, href: '/' },
  { label: 'Revenue', icon: BarChart3, href: '/revenue' },
  { label: 'Support & Ops', icon: ShieldAlert, href: '/support' },
  { label: 'Workspaces', icon: Globe, href: '/support' }, // Reuse search in support for now
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={cn(
      "h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 relative",
      isCollapsed ? "w-20" : "w-64"
    )}>
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <span className="font-black text-white">M</span>
        </div>
        {!isCollapsed && <span className="font-black text-xl tracking-tighter">HQ MODULAR</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
                isActive ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "" : "group-hover:scale-110 transition-transform")} />
              {!isCollapsed && <span className="font-bold text-sm tracking-wide">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2">
          <UserButton afterSignOutUrl="/" />
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Operator</span>
              <span className="text-xs font-bold truncate max-w-[120px]">Super Admin</span>
            </div>
          )}
        </div>
      </div>

      {/* Toggle */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
