import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function fetchWorkspaces(token: string | null) {
    if (!token) return [];

    try {
        const res = await fetch(`${API_BASE}/workspaces`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            console.error("[useWorkspaces] /workspaces failed:", res.status);
            return [];
        }

        const data = await res.json();
        return data.workspaces || [];
    } catch (err) {
        console.error("[useWorkspaces] Error:", err);
        return [];
    }
}

export function useWorkspaces() {
    const { getToken, isLoaded } = useAuth();

    const { data: workspaces, mutate, isLoading } = useSWR(
        isLoaded ? 'user-workspaces' : null,
        async () => {
            const token = await getToken();
            return fetchWorkspaces(token);
        },
        { revalidateOnFocus: false }
    );

    return { workspaces, mutate, isLoading };
}

export function useWorkspace() {
    const { getToken, isLoaded } = useAuth();
    const { workspaces, isLoading: isListLoading } = useWorkspaces();
    const [activeId, setActiveId] = useState<string | null>(null);

    // Persist active workspace ID in localStorage
    useEffect(() => {
        const saved = localStorage.getItem('modulajar_active_workspace');
        if (saved) setActiveId(saved);
    }, []);

    const setActiveWorkspace = (id: string) => {
        setActiveId(id);
        localStorage.setItem('modulajar_active_workspace', id);
    };

    const workspace = workspaces?.find((w: any) => w.id === activeId) || workspaces?.[0] || null;

    // Handle initial bootstrap if no workspaces exist
    useEffect(() => {
        async function bootstrapIfNeeded() {
            if (isLoaded && !isListLoading && (!workspaces || workspaces.length === 0)) {
                console.log("[useWorkspace] No workspace found, bootstrapping...");
                const token = await getToken();
                const createRes = await fetch(`${API_BASE}/bootstrap`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ name: 'My Workspace' })
                });
                if (createRes.ok) {
                    window.location.reload(); // Simplest way to refresh all state
                }
            }
        }
        bootstrapIfNeeded();
    }, [isLoaded, isListLoading, workspaces, getToken]);

    return {
        workspace,
        setActiveWorkspace,
        isLoading: isListLoading || (isLoaded && !workspace && workspaces?.length! > 0)
    };
}

