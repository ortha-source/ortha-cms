import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { EntryPresave, EntryPresaveResult } from '@orthacms/content-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { segmentsKeys } from '../infrastructure/segmentsGateway';
import type { EntryAccess, EntryAccessStaging } from '../domain/types';

/** The id the segments plugin's presave contribution is registered (and keyed) under. */
export const ENTRY_ACCESS_PRESAVE_ID = 'segments.entry.presave';

/**
 * The key the server's entry-write extension is registered under. Must match
 * `ACCESS_EXTENSION_KEY` in `@orthacms/segments-server` — it is the slot in the
 * save body's `extensions` bag *and* in the revision snapshot's `extra`.
 */
export const ACCESS_EXTENSION_KEY = 'access';

/**
 * The segments plugin's contribution to the entry **save** — what makes "who can
 * read this" part of pressing Save or Publish rather than a second button with a
 * second write of its own.
 *
 * It contributes to the save **body**, not a request beside it. That is the
 * whole design, and the reasons are all server-side: content writes the
 * `extensions` bag inside the save's own transaction, so the entry cannot land
 * with its restriction missing; the revision that save appends captures the
 * access it applied rather than the access it replaced; and restoring a version
 * puts that version's audiences back with its words. A second `PUT` after the
 * save has none of those — it would be captured, at best, by the *next* version.
 *
 * A save with nothing staged sends no key at all, and a key the server does not
 * see is a key it leaves alone. That is what keeps the feature inert: an editor
 * who never opens the Access tab changes nothing and pays nothing.
 *
 * Mounted once per entry view through `ENTRY_PRESAVE_SLOT`, so the staging
 * outlives the Access tab unmounting on a tab switch — editor tabs are routes.
 */
export function useEntryAccessPresave(): EntryPresave {
    const workspace = useCurrentWorkspace();
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<EntryAccess | null>(null);

    // `extensions` and `settle` are read from inside the save, after the render
    // that staged the change, so they read through a ref rather than a
    // render-stale closure.
    const draftRef = useRef(draft);
    draftRef.current = draft;

    const stage = useCallback((next: EntryAccess | null) => {
        draftRef.current = next;
        setDraft(next);
    }, []);

    // Nothing to rewrite on the way in: access does not travel in the values
    // bag, so there is nothing for this step to swap before the write.
    const commit = useCallback(
        async ({ values }: { values: Record<string, unknown> }) => values,
        []
    );

    const extensions = useCallback(() => {
        const staged = draftRef.current;
        if (!staged) return undefined;
        return {
            [ACCESS_EXTENSION_KEY]: { allow: staged.allow, deny: staged.deny }
        };
    }, []);

    const settle = useCallback(
        ({ entry }: EntryPresaveResult) => {
            const staged = draftRef.current;
            if (!staged) return;
            // The save carried these lists and the server stored them in the
            // same transaction — a failure would have failed the save — so
            // seeding the cache is telling it what it already knows, not
            // guessing. Refetching instead would blank the control the editor is
            // still looking at, and on a create there is no query to refetch
            // under the old (id-less) key at all.
            queryClient.setQueryData(
                // Keyed on the **saved** row's version, which is the key the
                // tab and the chip are about to read under: `useSaveEntry`
                // seeds the entry cache with this same record, so both re-render
                // against it in the same commit.
                segmentsKeys.entry(workspace.id, entry.id, entry.updatedAt),
                staged
            );
            stage(null);
        },
        [queryClient, stage, workspace.id]
    );

    const handle: EntryAccessStaging = { draft, stage };
    return { commit, extensions, settle, handle };
}
