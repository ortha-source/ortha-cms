import { forwardRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import {
    Button,
    CardContent,
    CardFooter,
    WizardFooter
} from '@orthacms/design-system';
import type { NewField } from '../../../../application/useNewField';
import { FIELD_CAPABILITIES } from '../../../../domain/fieldCapabilities';
import { FieldDisplayTab } from '../../FieldSheet/FieldDisplayTab';
import { FieldValidationTab } from '../../FieldSheet/FieldValidationTab';
import { StepHeading } from '../../StepHeading';
import { FieldProblems } from '../FieldProblems';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.addField.rulesTitle',
        defaultMessage: 'Rules and display'
    },
    description: {
        id: 'schemaBuilder.addField.rulesDescription',
        defaultMessage:
            'What counts as a valid value, and how the field looks in the entry editor. All optional.'
    },
    validation: {
        id: 'schemaBuilder.addField.validation',
        defaultMessage: 'Validation'
    },
    display: {
        id: 'schemaBuilder.addField.display',
        defaultMessage: 'Display'
    },
    back: { id: 'schemaBuilder.addField.back', defaultMessage: 'Back' },
    add: { id: 'schemaBuilder.addField.add', defaultMessage: 'Add field' }
});

type Props = {
    field: NewField;
    type: TypeDoc;
    onBack: () => void;
    onAdd: () => void;
};

/** Step 3: the sheet's Validation (when the type takes rules) and Display, then the field joins the draft. */
export const RulesStep = forwardRef<HTMLHeadingElement, Props>(
    function RulesStep({ field, type, onBack, onAdd }, ref) {
        const intl = useIntl();
        const takesRules =
            FIELD_CAPABILITIES[field.editor.entry.spec.type].validation.length >
            0;
        const ready = !field.nameProblem && field.issues.length === 0;
        return (
            <>
                <StepHeading
                    ref={ref}
                    title={intl.formatMessage(messages.title)}
                    description={intl.formatMessage(messages.description)}
                />
                <CardContent className="flex flex-col gap-6">
                    <FieldProblems issues={field.issues} />
                    {takesRules && (
                        <section
                            aria-labelledby="add-field-validation"
                            className="flex flex-col gap-3"
                        >
                            <h3
                                id="add-field-validation"
                                className="text-sm font-semibold"
                            >
                                {intl.formatMessage(messages.validation)}
                            </h3>
                            <FieldValidationTab editor={field.editor} />
                        </section>
                    )}
                    <section
                        aria-labelledby="add-field-display"
                        className="flex flex-col gap-3"
                    >
                        <h3
                            id="add-field-display"
                            className="text-sm font-semibold"
                        >
                            {intl.formatMessage(messages.display)}
                        </h3>
                        <FieldDisplayTab editor={field.editor} type={type} />
                    </section>
                </CardContent>
                <CardFooter>
                    <WizardFooter
                        onBack={onBack}
                        backLabel={intl.formatMessage(messages.back)}
                        primary={
                            <Button
                                type="button"
                                onClick={onAdd}
                                disabled={!ready}
                            >
                                <Plus />
                                {intl.formatMessage(messages.add)}
                            </Button>
                        }
                    />
                </CardFooter>
            </>
        );
    }
);
