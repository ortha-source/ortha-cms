/** Gives the lock back. */
export type ReleaseLock = () => Promise<void>;

/** [schema-builder:I-05] One apply at a time, across processes. */
export interface ApplyLock {
    /** Takes the lock, or throws `ApplyInProgressError` when someone holds it. */
    acquire(): Promise<ReleaseLock>;
}
