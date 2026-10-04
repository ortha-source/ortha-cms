import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Button
} from '@orthacms/design-system';
import type {
    ApplyFailure,
    ApplyStage
} from '../../../application/useApplyFlow';
import { ApplyStep, type StepState } from './ApplyStep';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.apply.title',
        defaultMessage: 'Applying the content model'
    },
    applying: {
        id: 'schemaBuilder.apply.applying',
        defaultMessage: 'Generating and running the migration'
    },
    restarting: {
        id: 'schemaBuilder.apply.restarting',
        defaultMessage: 'Waiting for the server to restart'
    },
    manual: {
        id: 'schemaBuilder.apply.manual',
        defaultMessage: 'Restart the server to load the new content model'
    },
    done: {
        id: 'schemaBuilder.apply.done',
        defaultMessage: 'The content model is live'
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
    close: { id: 'schemaBuilder.apply.close', defaultMessage: 'Close' }
});

const ORDER = ['applying', 'restarting', 'done'] as const;
const POSITION: Record<ApplyStage, number> = {
    idle: -1,
    applying: 0,
    restarting: 1,
    manual: 1,
    done: 3,
    failed: -1
};

type Props = {
    stage: ApplyStage;
    failure: ApplyFailure | null;
    onClose: () => void;
};

/**
 * Real progress, not a skeleton: the three steps of an apply in one
 * `role="status"`, so each step is announced as it starts. A failure is an
 * alert of its own, and says the draft is safe.
 */
export function ApplyProgress({ stage, failure, onClose }: Props) {
    const intl = useIntl();
    if (stage === 'idle') return null;
    if (stage === 'failed') {
        return (
            <Alert
                variant="destructive"
                role="alert"
                className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md shadow-lg"
            >
                <AlertTitle>
                    {intl.formatMessage(messages.failedTitle)}
                </AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                    {intl.formatMessage(messages.failedBody, {
                        message: failure?.message ?? ''
                    })}
                    <Button
                        size="sm"
                        variant="outline"
                        className="self-start"
                        onClick={onClose}
                    >
                        {intl.formatMessage(messages.close)}
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }
    const at = POSITION[stage];
    const label = (step: (typeof ORDER)[number]) =>
        intl.formatMessage(
            step === 'restarting' && stage === 'manual'
                ? messages.manual
                : messages[step]
        );
    const state = (index: number): StepState =>
        index < at ? 'done' : index === at ? 'current' : 'pending';
    return (
        <section
            aria-label={intl.formatMessage(messages.title)}
            className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-col gap-3 rounded-xl border bg-card p-4 shadow-lg"
        >
            <div role="status">
                <ol className="flex flex-col gap-2">
                    {ORDER.map((step, index) => (
                        <ApplyStep
                            key={step}
                            label={label(step)}
                            state={stage === 'done' ? 'done' : state(index)}
                        />
                    ))}
                </ol>
            </div>
            {stage === 'done' && (
                <Button
                    size="sm"
                    variant="outline"
                    className="self-end"
                    onClick={onClose}
                >
                    {intl.formatMessage(messages.close)}
                </Button>
            )}
        </section>
    );
}
