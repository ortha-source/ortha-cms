import { Revision, type NewRevisionParams } from './revision';
import { REVISION_STATUS } from './revision-status';

const params = (over: Partial<NewRevisionParams> = {}): NewRevisionParams => ({
    contentType: 'article',
    entryId: 'e1',
    workspaceId: 'w1',
    localeGroupId: null,
    locale: null,
    number: 1,
    snapshot: { values: { title: 'Hello' }, relations: { tags: ['t1'] } },
    createdBy: 'u1',
    ...over
});

describe('Revision domain model', () => {
    it('mints a draft carrying the snapshot and persistence shape', () => {
        const revision = Revision.createDraft(params({ number: 3 }));
        expect(revision.status).toBe(REVISION_STATUS.Draft);
        expect(revision.number).toBe(3);
        expect(revision.toPersistence()).toEqual({
            contentType: 'article',
            entryId: 'e1',
            workspaceId: 'w1',
            localeGroupId: null,
            locale: null,
            revisionNumber: 3,
            status: REVISION_STATUS.Draft,
            snapshot: { values: { title: 'Hello' }, relations: { tags: ['t1'] } },
            createdBy: 'u1'
        });
    });

    it('carries locale metadata for an i18n row', () => {
        const revision = Revision.createDraft(
            params({ locale: 'en', localeGroupId: 'g1' })
        );
        const row = revision.toPersistence();
        expect(row.locale).toBe('en');
        expect(row.localeGroupId).toBe('g1');
    });

    it('rejects a non-positive version number', () => {
        expect(() => Revision.createDraft(params({ number: 0 }))).toThrow();
        expect(() => Revision.createDraft(params({ number: -1 }))).toThrow();
        expect(() => Revision.createDraft(params({ number: 1.5 }))).toThrow();
    });
});
