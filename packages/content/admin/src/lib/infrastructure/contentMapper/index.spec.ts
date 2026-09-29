import { describe, expect, it } from 'vitest';
import type { EntryRecord, RelationRef } from '../../domain/types/contentType';
import {
    toContentTypeAccess,
    toEntryRecord,
    toEntryUsage,
    toRelationFieldView,
    toRelationRef
} from '.';

const record: EntryRecord = {
    id: 'post-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: { title: 'Hello' }
};

const source = { workspaceId: 'ws_brand', workspaceName: 'Brand hub' };

/**
 * The shared-workspaces wire fields arrived after the rest of the entry
 * contract, so a server that predates them sends none — and the admin must
 * read that as "own, writable", never as "unknown, maybe foreign".
 */
describe('contentMapper — shared-workspace fallbacks', () => {
    it('reads an entry without source/readOnly as own and writable', () => {
        const mapped = toEntryRecord(record);
        expect(mapped.source).toBeNull();
        expect(mapped.readOnly).toBe(false);
        expect(mapped.values).toEqual({ title: 'Hello' });
    });

    it('keeps a foreign entry’s source and read-only verdict', () => {
        const mapped = toEntryRecord({ ...record, source, readOnly: true });
        expect(mapped.source).toEqual(source);
        expect(mapped.readOnly).toBe(true);
    });

    it('defaults a relation ref’s source to null and keeps a real one', () => {
        const ref: RelationRef = { id: 'a', title: 'A' };
        expect(toRelationRef(ref).source).toBeNull();
        expect(toRelationRef({ ...ref, source }).source).toEqual(source);
        expect(
            toRelationFieldView({ items: [ref], total: 1 }).items[0].source
        ).toBeNull();
    });

    it('never prints NaN for a malformed usage count', () => {
        expect(
            toEntryUsage({
                workspaceId: 'ws_x',
                workspaceName: 'X',
                count: undefined as unknown as number
            }).count
        ).toBe(0);
    });
});

describe('toContentTypeAccess', () => {
    it('reads an absent access (an older server) as own, nothing shared', () => {
        expect(toContentTypeAccess(undefined)).toEqual({
            own: true,
            sharedSources: []
        });
    });

    it('reads a present access literally — a missing own is not own', () => {
        expect(
            toContentTypeAccess({
                sharedSources: [
                    {
                        workspaceId: 'ws_travel',
                        workspaceName: 'Travel Library'
                    }
                ]
            })
        ).toEqual({
            own: false,
            sharedSources: [
                { workspaceId: 'ws_travel', workspaceName: 'Travel Library' }
            ]
        });
        expect(toContentTypeAccess({ own: true })).toEqual({
            own: true,
            sharedSources: []
        });
    });
});
