import { forwardRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowLeft } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
    WizardFooter
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
    doneTitle: {
        id: 'schemaBuilder.apply.doneTitle',
        defaultMessage: 'Applied'
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
    backToReview: {
        id: 'schemaBuilder.apply.backToReview',
        defaultMessage: 'Back to the review'
    },
    finish: {
        id: 'schemaBuilder.apply.finish',
        defaultMessage: 'Back to the content model'
    }
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
    stage: Exclude<ApplyStage, 'idle'>;
    failure: ApplyFailure | null;
    /** After a failure: back to the steps, with the draft as it was. */
    onDismiss: () => void;
    /** After success: back to the editor. */
    onFinish: () => void;
};

/**
 * The review card once Apply is pressed. Real progress, not a skeleton: the
 * three steps of an apply in one `role="status"`, so each is announced as it
 * starts. A failure is an alert of its own and says the draft is safe.
 */
export const ApplyProgress = forwardRef<HTMLHeadingElement, Props>(
    function ApplyProgress({ stage, failure, onDismiss, onFinish }, ref) {
        const intl = useIntl();
        const at = POSITION[stage];
        const label = (step: (typeof ORDER)[number]) =>
            intl.formatMessage(
                step === 'restarting' && stage === 'manual'
                    ? messages.manual
                    : messages[step]
            );
        const state = (index: number): StepState =>
            stage === 'done' || index < at
                ? 'done'
                : index === at
                  ? 'current'
                  : 'pending';
        return (
            <>
                <CardHeader>
                    <CardTitle asChild>
                        <h2
                            ref={ref}
                            tabIndex={-1}
                            className="focus-visible:outline-none"
                        >
                            {intl.formatMessage(
                                stage === 'done'
                                    ? messages.doneTitle
                                    : messages.title
                            )}
                        </h2>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {stage === 'failed' ? (
                        <Alert variant="destructive" role="alert">
                            <AlertTitle>
                                {intl.formatMessage(messages.failedTitle)}
                            </AlertTitle>
                            <AlertDescription>
                                {intl.formatMessage(messages.failedBody, {
                                    message: failure?.message ?? ''
                                })}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div role="status">
                            <ol className="flex flex-col gap-3">
                                {ORDER.map((step, index) => (
                                    <ApplyStep
                                        key={step}
                                        label={label(step)}
                                        state={state(index)}
                                    />
                                ))}
                            </ol>
                        </div>
                    )}
                </CardContent>
                {(stage === 'failed' || stage === 'done') && (
                    <CardFooter>
                        <WizardFooter
                            primary={
                                stage === 'failed' ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={onDismiss}
                                    >
                                        <ArrowLeft />
                                        {intl.formatMessage(
                                            messages.backToReview
                                        )}
                                    </Button>
                                ) : (
                                    <Button type="button" onClick={onFinish}>
                                        {intl.formatMessage(messages.finish)}
                                    </Button>
                                )
                            }
                        />
                    </CardFooter>
                )}
            </>
        );
    }
);
