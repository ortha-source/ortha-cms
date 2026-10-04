import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getTableColumns, getTableName } from 'drizzle-orm';
import {
    ContentTypeRegistry,
    type AnyContentType
} from '@orthacms/content-server';
import { renderAll } from '@orthacms/schema-builder-domain';
import { toDocument } from '@orthacms/schema-builder-server';
import { contentTypes } from './index';

/**
 * Design invariant 9 (ADR-0020): the builder can take over every reference
 * type without changing it. Read the registry into a document as if the
 * builder owned every file, generate the modules, load them through the real
 * DSL, and the new registry must serialize — and build tables — exactly as the
 * hand-written one does.
 *
 * The modules are written under `test-output/` (ignored) rather than a temp
 * folder: they import `@orthacms/content-server/define`, which resolves only
 * from inside the workspace.
 */
const OUT = join(__dirname, '../../test-output/round-trip');

function named(list: readonly AnyContentType[], name: string): AnyContentType {
    const found = list.find((type) => type.name === name);
    if (!found) throw new Error(`no ${name}`);
    return found;
}

async function generated(): Promise<AnyContentType[]> {
    const document = await toDocument(contentTypes, async () => 'builder');
    rmSync(OUT, { recursive: true, force: true });
    for (const [path, source] of Object.entries(renderAll(document))) {
        const file = join(OUT, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, source);
    }
    let types: AnyContentType[] = [];
    jest.isolateModules(() => {
        types = document.types.map((type) => {
            const folder = type.kind === 'single' ? 'pages' : 'collections';
            const module = require(join(OUT, folder, type.name)) as Record<
                string,
                AnyContentType
            >;
            return module[type.name];
        });
    });
    return types;
}

describe('the builder round-trips every reference type', () => {
    const original = new ContentTypeRegistry(contentTypes);
    let regenerated: ContentTypeRegistry;
    let types: AnyContentType[];

    beforeAll(async () => {
        types = await generated();
        regenerated = new ContentTypeRegistry(types);
    });

    afterAll(() => rmSync(OUT, { recursive: true, force: true }));

    it('generates a module for every type', () => {
        expect(types.map((type) => type?.name)).toEqual(
            contentTypes.map((type) => type.name)
        );
    });

    it.each(contentTypes.map((type) => type.name))(
        '%s serializes as before',
        (name) => {
            expect(regenerated.serialize(name)).toEqual(
                original.serialize(name)
            );
        }
    );

    it.each(contentTypes.map((type) => type.name))(
        '%s builds the same tables',
        (name) => {
            const before = named(contentTypes, name);
            const after = named(types, name);
            expect(getTableName(after.table)).toBe(getTableName(before.table));
            expect(Object.keys(getTableColumns(after.table)).sort()).toEqual(
                Object.keys(getTableColumns(before.table)).sort()
            );
            expect(Object.keys(after.joinTables).sort()).toEqual(
                Object.keys(before.joinTables).sort()
            );
        }
    );
});
