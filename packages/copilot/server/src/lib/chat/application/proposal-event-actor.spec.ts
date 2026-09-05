import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { proposalEventActor } from './proposal-event-actor';

/** The repository root, from `packages/copilot/server/src/lib/chat/application`. */
const REPO = join(__dirname, '../../../../../../..');

/**
 * Who an applied change is attributed to.
 *
 * "The apply runs the ordinary use-case with a person as the actor: the same
 * validation, the same revision, the same activity row" is three claims, and
 * the revision one is pinned by the e2e suite. This is the one about the
 * **actor** — the half that decides whether the audit log can be read at all.
 * Get it wrong and there is still a row, still a revision, still a green suite;
 * the log just says a machine did it, and every question anyone asks of an
 * audit trail ("who changed this?") answers "the copilot".
 */
describe('proposalEventActor', () => {
    const actor = {
        userId: 'user-1',
        actorEmail: 'ada@example.com',
        workspaceId: 'workspace-1',
        runId: 'run-1',
        proposalId: 'proposal-1'
    };

    it('puts the person in the actor position, never the copilot [copilot:I-13]', () => {
        expect(proposalEventActor(actor)).toEqual({
            id: 'user-1',
            email: 'ada@example.com',
            via: {
                kind: 'copilot',
                runId: 'run-1',
                proposalId: 'proposal-1'
            }
        });
    });

    /**
     * `via` is provenance, and the distinction is the whole design: it says
     * *how* the change was made, beside an actor that still says *who*. An
     * implementation that moved the copilot into `id` — or dropped `via` and
     * made an agent turn indistinguishable from something Ada typed — would be
     * two different failures, and this catches both.
     */
    it('marks the mechanism without displacing the person [copilot:I-13]', () => {
        const event = proposalEventActor({ ...actor, proposalId: undefined });

        expect(event.id).toBe('user-1');
        expect(event.via).toMatchObject({ kind: 'copilot', runId: 'run-1' });
        // Absent rather than missing: a change applied outside a proposal row
        // still says which run it came from.
        expect((event.via as Record<string, unknown>)['proposalId']).toBeNull();
    });
});

/** Every `*.applier.ts` under `packages/`, tests excluded. */
function applierFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (
                entry.name.startsWith('.') ||
                entry.name === 'node_modules' ||
                entry.name === 'dist' ||
                entry.name === 'out-tsc'
            ) {
                continue;
            }
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(path);
            } else if (
                entry.name.endsWith('.applier.ts') &&
                !entry.name.endsWith('.spec.ts')
            ) {
                out.push(path);
            }
        }
    };
    walk(join(REPO, 'packages'));
    return out;
}

/**
 * The claim is about **every** applier — nine write sites across four packages,
 * in five files — which is exactly why the helper above exists rather than each
 * one assembling its own actor. An applier that quietly built one inline would
 * produce the row this is meant to prevent with nothing failing anywhere: its
 * own tests would pass, the change would apply, the revision would appear, and
 * only somebody reading the audit log months later would notice.
 *
 * The only observable for "nobody restated it" is the source tree, so this
 * reads it — the same technique, and the same reason, as
 * `activity/server`'s `package-shape.spec.ts`.
 */
describe('every proposal applier attributes its write to the person', () => {
    const files = applierFiles();

    it('finds the appliers at all', () => {
        // The guard on the guard: a walk defeated by a rename would make the
        // checks below pass over an empty list, and a file-level check would
        // pass over a second write inside a file that already stamps one.
        expect(files.length).toBeGreaterThanOrEqual(5);
        const stamps = files.reduce(
            (total, file) =>
                total +
                (readFileSync(file, 'utf8').match(/proposalEventActor\(/g)
                    ?.length ?? 0),
            0
        );
        expect(stamps).toBeGreaterThanOrEqual(9);
    });

    it('stamps the shared actor rather than assembling one [copilot:I-13]', () => {
        const offenders = files.filter(
            (file) => !readFileSync(file, 'utf8').includes('proposalEventActor')
        );

        expect(offenders.map((file) => relative(REPO, file))).toEqual([]);
    });

    it('leaves the copilot marker to the one place that writes it [copilot:I-13]', () => {
        // `kind: 'copilot'` belongs in `via`, and `via` is built in exactly one
        // function. A second literal is an applier that has started describing
        // its own actor — the step before it starts describing the wrong one.
        const marker = /kind:\s*'copilot'/;
        const offenders = files.filter((file) =>
            marker.test(readFileSync(file, 'utf8'))
        );

        expect(offenders.map((file) => relative(REPO, file))).toEqual([]);
    });
});
