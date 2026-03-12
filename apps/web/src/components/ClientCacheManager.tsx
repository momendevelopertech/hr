'use client';

import { useEffect } from 'react';
import { clearBrowserRuntimeCache } from '@/lib/api';

const APP_BUILD_ID = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION || 'dev';

export default function ClientCacheManager() {
    useEffect(() => {
        const key = 'app-build-id';
        const previousBuild = window.localStorage.getItem(key);
        const isNewBuild = previousBuild && previousBuild !== APP_BUILD_ID;

        if (isNewBuild) {
            clearBrowserRuntimeCache().finally(() => {
                window.localStorage.setItem(key, APP_BUILD_ID);
                window.location.reload();
            });
            return;
        }

        window.localStorage.setItem(key, APP_BUILD_ID);
    }, []);

    return null;
}
