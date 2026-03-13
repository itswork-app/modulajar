'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export function usePlatformRole() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!isLoaded || !isSignedIn) {
            setIsLoading(false);
            return;
        }

        async function checkRole() {
            try {
                const token = await getToken();
                // We try a minimal platform endpoint to verify role
                const res = await fetch(`${API_BASE}/platform/stats/technical`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setIsPlatformAdmin(res.ok);
            } catch {
                setIsPlatformAdmin(false);
            } finally {
                setIsLoading(false);
            }
        }

        checkRole();
    }, [isLoaded, isSignedIn, getToken]);

    return { isPlatformAdmin, isLoading };
}
