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
import { validationEditors } from '../../../../domain/fieldCapabilities';
import { FieldDisplayTab } from '../../FieldSheet/FieldDisplayTab';
import { FieldValidationTab } from '../../FieldSheet/FieldValidationTab';
import { StepHeading } from '../../StepHeading';
import { FieldProblems } from '../FieldProblems';
import { Section } from './Section';

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
    validationHint: {
        id: 'schemaBuilder.addField.validationHint',
        defaultMessage:
            'Checked whenever an entry is saved or published. Leave a rule empty for no limit.'
    },
    display: {
        id: 'schemaBuilder.addField.display',
        defaultMessage: 'Display'
    },
    displayHint: {
        id: 'schemaBuilder.addField.displayHint',
        defaultMessage:
            'How the field looks in the entry editor. Nothing here changes what is stored.'
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
            validationEditors(field.editor.entry.spec).length > 0;
        const ready = !field.nameProblem && field.issues.length === 0;
        return (
            <>
                <StepHeading
                    ref={ref}
                    title={intl.formatMessage(messages.title)}
                    description={intl.formatMessage(messages.description)}
                />
                <CardContent>
                    {/* Outside the sections' column: while empty, the live
                        region must not take a gap under the heading. */}
                    <FieldProblems issues={field.issues} />
                    <div className="flex flex-col gap-8">
                        {takesRules && (
                            <Section
                                id="add-field-validation"
                                title={intl.formatMessage(messages.validation)}
                                hint={intl.formatMessage(
                                    messages.validationHint
                                )}
                            >
                                <FieldValidationTab editor={field.editor} />
                            </Section>
                        )}
                        <Section
                            id="add-field-display"
                            title={intl.formatMessage(messages.display)}
                            hint={intl.formatMessage(messages.displayHint)}
                        >
                            <FieldDisplayTab
                                editor={field.editor}
                                type={type}
                            />
                        </Section>
                    </div>
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
