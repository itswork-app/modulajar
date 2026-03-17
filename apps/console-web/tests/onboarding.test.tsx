import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OnboardingWizardPage from '../app/(dashboard)/wizard/page';

// Mock Dependencies
const mockPush = vi.fn();
const mockReplace = vi.fn();

const mockRouter = {
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
};

const mockGetToken = vi.fn().mockResolvedValue('mock-token');

const mockWorkspaceData = { id: 'test-workspace-id' };
const mockWorkspaceResult = {
    workspace: mockWorkspaceData,
    isLoading: false
};

const mockAuthResult = {
    getToken: mockGetToken,
    isLoaded: true,
};

const mockUserResult = {
    user: { fullName: 'Test Teacher' }
};

vi.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    useParams: () => ({}),
    useSearchParams: () => ({ get: () => null }),
    usePathname: () => '/wizard',
}));

vi.mock('@clerk/nextjs', () => ({
    useAuth: () => mockAuthResult,
    useUser: () => mockUserResult
}));

vi.mock('@/hooks/use-workspace', () => ({
    useWorkspace: () => mockWorkspaceResult
}));

vi.mock('@/components/ui/Toaster', () => ({
    useToast: () => ({ toast: vi.fn() })
}));

const defaultStore = {
    teacherProfile: { full_name: 'Mock', primary_subject: 'Bahasa Indonesia', primary_jenjang: 'SD', primary_grade: 4 },
    schoolIdentity: { school_display_name: 'Mock School' },
    usageSummary: { credits_remaining: 10 },
    templates: [],
    isProfileLoading: false,
    isProfileLoaded: true,
    loadProfileData: vi.fn(),
    resetProfileData: vi.fn(),
};

const mockUseWorkspaceStore = vi.fn().mockReturnValue(defaultStore);

vi.mock('@/store/workspace-store', () => ({
    useWorkspaceStore: () => mockUseWorkspaceStore()
}));

describe('Onboarding Wizard Guard Logic (v1)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseWorkspaceStore.mockReturnValue(defaultStore);
        global.fetch = vi.fn().mockImplementation((url: string) => {
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });
    });

    it('loads wizard successfully with empty states if teacher profile is missing', async () => {
        mockUseWorkspaceStore.mockReturnValue({
            ...defaultStore,
            teacherProfile: null,
        });

        render(<OnboardingWizardPage />);

        await waitFor(() => {
            expect(screen.getByText('Identitas Guru')).toBeDefined();
        });

        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('loads wizard successfully with empty states if school identity is missing', async () => {
        mockUseWorkspaceStore.mockReturnValue({
            ...defaultStore,
            teacherProfile: { full_name: 'Mock', primary_subject: 'Matematika' } as any,
            schoolIdentity: null,
        });

        render(<OnboardingWizardPage />);

        await waitFor(() => {
            expect(screen.getByText('Identitas Sekolah')).toBeDefined();
        });

        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('loads wizard successfully and renders identity step', async () => {
        mockUseWorkspaceStore.mockReturnValue({
            ...defaultStore,
            teacherProfile: { full_name: 'Mock', primary_subject: 'Matematika', primary_jenjang: 'SD', primary_grade: 4 } as any,
            schoolIdentity: { school_display_name: 'Mock School' } as any,
        });

        render(<OnboardingWizardPage />);

        await waitFor(() => {
            expect(screen.getByText('Identitas Guru')).toBeDefined();
        });

        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('progresses through WizardV2Page flow correctly', async () => {
        mockUseWorkspaceStore.mockReturnValue({
            ...defaultStore,
            teacherProfile: { full_name: 'Mock', primary_subject: '' } as any,
        });

        render(<OnboardingWizardPage />);
        await waitFor(() => { expect(screen.getByText('Identitas Guru')).toBeDefined(); });

        // Identitas -> Target
        fireEvent.click(screen.getByText('Lanjut ke Target Ajar'));
        await waitFor(() => { expect(screen.getByText('Target Pengajaran')).toBeDefined(); });

        // Fill Target
        const selects = screen.getAllByRole('combobox');
        fireEvent.change(selects[3], { target: { value: 'Matematika' } }); // Mapel

        // Target -> Materi
        fireEvent.click(screen.getByText('Lanjut ke Materi'));
        await waitFor(() => { expect(screen.getByText('Materi & Fokus')).toBeDefined(); });

        // Switch to manual if recommendations empty
        const manualBtn = screen.queryByText('Tulis Topik Secara Manual →');
        if (manualBtn) {
            fireEvent.click(manualBtn);
            await waitFor(() => expect(screen.getByPlaceholderText(/Tulis topik secara bebas/i)).toBeDefined());
        }

        // Fill Materi
        const inputTema = screen.getByPlaceholderText(/Tulis topik secara bebas/i);
        fireEvent.change(inputTema, { target: { value: 'Bilangan Prima' } });

        // Materi -> Review
        fireEvent.click(screen.getByText('Review & Generate'));
        await waitFor(() => {
            expect(screen.getByText('Review Sebelum Generasi')).toBeDefined();
            expect(screen.getByText('Bilangan Prima')).toBeDefined();
        });
    });

    it('submits the generation successfully in V2 flow', async () => {
        mockUseWorkspaceStore.mockReturnValue({
            ...defaultStore,
            teacherProfile: { full_name: 'Mock', primary_subject: 'Matematika', primary_jenjang: 'SD', primary_grade: 4 } as any,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/modules/generate')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ success: true, job_id: 'test-job' }) });
            if (url.includes('/jobs/test-job')) return Promise.resolve({ 
                status: 200, 
                ok: true, 
                json: () => Promise.resolve({ 
                    id: 'test-job', 
                    status: 'done',
                    module_id: 'test-job',
                    progress: { phase: 'done', pct: 100 },
                    payload: { topic: 'Bilangan Prima' }
                }) 
            });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });

        render(<OnboardingWizardPage />);
        await waitFor(() => { expect(screen.getByText('Identitas Guru')).toBeDefined(); });

        fireEvent.click(screen.getByText('Lanjut ke Target Ajar'));
        await waitFor(() => { expect(screen.getByText('Target Pengajaran')).toBeDefined(); });

        fireEvent.click(screen.getByText('Lanjut ke Materi'));
        await waitFor(() => { expect(screen.getByText('Materi & Fokus')).toBeDefined(); });

        const manualBtn = screen.queryByText('Tulis Topik Secara Manual →');
        if (manualBtn) {
            fireEvent.click(manualBtn);
            await waitFor(() => expect(screen.getByPlaceholderText(/Tulis topik secara bebas/i)).toBeDefined());
        }

        const inputTema = screen.getByPlaceholderText(/Tulis topik secara bebas/i);
        fireEvent.change(inputTema, { target: { value: 'Bilangan Prima' } });

        fireEvent.click(screen.getByText('Review & Generate'));
        await waitFor(() => { expect(screen.getByText('Review Sebelum Generasi')).toBeDefined(); });

        // Submit
        fireEvent.click(screen.getByText('Generate Modul Sekarang'));

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/modules/test-job');
        });
    });

    it('handles generate validation errors in V2 flow', async () => {
        mockUseWorkspaceStore.mockReturnValue({
            ...defaultStore,
            teacherProfile: { full_name: 'Mock', primary_subject: 'IPAS', primary_jenjang: 'SD', primary_grade: 4 } as any,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/modules/generate')) return Promise.resolve({ status: 400, ok: false, json: () => Promise.resolve({ error: 'AI Error: Rate Limit' }) });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });

        render(<OnboardingWizardPage />);
        await waitFor(() => { expect(screen.getByText('Identitas Guru')).toBeDefined(); });

        fireEvent.click(screen.getByText('Lanjut ke Target Ajar'));
        await waitFor(() => { expect(screen.getByText('Target Pengajaran')).toBeDefined(); });

        fireEvent.click(screen.getByText('Lanjut ke Materi'));
        await waitFor(() => { expect(screen.getByText('Materi & Fokus')).toBeDefined(); });

        const manualBtn = screen.queryByText('Tulis Topik Secara Manual →');
        if (manualBtn) {
            fireEvent.click(manualBtn);
            await waitFor(() => expect(screen.getByPlaceholderText(/Tulis topik secara bebas/i)).toBeDefined());
        }

        const inputTema = screen.getByPlaceholderText(/Tulis topik secara bebas/i);
        fireEvent.change(inputTema, { target: { value: 'Bilangan Prima' } });

        fireEvent.click(screen.getByText('Review & Generate'));
        await waitFor(() => { expect(screen.getByText('Review Sebelum Generasi')).toBeDefined(); });

        fireEvent.click(screen.getByText('Generate Modul Sekarang'));

        await waitFor(() => {
            expect(screen.getByText(/Rate Limit/i)).toBeDefined();
        });
    });




});
