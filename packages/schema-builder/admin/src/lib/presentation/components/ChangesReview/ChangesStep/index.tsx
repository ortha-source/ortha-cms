import { forwardRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowRight } from 'lucide-react';
import {
    Button,
    CardContent,
    CardFooter,
    WizardFooter
} from '@orthacms/design-system';
import type { ApplyFlow } from '../../../../application/useApplyFlow';
import { ChangeRow } from '../ChangeRow';
import { ChangesSkeleton } from '../ChangesSkeleton';
import { PlanError } from '../PlanError';
import { ReadinessHint } from '../ReadinessHint';
import { StepHeading } from '../StepHeading';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.review.changesTitle',
        defaultMessage: 'Changes'
    },
    description: {
        id: 'schemaBuilder.review.changesDescription',
        defaultMessage:
            'Every change with how risky it is. A change that deletes data has to be confirmed on its own.'
    },
    list: { id: 'schemaBuilder.review.changesList', defaultMessage: 'Changes' },
    next: {
        id: 'schemaBuilder.review.toPreview',
        defaultMessage: 'Continue to files'
    }
});

/** Reasons that stop the review at this step; a bad migration name is the last step's business. */
const OWN_REASONS = ['blocked', 'unconfirmed', 'nothing'] as const;

type Props = { flow: ApplyFlow; onNext: () => void };

/**
 * Step 1: the plan's verdicts — a skeleton while drizzle-kit runs, the
 * server's error, or the list with a confirmation on each change that
 * deletes data. Continue is off, with the reason beside it, while anything
 * is blocked or unconfirmed.
 */
export const ChangesStep = forwardRef<HTMLHeadingElement, Props>(
    function ChangesStep({ flow, onNext }, ref) {
        const intl = useIntl();
        const { plan, readiness } = flow;
        const own =
            readiness &&
            !readiness.ok &&
            (OWN_REASONS as readonly string[]).includes(readiness.reason)
                ? readiness
                : null;
        const ready = Boolean(plan.data) && !own;
        return (
            <>
                <StepHeading
                    ref={ref}
                    title={intl.formatMessage(messages.title)}
                    description={intl.formatMessage(messages.description)}
                />
                <CardContent>
                    {plan.isError ? (
                        <PlanError
                            error={plan.error}
                            onRetry={() => plan.mutate()}
                        />
                    ) : !plan.data ? (
                        <ChangesSkeleton />
                    ) : (
                        <ul aria-label={intl.formatMessage(messages.list)}>
                            {plan.data.changes.map((item) => (
                                <ChangeRow
                                    key={item.id}
                                    item={item}
                                    confirmed={flow.confirmed.has(item.id)}
                                    onToggle={flow.toggle}
                                />
                            ))}
                        </ul>
                    )}
                </CardContent>
                <CardFooter>
                    <WizardFooter
                        hint={
                            <ReadinessHint
                                readiness={own}
                                id="review-changes-hint"
                            />
                        }
                        primary={
                            <Button
                                type="button"
                                onClick={onNext}
                                disabled={!ready}
                                aria-describedby={
                                    own ? 'review-changes-hint' : undefined
                                }
                            >
                                {intl.formatMessage(messages.next)}
                                <ArrowRight />
                            </Button>
                        }
                    />
                </CardFooter>
            </>
        );
    }
);
