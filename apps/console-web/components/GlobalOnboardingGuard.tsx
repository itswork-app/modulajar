'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { useWorkspaceStore } from '@/store/workspace-store';
import OnboardingFlow from '@/components/OnboardingFlow';

export default function GlobalOnboardingGuard({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();

    const {
        teacherProfile,
        schoolIdentity,
        isProfileLoaded,
        isProfileLoading,
        loadProfileData,
        resetProfileData
    } = useWorkspaceStore();

    // Re-fetch profile data whenever workspace changes
    useEffect(() => {
        if (!isAuthLoaded || !workspace) {
            resetProfileData();
            return;
        }
        
        // Prevent concurrent fetches
        if (!isProfileLoaded && !isProfileLoading) {
            getToken().then(token => {
                if (token) loadProfileData(workspace.id, token);
            });
        }
    }, [workspace, isAuthLoaded, getToken, loadProfileData, resetProfileData, isProfileLoaded, isProfileLoading]);

    // Show children immediately if loading (the individual components will show their own loading skeletal states) or if data is complete
    if (isWorkspaceLoading || isProfileLoading || !isAuthLoaded) {
        return <>{children}</>;
    }

    // Only block if we have successfully loaded data and determined the profile is missing
    const isProfileMissing = isProfileLoaded && (!teacherProfile || !schoolIdentity);

    return (
        <div className="relative min-h-screen">
            {/* The underlying Dashboard UI */}
            {children}

            {/* The Fullscreen Guard Overlay */}
            {isProfileMissing && (
                <div className="fixed inset-0 z-100 bg-slate-950/40 backdrop-blur-md flex items-center justify-center overflow-y-auto w-full h-full animate-in fade-in duration-500">
                    <div className="w-full max-w-4xl px-4 py-12 m-auto">
                        <div className="bg-white rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.1)] border border-slate-100 ring-1 ring-slate-950/5 overflow-hidden">
                            <OnboardingFlow onSuccess={() => {
                                // Reload global store explicitly instead of a hard refresh
                                getToken().then(token => {
                                    if (token && workspace) {
                                        loadProfileData(workspace.id, token);
                                    }
                                });
                            }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
