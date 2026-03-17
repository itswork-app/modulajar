'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart3, 
  ShieldAlert, 
  LayoutDashboard, 
  Globe, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UserButton } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, href: '/' },
  { label: 'Revenue', icon: BarChart3, href: '/revenue' },
  { label: 'Support & Ops', icon: ShieldAlert, href: '/support' },
  { label: 'Workspaces', icon: Globe, href: '/support' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={cn(
      "h-screen bg-card/5 border-r border-border/50 flex flex-col transition-all duration-500 relative backdrop-blur-xl z-50",
      isCollapsed ? "w-20" : "w-72"
    )}>
      {/* Branding */}
      <div className="p-8 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 glow-border">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col"
            >
              <span className="font-black text-lg tracking-tighter leading-none">MODULAR</span>
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-1">HQ OPS</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all relative group overflow-hidden",
                isActive 
                  ? "text-white" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {isActive && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-2xl -z-10"
                />
              )}
              <item.icon className={cn("w-5 h-5 transition-all duration-300", 
                 isActive ? "text-primary scale-110" : "group-hover:scale-110"
              )} />
              {!isCollapsed && (
                <span className="font-black text-xs uppercase tracking-widest">{item.label}</span>
              )}
              {isActive && (
                <div className="absolute left-0 w-1 h-5 bg-primary rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Operator Status */}
      <div className="p-6 mt-auto border-t border-border/30">
        <div className={cn("flex items-center gap-4 glass-card p-3 rounded-2xl", isCollapsed ? "justify-center" : "")}>
          <UserButton afterSignOutUrl="https://modulajar.app" />
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-black uppercase text-primary tracking-widest leading-none mb-1">Authenticated HL</span>
              <span className="text-xs font-black truncate text-foreground leading-none">System Operator</span>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Trigger */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-12 w-8 h-8 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:scale-110 z-50 shadow-xl shadow-black/50"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
