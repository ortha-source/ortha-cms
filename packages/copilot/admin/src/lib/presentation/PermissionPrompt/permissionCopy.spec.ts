import { createIntl } from 'react-intl';
import type { PermissionPreview } from '@orthacms/copilot-domain';
import { permissionCopy } from './permissionCopy';

const intl = createIntl({ locale: 'en', messages: {} });

const preview = (overrides: Partial<PermissionPreview>): PermissionPreview => ({
    kind: 'content.entry.bulk-save',
    summary: 'Write 23 summaries',
    records: 23,
    changes: [{ field: 'items[0].summary', after: 'x' }],
    omitted: 0,
    ...overrides
});

describe('permissionCopy', () => {
    it('says how many records and that they land as drafts', () => {
        expect(permissionCopy(intl, preview({ lands: 'draft' }))).toEqual({
            title: 'Ortha CMS AI wants to save 23 records as drafts',
            consequence:
                'Published versions stay live until someone publishes the drafts.'
        });
    });

    it('agrees in the singular', () => {
        expect(
            permissionCopy(
                intl,
                preview({
                    kind: 'content.entry.update',
                    lands: 'draft',
                    records: 1
                })
            ).title
        ).toBe('Ortha CMS AI wants to save 1 record as a draft');
    });

    it('says a live write is live', () => {
        const copy = permissionCopy(
            intl,
            preview({ kind: 'content.entry.create', lands: 'live', records: 2 })
        );
        expect(copy.title).toBe('Ortha CMS AI wants to create 2 records');
        expect(copy.consequence).toBe(
            'Readers see this as soon as it is saved.'
        );
    });

    it('never claims a draft it was not told about', () => {
        const copy = permissionCopy(intl, preview({}));
        expect(copy.title).toBe('Ortha CMS AI wants to save 23 records');
        expect(copy.consequence).toBe(
            'Nothing has happened yet — it is waiting for you.'
        );
    });

    it('counts changes for a kind it does not know', () => {
        expect(
            permissionCopy(
                intl,
                preview({ kind: 'media.asset.alt-text', omitted: 2 })
            ).title
        ).toBe('Ortha CMS AI wants to make 3 changes');
    });

    it('keeps the generic sentence when there is no preview', () => {
        expect(permissionCopy(intl, undefined).title).toBe(
            'Ortha CMS AI wants to change your content'
        );
    });
});
