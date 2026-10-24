import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import type {
    FieldEntry,
    SchemaDocument,
    TypeDoc
} from '@orthacms/schema-builder-domain';
import { useNewField } from '../../../../application/useNewField';
import { AddFieldDialog } from '../../AddFieldDialog';
import { FieldSheet } from '../../FieldSheet';

const messages = defineMessages({
    invalid: {
        id: 'schemaBuilder.addField.nameInvalid',
        defaultMessage: 'Start with a letter; letters and digits only.'
    },
    taken: {
        id: 'schemaBuilder.addField.nameTaken',
        defaultMessage: 'This type already has a field by that name.'
    }
});

type Props = {
    type: TypeDoc;
    document: SchemaDocument;
    /** The field joined the draft. */
    onAdded: (entry: FieldEntry) => void;
    /** Left without adding anything. */
    onCancel: () => void;
};

/**
 * Adding a field, in two steps instead of a page with three: pick what it
 * holds in a dialog, then name it and set its rules in the same panel that
 * edits a field. The field is built aside (`useNewField`) and joins the
 * draft only on "Add field" — leaving at either step leaves nothing behind.
 * Mounted for one addition at a time, so each starts from scratch.
 */
export function AddFieldFlow({ type, document, onAdded, onCancel }: Props) {
    const intl = useIntl();
    const field = useNewField(document, type.name);
    const [stage, setStage] = useState<'kind' | 'details'>('kind');
    const problem = field.nameProblem;
    return (
        <>
            <AddFieldDialog
                open={stage === 'kind'}
                typeLabel={type.label || type.name}
                choice={field.choice}
                onChoose={field.choose}
                onContinue={() => setStage('details')}
                onCancel={onCancel}
            />
            <FieldSheet
                editor={stage === 'details' ? field.editor : null}
                type={type}
                document={document}
                issues={field.issues}
                onClose={onCancel}
                adding={{
                    // An empty name is the starting state, not an error worth a red line.
                    nameError:
                        problem && problem !== 'empty'
                            ? intl.formatMessage(messages[problem])
                            : undefined,
                    nameEmpty: problem === 'empty',
                    ready: !problem && field.issues.length === 0,
                    onAdd: () => onAdded(field.editor.entry),
                    onBack: () => setStage('kind')
                }}
            />
        </>
    );
}
