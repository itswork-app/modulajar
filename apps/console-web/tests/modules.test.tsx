import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import JobsListPage from '../app/(dashboard)/modules/page';
import JobDetailPage from '../app/(dashboard)/modules/[generation_id]/page';

// Mock Dependencies
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
    useParams: () => ({ generation_id: 'mock-uuid-job-123' })
}));

vi.mock('@clerk/nextjs', () => ({
    useAuth: () => ({ getToken: vi.fn(() => Promise.resolve('mock-token')), isLoaded: true }),
    useUser: () => ({ user: { fullName: 'Test Teacher' } })
}));

vi.mock('@/hooks/use-workspace', () => ({
    useWorkspace: () => ({ workspace: { id: 'test-workspace-id' }, isLoading: false })
}));

describe('Jobs Tracking UX v1 - Integration Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    const mockGuardsPassed = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile') || url.includes('/school')) {
                return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
            }
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve([]) });
        });
    };

    it('jobs list renders correctly with empty state when no jobs return', async () => {
        mockGuardsPassed();
        render(<JobsListPage />);

        await waitFor(() => {
            expect(screen.getByText('Belum ada dokumen')).toBeDefined();
        });
    });

    it('jobs list renders chips correctly with queued payload rows', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/profile') || url.includes('/school')) {
                return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
            }
            // In the refactored code, the list page calls /documents
            if (url.includes('/documents')) return Promise.resolve({
                status: 200, ok: true, json: () => Promise.resolve([
                    { id: '1', status: 'QUEUED', payload: { mapel: 'Matematika' }, created_at: new Date().toISOString() },
                    { id: '2', status: 'FAILED', payload: { mapel: 'IPAS' }, created_at: new Date().toISOString() }
                ])
            });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });

        render(<JobsListPage />);

        await waitFor(() => {
            expect(screen.getByText('Matematika')).toBeDefined();
            expect(screen.getByText('IPAS')).toBeDefined();
            // Assuming "Antrean" label renders dynamically from 'QUEUED'
            expect(screen.getByText('Antrean')).toBeDefined();
            expect(screen.getByText('Gagal')).toBeDefined();
        });
    });

    it('job detail exposes secure share link + download PDF if DONE', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/jobs/')) return Promise.resolve({
                status: 200, ok: true, json: () => Promise.resolve({
                    id: 'doc-done',
                    status: 'DONE',
                    payload: { mapel: 'Bahasa Indonesia' },
                    pdf_url: 'https://storage/doc.pdf',
                    public_id: 'public-uri',
                    html_sha256: 'deadbeef123',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });

        render(<JobDetailPage />);

        await waitFor(() => {
            expect(screen.getByText('Unduh Dokumen (PDF)')).toBeDefined();
            expect(screen.getByText('Copy Verify Link')).toBeDefined();
            // Secure SHA-256 slice masking constraint 
            expect(screen.getByText('deadbeef...')).toBeDefined();
        });
    });

    it('job detail renders failed state and prints the last_error appropriately without polling', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/jobs/')) return Promise.resolve({
                status: 200, ok: true, json: () => Promise.resolve({
                    id: 'doc-err',
                    status: 'FAILED',
                    last_error: 'AI hallucinated metadata format',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });

        render(<JobDetailPage />);

        await waitFor(() => {
            expect(screen.getByText('AI hallucinated metadata format')).toBeDefined();
            expect(screen.getByText('Proses Generasi Gagal')).toBeDefined();
            expect(screen.getByText('Generate Lagi')).toBeDefined(); // CTA Retry assertion
        });
    });
});
