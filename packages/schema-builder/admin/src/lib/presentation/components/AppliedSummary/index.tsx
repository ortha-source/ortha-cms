import { useEffect, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { CircleCheck } from 'lucide-react';
import { Button, ContainerHeader } from '@orthacms/design-system';
import type { ApplyFlow } from '../../../application/useApplyFlow';
import { stepDuration } from '../../../domain/applyProgress';
import { formatSeconds } from '../ApplyProgress';
import type { ReviewType } from '../ChangesReview/ChangeGroup';
import { GrantNewTypes } from '../GrantNewTypes';

const messages = defineMessages({
    title: { id: 'schemaBuilder.apply.doneTitle', defaultMessage: 'Applied' },
    changes: {
        id: 'schemaBuilder.applied.changes',
        defaultMessage: '{count, plural, one {# change} other {# changes}}'
    },
    migration: {
        id: 'schemaBuilder.applied.migration',
        defaultMessage: 'migration {name}'
    },
    noMigration: {
        id: 'schemaBuilder.applied.noMigration',
        defaultMessage: 'no migration'
    },
    restarted: {
        id: 'schemaBuilder.applied.restarted',
        defaultMessage: 'server restarted in {time}'
    },
    open: {
        id: 'schemaBuilder.applied.open',
        defaultMessage: 'Open {type} in the model'
    },
    finish: {
        id: 'schemaBuilder.apply.finish',
        defaultMessage: 'Back to the Content Model'
    }
});

/** A migration file's name without its folder. */
const fileName = (path: string) => path.split('/').pop() ?? path;

type Props = {
    flow: ApplyFlow;
    typeOf: (name: string) => ReviewType | undefined;
    onFinish: () => void;
    onOpenType: (name: string) => void;
};

/**
 * The outcome, and the next decision on the same screen: what was applied —
 * how many changes, by which migration, how long the restart took — then,
 * when the apply created types, the offer to use them in workspaces, inline.
 * A created type is one click away; so is the model.
 */
export function AppliedSummary({ flow, typeOf, onFinish, onOpenType }: Props) {
    const intl = useIntl();
    const focusRef = useRef<HTMLDivElement>(null);
    useEffect(() => focusRef.current?.focus(), []);
    const applied = flow.applied;
    const restart = flow.progress
        ? stepDuration(flow.progress, 'restart')
        : undefined;
    const labels = flow.created.map((name) => typeOf(name)?.label ?? name);
    const facts = [
        applied &&
            intl.formatMessage(messages.changes, { count: applied.changes }),
        applied &&
            (applied.migrations.length > 0
                ? intl.formatMessage(messages.migration, {
                      name: applied.migrations.map(fileName).join(', ')
                  })
                : intl.formatMessage(messages.noMigration)),
        restart !== undefined &&
            intl.formatMessage(messages.restarted, {
                time: formatSeconds(intl, restart)
            })
    ].filter(Boolean);

    return (
        <div ref={focusRef} tabIndex={-1} className="outline-none">
            <ContainerHeader
                icon={<CircleCheck className="size-4 text-success" />}
                title={intl.formatMessage(messages.title)}
                subtitle={facts.join(' · ') || undefined}
            />
            <div className="flex flex-col gap-4">
                {flow.created.length > 0 && (
                    <GrantNewTypes types={flow.created} labels={labels} />
                )}
                <div className="flex flex-wrap gap-2">
                    {flow.created.length === 1 && (
                        <Button
                            variant="outline"
                            onClick={() => onOpenType(flow.created[0])}
                        >
                            {intl.formatMessage(messages.open, {
                                type: labels[0]
                            })}
                        </Button>
                    )}
                    <Button
                        variant={flow.created.length > 0 ? 'ghost' : 'default'}
                        onClick={onFinish}
                    >
                        {intl.formatMessage(messages.finish)}
                    </Button>
                </div>
            </div>
        </div>
    );
}
