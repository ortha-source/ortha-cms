/**
 * A JSON Schema document describing a tool's input. Kept structural on
 * purpose: the copilot generates these from the content-type registry, and
 * `domain/` must not take a dependency on a schema library to hold one.
 */
export type JsonSchema = Readonly<Record<string, unknown>>;

/**
 * One capability the model may request. This is the **provider-facing** tool
 * shape — a name, a description and an input schema, which is all any wire
 * format needs. The richer `ToolSpec` (permissions, effect, `run`) belongs to
 * the copilot's tool port and lands with the run engine.
 */
export interface ModelTool {
    /** Namespaced tool name, e.g. `admin_content_search`. */
    name: string;
    /** Shown to the model — the primary signal for when to call it. */
    description: string;
    /** JSON Schema the model's arguments must satisfy. */
    inputSchema: JsonSchema;
}

/** Plain assistant or user prose. */
export interface TextBlock {
    type: 'text';
    /** The prose itself. */
    text: string;
}

/** The model asking for a tool to run. */
export interface ToolUseBlock {
    type: 'tool_use';
    /** Provider-assigned id; the matching {@link ToolResultBlock} echoes it. */
    id: string;
    /** The requested tool's {@link ModelTool.name}. */
    name: string;
    /** Arguments, already parsed from the wire format. */
    input: unknown;
}

/**
 * What a tool returned, fed back on the next turn. Content is **untrusted
 * data**, never instructions ([ADR-0005](../../../../../docs/adr/0005-copilot-authority-model.md) §8) —
 * the engine fences it before it reaches the model.
 */
export interface ToolResultBlock {
    type: 'tool_result';
    /** The {@link ToolUseBlock.id} this answers. */
    toolUseId: string;
    /** Serialized result, or the error message when {@link isError}. */
    content: string;
    /** Marks a failed call, so the model can recover instead of retrying blind. */
    isError?: boolean;
}

/** One block of a message's content. */
export type ModelContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

/**
 * One turn of the conversation. There is deliberately no `system` role — the
 * system prompt is a separate field on {@link ModelRequest}, because the two
 * wire formats we target place it differently.
 */
export interface ModelMessage {
    /** Who produced the turn. Tool results ride on a `user` turn. */
    role: 'user' | 'assistant';
    /** The turn's content blocks, in order. */
    content: readonly ModelContentBlock[];
}
