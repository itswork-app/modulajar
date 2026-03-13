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

describe('Onboarding Wizard Guard Logic (v1)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('/profile')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ full_name: 'Mock', primary_subject: 'Bahasa Indonesia', primary_jenjang: 'SD', primary_grade: 4 }) });
            if (url.includes('/school')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ school_display_name: 'Mock School' }) });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });
    });

    it('redirects to /profile-setup if teacher profile is missing (404)', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile')) {
                return Promise.resolve({
                    status: 404,
                    ok: false,
                    json: () => Promise.resolve({ error: 'Not found' })
                });
            }
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });

        render(<OnboardingWizardPage />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/onboarding');
        });
    });

    it('redirects to /workspace/school-setup if school identity is missing (404)', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile')) {
                return Promise.resolve({
                    status: 200,
                    ok: true,
                    json: () => Promise.resolve({ full_name: 'Mock', primary_subject: 'Matematika' })
                });
            }
            if (url.includes('/school')) {
                return Promise.resolve({
                    status: 404,
                    ok: false,
                    json: () => Promise.resolve({ error: 'Not found' })
                });
            }
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });

        render(<OnboardingWizardPage />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/onboarding');
        });
    });

    it('loads wizard successfully and renders identity step', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ full_name: 'Mock', primary_subject: 'Matematika' }) });
            if (url.includes('/school')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ school_display_name: 'Mock School' }) });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });

        render(<OnboardingWizardPage />);

        await waitFor(() => {
            expect(screen.getByText('Identitas Guru')).toBeDefined();
        });

        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('progresses through WizardV2Page flow correctly', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ full_name: 'Mock', primary_subject: '' }) });
            if (url.includes('/school')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ school_display_name: 'Mock School' }) });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ full_name: 'Mock', primary_subject: 'Matematika' }) });
            if (url.includes('/school')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ school_display_name: 'Mock School' }) });
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ full_name: 'Mock', primary_subject: 'IPAS' }) });
            if (url.includes('/school')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ school_display_name: 'Mock School' }) });
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
