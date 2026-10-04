import { useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { ArrowLeft, Blocks } from 'lucide-react';
import type { FieldEntry, TypeDoc } from '@orthacms/schema-builder-domain';
import {
    Container,
    ContainerHeader,
    Stepper,
    WizardStepCard
} from '@orthacms/design-system';
import { PageTopBar } from '@orthacms/shell-admin';
import { useNewField } from '../../../application/useNewField';
import type { SchemaDraftState } from '../../../application/useSchemaDraft';
import { BasicsStep } from './BasicsStep';
import { kindCopy } from '../fieldKindCopy';
import { RulesStep } from './RulesStep';
import { TypeStep } from './TypeStep';

const messages = defineMessages({
    crumb: { id: 'schemaBuilder.page.title', defaultMessage: 'Content Model' },
    title: {
        id: 'schemaBuilder.addField.title',
        defaultMessage: 'Add a field'
    },
    subtitle: {
        id: 'schemaBuilder.addField.subtitle',
        defaultMessage:
            'A new field on {type}. It joins your draft when you add it — nothing is applied until you review your changes.'
    },
    back: {
        id: 'schemaBuilder.addField.backToType',
        defaultMessage: 'Back to {type}'
    },
    stepKind: { id: 'schemaBuilder.addField.stepKind', defaultMessage: 'Kind' },
    stepKindHint: {
        id: 'schemaBuilder.addField.stepKindHint',
        defaultMessage: 'What the field holds'
    },
    stepBasics: {
        id: 'schemaBuilder.addField.stepBasics',
        defaultMessage: 'Basics'
    },
    stepBasicsHint: {
        id: 'schemaBuilder.addField.stepBasicsHint',
        defaultMessage: 'Name, required, links'
    },
    stepRules: {
        id: 'schemaBuilder.addField.stepRules',
        defaultMessage: 'Rules and display'
    },
    stepRulesHint: {
        id: 'schemaBuilder.addField.stepRulesHint',
        defaultMessage: 'Validation, then how it looks'
    },
    optional: {
        id: 'schemaBuilder.addField.optional',
        defaultMessage: 'Optional'
    },
    stepLabel: {
        id: 'schemaBuilder.addField.stepLabel',
        defaultMessage: 'Step {number}: {label}'
    },
    announcement: {
        id: 'schemaBuilder.addField.announcement',
        defaultMessage: 'Step {number} of {total}: {label}'
    }
});

type Props = {
    type: TypeDoc;
    draft: SchemaDraftState;
    /** The editor's URL — where "back" goes. */
    editorHref: string;
    /** The field joined the draft. */
    onAdded: (entry: FieldEntry) => void;
};

/**
 * Adding a field as a page with steps, in the shape of the other wizards:
 * the kind of field, its basics, its rules and display. The field is built
 * aside (`useNewField`) with the field sheet's own editors, and joins the
 * draft only on "Add field" — going back leaves nothing half-made. A state
 * of the content model page (`?addField`), like the review.
 */
export function AddFieldPage({ type, draft, editorHref, onAdded }: Props) {
    const intl = useIntl();
    const field = useNewField(draft.document, type.name);
    const [step, setStep] = useState(1);
    const [maxReached, setMaxReached] = useState(1);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const typeLabel = type.label || type.name;

    const go = (next: number) => {
        setStep(next);
        setMaxReached((reached) => Math.max(reached, next));
    };
    // Focus follows the step; not on first paint.
    const previous = useRef(step);
    useEffect(() => {
        if (previous.current === step) return;
        previous.current = step;
        headingRef.current?.focus();
    }, [step]);

    const steps = [
        {
            label: intl.formatMessage(messages.stepKind),
            hint: intl.formatMessage(messages.stepKindHint),
            summary:
                maxReached > 1
                    ? intl.formatMessage(kindCopy(field.choice).label)
                    : undefined
        },
        {
            label: intl.formatMessage(messages.stepBasics),
            hint: intl.formatMessage(messages.stepBasicsHint),
            summary:
                maxReached > 2
                    ? field.editor.entry.name || undefined
                    : undefined
        },
        {
            label: intl.formatMessage(messages.stepRules),
            hint: intl.formatMessage(messages.stepRulesHint),
            optional: true
        }
    ];
    // Basics must be right before the rules can be reached from the rail.
    const reachable = field.nameProblem ? Math.min(maxReached, 2) : maxReached;

    return (
        <>
            <PageTopBar
                icon={Blocks}
                crumbs={[
                    {
                        key: 'content-model',
                        label: intl.formatMessage(messages.crumb)
                    },
                    { key: 'type', label: typeLabel },
                    {
                        key: 'add-field',
                        label: intl.formatMessage(messages.title)
                    }
                ]}
            />
            <Container className="max-w-[1040px]">
                <div data-keeps-unsaved-changes>
                    <Link
                        to={editorHref}
                        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        {intl.formatMessage(messages.back, { type: typeLabel })}
                    </Link>
                </div>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle, {
                        type: typeLabel
                    })}
                />
                <div className="grid gap-8 lg:grid-cols-[244px_minmax(0,1fr)]">
                    <div className="lg:sticky lg:top-6 lg:self-start">
                        <Stepper
                            current={step}
                            maxReached={reachable}
                            steps={steps}
                            onStepClick={(next) =>
                                next <= reachable && go(next)
                            }
                            optionalLabel={intl.formatMessage(
                                messages.optional
                            )}
                            stepAriaLabel={(item, number) =>
                                intl.formatMessage(messages.stepLabel, {
                                    number,
                                    label: item.label
                                })
                            }
                        />
                    </div>
                    <span role="status" aria-live="polite" className="sr-only">
                        {intl.formatMessage(messages.announcement, {
                            number: step,
                            total: steps.length,
                            label: steps[step - 1]?.label ?? ''
                        })}
                    </span>
                    <WizardStepCard key={step}>
                        {step === 1 ? (
                            <TypeStep
                                ref={headingRef}
                                choice={field.choice}
                                onChoose={field.choose}
                                onNext={() => go(2)}
                            />
                        ) : step === 2 ? (
                            <BasicsStep
                                ref={headingRef}
                                field={field}
                                type={type}
                                document={draft.document}
                                onBack={() => go(1)}
                                onNext={() => go(3)}
                            />
                        ) : (
                            <RulesStep
                                ref={headingRef}
                                field={field}
                                type={type}
                                onBack={() => go(2)}
                                onAdd={() => onAdded(field.editor.entry)}
                            />
                        )}
                    </WizardStepCard>
                </div>
            </Container>
        </>
    );
}
