import type { ToolContext } from '@orthacms/tools-server';
import { ProtectionToolProvider } from './protection-tool.provider';

/** A provider with every collaborator stubbed — the catalogue needs none of them. */
function provider(): ProtectionToolProvider {
    return new ProtectionToolProvider(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never
    );
}

const CANDIDATES = [{ userId: 'u-2', email: 'reviewer@example.com' }];

/**
 * A provider whose entry read and candidates read answer — what the
 * candidates tool's handler touches — recording who the list was asked for.
 */
function withCandidates(head: object | null = { id: 'r-1', number: 1 }) {
    const asked: [string, string][] = [];
    const tools = new ProtectionToolProvider(
        {} as never,
        {} as never,
        {} as never,
        {
            list: async (workspaceId: string, callerId: string) => {
                asked.push([workspaceId, callerId]);
                return CANDIDATES;
            }
        } as never,
        { find: async () => head } as never,
        {} as never,
        {} as never
    );
    const tool = tools
        .tools()
        .find(
            (candidate) => candidate.name === 'protection_reviewer_candidates'
        );
    if (!tool) throw new Error('protection_reviewer_candidates is missing');
    return { tool, asked };
}

function context(userId: string | null): ToolContext {
    return {
        workspaceId: 'w-1',
        actor: { userId }
    } as unknown as ToolContext;
}

describe('the protection tool catalogue', () => {
    /**
     * **`protection:I-17`.** ADR-0017 §6 withholds an approve tool from every
     * surface, and until this PR that held vacuously — the plugin contributed no
     * tools at all. It contributes three now, so the rule needs an assertion
     * rather than an absence.
     *
     * The check is on the **catalogue**, not on a list of names this file also
     * writes: anything that records an approval would have to appear here to be
     * callable, whatever it were called.
     */
    it('offers no tool that could record an approval [protection:I-17]', () => {
        const names = provider()
            .tools()
            .map((tool) => tool.name);

        expect(names).not.toContain('protection_approve');
        expect(names).not.toContain('protection_request_changes');
        // Nothing named for the act, however spelled. A model asked to "approve"
        // must find nothing, so the refusal is the absence of a tool rather than
        // a handler that says no — a handler is still a tool the model spends a
        // turn on.
        expect(
            names.filter((name) => /approve|approval|vote/.test(name))
        ).toEqual([]);
    });

    /**
     * The four that do exist, and the fact that three of them only read. A
     * write appearing where a read was is the change this pins: the reads are
     * what a run may do without asking anybody.
     */
    it('offers exactly the four tools, three of them read-only', () => {
        const tools = provider().tools();

        expect(tools.map((tool) => tool.name)).toEqual([
            'protection_review_status',
            'protection_review_diff',
            'protection_reviewer_candidates',
            'protection_request_review'
        ]);
        expect(
            tools.filter((tool) => tool.readOnly).map((tool) => tool.name)
        ).toEqual([
            'protection_review_status',
            'protection_review_diff',
            'protection_reviewer_candidates'
        ]);
    });

    /**
     * Omitting `surfaces` in `tools/server` means **both** consumers, so a tool
     * that says nothing has been handed to MCP by accident rather than by
     * decision. Every tool here states it, and this is what keeps that true when
     * a fourth is added by someone reading the file next door.
     */
    it('states its surfaces explicitly on every tool', () => {
        for (const tool of provider().tools()) {
            expect(tool.surfaces).toEqual(
                tool.name === 'protection_reviewer_candidates'
                    ? ['copilot']
                    : ['copilot', 'mcp']
            );
        }
    });

    /**
     * Who can be asked is the editor picker's list, for the signed-in caller —
     * the people `protection_request_review` will accept, and nobody else.
     */
    it('lists the reviewer candidates for the caller', async () => {
        const { tool, asked } = withCandidates();

        await expect(
            tool.handler(
                { typeName: 'article', entryId: 'e-1' },
                context('u-1')
            )
        ).resolves.toEqual({ candidates: CANDIDATES });
        expect(asked).toEqual([['w-1', 'u-1']]);
    });

    /**
     * An entry outside the workspace answers like a missing one, before any
     * member is read — a run must not learn who works in a workspace by naming
     * an entry it cannot see.
     */
    it('reads no candidates for an entry it cannot reach', async () => {
        const { tool, asked } = withCandidates(null);

        await expect(
            tool.handler(
                { typeName: 'article', entryId: 'e-1' },
                context('u-1')
            )
        ).rejects.toThrow('No such entry in this workspace.');
        expect(asked).toEqual([]);
    });

    /**
     * The write is marked as one, which is what makes the copilot's run engine
     * park it for the in-the-moment prompt (ADR-0009) instead of applying it
     * silently. What it applies is a *request*, but it is still a write.
     */
    it('marks the request tool as a write that applies', () => {
        const request = provider()
            .tools()
            .find((tool) => tool.name === 'protection_request_review');

        expect(request?.readOnly).toBe(false);
        expect(request?.effect).toBe('apply');
    });

    /**
     * The descriptions are written for a model, and the two read tools say
     * outright that approving is a person's act. Without it a model spends turns
     * looking for the tool, then reports its absence as a fault.
     */
    it('tells a model, in the description, that it cannot approve', () => {
        const readers = provider()
            .tools()
            .filter((tool) => tool.readOnly);

        for (const tool of readers) {
            expect(tool.description).toMatch(/cannot approve/i);
        }
    });
});
