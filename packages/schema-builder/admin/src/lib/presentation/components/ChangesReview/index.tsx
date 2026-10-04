import { useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { ArrowLeft, Blocks } from 'lucide-react';
import {
    Container,
    ContainerHeader,
    Stepper,
    WizardStepCard
} from '@orthacms/design-system';
import { PageTopBar } from '@orthacms/shell-admin';
import type { ApplyFlow } from '../../../application/useApplyFlow';
import { ApplyProgress } from '../ApplyProgress';
import { ChangesStep } from './ChangesStep';
import { ConfirmStep } from './ConfirmStep';
import { PreviewStep } from './PreviewStep';

const messages = defineMessages({
    crumb: { id: 'schemaBuilder.page.title', defaultMessage: 'Content Model' },
    title: {
        id: 'schemaBuilder.review.title',
        defaultMessage: 'Review changes'
    },
    subtitle: {
        id: 'schemaBuilder.review.subtitle',
        defaultMessage:
            'What applying your draft will do, in three steps. Nothing changes until you press Apply.'
    },
    back: {
        id: 'schemaBuilder.review.backToModel',
        defaultMessage: 'Back to the Content Model'
    },
    stepChanges: {
        id: 'schemaBuilder.review.stepChanges',
        defaultMessage: 'Changes'
    },
    stepChangesHint: {
        id: 'schemaBuilder.review.stepChangesHint',
        defaultMessage: 'What changes, and how risky'
    },
    stepPreview: {
        id: 'schemaBuilder.review.stepPreview',
        defaultMessage: 'Files and SQL'
    },
    stepPreviewHint: {
        id: 'schemaBuilder.review.stepPreviewHint',
        defaultMessage: 'What gets written and run'
    },
    stepApply: {
        id: 'schemaBuilder.review.stepApply',
        defaultMessage: 'Apply'
    },
    stepApplyHint: {
        id: 'schemaBuilder.review.stepApplyHint',
        defaultMessage: 'Name the migration, then apply'
    },
    changesSummary: {
        id: 'schemaBuilder.review.changesSummary',
        defaultMessage: '{count, plural, one {# change} other {# changes}}'
    },
    filesSummary: {
        id: 'schemaBuilder.review.filesSummary',
        defaultMessage: '{count, plural, one {# file} other {# files}}'
    },
    stepLabel: {
        id: 'schemaBuilder.review.stepLabel',
        defaultMessage: 'Step {number}: {label}'
    },
    announcement: {
        id: 'schemaBuilder.review.announcement',
        defaultMessage: 'Step {number} of {total}: {label}'
    }
});

type Props = {
    flow: ApplyFlow;
    /** The editor's URL — where "back" goes, with the draft intact. */
    editorHref: string;
    /** Leaves the review after a successful apply. */
    onFinish: () => void;
};

/**
 * The review as a page with steps, in the shape of the other wizards (a new
 * workspace, an invitation): the stepper rail on the left, one step card on
 * the right. Changes → files and SQL → apply. Once Apply is pressed the card
 * becomes the apply's progress, then its outcome. It is a state of the
 * content model page (`?review`), not a route of its own, so the draft it
 * reviews is the editor's — the browser's Back returns to it unchanged.
 */
export function ChangesReview({ flow, editorHref, onFinish }: Props) {
    const intl = useIntl();
    const [step, setStep] = useState(1);
    const [maxReached, setMaxReached] = useState(1);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const plan = flow.plan.data;

    const go = (next: number) => {
        setStep(next);
        setMaxReached((reached) => Math.max(reached, next));
    };

    // The card remounts on every step and once when the apply starts, which
    // replays its entrance and drops focus; put it on the new heading. Not on
    // first paint — moving focus unasked is its own bug. The apply's own
    // stages are announced by its status region, not by moving focus.
    const position = flow.stage === 'idle' ? `step:${step}` : 'apply';
    const previous = useRef(position);
    useEffect(() => {
        if (previous.current === position) return;
        previous.current = position;
        headingRef.current?.focus();
    }, [position]);

    const steps = [
        {
            label: intl.formatMessage(messages.stepChanges),
            hint: intl.formatMessage(messages.stepChangesHint),
            summary: plan
                ? intl.formatMessage(messages.changesSummary, {
                      count: plan.changes.length
                  })
                : undefined
        },
        {
            label: intl.formatMessage(messages.stepPreview),
            hint: intl.formatMessage(messages.stepPreviewHint),
            summary:
                plan && maxReached > 2
                    ? intl.formatMessage(messages.filesSummary, {
                          count: plan.files.length
                      })
                    : undefined
        },
        {
            label: intl.formatMessage(messages.stepApply),
            hint: intl.formatMessage(messages.stepApplyHint)
        }
    ];
    const applying = flow.stage !== 'idle';

    return (
        <>
            <PageTopBar
                icon={Blocks}
                crumbs={[
                    {
                        key: 'content-model',
                        label: intl.formatMessage(messages.crumb)
                    },
                    { key: 'review', label: intl.formatMessage(messages.title) }
                ]}
            />
            <Container className="max-w-[1040px]">
                {!applying && (
                    // The draft travels with the page; going back keeps it.
                    <div data-keeps-unsaved-changes>
                        <Link
                            to={editorHref}
                            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ArrowLeft className="size-4" />
                            {intl.formatMessage(messages.back)}
                        </Link>
                    </div>
                )}
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                />
                <div className="grid gap-8 lg:grid-cols-[244px_minmax(0,1fr)]">
                    <div className="lg:sticky lg:top-6 lg:self-start">
                        <Stepper
                            current={applying ? 3 : step}
                            maxReached={applying ? 3 : maxReached}
                            steps={steps}
                            onStepClick={applying ? () => undefined : go}
                            stepAriaLabel={(item, number) =>
                                intl.formatMessage(messages.stepLabel, {
                                    number,
                                    label: item.label
                                })
                            }
                        />
                    </div>
                    <span role="status" aria-live="polite" className="sr-only">
                        {!applying &&
                            intl.formatMessage(messages.announcement, {
                                number: step,
                                total: steps.length,
                                label: steps[step - 1]?.label ?? ''
                            })}
                    </span>
                    <WizardStepCard key={position}>
                        {flow.stage !== 'idle' ? (
                            <ApplyProgress
                                ref={headingRef}
                                stage={flow.stage}
                                failure={flow.failure}
                                onDismiss={flow.dismiss}
                                onFinish={onFinish}
                            />
                        ) : step === 1 || !plan ? (
                            <ChangesStep
                                ref={headingRef}
                                flow={flow}
                                onNext={() => go(2)}
                            />
                        ) : step === 2 ? (
                            <PreviewStep
                                ref={headingRef}
                                plan={plan}
                                onBack={() => go(1)}
                                onNext={() => go(3)}
                            />
                        ) : (
                            <ConfirmStep
                                ref={headingRef}
                                flow={flow}
                                onBack={() => go(2)}
                            />
                        )}
                    </WizardStepCard>
                </div>
            </Container>
        </>
    );
}
