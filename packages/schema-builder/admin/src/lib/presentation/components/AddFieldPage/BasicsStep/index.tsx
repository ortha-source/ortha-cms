import { forwardRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowRight } from 'lucide-react';
import type { SchemaDocument, TypeDoc } from '@orthacms/schema-builder-domain';
import {
    Button,
    CardContent,
    CardFooter,
    WizardFooter
} from '@orthacms/design-system';
import type { NewField } from '../../../../application/useNewField';
import { FieldGeneralTab } from '../../FieldSheet/FieldGeneralTab';
import { StepHeading } from '../../StepHeading';
import { FieldProblems } from '../FieldProblems';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.addField.basicsTitle',
        defaultMessage: 'Basics'
    },
    description: {
        id: 'schemaBuilder.addField.basicsDescription',
        defaultMessage:
            'Its label and machine name, whether it is required — and for a relation, what it links to and how many.'
    },
    empty: {
        id: 'schemaBuilder.addField.nameEmpty',
        defaultMessage: 'Give the field a label or a machine name.'
    },
    invalid: {
        id: 'schemaBuilder.addField.nameInvalid',
        defaultMessage: 'Start with a letter; letters and digits only.'
    },
    taken: {
        id: 'schemaBuilder.addField.nameTaken',
        defaultMessage: 'This type already has a field by that name.'
    },
    back: { id: 'schemaBuilder.addField.back', defaultMessage: 'Back' },
    next: { id: 'schemaBuilder.addField.toRules', defaultMessage: 'Continue' }
});

type Props = {
    field: NewField;
    type: TypeDoc;
    document: SchemaDocument;
    onBack: () => void;
    onNext: () => void;
};

/** Step 2: the field sheet's General tab, over the field being added. */
export const BasicsStep = forwardRef<HTMLHeadingElement, Props>(
    function BasicsStep({ field, type, document, onBack, onNext }, ref) {
        const intl = useIntl();
        const problem = field.nameProblem;
        // An empty name is the starting state, not an error worth a red line.
        const nameError =
            problem && problem !== 'empty'
                ? intl.formatMessage(messages[problem])
                : undefined;
        const ready = !problem && field.issues.length === 0;
        return (
            <>
                <StepHeading
                    ref={ref}
                    title={intl.formatMessage(messages.title)}
                    description={intl.formatMessage(messages.description)}
                />
                <CardContent>
                    <FieldProblems issues={field.issues} />
                    <FieldGeneralTab
                        editor={field.editor}
                        type={type}
                        document={document}
                        nameError={nameError}
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
                                    onClick={onNext}
                                    disabled={!ready}
                                    aria-describedby={
                                        problem === 'empty'
                                            ? 'add-field-basics-hint'
                                            : undefined
                                    }
                                >
                                    {intl.formatMessage(messages.next)}
                                    <ArrowRight />
                                </Button>
                                {problem === 'empty' && (
                                    <p
                                        id="add-field-basics-hint"
                                        className="text-xs text-muted-foreground"
                                    >
                                        {intl.formatMessage(messages.empty)}
                                    </p>
                                )}
                            </div>
                        }
                    />
                </CardFooter>
            </>
        );
    }
);
