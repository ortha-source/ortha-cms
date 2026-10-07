import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { publishManagerPath } from '../../../domain/constants';
import {
    PUBLISH_SET_MAX_IDS,
    publishSetSearch
} from '../../../domain/publishSet';

/**
 * Opens the Publish Manager on a set — one content type and its entry ids —
 * by navigating to the page with the set in the URL. Exported, so any plugin
 * with a reason to start a publish from somewhere else opens the same page the
 * same way rather than building a URL of its own.
 */
export function useOpenInPublishManager(
    workspaceId: string
): (type: string, ids: readonly string[]) => void {
    const navigate = useNavigate();
    return useCallback(
        (type, ids) =>
            navigate(
                `${publishManagerPath(workspaceId)}?${publishSetSearch({
                    type,
                    ids: [...ids].slice(0, PUBLISH_SET_MAX_IDS)
                })}`
            ),
        [navigate, workspaceId]
    );
}
