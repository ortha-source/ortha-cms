import type { CopilotLimitRefusal } from '@orthacms/copilot-domain';

/**
 * Thrown when a usage limit refuses a run before it starts.
 *
 * Transport-agnostic: it carries the refusal, and the run controller turns it
 * into a `429` with `Retry-After` — before the stream opens, so the refusal is
 * a status code a client can branch on rather than a frame inside a `200`.
 */
export class CopilotLimitError extends Error {
    constructor(readonly refusal: CopilotLimitRefusal) {
        super(`Copilot usage limit: ${refusal.code} (${refusal.scope}).`);
        this.name = 'CopilotLimitError';
    }
}
