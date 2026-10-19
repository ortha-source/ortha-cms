import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type { UsageMeterState } from '../../application/usageMeter';

const messages = defineMessages({
    label: {
        id: 'copilot.usage.label',
        defaultMessage: 'Today’s Ortha CMS AI usage'
    },
    spent: {
        id: 'copilot.usage.spent',
        defaultMessage: '{used} of {limit} tokens today'
    },
    remaining: {
        id: 'copilot.usage.remaining',
        defaultMessage: '{remaining} tokens left today'
    },
    exhausted: {
        id: 'copilot.usage.exhausted',
        defaultMessage: 'Today’s allowance is used up'
    },
    resets: {
        id: 'copilot.usage.resets',
        defaultMessage: 'resets at {time}'
    }
});

/** What {@link UsageMeter} needs. */
export interface UsageMeterProps {
    /** From `usageMeterState`; the caller renders nothing for `null`. */
    state: UsageMeterState;
}

/**
 * The thin bar under the composer: today's spend against the user's daily
 * quota, and when it resets.
 *
 * A `meter`, not a `progressbar` — it measures a quantity within a range
 * rather than a task's progress — named, and with `aria-valuetext` in words,
 * because "1240000" is not what anyone wants read aloud. It is **not** a live
 * region: it changes after every run, and announcing that would talk over the
 * answer. The one change that has to be heard — "you cannot send" — is said by
 * the composer's own hint line, which is.
 *
 * Colour follows the level (primary, warning, destructive) and the text says
 * the same thing in words, so the state never rests on colour alone. With only
 * a workspace quota there is no figure to draw a bar from; the line alone
 * says it is spent.
 */
export function UsageMeter({ state }: UsageMeterProps) {
    const intl = useIntl();
    const compact = (value: number) =>
        intl.formatNumber(value, {
            notation: 'compact',
            maximumFractionDigits: 1
        });
    const time = intl.formatTime(state.resetsAt, {
        hour: 'numeric',
        minute: '2-digit'
    });
    const text =
        state.level === 'exhausted'
            ? intl.formatMessage(messages.exhausted)
            : state.level === 'warning' && state.remaining !== null
              ? intl.formatMessage(messages.remaining, {
                    remaining: compact(state.remaining)
                })
              : state.used !== null && state.limit !== null
                ? intl.formatMessage(messages.spent, {
                      used: compact(state.used),
                      limit: compact(state.limit)
                  })
                : '';
    const fill =
        state.level === 'exhausted'
            ? 'bg-destructive'
            : state.level === 'warning'
              ? 'bg-warning'
              : 'bg-primary';

    return (
        <div className="mt-2 space-y-1">
            {state.used !== null && state.limit !== null ? (
                <div
                    role="meter"
                    aria-label={intl.formatMessage(messages.label)}
                    aria-valuemin={0}
                    aria-valuemax={state.limit}
                    aria-valuenow={Math.min(state.used, state.limit)}
                    aria-valuetext={text}
                    className="bg-muted h-1 overflow-hidden rounded-full"
                >
                    <div
                        className={cn('h-full rounded-full', fill)}
                        style={{ width: `${state.fraction * 100}%` }}
                    />
                </div>
            ) : null}
            <p className="text-muted-foreground flex flex-wrap gap-x-1 text-[11px]">
                <span
                    className={cn(
                        state.level !== 'normal' &&
                            'text-foreground font-medium'
                    )}
                >
                    {text}
                </span>
                <span>· {intl.formatMessage(messages.resets, { time })}</span>
            </p>
        </div>
    );
}
