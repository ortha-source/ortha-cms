import { BadRequestException } from '@nestjs/common';
import { Kind, parse, type FragmentDefinitionNode } from 'graphql';
import { article } from '../../schema/__test__/fixtures';
import {
    applySelection,
    entryDtoFrom,
    listDtoFrom,
    readEntrySelection,
    type EntrySelection
} from '../selection';

/**
 * The selection → DTO derivation is what makes the GraphQL layer an adapter
 * rather than a second read path: a query asking for `{ id title }` must narrow
 * the SQL projection exactly as `?fields=id,title` does, because it becomes
 * that request.
 */
describe('selection', () => {
    /** Reads the selection a query's first field implies for `article`. */
    const selectionFor = (query: string): EntrySelection => {
        const document = parse(query);
        const fragments: Record<string, FragmentDefinitionNode> = {};
        for (const definition of document.definitions) {
            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
                fragments[definition.name.value] = definition;
            }
        }
        const operation = document.definitions.find(
            (definition) => definition.kind === Kind.OPERATION_DEFINITION
        );
        const root =
            operation?.kind === Kind.OPERATION_DEFINITION
                ? operation.selectionSet.selections[0]
                : undefined;
        const selectionSet =
            root?.kind === Kind.FIELD ? root.selectionSet : undefined;
        return readEntrySelection(article, selectionSet, fragments, {});
    };

    describe('value fields', () => {
        it('collects the stored fields a query selected', () => {
            expect(selectionFor('{ a { title body } }').valueFields).toEqual([
                'title',
                'body'
            ]);
        });

        it('ignores envelope fields and __typename', () => {
            // Neither maps to a content field; treating them as one would put a
            // name in `?fields=` that `parseFieldSelection` rejects with a 400.
            expect(
                selectionFor('{ a { id createdAt __typename title } }')
                    .valueFields
            ).toEqual(['title']);
        });

        it('follows a named fragment', () => {
            // Generated clients express selections as fragments; missing them
            // would silently under-fetch and return null for a selected field.
            const selection = selectionFor(
                `{ a { ...fields } }
                 fragment fields on Article { title body }`
            );

            expect(selection.valueFields).toEqual(['title', 'body']);
        });

        it('follows an inline fragment', () => {
            expect(
                selectionFor('{ a { ... on Article { title } } }').valueFields
            ).toEqual(['title']);
        });
    });

    describe('expansions', () => {
        it('records a relation with the page size it asked for', () => {
            expect(
                selectionFor(
                    '{ a { tags(pageSize: 5) { items { id } } } }'
                ).relations.get('tags')
            ).toBe(5);
        });

        it('falls back to the shared expansion default', () => {
            expect(
                selectionFor('{ a { tags { items { id } } } }').relations.get(
                    'tags'
                )
            ).toBe(20);
        });

        it('clamps a page size to what the REST API accepts', () => {
            expect(
                selectionFor(
                    '{ a { tags(pageSize: 5000) { items { id } } } }'
                ).relations.get('tags')
            ).toBe(100);
        });

        it('records media fields and translations', () => {
            const selection = selectionFor(
                '{ a { cover(limit: 3) { url } translations { id } } }'
            );

            expect(selection.media.get('cover')).toBe(3);
            expect(selection.translations).toBe(true);
        });
    });

    describe('applySelection', () => {
        it('turns a selection into the REST expansion parameters', () => {
            const dto = {} as Record<string, unknown>;
            applySelection(
                dto as never,
                selectionFor(
                    '{ a { title tags(pageSize: 5) { items { id } } cover { url } translations { id } } }'
                )
            );

            expect(dto).toEqual({
                fields: 'title',
                relations: 'preview',
                relationFields: 'tags',
                relationLimit: 5,
                media: 'preview',
                mediaFields: 'cover',
                mediaLimit: 20,
                translations: 'preview'
            });
        });

        it('sends the largest page size when fields disagree', () => {
            // One `relationLimit` serves every expanded field, so it must be the
            // maximum — anything smaller would truncate a field below what it
            // explicitly asked for. Each resolver slices back down to its own.
            const dto = {} as Record<string, unknown>;
            applySelection(
                dto as never,
                selectionFor(
                    '{ a { tags(pageSize: 5) { items { id } } secret(pageSize: 50) { code } } }'
                )
            );

            expect(dto['relationLimit']).toBe(50);
        });

        it('leaves `fields` unset when no value field was selected', () => {
            const dto = {} as Record<string, unknown>;
            applySelection(dto as never, selectionFor('{ a { id } }'));

            expect(dto).not.toHaveProperty('fields');
        });
    });

    describe('listDtoFrom', () => {
        it('maps list arguments onto the REST query DTO', () => {
            const dto = listDtoFrom(
                {
                    page: 2,
                    pageSize: 10,
                    sort: '-publishedAt',
                    search: 'hello',
                    locale: 'de',
                    status: 'draft'
                },
                selectionFor('{ a { title } }')
            );

            expect(dto).toMatchObject({
                page: 2,
                pageSize: 10,
                sort: '-publishedAt',
                search: 'hello',
                locale: 'de',
                status: 'draft',
                fields: 'title'
            });
        });

        it('re-serialises the filter tree for the shared engine', () => {
            // Re-encoding rather than reaching past the parser keeps one filter
            // language, one set of caps, and one error shape across protocols.
            const filter = {
                and: [{ field: 'featured', op: 'eq', value: true }]
            };
            const dto = listDtoFrom(
                { filter },
                selectionFor('{ a { title } }')
            );

            expect(dto.filter).toBe(JSON.stringify(filter));
        });

        it('omits arguments the caller did not pass', () => {
            const dto = listDtoFrom({}, selectionFor('{ a { title } }'));

            expect(dto).not.toHaveProperty('page');
            expect(dto).not.toHaveProperty('filter');
        });
    });

    describe('read arguments are validated, as the REST route validates them', () => {
        // A REST query string meets the host's global `ValidationPipe`; a
        // GraphQL argument never does. Without running the DTO's own validators
        // a token reached further over GraphQL than over REST — `pageSize: -1`
        // is a clean 400 over there and reached `.limit(-1)` over here, coming
        // back as an opaque 500.
        const selection = () => selectionFor('{ a { title } }');

        /**
         * The messages a `BadRequestException` carries. They live in the
         * response body, exactly as the REST 400 spells them — `errors.ts`
         * joins them into the GraphQL error message.
         */
        const refusalFor = (build: () => unknown): string => {
            try {
                build();
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException);
                const response = (error as BadRequestException).getResponse();
                return JSON.stringify(response);
            }
            throw new Error('Expected the DTO to be refused.');
        };

        it.each([
            ['pageSize below the minimum', { pageSize: -1 }, /less than 1/],
            ['pageSize of zero', { pageSize: 0 }, /less than 1/],
            ['page below the minimum', { page: 0 }, /less than 1/],
            [
                'pageSize past MAX_PAGE_SIZE',
                { pageSize: 500 },
                /greater than 100/
            ],
            [
                'a search needle past the cap',
                { search: 'x'.repeat(100_000) },
                /shorter than or equal to 255/
            ],
            [
                'a locale slug past the cap',
                { locale: 'x'.repeat(200) },
                /shorter than or equal to 35/
            ]
        ])('refuses %s', (_name, args, message) => {
            expect(refusalFor(() => listDtoFrom(args, selection()))).toMatch(
                message
            );
        });

        it('accepts the boundary values REST accepts', () => {
            expect(() =>
                listDtoFrom({ page: 1, pageSize: 100 }, selection())
            ).not.toThrow();
        });

        it('validates the single-entry DTO too', () => {
            expect(
                refusalFor(() =>
                    entryDtoFrom({ locale: 'x'.repeat(200) }, selection())
                )
            ).toMatch(/shorter than or equal to 35/);
        });
    });
});
