import { defineMessages, type IntlShape } from 'react-intl';
import type { SchemaChange } from '@orthacms/schema-builder-domain';

const messages = defineMessages({
    'type.add': {
        id: 'schemaBuilder.change.typeAdd',
        defaultMessage: 'Add the type {type}'
    },
    'type.remove': {
        id: 'schemaBuilder.change.typeRemove',
        defaultMessage: 'Remove the type {type}'
    },
    'type.meta': {
        id: 'schemaBuilder.change.typeMeta',
        defaultMessage: 'Change the settings of {type}'
    },
    'type.flag': {
        id: 'schemaBuilder.change.typeFlag',
        defaultMessage:
            'Turn {flag} {to, select, true {on} other {off}} for {type}'
    },
    'field.add': {
        id: 'schemaBuilder.change.fieldAdd',
        defaultMessage: 'Add {field} to {type}'
    },
    'field.remove': {
        id: 'schemaBuilder.change.fieldRemove',
        defaultMessage: 'Remove {field} from {type}'
    },
    'field.rename': {
        id: 'schemaBuilder.change.fieldRename',
        defaultMessage: 'Rename {from} to {to} on {type}'
    },
    'field.retype': {
        id: 'schemaBuilder.change.fieldRetype',
        defaultMessage: 'Change {field} on {type} from {from} to {to}'
    },
    'field.update': {
        id: 'schemaBuilder.change.fieldUpdate',
        defaultMessage: 'Change {field} on {type}'
    },
    'field.reorder': {
        id: 'schemaBuilder.change.fieldReorder',
        defaultMessage: 'Reorder the fields of {type}'
    }
});

/** One change as a sentence. */
export function changeTitle(intl: IntlShape, change: SchemaChange): string {
    return intl.formatMessage(
        messages[change.kind],
        change as unknown as Record<string, string>
    );
}
