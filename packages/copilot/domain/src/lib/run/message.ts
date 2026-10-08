/**
 * Longest message one turn may carry, in characters. Bounds the prompt before
 * the model bounds it: past this the request is a `400` and no provider is
 * called, so an oversized paste costs nothing.
 *
 * Here rather than beside the DTO because two places have to agree on it. The
 * server's `CreateRunDto` enforces it; the admin composer counts against it and
 * refuses to send past it — without the shared number the box let anything
 * through and the person met the server's validation sentence under "Something
 * went wrong", which reads as a crash rather than as "too long".
 *
 * 32,000 rather than the 8,000 it started at, which was a page or two of text
 * and too little for the thing people actually paste — an article to rewrite,
 * a brief to turn into entries. It is still a ceiling, because the message is
 * re-sent on **every** model call of the run and so is paid against
 * `DEFAULT_RUN_LIMITS.maxTotalTokens` once per step: at roughly 8–12k tokens,
 * a message this size leaves a long run room to work, where an unbounded one
 * would spend the budget on its own repetition.
 */
export const MAX_MESSAGE_LENGTH = 32_000;
