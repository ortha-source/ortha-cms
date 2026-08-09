/** Runtime configuration for the MCP plugin. */
export interface McpPluginConfig {
    /**
     * Whether the MCP endpoint is mounted at all.
     *
     * **Off by default.** The endpoint hands an external agent the same content
     * CRUD a `full`-scope token has, and an operator who has not thought about
     * that should not have it exposed because they upgraded. The same reasoning
     * — and the same default — as the copilot's kill switch (ADR-0005 §10).
     */
    enabled: boolean;
    /** Server name reported to MCP clients during `initialize`. */
    name: string;
    /** Server version reported to MCP clients. */
    version: string;
}
