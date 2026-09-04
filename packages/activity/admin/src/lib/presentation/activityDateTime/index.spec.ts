import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { toActivityEvent } from '../../infrastructure/activityMapper';
import { activityDateTime } from './index';

/**
 * What the plugin does with a timestamp it cannot parse.
 *
 * Two halves, and they pull in opposite directions on purpose. The mapper must
 * **not** repair a malformed `at` — substituting the epoch or "now" for an
 * audit row's time is a mapper fallback that silently rewrites the record — so
 * an `Invalid Date` is part of the view model's contract. Which means every
 * consumer has to be total, because `Date.prototype.toISOString` throws a
 * `RangeError` on one, and an unguarded call in render took the whole SPA to a
 * blank page (`BUG-activity-admin-04`): there is no error boundary above the
 * home slots, so one bad row in the Recent activity panel unmounted the tree.
 *
 * The first half is a value test. The second is a source scan, because the
 * failure is a *missing* indirection: a `dateTime={event.at.toISOString()}`
 * written in a fourth component renders perfectly against every fixture that
 * has a valid timestamp, which is every fixture anybody writes.
 */

/** This package's `src`, from `src/lib/presentation/activityDateTime`. */
const SRC = join(__dirname, '../../..');

/** Every non-test source file under `src`. */
function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...sourceFiles(path));
        } else if (
            /\.tsx?$/.test(entry.name) &&
            !/\.spec\.tsx?$/.test(entry.name)
        ) {
            out.push(path);
        }
    }
    return out;
}

/** Code lines only — this package explains the hazard at length in prose. */
function codeLines(): { file: string; line: number; text: string }[] {
    const out: { file: string; line: number; text: string }[] = [];
    for (const file of sourceFiles(SRC)) {
        for (const [index, text] of readFileSync(file, 'utf8')
            .split('\n')
            .entries()) {
            const trimmed = text.trimStart();
            if (
                trimmed.startsWith('*') ||
                trimmed.startsWith('//') ||
                trimmed.startsWith('/*')
            ) {
                continue;
            }
            out.push({ file: relative(SRC, file), line: index + 1, text });
        }
    }
    return out;
}

const at = (hit: { file: string; line: number }) => `${hit.file}:${hit.line}`;

/** The one module allowed to call `toISOString` — the guard itself. */
const GUARD = 'lib/presentation/activityDateTime/index.ts';

describe('an audit row whose timestamp does not parse', () => {
    describe('the mapper', () => {
        it('keeps the unparseable value instead of inventing one [activity:I-25]', () => {
            const mapped = toActivityEvent({
                id: 'e1',
                kind: 'user.signed_in',
                subjectType: 'user',
                subjectId: 'u1',
                actorId: null,
                actorType: null,
                actorEmail: null,
                workspaceId: null,
                meta: null,
                at: 'not a timestamp'
            });

            // Not the epoch, not `Date.now()`: an audit row with a made-up time
            // is worse than one with an unreadable time, because nothing
            // downstream can tell it from a real one.
            expect(mapped.at).toBeInstanceOf(Date);
            expect(Number.isNaN(mapped.at.getTime())).toBe(true);
        });

        it('still parses a real timestamp [activity:I-25]', () => {
            const mapped = toActivityEvent({
                id: 'e1',
                kind: 'user.signed_in',
                subjectType: 'user',
                subjectId: 'u1',
                actorId: null,
                actorType: null,
                actorEmail: null,
                workspaceId: null,
                meta: null,
                at: '2026-07-17T12:00:00.000Z'
            });

            expect(mapped.at.toISOString()).toBe('2026-07-17T12:00:00.000Z');
        });
    });

    describe('the `<time datetime>` guard', () => {
        it('drops the attribute rather than throwing [activity:I-25]', () => {
            expect(
                activityDateTime(new Date('not a timestamp'))
            ).toBeUndefined();
            expect(activityDateTime(new Date('2026-07-17T12:00:00.000Z'))).toBe(
                '2026-07-17T12:00:00.000Z'
            );
        });

        it('is what every `dateTime` attribute in the plugin goes through [activity:I-25]', () => {
            const attributes = codeLines().filter((hit) =>
                hit.text.includes('dateTime=')
            );

            // Three today, across the table row, the home panel and the entry
            // widget. Asserting there are any is the guard on the guard: a
            // renamed prop would otherwise empty this list and pass.
            expect(attributes.length).toBeGreaterThanOrEqual(3);

            const unguarded = attributes.filter(
                (hit) => !hit.text.includes('dateTime={activityDateTime(')
            );
            expect(unguarded.map(at)).toEqual([]);
        });

        it('is the only place a Date is stringified by hand [activity:I-25]', () => {
            // `intl.formatDate` is total on an `Invalid Date` (it renders
            // "Invalid Date" rather than throwing), so it is the sanctioned way
            // to put an audit time on screen. These three are not.
            const raw = codeLines().filter(
                (hit) =>
                    /\.toISOString\(|\.toLocaleString\(|\.toLocaleDateString\(/.test(
                        hit.text
                    ) && hit.file !== GUARD
            );

            expect(raw.map(at)).toEqual([]);
        });
    });
});
