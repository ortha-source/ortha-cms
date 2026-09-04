import { Logger } from '@nestjs/common';
import { SegmentCatalogService } from './segment-catalog.service';

/** One row as the table stores it. */
function row(id: string, label: string, tags: string[]) {
    return { id, key: label, label, tags, workspaceIds: [] };
}

/**
 * A database whose catalogue read answers with whatever `pages.shift()` gives
 * next — or fails, when the entry is an error.
 */
function db(...pages: (unknown[] | Error)[]) {
    let reads = 0;
    const handle = {
        select: () => ({
            from: () => ({
                orderBy: async () => {
                    reads += 1;
                    const next = pages.length > 1 ? pages.shift() : pages[0];
                    if (next instanceof Error) throw next;
                    return next ?? [];
                }
            })
        })
    };
    return { handle, reads: () => reads };
}

describe('SegmentCatalogService', () => {
    let log: jest.SpyInstance;

    beforeEach(() => {
        log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {
            /* quiet */
        });
    });

    afterEach(() => log.mockRestore());

    /**
     * The read path consults this cache **synchronously** — `CONTENT_READ_SCOPE`
     * is called from inside the query builder and cannot await — so it has to be
     * populated before the first request is served.
     */
    it('loads the catalogue before the first request is served [segments:I-36]', async () => {
        const source = db([row('s1', 'Acme', ['acme'])]);
        const catalog = new SegmentCatalogService(source.handle as never);

        // Nothing yet: the constructor does no I/O.
        expect(catalog.all()).toEqual([]);
        expect(catalog.configured).toBe(false);

        await catalog.onApplicationBootstrap();

        expect(source.reads()).toBe(1);
        expect(catalog.configured).toBe(true);
        expect(catalog.resolveTags(['acme'])).toEqual(new Set(['s1']));
    });

    /**
     * `onApplicationBootstrap` runs inside `app.init()`, so a rejection here
     * takes the process down.
     *
     * That is the wanted outcome and the reason there is no try/catch: a server
     * that came up with an empty catalogue would serve **restricted** content as
     * though nothing were configured — every entitlement in the installation
     * silently off, with a healthy-looking process behind it.
     */
    it('aborts the start when the catalogue cannot be read [segments:I-36]', async () => {
        const catalog = new SegmentCatalogService(
            db(new Error('relation "segments" does not exist')).handle as never
        );

        await expect(catalog.onApplicationBootstrap()).rejects.toThrow(
            /segments/
        );
    });

    /**
     * "In full" is the half worth an assertion: the cache is **replaced**, not
     * merged into. A reload that added the rows it read would leave a deleted
     * audience resolving readers forever, and a renamed tag answering to both
     * its names.
     */
    it('replaces the whole catalogue on reload rather than merging [segments:I-36]', async () => {
        const before = [
            row('s1', 'Acme', ['acme']),
            row('s2', 'Globex', ['globex'])
        ];
        const after = [row('s2', 'Globex', ['globex-new'])];
        const catalog = new SegmentCatalogService(
            db(before, after).handle as never
        );

        await catalog.onApplicationBootstrap();
        expect(catalog.all().map((s) => s.id)).toEqual(['s1', 's2']);

        await catalog.reload();

        // The deleted one is gone, and the retagged one answers only to its new
        // tag — the two things a merge would get wrong.
        expect(catalog.all().map((s) => s.id)).toEqual(['s2']);
        expect(catalog.resolveTags(['acme'])).toEqual(new Set());
        expect(catalog.resolveTags(['globex'])).toEqual(new Set());
        expect(catalog.resolveTags(['globex-new'])).toEqual(new Set(['s2']));
    });

    it('reports itself unconfigured while the table is empty', async () => {
        // The state every installation that has never used the feature is in,
        // and what makes the read scope emit nothing at all.
        const catalog = new SegmentCatalogService(db([]).handle as never);

        await catalog.onApplicationBootstrap();

        expect(catalog.configured).toBe(false);
    });
});
