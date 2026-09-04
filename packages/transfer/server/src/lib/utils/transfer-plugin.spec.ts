import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TransferPlugin } from './transfer-plugin';
import { TRANSFER_EVENT_KINDS, transferEvent } from '../transfer.events';

/** `packages/transfer/server`. */
const PACKAGE_ROOT = join(__dirname, '..', '..', '..');

describe('TransferPlugin()', () => {
    it('owns no migrations — a transfer writes content that already exists [transfer:I-01]', () => {
        // The `migrations` descriptor is how a plugin claims tables of its own:
        // the host reads it in `db:migrate` and applies whatever SQL it points
        // at. Transfer declaring one would mean it had grown a table, which is
        // the thing this invariant exists to notice.
        expect(TransferPlugin().migrations).toBeUndefined();
    });

    it('ships no drizzle config and no migrations folder [transfer:I-01]', () => {
        // The descriptor above is the runtime half; this is the half that
        // appears first. A `db:generate` target is *inferred* from the presence
        // of a `drizzle.config.ts`, so the file is what turns a package into
        // one that owns schema.
        expect(existsSync(join(PACKAGE_ROOT, 'drizzle.config.ts'))).toBe(false);
        expect(existsSync(join(PACKAGE_ROOT, 'migrations'))).toBe(false);
    });

    it('declares no schema module of its own [transfer:I-01]', () => {
        // Content's tables come from `content-server`, media's from
        // `media-server`. A `schema/` folder here holding `pgTable(...)` would
        // be a table by any other name, migrations or not.
        const tableDefiners = sourceFiles(join(PACKAGE_ROOT, 'src')).filter(
            (path) => /\bpgTable\s*\(/.test(readFileSync(path, 'utf8'))
        );

        expect(tableDefiners).toEqual([]);
    });

    it('adds exactly two events, both riding the shared outbox [transfer:I-01]', () => {
        expect(Object.values(TRANSFER_EVENT_KINDS)).toEqual([
            'transfer.content.exported',
            'transfer.content.imported'
        ]);

        // And they are ordinary domain events — the outbox row shape every
        // other plugin writes, not a journal of transfer's own.
        const event = transferEvent(TRANSFER_EVENT_KINDS.EXPORTED, 'post', {
            selected: 3
        });
        expect(event).toMatchObject({
            kind: 'transfer.content.exported',
            aggregateType: 'transfer.content',
            aggregateId: 'post',
            payload: { selected: 3 }
        });
    });

    it('carries its config through and names itself', () => {
        const plugin = TransferPlugin({ identity: { post: ['slug'] } });

        expect(plugin.name).toBe('transfer');
        expect(plugin.transferConfig).toEqual({ identity: { post: ['slug'] } });
    });

    it('refuses an identity list naming no fields', () => {
        // Eager, because the alternative surfaces months later as "every import
        // creates duplicates", nowhere near its cause.
        expect(() => TransferPlugin({ identity: { post: [] } })).toThrow(
            /identity for content type "post" is empty/
        );
    });

    it('refuses a blank field name in an identity list', () => {
        expect(() => TransferPlugin({ identity: { post: ['  '] } })).toThrow(
            /contains a blank field name/
        );
    });
});

/** Every non-spec `.ts` under a directory, recursively. */
function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) {
            return [];
        }
        return [path];
    });
}
