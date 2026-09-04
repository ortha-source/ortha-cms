import {
    CONFLICT_POLICIES,
    CONFLICT_POLICY,
    IMPORT_ACTION,
    IMPORT_REASON,
    RELATION_POLICIES,
    RELATION_POLICY,
    type ConflictPolicy,
    type ImportAction,
    type ImportReason,
    type RelationPolicy
} from '@orthacms/transfer-domain';
import { ImportEntriesUseCase } from './import-entries.use-case';

/**
 * The policy decision, called on the real prototype.
 *
 * `decide` is a private pure method: it reads no `this`, touches no database,
 * and is the single switch both policies pass through. Reaching it this way
 * exercises the production code rather than a paraphrase of it — the
 * alternative is a container, a Postgres and thirty rows of fixture to observe
 * one `if`.
 */
const decide = (
    ImportEntriesUseCase.prototype as unknown as {
        decide(
            keyable: boolean,
            match: { targetId: string } | undefined,
            policy: ConflictPolicy | RelationPolicy
        ): { action: ImportAction; reason: ImportReason };
    }
).decide;

/** All seven policy settings — four conflict, three relation. */
const EVERY_POLICY: (ConflictPolicy | RelationPolicy)[] = [
    ...CONFLICT_POLICIES,
    ...RELATION_POLICIES
];

const MATCH = { targetId: 'existing-1' };

describe('no match means a create', () => {
    it('has seven policies to answer for', () => {
        // The loop below is only as good as its input, and the invariant says
        // "every one of the seven".
        expect(EVERY_POLICY).toHaveLength(7);
    });

    it.each(EVERY_POLICY)(
        'creates under %s when nothing matched [transfer:I-13]',
        (policy) => {
            // `recreate` included, and `fail` and `skip` too: a related record
            // with nothing to link to has to be written, or the link it exists
            // to serve would dangle. There is no policy under which "not here"
            // means "do nothing".
            expect(decide(true, undefined, policy).action).toBe(
                IMPORT_ACTION.Create
            );
        }
    );

    it('says why: new when the record was keyable, no-identity when it was not [transfer:I-13]', () => {
        expect(decide(true, undefined, CONFLICT_POLICY.Skip).reason).toBe(
            IMPORT_REASON.New
        );
        expect(decide(false, undefined, CONFLICT_POLICY.Skip).reason).toBe(
            IMPORT_REASON.NoIdentity
        );
    });

    it.each(EVERY_POLICY)(
        'does not create under %s when something did match',
        (policy) => {
            // The control. Without it, a `decide` that returned Create
            // unconditionally would satisfy every case above.
            const created = decide(true, MATCH, policy).action;
            const expected =
                policy === CONFLICT_POLICY.Duplicate ||
                policy === RELATION_POLICY.Recreate;

            expect(created === IMPORT_ACTION.Create).toBe(expected);
        }
    );
});

describe('a match is answered by whichever policy governs the record', () => {
    it.each([
        [
            CONFLICT_POLICY.Skip,
            IMPORT_ACTION.Skip,
            IMPORT_REASON.ConflictSkipped
        ],
        [CONFLICT_POLICY.Update, IMPORT_ACTION.Update, IMPORT_REASON.Matched],
        [
            CONFLICT_POLICY.Duplicate,
            IMPORT_ACTION.Create,
            IMPORT_REASON.ConflictDuplicated
        ],
        [CONFLICT_POLICY.Fail, IMPORT_ACTION.Error, IMPORT_REASON.Matched],
        [
            RELATION_POLICY.Link,
            IMPORT_ACTION.Skip,
            IMPORT_REASON.RelationLinked
        ],
        [RELATION_POLICY.Update, IMPORT_ACTION.Update, IMPORT_REASON.Matched],
        [
            RELATION_POLICY.Recreate,
            IMPORT_ACTION.Create,
            IMPORT_REASON.RelationRecreated
        ]
    ])('%s → %s', (policy, action, reason) => {
        expect(decide(true, MATCH, policy)).toEqual({ action, reason });
    });

    it('distinguishes a linked relation from a skipped conflict', () => {
        // They are the same action and deliberately different reasons: one is
        // the intent ("point at the author who is already here"), the other is
        // a conflict declined. Collapsing them would make the verdict list lie
        // about what happened.
        expect(decide(true, MATCH, RELATION_POLICY.Link).reason).not.toBe(
            decide(true, MATCH, CONFLICT_POLICY.Skip).reason
        );
    });
});
