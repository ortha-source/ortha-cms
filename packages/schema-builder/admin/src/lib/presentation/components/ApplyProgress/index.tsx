import { useEffect, useRef } from 'react';
import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import { ArrowLeft } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Button,
    ContainerHeader
} from '@orthacms/design-system';
import type { ApplyFlow, ApplyStage } from '../../../application/useApplyFlow';
import {
    PROGRESS_STEPS,
    stepDuration,
    stepState,
    type ProgressStep
} from '../../../domain/applyProgress';
import { ApplyStep } from './ApplyStep';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.apply.titleCount',
        defaultMessage:
            'Applying {count, plural, one {# change} other {# changes}}'
    },
    subtitle: {
        id: 'schemaBuilder.apply.subtitle',
        defaultMessage:
            'Keep this tab open — it follows the server through its restart.'
    },
    generate: {
        id: 'schemaBuilder.apply.generate',
        defaultMessage: 'Generating the migration'
    },
    generateDetail: {
        id: 'schemaBuilder.apply.generateDetail',
        defaultMessage: 'drizzle-kit · {name}'
    },
    migrate: {
        id: 'schemaBuilder.apply.migrate',
        defaultMessage: 'Running the migration'
    },
    migrateDetail: {
        id: 'schemaBuilder.apply.migrateDetail',
        defaultMessage:
            '{count, plural, =0 {Nothing to run — only code changes} one {One transaction} other {# migrations, each in one transaction}}'
    },
    publish: {
        id: 'schemaBuilder.apply.publish',
        defaultMessage: 'Writing {count, plural, one {# file} other {# files}}'
    },
    restart: {
        id: 'schemaBuilder.apply.restart',
        defaultMessage: 'Restarting the server'
    },
    restartDetail: {
        id: 'schemaBuilder.apply.restartDetail',
        defaultMessage: 'Waiting for the new process to answer…'
    },
    manual: {
        id: 'schemaBuilder.apply.manual',
        defaultMessage: 'Restart the server to load the new content model'
    },
    manualDetail: {
        id: 'schemaBuilder.apply.manualDetail',
        defaultMessage:
            'This server does not restart itself. Restart it — this page carries on when it is back.'
    },
    ready: { id: 'schemaBuilder.apply.ready', defaultMessage: 'Ready' },
    readyDetail: {
        id: 'schemaBuilder.apply.readyDetail',
        defaultMessage: 'The new model is served'
    },
    watcherHint: {
        id: 'schemaBuilder.apply.watcherHint',
        defaultMessage:
            'Running without a file watcher? Restart the server yourself — this page carries on when it’s back.'
    },
    failedTitle: {
        id: 'schemaBuilder.apply.failedTitle',
        defaultMessage: 'The change was not applied'
    },
    failedBody: {
        id: 'schemaBuilder.apply.failedBody',
        defaultMessage:
            '{message} Your draft is still here; nothing in the database or src/content changed.'
    },
    backToReview: {
        id: 'schemaBuilder.apply.backToReview',
        defaultMessage: 'Back to the review'
    }
});

/**
 * A step's time as the page says it: tenths under ten seconds, and "<0.1s"
 * for a step this tab saw for less than that — never a flat "0s".
 */
export const formatSeconds = (intl: IntlShape, ms: number): string => {
    const seconds = (value: number) =>
        intl.formatNumber(value, {
            style: 'unit',
            unit: 'second',
            unitDisplay: 'narrow',
            maximumFractionDigits: value < 10 ? 1 : 0
        });
    return ms < 100 ? `<${seconds(0.1)}` : seconds(ms / 1000);
};

type Props = {
    flow: ApplyFlow;
    stage: Exclude<ApplyStage, 'idle' | 'done'>;
    /** After a failure: back to the review, with the draft as it was. */
    onDismiss: () => void;
};

/**
 * The page once Apply is pressed: real progress, not a skeleton. The
 * server's three steps, then the restart and ready, each with what it does
 * and how long this tab saw it take, one spinning — in one `role="status"`,
 * so each is announced as it starts. A failure stops at its step, says the
 * draft is safe, and leads back to the review.
 */
export function ApplyProgress({ flow, stage, onDismiss }: Props) {
    const intl = useIntl();
    const focusRef = useRef<HTMLDivElement>(null);
    // The Apply button that started this is gone; the page takes the focus.
    useEffect(() => focusRef.current?.focus(), []);
    const plan = flow.plan.data;
    const progress = flow.progress;
    const files = plan?.files ?? [];
    const manual = stage === 'manual';

    const copy: Record<ProgressStep, { title: string; detail?: string }> = {
        generate: {
            title: intl.formatMessage(messages.generate),
            detail: intl.formatMessage(messages.generateDetail, {
                name: flow.migrationName
            })
        },
        migrate: {
            title: intl.formatMessage(messages.migrate),
            detail: intl.formatMessage(messages.migrateDetail, {
                count: plan?.sql.length ?? 0
            })
        },
        publish: {
            title: intl.formatMessage(messages.publish, {
                count: files.length
            }),
            detail: files.map((file) => file.path).join(', ') || undefined
        },
        restart: {
            title: intl.formatMessage(
                manual ? messages.manual : messages.restart
            ),
            detail: intl.formatMessage(
                manual ? messages.manualDetail : messages.restartDetail
            )
        },
        ready: {
            title: intl.formatMessage(messages.ready),
            detail: intl.formatMessage(messages.readyDetail)
        }
    };

    return (
        <div ref={focusRef} tabIndex={-1} className="outline-none">
            <ContainerHeader
                title={intl.formatMessage(
                    stage === 'failed' ? messages.failedTitle : messages.title,
                    { count: plan?.changes.length ?? 0 }
                )}
                subtitle={
                    stage === 'failed'
                        ? undefined
                        : intl.formatMessage(messages.subtitle)
                }
            />
            <div className="flex flex-col gap-4">
                {stage === 'failed' && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>
                            {intl.formatMessage(messages.failedBody, {
                                message: flow.failure?.message ?? ''
                            })}
                        </AlertDescription>
                    </Alert>
                )}
                {progress && (
                    <div
                        role="status"
                        className="rounded-xl border bg-card p-5 shadow-xs"
                    >
                        <ol>
                            {PROGRESS_STEPS.map((step, index) => {
                                const time = stepDuration(progress, step);
                                return (
                                    <ApplyStep
                                        key={step}
                                        title={copy[step].title}
                                        detail={copy[step].detail}
                                        state={stepState(progress, step)}
                                        time={
                                            time === undefined
                                                ? undefined
                                                : formatSeconds(intl, time)
                                        }
                                        last={
                                            index === PROGRESS_STEPS.length - 1
                                        }
                                    />
                                );
                            })}
                        </ol>
                    </div>
                )}
                {stage === 'failed' ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="self-start"
                        onClick={onDismiss}
                    >
                        <ArrowLeft />
                        {intl.formatMessage(messages.backToReview)}
                    </Button>
                ) : (
                    stage === 'restarting' && (
                        <p className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.watcherHint)}
                        </p>
                    )
                )}
            </div>
        </div>
    );
}
