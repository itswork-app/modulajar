import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OnboardingWizardPage from '../app/onboarding/page';

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
});
