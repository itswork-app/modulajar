'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileSetupPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/onboarding');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="animate-pulse text-slate-400 font-medium tracking-tighter uppercase text-xs">Redirecting to onboarding...</div>
        </div>
    );
}
