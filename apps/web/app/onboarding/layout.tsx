'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const steps = [
    { path: '/onboarding/profile', label: 'Profil Guru', num: 1 },
    { path: '/onboarding/school', label: 'Profil Sekolah', num: 2 },
    { path: '/onboarding/assignment', label: 'Kelas & Mapel', num: 3 },
    { path: '/onboarding/start', label: 'Mulai', num: 4 },
];

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const currentIdx = steps.findIndex(s => pathname?.startsWith(s.path));

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-emerald-50/30 flex flex-col">
            {/* Header */}
            <header className="w-full px-6 pt-8 pb-4">
                <div className="max-w-xl mx-auto flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">M</div>
                    <span className="text-lg font-bold tracking-tight text-slate-900">Modulajar</span>
                </div>
            </header>

            {/* Progress Bar */}
            <div className="w-full px-6 pb-8">
                <div className="max-w-xl mx-auto">
                    <div className="flex items-center gap-2">
                        {steps.map((step, i) => (
                            <React.Fragment key={step.path}>
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                                        i < currentIdx
                                            ? 'bg-emerald-600 text-white'
                                            : i === currentIdx
                                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                                                : 'bg-slate-100 text-slate-400'
                                    )}>
                                        {i < currentIdx ? '✓' : step.num}
                                    </div>
                                    <span className={cn(
                                        'text-xs font-medium hidden sm:block',
                                        i <= currentIdx ? 'text-slate-700' : 'text-slate-400'
                                    )}>
                                        {step.label}
                                    </span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={cn(
                                        'flex-1 h-0.5 rounded-full transition-all duration-300',
                                        i < currentIdx ? 'bg-emerald-400' : 'bg-slate-200'
                                    )} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="flex-1 flex items-start justify-center px-6 pb-16">
                <div className="w-full max-w-xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
