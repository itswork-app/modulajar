'use client';

import { ModuleEditor } from '@/components/editor/ModuleEditor';

export default function EditModulePage({ params }: { params: { workspaceId: string, moduleId: string } }) {
    return (
        <div className="h-[calc(100vh-64px)] overflow-hidden">
            <ModuleEditor workspaceId={params.workspaceId} moduleId={params.moduleId} />
        </div>
    );
}
