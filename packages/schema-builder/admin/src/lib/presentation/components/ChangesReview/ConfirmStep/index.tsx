import { forwardRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Rocket } from 'lucide-react';
import {
    Button,
    CardContent,
    CardFooter,
    InputField,
    WizardFooter
} from '@orthacms/design-system';
import type { ApplyFlow } from '../../../../application/useApplyFlow';
import { ReadinessHint } from '../ReadinessHint';
import { StepHeading } from '../StepHeading';

const messages = defineMessages({
    title: { id: 'schemaBuilder.review.applyTitle', defaultMessage: 'Apply' },
    description: {
        id: 'schemaBuilder.review.applyDescription',
        defaultMessage:
            'Name the migration. Applying runs it in one transaction, writes the files, and the dev server restarts.'
    },
    migrationName: {
        id: 'schemaBuilder.changes.migrationName',
        defaultMessage: 'Migration name'
    },
    nameHint: {
        id: 'schemaBuilder.review.nameHint',
        defaultMessage:
            'Becomes the migration file name. Suggested from your changes.'
    },
    summary: {
        id: 'schemaBuilder.review.summary',
        defaultMessage:
            '{changes, plural, one {# change} other {# changes}} · {files, plural, one {# file} other {# files}} · {migrations, plural, =0 {no migration} one {# migration} other {# migrations}}'
    },
    back: { id: 'schemaBuilder.review.back', defaultMessage: 'Back' },
    apply: { id: 'schemaBuilder.changes.apply', defaultMessage: 'Apply' }
});

type Props = { flow: ApplyFlow; onBack: () => void };

/** Step 3: the migration's name and the one button that changes anything. */
export const ConfirmStep = forwardRef<HTMLHeadingElement, Props>(
    function ConfirmStep({ flow, onBack }, ref) {
        const intl = useIntl();
        const plan = flow.plan.data;
        const ready = flow.readiness?.ok === true;
        return (
            <>
                <StepHeading
                    ref={ref}
                    title={intl.formatMessage(messages.title)}
                    description={intl.formatMessage(messages.description)}
                />
                <CardContent className="flex flex-col gap-4">
                    {plan && (
                        <p className="text-sm text-muted-foreground">
                            {intl.formatMessage(messages.summary, {
                                changes: plan.changes.length,
                                files: plan.files.length,
                                migrations: plan.sql.length
                            })}
                        </p>
                    )}
                    <InputField
                        id="migration-name"
                        label={intl.formatMessage(messages.migrationName)}
                        description={intl.formatMessage(messages.nameHint)}
                        className="font-mono"
                        value={flow.migrationName}
                        onChange={(event) =>
                            flow.setMigrationName(event.target.value)
                        }
                    />
                </CardContent>
                <CardFooter>
                    <WizardFooter
                        onBack={onBack}
                        backLabel={intl.formatMessage(messages.back)}
                        primary={
                            <div className="flex flex-col items-end gap-1">
                                <Button
                                    type="button"
                                    onClick={() => void flow.apply()}
                                    disabled={!ready}
                                    aria-describedby={
                                        ready ? undefined : 'review-apply-hint'
                                    }
                                >
                                    <Rocket />
                                    {intl.formatMessage(messages.apply)}
                                </Button>
                                <ReadinessHint
                                    readiness={flow.readiness}
                                    id="review-apply-hint"
                                />
                            </div>
                        }
                    />
                </CardFooter>
            </>
        );
    }
);
