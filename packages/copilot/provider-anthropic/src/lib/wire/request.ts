import type Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import type {
    ModelMessage,
    ModelRequest,
    ModelTool
} from '@ortha-cms/copilot-domain';
import type { AnthropicProviderConfig } from '../config';

/**
 * The body `messages.stream` accepts, derived from the method rather than
 * imported by name — the SDK moves these aliases between barrels across
 * releases, and the method signature is the thing we actually have to satisfy.
 */
type StreamParams = Parameters<Anthropic['messages']['stream']>[0];

/** Maps the port's tool descriptors onto Anthropic's tool definitions. */
export function toAnthropicTools(tools: readonly ModelTool[]): Tool[] {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Tool.InputSchema
    }));
}

/** Maps the port's block-structured turns onto Anthropic's message params. */
export function toAnthropicMessages(
    messages: readonly ModelMessage[]
): MessageParam[] {
    return messages.map((message) => ({
        role: message.role,
        content: message.content.map((block) => {
            switch (block.type) {
                case 'text':
                    return { type: 'text' as const, text: block.text };
                case 'tool_use':
                    return {
                        type: 'tool_use' as const,
                        id: block.id,
                        name: block.name,
                        input: block.input
                    };
                case 'tool_result':
                    return {
                        type: 'tool_result' as const,
                        tool_use_id: block.toolUseId,
                        content: block.content,
                        ...(block.isError ? { is_error: true } : {})
                    };
            }
        })
    }));
}

/**
 * Builds the streaming request body.
 *
 * **No `thinking` configuration is sent**, deliberately. On current models
 * thinking is on by default, and turning it off makes them occasionally write
 * a tool call into the *visible text* instead of emitting a tool-use block —
 * the call then silently never runs, which for a tool-driven copilot is the
 * worst available failure mode. The lever for cheaper runs is `config.effort`.
 *
 * No sampling parameters either: current models reject `temperature`, `top_p`
 * and `top_k` outright, which is why the port never carried them.
 */
export function toStreamParams(
    request: ModelRequest,
    config: AnthropicProviderConfig
): StreamParams {
    const tools = request.tools ?? [];
    return {
        model: request.model ?? config.model,
        max_tokens: request.maxOutputTokens,
        ...(request.system ? { system: request.system } : {}),
        messages: toAnthropicMessages(request.messages),
        ...(tools.length > 0 ? { tools: toAnthropicTools(tools) } : {}),
        ...(config.effort ? { output_config: { effort: config.effort } } : {})
    };
}
