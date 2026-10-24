import { defineMessages, useIntl } from 'react-intl';
import { Rocket } from 'lucide-react';
import { Button, Input, Label } from '@orthacms/design-system';
import type { ApplyFlow } from '../../../../application/useApplyFlow';
import { ReadinessHint } from '../ReadinessHint';

const messages = defineMessages({
    migrationName: {
        id: 'schemaBuilder.changes.migrationName',
        defaultMessage: 'Migration name'
    },
    apply: {
        id: 'schemaBuilder.review.applyCount',
        defaultMessage:
            'Apply {count, plural, one {# change} other {# changes}}'
    }
});

/**
 * Apply, always in reach: a bar held at the foot of the page while the
 * changes scroll above it — what still blocks Apply, the migration's name
 * (suggested from the changes), and the one button that changes anything.
 */
export function ApplyBar({ flow }: { flow: ApplyFlow }) {
    const intl = useIntl();
    const plan = flow.plan.data;
    const ready = flow.readiness?.ok === true;
    return (
        <div className="sticky bottom-4 z-10 mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
            <div className="min-w-0 flex-1">
                <ReadinessHint
                    readiness={flow.readiness}
                    id="review-apply-hint"
                />
            </div>
            <div className="flex items-center gap-2">
                <Label htmlFor="migration-name" className="shrink-0">
                    {intl.formatMessage(messages.migrationName)}
                </Label>
                <Input
                    id="migration-name"
                    className="w-64 font-mono"
                    value={flow.migrationName}
                    onChange={(event) =>
                        flow.setMigrationName(event.target.value)
                    }
                />
            </div>
            <Button
                type="button"
                onClick={() => void flow.apply()}
                disabled={!ready}
                aria-describedby={ready ? undefined : 'review-apply-hint'}
            >
                <Rocket />
                {intl.formatMessage(messages.apply, {
                    count: plan?.changes.length ?? 0
                })}
            </Button>
        </div>
    );
}
