/** How a poller waits; injected so specs need no timers. */
export type Sleep = (ms: number) => Promise<void>;

/** Real waiting. */
export const sleep: Sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

/** Poll timing. */
export type PollOptions = {
    readonly intervalMs?: number;
    readonly timeoutMs?: number;
    readonly sleep?: Sleep;
};
