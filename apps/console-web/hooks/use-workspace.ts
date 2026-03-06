'use client';

import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function fetchWorkspace(token: string | null) {
    if (!token) return null;

    try {
        // 1. Try to get existing workspaces via /me (standard for Modulajar API)
        const res = await fetch(`${API_BASE}/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error("[useWorkspace] /me failed:", res.status, errBody);
            throw new Error(`Failed to fetch workspaces: ${res.status}`);
        }

        const data = await res.json();
        if (data.workspaces && data.workspaces.length > 0) {
            return data.workspaces[0];
        }

        // 2. If no workspace, call /bootstrap (idempotent init)
        console.log("[useWorkspace] No workspace found, bootstrapping...");
        const createRes = await fetch(`${API_BASE}/bootstrap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name: 'My Workspace' })
        });

        if (!createRes.ok) {
            const errBody = await createRes.text();
            console.error("[useWorkspace] /bootstrap failed:", createRes.status, errBody);
            throw new Error(`Failed to create workspace: ${createRes.status}`);
        }

        // Fetch again to get the full list and set SWR state
        const refreshRes = await fetch(`${API_BASE}/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const refreshData = await refreshRes.json();
        return refreshData.workspaces?.[0] || null;

    } catch (err) {
        console.error("[useWorkspace] Error in fetchWorkspace:", err);
        throw err;
    }
}

export function useWorkspace() {
    const { getToken, isLoaded } = useAuth();

    const { data: workspace, error, isLoading } = useSWR(
        isLoaded ? 'user-workspace' : null,
        async () => {
            const token = await getToken();
            return fetchWorkspace(token);
        },
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false,
            dedupingInterval: 10000 // Cache for 10s
        }
    );

    return {
        workspace,
        error,
        isLoading: isLoading || (isLoaded && !workspace && !error)
    };
}

