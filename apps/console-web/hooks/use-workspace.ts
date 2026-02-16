'use client';

import { useAuth, useUser } from "@clerk/nextjs";
import useSWR from "swr";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function fetchWorkspace(token: string | null) {
    if (!token) return null;

    // 1. Try to get existing workspaces
    const res = await fetch(`${API_BASE}/workspaces`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to fetch workspaces");

    const data = await res.json();
    if (data.workspaces && data.workspaces.length > 0) {
        return data.workspaces[0];
    }

    // 2. If no workspace, create one
    const createRes = await fetch(`${API_BASE}/workspaces`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'My Workspace' })
    });

    if (!createRes.ok) throw new Error("Failed to create workspace");
    return createRes.json();
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
            shouldRetryOnError: false
        }
    );

    return { workspace, error, isLoading: isLoading || !isLoaded };
}
