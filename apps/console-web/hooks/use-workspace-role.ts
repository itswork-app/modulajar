'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from './use-workspace';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type WorkspaceRole = 'owner' | 'admin' | 'member' | null;

interface UseWorkspaceRoleResult {
    role: WorkspaceRole;
    isAdmin: boolean;
    isLoading: boolean;
}

export function useWorkspaceRole(): UseWorkspaceRoleResult {
    const { getToken, isLoaded } = useAuth();
    const { workspace } = useWorkspace();
    const [role, setRole] = useState<WorkspaceRole>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        if (!isLoaded || !workspace) {
            setIsLoading(false);
            return;
        }

        async function fetchRole() {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                const match = data.workspaces?.find((w: { id: string }) => w.id === workspace!.id);
                if (isMounted && match) {
                    setRole(match.role as WorkspaceRole);
                }
            } catch {
                // silently fail
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        fetchRole();
        return () => { isMounted = false; };
    }, [isLoaded, workspace, getToken]);

    return {
        role,
        isAdmin: role === 'owner' || role === 'admin',
        isLoading,
    };
}
