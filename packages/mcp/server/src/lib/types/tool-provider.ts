import type {
    ResourceContents,
    ResourceDefinition,
    ToolContext,
    ToolDefinition
} from './tool';

/**
 * A plugin's contribution of tools (and optionally resources) to the shared
 * {@link ToolRegistry}.
 *
 * The **inversion** that keeps the package graph acyclic and this package free
 * of domain knowledge: `mcp/server` owns the protocol and knows nothing about
 * content, media, or users; each capability plugin implements this and
 * registers itself. `content/server` binds the first one. A plugin's tools can
 * therefore reach straight into its own internals — `PublicEntriesQuery`,
 * `PublicEntryWritesService` — instead of those having to be re-exported for an
 * outside package to drive, which is precisely how a second, drifting copy of
 * the visibility rules would get written.
 *
 * Registration is a **call**, not a DI multi-binding, because Nest has no
 * multi-provider token: a contributor injects the registry `@Optional()` and
 * registers itself in `onModuleInit`. Optional because MCP is a plugin — a
 * deployment that leaves it out must still boot, with its capability plugins
 * simply contributing nothing.
 */
export interface ToolProvider {
    /**
     * The tools this plugin contributes. Called once per `tools/list`, so it
     * may vary with runtime state (the content registry's types), but must not
     * be expensive or do I/O — permission filtering happens after it returns.
     */
    tools(): readonly ToolDefinition[];

    /**
     * Resources this plugin exposes to the calling actor, if any. Async and
     * context-taking because visibility is per-workspace: a content type the
     * workspace was not granted must not be listed.
     */
    resources?(context: ToolContext): Promise<readonly ResourceDefinition[]>;

    /**
     * Read one of this plugin's resources. Return `undefined` for a URI this
     * provider does not own, so the registry can try the next one.
     */
    readResource?(
        uri: string,
        context: ToolContext
    ): Promise<ResourceContents | undefined>;
}
