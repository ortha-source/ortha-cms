/**
 * What a tool call is allowed to do to the system.
 *
 * `read` runs freely; `propose` produces a reviewable change a human accepts;
 * `apply` writes directly and is off unless a workspace policy enables it
 * ([ADR-0005](../../../../../docs/adr/0005-copilot-authority-model.md) §6).
 * Phase 1 ships only `read` tools — the other two are declared here so the
 * profile can already refuse them rather than learning a new case later.
 */
export type ToolEffect = 'read' | 'propose' | 'apply';

/**
 * A `resource:action` permission key, as a plain string.
 *
 * Deliberately **not** imported from `@ortha-cms/identity-server`: this package
 * imports nothing, and the binder that declares a tool passes the real
 * `PERMISSIONS.*` constant, so the concrete union is still enforced at the one
 * place that matters — the tool declaration.
 */
export type ToolPermissionKey = string;

/**
 * Everything a tool needs to run inside the caller's authority, and nothing
 * more. A tool **cannot** execute outside a caller's scope even by mistake,
 * because there is no way to name another user or workspace from here.
 *
 * There is deliberately no unit of work yet. Phase 1's tools are all `read`,
 * and a transaction handle that nothing uses would be a seam we'd have to keep
 * honest for free. It joins when the first write tool lands (phase 3), where
 * the "audit in the same transaction as the effect" rule (ADR-0005 §9) makes
 * it load-bearing.
 */
export interface ToolContext {
    /** The user the run acts as. The copilot has no identity of its own. */
    userId: string;
    /** The workspace the run is scoped to; the caller is a confirmed member. */
    workspaceId: string;
    /** The run this call belongs to — recorded as provenance on every effect. */
    runId: string;
    /** The conversation the run belongs to. */
    conversationId: string;
    /**
     * Aborted when the client disconnects or a run limit trips, so a tool
     * doing real I/O can give up instead of finishing work nobody will read.
     */
    signal?: AbortSignal;
}

/**
 * One capability the copilot may invoke on the user's behalf.
 *
 * Tools are bound by the plugin that owns the logic they wrap — content tools
 * in `content/server`, media tools in `media/server` — so the copilot never
 * imports a feature plugin and never sits at the bottom of the package graph
 * ([`docs/design/copilot.md`](../../../../../docs/design/copilot.md) §4).
 */
export interface ToolSpec<I = unknown, O = unknown> {
    /** Namespaced name the model sees, e.g. `content.searchEntries`. */
    name: string;
    /** Shown to the model — the primary signal for when to call it. */
    description: string;
    /** JSON Schema the model's arguments must satisfy. */
    inputSchema: Readonly<Record<string, unknown>>;
    /**
     * Permission keys the caller must hold **in full**. An empty list means
     * the tool needs nothing beyond `copilot:use`, which the run route already
     * enforced — say so explicitly rather than leaving it implied.
     */
    permissions: readonly ToolPermissionKey[];
    /** What running this does to the system. */
    effect: ToolEffect;
    /** Runs the tool. Throwing yields a tool error the model can recover from. */
    run(input: I, ctx: ToolContext): Promise<O>;
}
