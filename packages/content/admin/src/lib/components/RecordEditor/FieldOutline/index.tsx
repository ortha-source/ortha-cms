import { defineMessages, useIntl } from 'react-intl';
import type { FieldState } from '../../../hooks/useRecordEditor';
import { OutlineRow } from './OutlineRow';
import { ProblemsFirst } from './ProblemsFirst';

const messages = defineMessages({
    header: { id: 'content.record.outline.header', defaultMessage: 'Fields' },
    summary: {
        id: 'content.record.outline.summary',
        defaultMessage: '{filled} of {total}'
    }
});

/** Above this field count the outline switches to problems-first. */
const PROBLEMS_FIRST_THRESHOLD = 25;

/**
 * The left field outline: one clickable row per field (status dot + label), a
 * live active indicator that mirrors the form's scroll-spy, and a progress
 * summary that sits directly beneath the last row. For large schemas (>
 * {@link PROBLEMS_FIRST_THRESHOLD} fields) it flips to *problems-first*
 * ({@link ProblemsFirst}): required/invalid rows stay pinned and the rest fold
 * into collapsible groups. The whole column scrolls as one.
 */
export function FieldOutline({
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
    const problemsFirst = fieldStates.length > PROBLEMS_FIRST_THRESHOLD;

    return (
        <nav
            aria-label={intl.formatMessage(messages.header)}
            className="flex min-h-0 w-[212px] flex-none flex-col overflow-y-auto"
        >
            <p className="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {intl.formatMessage(messages.header)}
            </p>

            <div className="flex flex-col gap-0.5">
                {problemsFirst ? (
                    <ProblemsFirst
                        fieldStates={fieldStates}
                        activeKey={activeKey}
                        onJump={onJump}
                    />
                ) : (
                    fieldStates.map((state) => (
                        <OutlineRow
                            key={state.field.key}
                            state={state}
                            active={state.field.key === activeKey}
                            onJump={onJump}
                        />
                    ))
                )}
            </div>

            <footer className="mt-3 border-t pt-3">
                <div className="h-1 overflow-hidden rounded-full bg-secondary">
                    <div
                        className="h-full rounded-full bg-foreground transition-[width]"
                        style={{
                            width: `${
                                totalCount
                                    ? (filledCount / totalCount) * 100
                                    : 0
                            }%`
                        }}
                    />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    {intl.formatMessage(messages.summary, {
                        filled: filledCount,
                        total: totalCount
                    })}
                </p>
            </footer>
        </nav>
    );
}
