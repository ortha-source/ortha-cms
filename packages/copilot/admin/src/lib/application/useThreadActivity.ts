import { useMemo, useSyncExternalStore } from 'react';
import { copilotStoreState, subscribeToCopilotStore } from './copilotStore';
import { threadActivity, type ThreadActivity } from './threadActivity';

/**
 * The snapshot is a string so the rail re-renders when a thread starts,
 * parks or finishes — not on every streamed token, which publishes a new
 * store state each time.
 */
function snapshot(): string {
    return JSON.stringify([...threadActivity(copilotStoreState())]);
}

/** The tab's live threads and what each is doing — see {@link threadActivity}. */
export function useThreadActivity(): ReadonlyMap<string, ThreadActivity> {
    const signature = useSyncExternalStore(subscribeToCopilotStore, snapshot);
    return useMemo(
        () => new Map(JSON.parse(signature) as [string, ThreadActivity][]),
        [signature]
    );
}
