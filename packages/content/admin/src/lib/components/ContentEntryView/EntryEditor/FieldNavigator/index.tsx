import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import type { FieldState } from '../../../../hooks/useRecordEditor';

const messages = defineMessages({
    title: { id: 'content.editor.navTitle', defaultMessage: 'Fields' },
    summary: {
        id: 'content.editor.navSummary',
        defaultMessage: '{filled} of {total} filled'
    }
});

/**
 * The record editor's left field navigation: a completion **progress ring**
 * header over a clean field list. Each row carries a status dot (filled / empty
 * / blocking) and its label; the active row (kept in sync with the form's
 * scroll-spy) reads selected. Clicking a row jumps to + focuses that field, and
 * ⌘J still opens the searchable palette.
 */
export function FieldNavigator({
    fieldStates,
    activeKey,
    filledCount,
    totalCount,
    onJump
}: {
    fieldStates: FieldState[];
    activeKey?: string;
    filledCount: number;
    totalCount: number;
    onJump: (key: string) => void;
}) {
    const intl = useIntl();
    const pct = totalCount ? Math.round((filledCount / totalCount) * 100) : 0;

    return (
        <nav
            aria-label={intl.formatMessage(messages.title)}
            className="hidden w-[212px] flex-none flex-col overflow-y-auto lg:flex"
        >
            <div className="flex items-center gap-3 px-1">
                <div className="relative size-11 shrink-0">
                    <svg viewBox="0 0 36 36" className="size-11 -rotate-90">
                        <circle
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            className="stroke-secondary"
                            strokeWidth="3"
                        />
                        <circle
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            pathLength={100}
                            strokeDasharray={`${pct} 100`}
                            strokeLinecap="round"
                            className="stroke-foreground transition-[stroke-dasharray]"
                            strokeWidth="3"
                        />
                    </svg>
                    <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">
                        {pct}%
                    </span>
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {intl.formatMessage(messages.title)}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                        {intl.formatMessage(messages.summary, {
                            filled: filledCount,
                            total: totalCount
                        })}
                    </p>
                </div>
            </div>

            <ol className="mt-4 flex flex-col gap-0.5">
                {fieldStates.map((state) => {
                    const active = state.field.key === activeKey;
                    return (
                        <li key={state.field.key}>
                            <button
                                type="button"
                                onClick={() => onJump(state.field.key)}
                                aria-current={active || undefined}
                                className={cn(
                                    'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-accent',
                                    active
                                        ? 'bg-accent font-medium text-foreground'
                                        : state.blocking
                                          ? 'text-destructive'
                                          : 'text-muted-foreground'
                                )}
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        'size-2 shrink-0 rounded-full',
                                        state.blocking
                                            ? 'bg-destructive'
                                            : state.filled
                                              ? 'bg-foreground'
                                              : 'border border-muted-foreground'
                                    )}
                                />
                                <span className="min-w-0 flex-1 truncate">
                                    {state.field.label}
                                </span>
                                {state.blocking ? (
                                    <span
                                        aria-hidden
                                        className="shrink-0 text-[11px] font-semibold"
                                    >
                                        !
                                    </span>
                                ) : null}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
