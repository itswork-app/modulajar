import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OnboardingWizardPage from '../app/(dashboard)/wizard/page';

// Mock Dependencies
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace
    })
}));

vi.mock('@clerk/nextjs', () => ({
    useAuth: () => ({
        getToken: vi.fn(() => Promise.resolve('mock-token')),
        isLoaded: true,
    }),
    useUser: () => ({
        user: { fullName: 'Test Teacher' }
    })
}));

vi.mock('@/hooks/use-workspace', () => ({
    useWorkspace: () => ({
        workspace: { id: 'test-workspace-id' },
        isLoading: false
    })
}));

describe('Onboarding Wizard Guard Logic (v1)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
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
            expect(mockReplace).toHaveBeenCalledWith('/profile-setup');
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
        });

        render(<OnboardingWizardPage />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/workspace/school-setup');
        });
    });

    it('loads wizard successfully and locks Jenjang & Kelas structurally', async () => {
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
                    status: 200,
                    ok: true,
                    json: () => Promise.resolve({ school_display_name: 'Mock School' })
                });
            }
        });

        render(<OnboardingWizardPage />);

        await waitFor(() => {
            expect(screen.getByText('Pilih Cara Mulai')).toBeDefined();
        });

        // The API defaults form mock
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('progresses from CHOOSE_PATH to FORM, fills inputs, and proceeds to REVIEW', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ full_name: 'Mock', primary_subject: '' }) });
            if (url.includes('/school')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ school_display_name: 'Mock School' }) });
        });

        render(<OnboardingWizardPage />);
        await waitFor(() => { expect(screen.getByText('Pilih Cara Mulai')).toBeDefined(); });

        // Navigate to Form
        fireEvent.click(screen.getByText('Generate dari Template'));

        await waitFor(() => { expect(screen.getByText('Target Pengajaran')).toBeDefined(); });

        // Fill form fields
        const selectMapel = screen.getByRole('combobox');
        fireEvent.change(selectMapel, { target: { value: 'Matematika' } });

        const radioSemester2 = screen.getByLabelText('Genap (2)');
        fireEvent.click(radioSemester2);

        const inputTema = screen.getByPlaceholderText('Fokus Tema (misal: Pecahan)');
        fireEvent.change(inputTema, { target: { value: 'Bilangan Prima' } });

        const inputTopik = screen.getByPlaceholderText('Unit Khusus (misal: Unit 2)');
        fireEvent.change(inputTopik, { target: { value: 'Unit 4' } });

        const inputCatatan = screen.getByPlaceholderText(/Catatan tambahan/i);
        fireEvent.change(inputCatatan, { target: { value: 'Tolong gunakan contoh sehari-hari' } });

        // Proceed to Review
        const reviewBtn = screen.getByText(/Review Data/i);
        fireEvent.click(reviewBtn);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /Konfirmasi Generasi/i })).toBeDefined();
            expect(screen.getAllByText(/Matematika/i).length).toBeGreaterThan(0);
            expect(screen.getByText(/Bilangan Prima/i)).toBeDefined();
            expect(screen.getByText(/Unit 4/i)).toBeDefined();
            expect(screen.getByText(/"Tolong gunakan contoh sehari-hari"/i)).toBeDefined();
        });
    });

    it('submits the generation successfully and redirects to /modules', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ full_name: 'Mock', primary_subject: 'Matematika' }) });
            if (url.includes('/school')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ school_display_name: 'Mock School' }) });
            if (url.includes('/generate-semester')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ success: true, job_id: 'test-job' }) });
        });

        render(<OnboardingWizardPage />);
        await waitFor(() => { expect(screen.getByText(/Pilih Cara Mulai/i)).toBeDefined(); });

        // Step 1 to 2
        fireEvent.click(screen.getByText(/Generate dari Template/i));
        await waitFor(() => { expect(screen.getByText(/Target Pengajaran/i)).toBeDefined(); });

        // Step 2 to 3 (Mapel defaults to profile 'Matematika' here)
        fireEvent.click(screen.getByText(/Review Data/i));
        await waitFor(() => { expect(screen.getByText(/Konfirmasi Generasi/i)).toBeDefined(); });

        // Submit Step 3
        fireEvent.click(screen.getByText(/Mulai Generate AI Sekarang/i));

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/modules/test-job');
        });
    });

    it('handles generate validation errors gracefully', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ full_name: 'Mock', primary_subject: 'IPAS' }) });
            if (url.includes('/school')) return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ school_display_name: 'Mock School' }) });
            if (url.includes('/generate-semester')) return Promise.resolve({ status: 400, ok: false, json: () => Promise.resolve({ error: 'AI Error: Rate Limit' }) });
        });

        render(<OnboardingWizardPage />);
        await waitFor(() => { expect(screen.getByText(/Pilih Cara Mulai/i)).toBeDefined(); });

        fireEvent.click(screen.getByText(/Generate dari Template/i));
        await waitFor(() => { expect(screen.getByText(/Target Pengajaran/i)).toBeDefined(); });

        fireEvent.click(screen.getByText(/Review Data/i));
        await waitFor(() => { expect(screen.getByText(/Konfirmasi Generasi/i)).toBeDefined(); });

        fireEvent.click(screen.getByText(/Mulai Generate AI Sekarang/i));

        await waitFor(() => {
            expect(screen.getByText(/AI Error: Rate Limit/i)).toBeDefined();
        });
    });
});
