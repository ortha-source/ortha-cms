import { useMutation } from '@tanstack/react-query';
import type { EntryRecord } from '../../types/contentType';

/** What a save submits: the field values, plus the id when updating. */
export type SaveEntryInput = {
    /** Present for an update; absent for a create. */
    id?: string;
    /** The field values to persist, keyed by field name. */
    values: Record<string, unknown>;
};

/** Simulated network latency for the mocked save, in ms. */
const MOCK_SAVE_LATENCY = 400;

/**
 * Persist a content entry — **mocked** until the entry-write API lands. It
 * mimics the eventual `POST /api/content/:type` (create) /
 * `PATCH /api/content/:type/:id` (update): validates nothing server-side, waits
 * a beat, and echoes back an {@link EntryRecord}. Shaped so the call sites
 * (`ContentEntryView`) don't change when the real `apiClient` request replaces
 * the mock — only this `mutationFn` body does.
 */
async function mockSaveEntry(input: SaveEntryInput): Promise<EntryRecord> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_SAVE_LATENCY));
    const now = new Date().toISOString();
    return {
        id: input.id ?? crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        values: input.values
    };
}

/**
 * Save mutation for one content type. Returns the TanStack mutation; callers
 * use `mutateAsync`/`isPending`. No cache invalidation yet — nothing is
 * persisted server-side, so refetching would drop the change; that wiring lands
 * with the real write API.
 */
export function useSaveEntry(_typeName: string) {
    return useMutation({
        mutationFn: (input: SaveEntryInput) => mockSaveEntry(input)
    });
}
