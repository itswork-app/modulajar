import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateWorkspaceModal } from '../components/ui/CreateWorkspaceModal';

// Mock SWR and useWorkspace
vi.mock('swr', () => ({
    default: vi.fn(() => ({ mutate: vi.fn() })),
    useSWRConfig: vi.fn(() => ({ mutate: vi.fn() }))
}));

vi.mock('@clerk/nextjs', () => ({
    useAuth: vi.fn(() => ({
        getToken: vi.fn(async () => 'fake-token')
    }))
}));

vi.mock('@/hooks/use-workspace', () => ({
    useWorkspaces: vi.fn(() => ({
        activeWorkspace: null,
        workspaces: [],
        isLoading: false,
        mutate: vi.fn()
    }))
}));

// Mock global fetch
global.fetch = vi.fn();

describe('CreateWorkspaceModal (Elite Grade)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders create and join tabs', () => {
        render(<CreateWorkspaceModal isOpen={true} onClose={() => {}} />);
        expect(screen.getByText('Buat Baru')).toBeDefined();
        expect(screen.getByText('Gabung Sekolah')).toBeDefined();
    });

    it('switches to join tab and submits code', async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'joined', workspaceId: 'ws-123' })
        });

        render(<CreateWorkspaceModal isOpen={true} onClose={() => {}} />);
        
        // Switch to Join tab
        fireEvent.click(screen.getByText('Gabung Sekolah'));
        
        const input = screen.getByPlaceholderText('Masukkan kode sekolah');
        fireEvent.change(input, { target: { value: 'SCHOOL123' } });
        
        const joinButton = screen.getByText('Gabung Sekarang');
        fireEvent.click(joinButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/workspaces/join'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ code: 'SCHOOL123' })
                })
            );
        });
    });

    it('shows error if join fails', async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ message: 'Kode tidak valid' })
        });

        render(<CreateWorkspaceModal isOpen={true} onClose={() => {}} />);
        
        fireEvent.click(screen.getByText('Gabung Sekolah'));
        fireEvent.change(screen.getByPlaceholderText('Masukkan kode sekolah'), { target: { value: 'BADCODE' } });
        fireEvent.click(screen.getByText('Gabung Sekarang'));

        await waitFor(() => {
            expect(screen.getByText('Kode tidak valid')).toBeDefined();
        });
    });
});
