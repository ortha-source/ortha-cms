import {
    PROTECTION_REFUSAL,
    PublishProtectionGuard
} from './publish-protection.guard';
import type {
    ContentPublishGuardContext,
    PublishVerdict
} from '@orthacms/content-server';
import type { ProtectionRuleView } from '../types/protection-views';
import type { StoredApproval } from './review-approval.repository';

const HEAD = { id: 'rev-7', number: 7, authorId: 'anna' };

const ruleWith = (
    overrides: Partial<ProtectionRuleView> = {}
): ProtectionRuleView => ({
    id: 'rule-1',
    kind: 'collection',
    slug: 'article',
    enabled: true,
    requiredApprovals: 2,
    requireOtherPerson: true,
    countStaleApprovals: false,
    adminBypass: true,
    allowTokenPublish: false,
    updatedBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

const approved = (userId: string, revisionId = HEAD.id): StoredApproval => ({
    id: `vote-${userId}-${revisionId}`,
    revisionId,
    userId,
    decision: 'approved',
    note: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z')
});

const context = (
    overrides: Partial<ContentPublishGuardContext> = {}
): ContentPublishGuardContext => ({
    type: { name: 'article', kind: 'collection' } as never,
    entryId: 'entry-1',
    workspaceId: 'ws-1',
    actor: { userId: 'publisher', isToken: false },
    ...overrides
});

/** Builds the guard over stubbed collaborators, each counting its calls. */
function build(options: {
    rule?: ProtectionRuleView | null;
    head?: typeof HEAD | null;
    approvals?: StoredApproval[];
    manages?: boolean;
}) {
    const calls = { rule: 0, head: 0, approvals: 0, permissions: 0 };
    const rules = {
        async find() {
            calls.rule += 1;
            return options.rule ?? null;
        }
    };
    const approvals = {
        async listForEntry() {
            calls.approvals += 1;
            return options.approvals ?? [];
        }
    };
    const heads = {
        async find() {
            calls.head += 1;
            return options.head === undefined ? HEAD : options.head;
        }
    };
    const permissions = {
        async forUser() {
            calls.permissions += 1;
            return options.manages ? ['protection:manage'] : [];
        }
    };
    // The real policy's contract, narrowed to what this guard uses: does the
    // actor hold the key? `Permission` is a value object, so the stub reads its
    // `value` rather than stringifying it.
    const accessPolicy = {
        can: (
            actor: { grantedPermissions: Set<string> },
            permission: { value: string }
        ) => actor.grantedPermissions.has(permission.value)
    };

    const guard = new PublishProtectionGuard(
        rules as never,
        approvals as never,
        heads as never,
        permissions as never,
        accessPolicy as never
    );
    return { guard, calls };
}

const refusalOf = (verdict: PublishVerdict) => {
    if (verdict.allowed) throw new Error('expected a refusal');
    return verdict;
};

describe('an unprotected type', () => {
    /**
     * Invariant I-02, proven where it is actually claimed: an installation with
     * the plugin registered but no rule on this type pays for one indexed
     * lookup and nothing else. A passing publish would not show this — it would
     * pass either way — so the assertion is on what was *not* called.
     */
    it('answers before reading a revision or an approval [protection:I-02]', async () => {
        const { guard, calls } = build({ rule: null });

        await expect(guard.check(context())).resolves.toEqual({
            allowed: true
        });
        expect(calls).toEqual({
            rule: 1,
            head: 0,
            approvals: 0,
            permissions: 0
        });
    });

    it('treats a switched-off rule as no rule at all [protection:I-04]', async () => {
        const { guard, calls } = build({ rule: ruleWith({ enabled: false }) });

        await expect(guard.check(context())).resolves.toEqual({
            allowed: true
        });
        expect(calls.approvals).toBe(0);
    });

    it('does not refuse a token when the rule is off', async () => {
        const { guard } = build({
            rule: ruleWith({ enabled: false, allowTokenPublish: false })
        });

        await expect(
            guard.check(context({ actor: { userId: null, isToken: true } }))
        ).resolves.toEqual({ allowed: true });
    });
});

describe('a protected type', () => {
    it('allows the publish once the head has enough approvals', async () => {
        const { guard } = build({
            rule: ruleWith({ requiredApprovals: 2 }),
            approvals: [approved('boris'), approved('igor')]
        });

        await expect(guard.check(context())).resolves.toEqual({
            allowed: true
        });
    });

    it('refuses with 409 and the numbers the caller needs', async () => {
        const { guard } = build({
            rule: ruleWith({ requiredApprovals: 2 }),
            approvals: [approved('boris'), approved('dmitry', 'rev-4')]
        });

        expect(refusalOf(await guard.check(context()))).toEqual({
            allowed: false,
            status: 409,
            code: PROTECTION_REFUSAL.InsufficientApprovals,
            message: expect.stringContaining('2 approval(s)'),
            details: {
                required: 2,
                given: 1,
                stale: 1,
                bypassable: false
            }
        });
    });

    /**
     * 409 rather than 403 is the load-bearing choice: a 403 here would be
     * indistinguishable from lacking `content:publish`, and the caller has to
     * tell "ask an administrator for the permission" from "ask a colleague for
     * an approval".
     */
    it('refuses a bearer token with its own code, not a 403', async () => {
        const { guard } = build({
            rule: ruleWith({ allowTokenPublish: false }),
            approvals: [approved('boris'), approved('igor')]
        });

        expect(
            refusalOf(
                await guard.check(
                    context({ actor: { userId: null, isToken: true } })
                )
            )
        ).toMatchObject({
            status: 409,
            code: PROTECTION_REFUSAL.TokenRefused
        });
    });

    /** A missing revision is content's 404 to give, not protection's 409. */
    it('stands aside when the entry has no revision', async () => {
        const { guard, calls } = build({
            rule: ruleWith(),
            head: null
        });

        await expect(guard.check(context())).resolves.toEqual({
            allowed: true
        });
        expect(calls.approvals).toBe(0);
    });
});

describe('the bypass', () => {
    const blocked = { rule: ruleWith({ requiredApprovals: 2 }) };

    it('allows the publish and returns the row that excuses it [protection:I-13]', async () => {
        const { guard } = build({ ...blocked, manages: true });

        const verdict = await guard.check(
            context({ bypassReason: '  Numbers corrected before the send  ' })
        );

        expect(verdict.allowed).toBe(true);
        expect(verdict.allowed && verdict.events).toHaveLength(1);
        expect(verdict.allowed && verdict.events?.[0]).toMatchObject({
            kind: 'entry.publish_bypassed',
            aggregateId: 'entry-1',
            payload: {
                ruleId: 'rule-1',
                required: 2,
                given: 0,
                // Trimmed, so a reason of spaces cannot masquerade as one.
                reason: 'Numbers corrected before the send'
            }
        });
    });

    /**
     * Authorization before shape. A member who may not bypass is told that
     * whatever they typed — a 400 would describe the shape of a door that is
     * not theirs to open.
     */
    it('is 403 for a caller without protection:manage, blank reason or not', async () => {
        const { guard } = build({ ...blocked, manages: false });

        for (const reason of ['a real reason', '', '   ']) {
            expect(
                refusalOf(await guard.check(context({ bypassReason: reason })))
            ).toMatchObject({
                status: 403,
                code: PROTECTION_REFUSAL.BypassRefused
            });
        }
    });

    it('is 403 when the rule allows no bypass, even for an administrator', async () => {
        const { guard } = build({
            rule: ruleWith({ requiredApprovals: 2, adminBypass: false }),
            manages: true
        });

        expect(
            refusalOf(await guard.check(context({ bypassReason: 'because' })))
        ).toMatchObject({
            status: 403,
            message: expect.stringContaining('no bypass')
        });
    });

    it('is 400 when an entitled caller sends nothing usable', async () => {
        const { guard } = build({ ...blocked, manages: true });

        expect(
            refusalOf(await guard.check(context({ bypassReason: '   ' })))
        ).toMatchObject({
            status: 400,
            code: PROTECTION_REFUSAL.BypassReasonRequired
        });
    });

    /** Nothing to bypass, nothing recorded — a reason is not a way to add a row. */
    it('records nothing when the publish was not blocked anyway', async () => {
        const { guard } = build({
            rule: ruleWith({ requiredApprovals: 1 }),
            approvals: [approved('boris')],
            manages: true
        });

        await expect(
            guard.check(context({ bypassReason: 'just in case' }))
        ).resolves.toEqual({ allowed: true });
    });

    it('reports bypassable to a caller who has not asked for one', async () => {
        const { guard } = build({ ...blocked, manages: true });

        expect(refusalOf(await guard.check(context()))).toMatchObject({
            status: 409,
            details: expect.objectContaining({ bypassable: true })
        });
    });
});
