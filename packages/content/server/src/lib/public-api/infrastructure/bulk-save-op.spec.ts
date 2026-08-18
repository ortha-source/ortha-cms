import { BadRequestException } from '@nestjs/common';
import { resolveBulkSaveOp } from './bulk-save-op';

const ID = '11111111-1111-4111-8111-111111111111';
const GROUP = '22222222-2222-4222-8222-222222222222';

/**
 * The addressing rules are the whole of what decides whether an item writes a
 * new row or rewrites an existing one, and they are read from data a model or
 * an import script produced. Getting one wrong does not fail loudly — it
 * silently creates a duplicate, or silently overwrites the wrong record — so
 * each rule is pinned here rather than left to the endpoint's e2e.
 */
describe('resolveBulkSaveOp', () => {
    it('creates when nothing addresses an existing row', () => {
        expect(resolveBulkSaveOp({})).toEqual({ op: 'create' });
    });

    it('updates the row an `id` names', () => {
        expect(resolveBulkSaveOp({ id: ID })).toEqual({
            op: 'update',
            locator: { id: ID }
        });
    });

    // An entry id already names one row including its locale, so an addressing
    // locale could only ever contradict it.
    it('carries no addressing locale for an id-addressed update', () => {
        expect(resolveBulkSaveOp({ id: ID, locale: 'de' })).toEqual({
            op: 'update',
            locator: { id: ID }
        });
    });

    it('takes an explicit `op: "create"` on an unaddressed item', () => {
        expect(resolveBulkSaveOp({ op: 'create' })).toEqual({ op: 'create' });
    });

    // The one genuinely ambiguous shape: a group id could mean "add this
    // record's German row" or "change the German row it already has".
    it('refuses a bare `localeGroupId` and asks for `op`', () => {
        expect(() => resolveBulkSaveOp({ localeGroupId: GROUP })).toThrow(
            BadRequestException
        );
        expect(() => resolveBulkSaveOp({ localeGroupId: GROUP })).toThrow(
            /op: "create"/
        );
    });

    it('joins the group on `op: "create"` with a `localeGroupId`', () => {
        expect(
            resolveBulkSaveOp({
                localeGroupId: GROUP,
                locale: 'de',
                op: 'create'
            })
        ).toEqual({ op: 'create' });
    });

    it('addresses the group’s row in `locale` on `op: "update"`', () => {
        expect(
            resolveBulkSaveOp({
                localeGroupId: GROUP,
                locale: 'de',
                op: 'update'
            })
        ).toEqual({
            op: 'update',
            locator: { localeGroupId: GROUP },
            locale: 'de'
        });
    });

    // Without an addressing locale the group write falls back to the default
    // locale's row, exactly as the single-entry route does with no `?locale=`.
    it('omits the locale a group-addressed update did not give', () => {
        expect(
            resolveBulkSaveOp({ localeGroupId: GROUP, op: 'update' })
        ).toEqual({ op: 'update', locator: { localeGroupId: GROUP } });
    });

    // Each of these is a caller believing one thing while the item says
    // another. Picking a winner would make whichever they did not mean happen
    // without a word.
    it.each([
        ['both addressing forms', { id: ID, localeGroupId: GROUP }],
        ['`op: "create"` beside an id', { id: ID, op: 'create' as const }],
        ['`op: "update"` with nothing to update', { op: 'update' as const }]
    ])('refuses %s', (_label, item) => {
        expect(() => resolveBulkSaveOp(item)).toThrow(BadRequestException);
    });

    it('treats an empty-string id as absent rather than as a row', () => {
        expect(resolveBulkSaveOp({ id: '' })).toEqual({ op: 'create' });
    });
});
