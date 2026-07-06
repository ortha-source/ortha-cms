import { defineMessages, useIntl } from 'react-intl';
import type { FieldState } from '../../../hooks/useRecordEditor';
import { OutlineRow } from './OutlineRow';
import { ProblemsFirst } from './ProblemsFirst';

const messages = defineMessages({
    header: { id: 'content.record.outline.header', defaultMessage: 'Fields' },
    summaryRequired: {
        id: 'content.record.outline.summaryRequired',
        defaultMessage: '{filled} of {total} · {count} required'
    },
    summaryReady: {
        id: 'content.record.outline.summaryReady',
        defaultMessage: '{filled} of {total} · ready'
    }
});

/** Above this field count the outline switches to problems-first. */
const PROBLEMS_FIRST_THRESHOLD = 25;

/**
 * The left field outline: one clickable row per field (status dot + label), a
 * live active indicator that mirrors the form's scroll-spy, and a progress
 * footer. For large schemas (> {@link PROBLEMS_FIRST_THRESHOLD} fields) it flips
 * to *problems-first* ({@link ProblemsFirst}): required/invalid rows stay pinned
 * and the rest fold into collapsible groups.
 */
export function FieldOutline({
    fieldStates,
    activeKey,
    filledCount,
    totalCount,
    requiredRemaining,
    onJump
}: {
    fieldStates: FieldState[];
    activeKey?: string;
    filledCount: number;
    totalCount: number;
    requiredRemaining: number;
    onJump: (key: string) => void;
}) {
    const intl = useIntl();
    const problemsFirst = fieldStates.length > PROBLEMS_FIRST_THRESHOLD;

    return (
        <nav
            aria-label={intl.formatMessage(messages.header)}
            className="flex min-h-0 w-[212px] flex-none flex-col"
        >
            <p className="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {intl.formatMessage(messages.header)}
            </p>

            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
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
                    {intl.formatMessage(
                        requiredRemaining > 0
                            ? messages.summaryRequired
                            : messages.summaryReady,
                        {
                            filled: filledCount,
                            total: totalCount,
                            count: requiredRemaining
                        }
                    )}
                </p>
            </footer>
        </nav>
    );
}
