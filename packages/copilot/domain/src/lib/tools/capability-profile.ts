import type { ToolPermissionKey, ToolSpec } from './tool-spec';

/**
 * The acting user, reduced to what an authority decision needs. Structurally
 * identical to identity's `Actor` on purpose — the server maps one to the other
 * so this package can stay import-free while the decision still runs off the
 * grants `PermissionsService.forRole` resolved.
 */
export interface CopilotActor {
    /** The acting user's id. */
    userId: string;
    /** The `resource:action` keys the actor's role grants. */
    grantedPermissions: ReadonlySet<ToolPermissionKey>;
}

/**
 * The workspace's copilot policy — the opt-ins an admin makes per workspace
 * ([ADR-0005](../../../../../docs/adr/0005-copilot-authority-model.md) §6, §10).
 */
export interface WorkspaceCopilotPolicy {
    /**
     * Tool names allowed to write **directly** instead of producing a
     * proposal. Empty by default: a team opts a specific low-risk tool in, and
     * never opts in wholesale — there is deliberately no `all` switch.
     */
    autoApplyTools?: readonly string[];
}

/** Why a declared tool is not on offer for this run. */
export type WithheldReason =
    /** The caller lacks at least one of the tool's declared permissions. */
    | 'missing-permission'
    /** An `apply` tool the workspace policy has not opted into. */
    | 'apply-not-enabled'
    /** A later tool re-declared a name an earlier one already took. */
    | 'duplicate-name';

/** One tool that was declared but not offered, and the reason. */
export interface WithheldTool {
    /** The tool's name. */
    name: string;
    /** Why it was withheld. */
    reason: WithheldReason;
    /**
     * The permissions the caller was missing. Present only for
     * `missing-permission`, and used to explain the gap — never to the model,
     * which is not told the tool exists at all.
     */
    missing?: readonly ToolPermissionKey[];
}

/**
 * The tools one run may use, and what was left out.
 *
 * Recomputed per run and **never cached across a conversation** (ADR-0005 §2):
 * permissions can be revoked mid-thread, and a long chat must not carry stale
 * authority.
 */
export interface CapabilityProfile {
    /** The tools offered to the model, in declaration order. */
    tools: readonly ToolSpec[];
    /** What was declared but withheld, for logging and for the settings UI. */
    withheld: readonly WithheldTool[];
}

/** Inputs to {@link resolveCapabilityProfile}. */
export interface ResolveCapabilityProfileInput {
    /** Every tool the bound providers declared for this workspace. */
    tools: readonly ToolSpec[];
    /** The user the run acts as. */
    actor: CopilotActor;
    /** The workspace's copilot policy, if any. */
    policy?: WorkspaceCopilotPolicy;
}

/** The permissions `actor` is missing from `required`, in declaration order. */
function missingPermissions(
    actor: CopilotActor,
    required: readonly ToolPermissionKey[]
): ToolPermissionKey[] {
    return required.filter((key) => !actor.grantedPermissions.has(key));
}

/**
 * Derives the tool set a run may use — the **offer**-time gate, which
 * [ADR-0005](../../../../../docs/adr/0005-copilot-authority-model.md) §3 is
 * explicit is not an optimisation: a tool the model was never told about
 * cannot be requested, argued into existence, or refused at token cost.
 * Execution re-checks the same permissions against a freshly resolved session.
 *
 * Pure and total — no I/O, no clock — so "a viewer is offered no write tools"
 * is a unit test rather than a promise.
 */
export function resolveCapabilityProfile(
    input: ResolveCapabilityProfileInput
): CapabilityProfile {
    const autoApply = new Set(input.policy?.autoApplyTools ?? []);
    const tools: ToolSpec[] = [];
    const withheld: WithheldTool[] = [];
    const claimed = new Set<string>();

    for (const tool of input.tools) {
        // First declaration of a name wins. A later one is dropped rather than
        // allowed to shadow it: MCP tools are namespaced precisely so they
        // cannot impersonate a native tool (ADR-0005 §8), and silently letting
        // the last registration win would undo that.
        if (claimed.has(tool.name)) {
            withheld.push({ name: tool.name, reason: 'duplicate-name' });
            continue;
        }
        claimed.add(tool.name);

        const missing = missingPermissions(input.actor, tool.permissions);
        if (missing.length > 0) {
            withheld.push({
                name: tool.name,
                reason: 'missing-permission',
                missing
            });
            continue;
        }

        // Holding the permission is necessary but not sufficient for a direct
        // write: `apply` additionally needs the workspace to have opted this
        // specific tool in. `propose` needs no opt-in — its output is a
        // reviewable change, not an effect.
        if (tool.effect === 'apply' && !autoApply.has(tool.name)) {
            withheld.push({ name: tool.name, reason: 'apply-not-enabled' });
            continue;
        }

        tools.push(tool);
    }

    return { tools, withheld };
}
