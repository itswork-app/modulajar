'use client';

import { ModuleEditor } from '@/components/editor/ModuleEditor';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2 } from 'lucide-react';

export default function EditModulePage({ params }: { params: { generation_id: string } }) {
    const { workspace, isLoading } = useWorkspace();

    if (isLoading || !workspace?.id) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-64px)] overflow-hidden -m-8">
            <ModuleEditor workspaceId={workspace.id} moduleId={params.generation_id} />
        </div>
    );
}
