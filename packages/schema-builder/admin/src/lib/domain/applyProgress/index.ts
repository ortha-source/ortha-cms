import type { ApplyStep } from '@orthacms/schema-builder-domain';

/**
 * The steps the apply page shows: the server's own (`APPLY_STEPS` — generate,
 * migrate, publish), then the restart the page waits for, then ready.
 */
export const PROGRESS_STEPS = [
    'generate',
    'migrate',
    'publish',
    'restart',
    'ready'
] as const satisfies readonly (ApplyStep | 'restart' | 'ready')[];

export type ProgressStep = (typeof PROGRESS_STEPS)[number];

/** Where one step stands on the page. */
export type ProgressState = 'done' | 'current' | 'pending' | 'failed';

/**
 * An apply as the page follows it: the step running now, and when each step
 * was first seen and left, in ms. Times are what this tab observed while
 * polling — a step that ran between two polls was never seen running and has
 * no time, which is honest rather than a made-up zero.
 */
export type ApplyProgress = {
    readonly current: ProgressStep;
    readonly started: Partial<Record<ProgressStep, number>>;
    readonly ended: Partial<Record<ProgressStep, number>>;
    readonly failed: boolean;
};

const index = (step: ProgressStep) => PROGRESS_STEPS.indexOf(step);

/** An apply just sent: generating. */
export const startProgress = (now: number): ApplyProgress => ({
    current: 'generate',
    started: { generate: now },
    ended: {},
    failed: false
});

/**
 * Moves on to `to`: the current step ends now, any step in between ran
 * unseen, and `to` starts — or, for `ready`, is reached at once. Never moves
 * backwards; a poll repeating the current step changes nothing.
 */
export function advance(
    progress: ApplyProgress,
    to: ProgressStep,
    now: number
): ApplyProgress {
    if (index(to) <= index(progress.current) && to !== 'ready') return progress;
    if (progress.current === 'ready') return progress;
    return {
        current: to,
        started: { ...progress.started, [to]: now },
        ended: {
            ...progress.ended,
            [progress.current]: now,
            ...(to === 'ready' ? { ready: now } : {})
        },
        failed: false
    };
}

/** The apply stopped at `at` (the server's word for it), or at the step running. */
export const failProgress = (
    progress: ApplyProgress,
    at: ProgressStep | null,
    now: number
): ApplyProgress => ({
    ...(at && at !== progress.current ? advance(progress, at, now) : progress),
    failed: true
});

/** How long a step took, when this tab saw both its ends. */
export function stepDuration(
    progress: ApplyProgress,
    step: ProgressStep
): number | undefined {
    const start = progress.started[step];
    const end = progress.ended[step];
    return start !== undefined && end !== undefined && step !== 'ready'
        ? end - start
        : undefined;
}

/** A step's state on the page. */
export function stepState(
    progress: ApplyProgress,
    step: ProgressStep
): ProgressState {
    const at = index(progress.current);
    const here = index(step);
    if (here < at) return 'done';
    if (here > at) return 'pending';
    if (progress.failed) return 'failed';
    return progress.ended[step] !== undefined ? 'done' : 'current';
}
