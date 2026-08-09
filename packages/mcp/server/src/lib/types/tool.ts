import type { PermissionKey } from '@ortha-cms/identity-server';

/**
 * A JSON Schema fragment. Tools declare their input shape as **plain JSON
 * Schema** rather than a validator's object model, because most of this CMS's
 * schema is runtime data — content types are defined in code and held in a
 * registry, so their shapes are computed at boot, not declared as classes.
 * `content/server`'s `docs/field-schema.ts` already produces exactly this for
 * the OpenAPI document; the MCP tool schemas reuse it.
 */
export type JsonSchema = Record<string, unknown>;

/** Who a tool call acts as. */
export type ToolActorKind = 'token' | 'user';

/**
 * The identity a tool call runs under — the transport-neutral half of "who is
 * asking". A bearer API token from the public API and a signed-in admin user
 * driving the copilot are the same shape here, which is what lets one tool
 * implementation serve both callers.
 *
 * `grantedPermissions` is resolved by whoever built the context (the MCP
 * endpoint's bearer auth, or the copilot's RBAC lookup) and is the **only**
 * input to the authorization decision — a tool never re-derives rights from
 * `id` or `userId`.
 */
export interface ToolActor {
    /** Whether this is a bearer token acting as itself, or a signed-in user. */
    kind: ToolActorKind;
    /**
     * The actor's own id — a token id or a user id. What a log line keys on.
     * For a token this is deliberately **not** the minting user: a token acts
     * as itself, so revoking it revokes its access whoever created it.
     */
    id: string;
    /** Display name, for diagnostics and audit lines. */
    displayName: string;
    /** The `resource:action` keys this actor holds. */
    grantedPermissions: ReadonlySet<string>;
    /**
     * The accountable human, when there is one — the user themselves, or the
     * user who minted a token. **Attribution only, never authorization.**
     */
    userId: string | null;
}

/**
 * Everything a tool handler is told about the call, beyond its own arguments.
 * Framework-free by design: no request, no response, nothing HTTP. A tool
 * written against this runs identically behind the MCP endpoint and inside the
 * copilot's in-process tool loop.
 */
export interface ToolContext {
    /** Who is calling. */
    actor: ToolActor;
    /** The workspace this call acts in — always resolved before dispatch. */
    workspaceId: string;
    /**
     * Whether the actor holds a permission. Handlers use this for decisions
     * **finer** than the tool's own `requires` gate — e.g. content reads let a
     * writer see drafts, which is a widening inside one tool rather than a
     * separate tool.
     */
    can(permission: PermissionKey): boolean;
}

/**
 * What a tool returns. A plain JSON-serializable value — the transport decides
 * how to present it (MCP wraps it as `structuredContent` plus a text rendering;
 * the copilot's loop will feed it back to the model as a tool result).
 */
export type ToolOutput = unknown;

/**
 * One callable tool. The unit every consumer of the registry sees.
 *
 * `requires` is the authorization contract and is enforced **centrally** by
 * {@link ToolRegistry.call}, exactly as `@RequirePermissions(...)` is enforced
 * by a guard on the HTTP routes — a handler never checks its own gate, so a new
 * tool cannot forget to. It is the direct analogue of the decorator, and the
 * reason a `read`-scoped token gets a refusal on every write tool without a
 * line of code here saying so.
 */
export interface ToolDefinition {
    /**
     * Machine name, `snake_case`, unique across every provider. Namespaced by
     * subject (`content_list`, `content_create`) so a second contributing
     * plugin's tools cannot read as the first's.
     */
    name: string;
    /** Short human title, shown by MCP clients in tool pickers. */
    title: string;
    /**
     * What the tool does, written **for a model**. This is the only
     * documentation the caller gets, so it carries the workflow rules the HTTP
     * API states in prose: that a create yields a draft, that publish is a
     * separate call, that an update merges.
     */
    description: string;
    /** JSON Schema for the arguments object. */
    inputSchema: JsonSchema;
    /**
     * Permissions the actor must hold — **all** of them. Checked before the
     * handler runs, and used to hide the tool from actors who cannot call it.
     */
    requires: readonly PermissionKey[];
    /**
     * True when the tool cannot modify anything. Surfaces as MCP's
     * `readOnlyHint`, which clients use to decide what to auto-approve.
     */
    readOnly: boolean;
    /**
     * True when the tool can destroy data an actor would not get back.
     * Surfaces as MCP's `destructiveHint`.
     */
    destructive?: boolean;
    /** Runs the tool. Throws to signal failure; see `toToolError`. */
    handler(
        input: Record<string, unknown>,
        context: ToolContext
    ): Promise<ToolOutput>;
}

/** One readable resource — a document a client can pull in without a call. */
export interface ResourceDefinition {
    /** Stable URI, e.g. `ortha://content-type/article`. */
    uri: string;
    /** Short human name. */
    name: string;
    /** What the resource holds. */
    description: string;
    /** MIME type of the contents, e.g. `application/json`. */
    mimeType: string;
}

/** The body of a resource read. */
export interface ResourceContents {
    /** Echoes the requested URI. */
    uri: string;
    /** MIME type of {@link text}. */
    mimeType: string;
    /** The resource body. */
    text: string;
}
