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
    /**
     * Ceiling on **one** `tools/call`, in milliseconds.
     *
     * The registry deliberately has no deadline of its own — `ToolContext.signal`
     * is documented as "a courtesy, never a correctness boundary" — so without
     * this the only thing bounding a tool call is the query underneath it. When
     * that blocks (a pool with no free connection, a database that went away),
     * an MCP request hangs until the *client* gives up, holding a socket, a
     * transport and a protocol server the whole time.
     *
     * The bound lives here rather than in the registry because it is a property
     * of the transport: a request/response exchange owes its caller an answer,
     * where the copilot's in-process loop has its own wall clock. Expiry is
     * reported as a model-readable `isError` result (`504` / `timeout`), so an
     * agent retries or narrows instead of stalling.
     *
     * **It abandons, it does not cancel.** The signal is passed to the handler,
     * but a tool that ignores it keeps running to completion with nobody
     * reading the answer. Bounding the *caller's* wait is the guarantee; ending
     * the work is not one this layer can make.
     */
    callTimeoutMs: number;
    /**
     * Ceiling on the serialised size of one tool result, in bytes.
     *
     * A result is emitted **twice** — pretty-printed as the text block a model
     * reads, and again as `structuredContent` for clients that parse it — and
     * the transport then serialises the whole response a third time. Peak
     * memory is therefore a multiple of the payload, per concurrent request,
     * and nothing in the tool catalogue caps how much a handler may return.
     *
     * Over the ceiling the call answers `413` / `result_too_large` naming the
     * two sizes, which is strictly more useful to a model than the payload
     * would have been: a result that does not fit here does not fit in its
     * context window either, and the message tells it to narrow the query.
     */
    maxResultBytes: number;
}
