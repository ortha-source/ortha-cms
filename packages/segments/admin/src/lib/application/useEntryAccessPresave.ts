import { useCallback, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import type { EntryPresave, EntryPresaveResult } from '@orthacms/content-admin';
import { toast } from '@orthacms/design-system';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import type { EntryAccess, EntryAccessStaging } from '../domain/types';
import { useSetEntryAccess } from './hooks';

const messages = defineMessages({
    failed: {
        id: 'segments.presave.failed',
        defaultMessage:
            'Saved the entry, but who can read it was left unchanged. Press Save again to apply it.'
    }
});

/** The id the segments plugin's presave contribution is registered (and keyed) under. */
export const ENTRY_ACCESS_PRESAVE_ID = 'segments.entry.presave';

/**
 * The segments plugin's contribution to the entry **save** — what makes "who can
 * read this" part of pressing Save or Publish rather than a second button with a
 * second save of its own.
 *
 * It runs in **`settle`**, after the write, not in `commit`. Access is stored
 * against the entry id, and on a create there is no id until the row exists — so
 * before the write there is nothing to write it against. That ordering has a
 * consequence worth stating plainly: the entry lands first and its audiences a
 * moment later, so a failure here leaves a saved entry whose access is still
 * whatever it was. Nothing is lost — the staging is kept and the toast says to
 * press Save again — and the alternative (writing access first, then failing to
 * write the entry) would restrict a record that never changed, which is the worse
 * half of the same trade.
 *
 * A save with nothing staged writes nothing at all. That is what keeps the
 * feature inert: an editor who never opens the Access tab pays no request, and an
 * installation with no audiences has nothing to stage.
 *
 * Mounted once per entry view through `ENTRY_PRESAVE_SLOT`, so the staging
 * outlives the Access tab unmounting on a tab switch.
 */
export function useEntryAccessPresave(): EntryPresave {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const save = useSetEntryAccess(workspace.id);
    const [draft, setDraft] = useState<EntryAccess | null>(null);

    // `settle` runs across an await and after the render that staged the change,
    // so it reads the draft through a ref rather than a render-stale closure.
    const draftRef = useRef(draft);
    draftRef.current = draft;

    const stage = useCallback((next: EntryAccess | null) => {
        draftRef.current = next;
        setDraft(next);
    }, []);

    // Nothing to do on the way in: access does not travel in the values bag, so
    // there is nothing to rewrite before the write.
    const commit = useCallback(
        async ({ values }: { values: Record<string, unknown> }) => values,
        []
    );

    const settle = useCallback(
        async ({ entry, schema }: EntryPresaveResult) => {
            const staged = draftRef.current;
            if (!staged) return;
            try {
                await save.mutateAsync({
                    entryId: entry.id,
                    typeSlug: schema.name,
                    allow: staged.allow,
                    deny: staged.deny
                });
                // The mutation seeded the cache with what the server stored, so
                // the tab reads the saved answer from here on.
                stage(null);
            } catch {
                toast.error(intl.formatMessage(messages.failed));
            }
        },
        [intl, save, stage]
    );

    const handle: EntryAccessStaging = { draft, stage };
    return { commit, settle, handle };
}
