import { resolveGrants } from './content-selection';
import type { KnownSlugs } from './content-catalog.reader';
import type { ContentDto } from '../dto/create-workspace.dto';

/** A catalogue with both kinds, so a mis-assigned kind is visible. */
const KNOWN: KnownSlugs = {
    collections: ['article', 'author'],
    pages: ['home', 'about']
};

/** `resolveGrants` takes the DTO class; the shape is all it reads. */
function content(dto: unknown): ContentDto {
    return dto as ContentDto;
}

/**
 * The create wizard's content decision, flattened into the explicit
 * `(kind, slug)` rows that become `workspace_content`.
 *
 * The kind is **not** carried by the request — the client sends slugs and the
 * catalogue decides what each one is. That is what makes this worth pinning:
 * a grant row written with the wrong kind, or with a slug no content type
 * answers to, points at nothing and is only discovered when an editor opens a
 * workspace and finds a type missing (or a phantom one listed).
 */
describe('resolveGrants', () => {
    describe("mode 'all'", () => {
        it('expands to one row per known slug, collections before pages [workspaces:I-21]', () => {
            expect(resolveGrants(content({ mode: 'all' }), KNOWN)).toEqual([
                { kind: 'collection', slug: 'article' },
                { kind: 'collection', slug: 'author' },
                { kind: 'single', slug: 'home' },
                { kind: 'single', slug: 'about' }
            ]);
        });

        it('ignores per-kind selections that came along for the ride', () => {
            // The top-level `all` short-circuits: a stale `collections` block
            // left in the payload must not narrow a decision the user made at
            // the page level.
            expect(
                resolveGrants(
                    content({
                        mode: 'all',
                        collections: { mode: 'specific', ids: ['article'] }
                    }),
                    KNOWN
                )
            ).toHaveLength(4);
        });

        it('grants nothing against an empty catalogue', () => {
            expect(
                resolveGrants(content({ mode: 'all' }), {
                    collections: [],
                    pages: []
                })
            ).toEqual([]);
        });
    });

    describe("mode 'specific'", () => {
        it("carves excludedIds out of a per-kind 'all'", () => {
            expect(
                resolveGrants(
                    content({
                        mode: 'specific',
                        collections: {
                            mode: 'all',
                            excludedIds: ['author']
                        }
                    }),
                    KNOWN
                )
            ).toEqual([{ kind: 'collection', slug: 'article' }]);
        });

        it('tolerates an excluded slug the catalogue never had', () => {
            expect(
                resolveGrants(
                    content({
                        mode: 'specific',
                        pages: { mode: 'all', excludedIds: ['ghost'] }
                    }),
                    KNOWN
                )
            ).toEqual([
                { kind: 'single', slug: 'home' },
                { kind: 'single', slug: 'about' }
            ]);
        });

        it('intersects with the catalogue, dropping an unknown slug', () => {
            // Writing the unrequested slug through would create a grant row
            // pointing at no content type at all — a row nothing can ever
            // resolve, and nothing later would flag.
            expect(
                resolveGrants(
                    content({
                        mode: 'specific',
                        collections: {
                            mode: 'specific',
                            ids: ['article', 'ghost']
                        }
                    }),
                    KNOWN
                )
            ).toEqual([{ kind: 'collection', slug: 'article' }]);
        });

        it('drops a slug listed under the wrong kind', () => {
            // `article` is a collection; asking for it as a page must not mint
            // a `single` grant for it. The catalogue's kind is the only source.
            expect(
                resolveGrants(
                    content({
                        mode: 'specific',
                        pages: { mode: 'specific', ids: ['article'] }
                    }),
                    KNOWN
                )
            ).toEqual([]);
        });

        it('yields the catalogue order, not the requested order', () => {
            expect(
                resolveGrants(
                    content({
                        mode: 'specific',
                        collections: {
                            mode: 'specific',
                            ids: ['author', 'article']
                        }
                    }),
                    KNOWN
                )
            ).toEqual([
                { kind: 'collection', slug: 'article' },
                { kind: 'collection', slug: 'author' }
            ]);
        });

        it('grants nothing when neither selection is present', () => {
            expect(resolveGrants(content({ mode: 'specific' }), KNOWN)).toEqual(
                []
            );
        });

        it("treats a 'specific' selection with no ids as an empty pick", () => {
            expect(
                resolveGrants(
                    content({
                        mode: 'specific',
                        collections: { mode: 'specific' }
                    }),
                    KNOWN
                )
            ).toEqual([]);
        });
    });
});
