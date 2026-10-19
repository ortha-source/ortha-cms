import { useEffect, useRef } from 'react';
import { usePanelLayoutSync, type PanelLayout } from '@orthacms/design-system';
import { usePreferences } from '../../../application/usePreferences';
import { useUpdatePanelLayout } from '../../../application/useUpdatePanelLayout';

/**
 * How long a burst of panel changes settles before it is saved. A keyboard user
 * stepping a width with the arrow keys commits on every press; this turns the
 * run into one request.
 */
export const LAYOUT_SAVE_DELAY_MS = 600;

/**
 * Invisible bridge between the shell's panel layout and the user's stored
 * preferences — the layout's counterpart of `ThemeSync`, contributed into
 * the same sidebar footer for the same reason (the one region mounted in every
 * authenticated route).
 *
 * - **Down:** once the preferences load, their `layout` hydrates the store. The
 *   store's own `localStorage` cache already painted the first frame; this
 *   reconciles it with the durable, cross-device copy. A panel the user changed
 *   in the meantime keeps their change — the store skips it.
 * - **Up:** every change the user makes is collected and saved after
 *   {@link LAYOUT_SAVE_DELAY_MS} of quiet, as one patch naming only the panels
 *   that changed. The server merges per panel, so a save from this tab never
 *   reverts another tab's resize of a different panel.
 *
 * A failed save is silent — the layout still holds in this browser through the
 * cache — and its panels ride along with the next save rather than being lost.
 * What is still pending when the bridge unmounts (signing out) is sent then.
 */
export function PanelLayoutSync() {
    const sync = usePanelLayoutSync();
    const { data } = usePreferences();
    const { mutate } = useUpdatePanelLayout();

    useEffect(() => {
        if (sync && data) {
            sync.hydrate(data.layout ?? {});
        }
    }, [sync, data]);

    // `mutate` is stable, but it is read through a ref so the subscription
    // below is made once per store rather than once per render.
    const save = useRef(mutate);
    save.current = mutate;

    useEffect(() => {
        if (!sync) return;
        let pending: PanelLayout = {};
        let timer: ReturnType<typeof setTimeout> | undefined;

        const flush = () => {
            timer = undefined;
            const batch = pending;
            pending = {};
            if (Object.keys(batch).length === 0) return;
            save.current(batch, {
                // Newer changes to the same panel win over the retried ones.
                onError: () => {
                    pending = { ...batch, ...pending };
                }
            });
        };

        const unsubscribe = sync.onChange((changes) => {
            pending = { ...pending, ...changes };
            if (timer) clearTimeout(timer);
            timer = setTimeout(flush, LAYOUT_SAVE_DELAY_MS);
        });

        return () => {
            unsubscribe();
            if (timer) {
                clearTimeout(timer);
                flush();
            }
        };
    }, [sync]);

    return null;
}
