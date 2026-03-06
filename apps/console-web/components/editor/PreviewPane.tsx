'use client';

import { useEffect, useRef } from 'react';

interface PreviewPaneProps {
    workspaceId: string;
    moduleId: string;
    version: number;
}

export function PreviewPane({ workspaceId, moduleId, version }: PreviewPaneProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        // Force refresh iframe when version changes
        if (iframeRef.current) {
            iframeRef.current.src = `/api/w/${workspaceId}/modules/${moduleId}/preview?v=${version}`;
        }
    }, [workspaceId, moduleId, version]);

    return (
        <div className="flex-1 bg-slate-200">
            <iframe
                ref={iframeRef}
                className="w-full h-full border-none bg-white"
                title="Module Preview"
            />
        </div>
    );
}
