/** The steps of an apply, in order. */
export const APPLY_STEPS = ['generate', 'migrate', 'publish'] as const;
export type ApplyStep = (typeof APPLY_STEPS)[number];

/**
 * Where an apply stands. `interrupted` is what a `running` operation reads as
 * once the process that ran it is gone — a crash, or a restart mid-publish.
 */
export type ApplyStatus = 'running' | 'succeeded' | 'failed' | 'interrupted';

/** One apply, as `GET /schema-builder/operations/:id` answers it. */
export interface ApplyOperation {
    readonly id: string;
    readonly status: ApplyStatus;
    /** The step running now, or the one that failed; `null` once done. */
    readonly step: ApplyStep | null;
    /** Migration files the apply generated, relative to the migrations folder. */
    readonly migrations: readonly string[];
    /** Files under `src/content/` the apply wrote or deleted. */
    readonly files: readonly string[];
    /** Why it failed, with the error's stable code. */
    readonly error?: { readonly code: string; readonly message: string };
    /** The boot id of the process that ran it. */
    readonly bootId: string;
    readonly startedAt: string;
    readonly finishedAt?: string;
}

/** What `POST /schema-builder/apply` answers: where to follow it, and the boot id to wait past. */
export interface ApplyAccepted {
    readonly operationId: string;
    readonly bootId: string;
}
