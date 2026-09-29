import { collection } from '../../collection/define';
import type { AnyContentType } from '../../types/content-type';
import { field } from '../../fields';
import type { WorkspaceGrantsQuery } from '../../content-types/queries/workspace-grants.query';
import { EntryValidationService } from './entry-validation.service';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('EntryValidationService', () => {
    const service = new EntryValidationService();

    const type = collection('thing', {
        fields: {
            title: field.text({ required: true, minLength: 3, maxLength: 10 }),
            slug: field.text({ pattern: '^[a-z-]+$' }),
            count: field.number({ integer: true, min: 1, max: 5 }),
            price: field.money({ min: 0 }),
            active: field.boolean(),
            publishOn: field.date(),
            publishAt: field.datetime(),
            color: field.select({ options: ['red', 'blue'] as const }),
            author: field.relation({ to: (): AnyContentType => type }),
            tags: field.relation({
                to: (): AnyContentType => type,
                many: true
            })
        }
    });

    const fieldsWithIssues = (values: Record<string, unknown>): string[] =>
        service.validate(type, values).issues.map((i) => i.field);

    it('passes a fully valid values object', () => {
        const result = service.validate(type, {
            title: 'hello',
            slug: 'a-slug',
            count: 3,
            price: 100,
            active: true,
            publishOn: '2026-01-02',
            publishAt: '2026-01-02T03:04:05Z',
            color: 'red',
            author: UUID,
            tags: [UUID]
        });
        expect(result).toEqual({ valid: true, issues: [] });
    });

    it('flags a missing required field', () => {
        expect(fieldsWithIssues({})).toContain('title');
    });

    it('treats false and 0 as present, not empty', () => {
        // active:false and count:0 are concrete values — only the min should
        // complain about 0, and `active` should not be "required"-flagged.
        const issues = service.validate(type, {
            title: 'hello',
            active: false,
            count: 0
        }).issues;
        expect(issues.map((i) => i.field)).not.toContain('active');
        expect(issues.find((i) => i.field === 'count')?.message).toMatch(/≥ 1/);
    });

    it('enforces text length and pattern', () => {
        expect(fieldsWithIssues({ title: 'no' })).toContain('title');
        expect(
            fieldsWithIssues({ title: 'hello', slug: 'Bad Slug' })
        ).toContain('slug');
    });

    it('enforces integer and number bounds', () => {
        expect(fieldsWithIssues({ title: 'hello', count: 2.5 })).toContain(
            'count'
        );
        expect(fieldsWithIssues({ title: 'hello', count: 99 })).toContain(
            'count'
        );
    });

    it('rejects a date-only string for a datetime field', () => {
        expect(
            fieldsWithIssues({ title: 'hello', publishAt: '2026-01-02' })
        ).toContain('publishAt');
    });

    it('accepts a Date instance for a datetime field', () => {
        expect(
            fieldsWithIssues({
                title: 'hello',
                publishAt: new Date('2026-01-02T00:00:00Z')
            })
        ).not.toContain('publishAt');
    });

    it('rejects a malformed calendar date', () => {
        expect(
            fieldsWithIssues({ title: 'hello', publishOn: '01-02-2026' })
        ).toContain('publishOn');
    });

    it('restricts select to its options', () => {
        expect(fieldsWithIssues({ title: 'hello', color: 'green' })).toContain(
            'color'
        );
    });

    it('requires a uuid for a single relation', () => {
        expect(fieldsWithIssues({ title: 'hello', author: 'nope' })).toContain(
            'author'
        );
    });

    it('skips a many relation in the values bag (link-managed, not validated here)', () => {
        // A many/inverse relation's links travel in the `relations` delta, never
        // in `values`, so the validator skips them — a bad array here is not a
        // values-bag issue (their requiredness is enforced against the link set).
        expect(
            fieldsWithIssues({ title: 'hello', tags: ['nope'] })
        ).not.toContain('tags');
    });

    it('rejects unknown fields', () => {
        const issues = service.validate(type, {
            title: 'hello',
            mystery: 1
        }).issues;
        expect(issues).toContainEqual({
            field: 'mystery',
            message: 'unknown field on "thing"'
        });
    });

    describe('waivedRequired [content:I-50]', () => {
        const person = collection('person', {
            fields: { name: field.text() }
        });
        const post = collection('post', {
            publishable: true,
            fields: {
                title: field.text({ required: true }),
                author: field.relation({
                    to: (): AnyContentType => person,
                    required: true,
                    onDelete: 'restrict'
                })
            }
        });
        const grantsOf = (slugs: string[]) => {
            const reachableSlugs = jest.fn(async () => new Set(slugs));
            return {
                reachableSlugs,
                query: { reachableSlugs } as unknown as WorkspaceGrantsQuery
            };
        };

        it('waives a required relation to an ungranted type, and validate then accepts it empty', async () => {
            const grants = grantsOf(['post']);
            const withGrants = new EntryValidationService(grants.query);

            const waived = await withGrants.waivedRequired(post, 'ws-1');

            expect(waived).toEqual(new Set(['author']));
            expect(grants.reachableSlugs).toHaveBeenCalledWith(
                'ws-1',
                undefined
            );
            expect(withGrants.validate(post, { title: 'hi' }, waived)).toEqual({
                valid: true,
                issues: []
            });
        });

        it('keeps a required relation to a granted type required', async () => {
            const withGrants = new EntryValidationService(
                grantsOf(['post', 'person']).query
            );

            const waived = await withGrants.waivedRequired(post, 'ws-1');

            expect(waived.size).toBe(0);
            expect(
                withGrants.validate(post, { title: 'hi' }, waived).issues
            ).toEqual([{ field: 'author', message: 'is required' }]);
        });

        it('waives nothing without a grants query (fails closed)', async () => {
            expect((await service.waivedRequired(post, 'ws-1')).size).toBe(0);
        });

        it('does not read the grants for a type with no required relation', async () => {
            const grants = grantsOf([]);
            await new EntryValidationService(grants.query).waivedRequired(
                person,
                'ws-1'
            );
            expect(grants.reachableSlugs).not.toHaveBeenCalled();
        });
    });
});
