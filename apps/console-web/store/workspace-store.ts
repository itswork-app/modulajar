import { create } from 'zustand';
import { TeacherProfile, SchoolIdentity } from 'shared-types';

interface UsageSummary {
    credits_remaining: number;
    documents_generated: number;
}

interface Template {
    id: string;
    name: string;
    workspace_id: string | null;
}

interface WorkspaceState {
    teacherProfile: TeacherProfile | null;
    schoolIdentity: SchoolIdentity | null;
    usageSummary: UsageSummary | null;
    templates: Template[];
    isProfileLoading: boolean;
    isProfileLoaded: boolean;
    error: string | null;
    
    // Actions
    loadProfileData: (workspaceId: string, token: string) => Promise<void>;
    resetProfileData: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
    teacherProfile: null,
    schoolIdentity: null,
    usageSummary: null,
    templates: [],
    isProfileLoading: false,
    isProfileLoaded: false,
    error: null,

    loadProfileData: async (workspaceId: string, token: string) => {
        set({ isProfileLoading: true, error: null });
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const opts = { headers };

            const [profileRes, schoolRes, usageRes, tplRes] = await Promise.all([
                fetch(`${API_BASE}/w/${workspaceId}/profile`, opts),
                fetch(`${API_BASE}/w/${workspaceId}/school`, opts),
                fetch(`${API_BASE}/w/${workspaceId}/wallet/summary`, opts),
                fetch(`${API_BASE}/w/${workspaceId}/templates?document_type=modul_ajar`, opts)
            ]);

            let pData: TeacherProfile | null = null;
            let sData: SchoolIdentity | null = null;
            let uData: UsageSummary | null = null;
            let tData: { templates: Template[] } = { templates: [] };

            if (profileRes.ok) pData = await profileRes.json();
            if (schoolRes.ok) sData = await schoolRes.json();
            if (usageRes.ok) uData = await usageRes.json();
            if (tplRes.ok) tData = await tplRes.json();

            set({
                teacherProfile: pData,
                schoolIdentity: sData,
                usageSummary: uData,
                templates: tData.templates || [],
                isProfileLoading: false,
                isProfileLoaded: true
            });
        } catch (err: unknown) {
            console.error('Failed to load global profile data:', err);
            set({
                error: (err as Error).message || 'Gagal memuat profil',
                isProfileLoading: false,
                isProfileLoaded: true
            });
        }
    },

    resetProfileData: () => set({
        teacherProfile: null,
        schoolIdentity: null,
        usageSummary: null,
        templates: [],
        isProfileLoaded: false,
        isProfileLoading: false,
        error: null
    })
}));
