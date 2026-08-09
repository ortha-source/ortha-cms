import type { EntryRecord } from '../entries/types/entry-list-view';
import { projectEntry } from './project-entry';

const entry = {
    id: 'e1',
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: { title: 'Hello', body: 'a very long body', views: 3 }
} as unknown as EntryRecord;

describe('projectEntry', () => {
    it('returns the entry untouched when no fields are named', () => {
        expect(projectEntry(entry, undefined)).toBe(entry);
        // Empty reads as "no preference", not "no fields" — same rule the
        // public API's `?fields=` follows.
        expect(projectEntry(entry, [])).toBe(entry);
    });

    it('narrows values to the named fields', () => {
        expect(projectEntry(entry, ['title']).values).toEqual({
            title: 'Hello'
        });
    });

    it('keeps the envelope, so a follow-up getEntry is still possible', () => {
        const projected = projectEntry(entry, ['title']);
        expect(projected.id).toBe('e1');
        expect(projected.status).toBe('draft');
        expect(projected.updatedAt).toBe(entry.updatedAt);
    });

    it('ignores an unknown name rather than failing the call', () => {
        // The public API 400s a typo because a developer wrote it. Here the
        // name came from a model, and the returned `values` already say what
        // was actually found.
        expect(projectEntry(entry, ['title', 'nope']).values).toEqual({
            title: 'Hello'
        });
    });

    it('survives an entry with no values bag', () => {
        const bare = { id: 'e2' } as unknown as EntryRecord;
        expect(projectEntry(bare, ['title']).values).toEqual({});
    });
});
