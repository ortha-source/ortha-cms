/** One OpenAI-shaped chat message. */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
    tool_calls?: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
    }[];
}

/** A tool-call fragment as it arrives on the stream, keyed by `index`. */
export interface ToolCallDelta {
    index: number;
    id?: string;
    function?: { name?: string; arguments?: string };
}

/** The subset of the streaming chat-completions chunk this adapter reads. */
export interface ChatCompletionChunk {
    choices?: {
        delta?: {
            content?: string | null;
            tool_calls?: ToolCallDelta[];
        };
        finish_reason?: string | null;
    }[];
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
    } | null;
}
