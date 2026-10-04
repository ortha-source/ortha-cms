import { defineMessages, type IntlShape } from 'react-intl';
import type { ClassifyReason } from '@orthacms/schema-builder-domain';

const messages = defineMessages({
    'new-type': {
        id: 'schemaBuilder.reason.newType',
        defaultMessage: 'Creates a new table.'
    },
    'code-only': {
        id: 'schemaBuilder.reason.codeOnly',
        defaultMessage: 'Changes only the code; no migration.'
    },
    'nullable-column': {
        id: 'schemaBuilder.reason.nullableColumn',
        defaultMessage: 'Adds a column existing entries leave empty.'
    },
    'trash-column': {
        id: 'schemaBuilder.reason.trashColumn',
        defaultMessage: 'Adds the trash column.'
    },
    'required-on-live-type': {
        id: 'schemaBuilder.reason.requiredOnLiveType',
        defaultMessage:
            'Existing entries without a value will fail validation, or the migration if the column is NOT NULL.'
    },
    'constraint-tightened': {
        id: 'schemaBuilder.reason.constraintTightened',
        defaultMessage: 'Existing values may no longer pass.'
    },
    'not-null-toggle': {
        id: 'schemaBuilder.reason.notNullToggle',
        defaultMessage: 'Changes whether the column may be empty.'
    },
    'relation-constraint': {
        id: 'schemaBuilder.reason.relationConstraint',
        defaultMessage: 'Changes how the link is stored or what a delete does.'
    },
    'drops-data': {
        id: 'schemaBuilder.reason.dropsData',
        defaultMessage: 'Deletes data. It cannot be undone.'
    },
    'type-in-use': {
        id: 'schemaBuilder.reason.typeInUse',
        defaultMessage:
            'Workspaces are granted this type or other types link to it. Remove those first.'
    },
    'rename-unsupported': {
        id: 'schemaBuilder.reason.renameUnsupported',
        defaultMessage:
            'Renaming keeps no data in this version. Add a new field and remove the old one instead.'
    },
    'retype-unsupported': {
        id: 'schemaBuilder.reason.retypeUnsupported',
        defaultMessage:
            'Changing a field’s type is not applied in this version.'
    },
    'flag-needs-data-migration': {
        id: 'schemaBuilder.reason.flagNeedsDataMigration',
        defaultMessage:
            'This flag changes how entries are stored and needs a data migration.'
    }
});

/** Why a change got its verdict, as a sentence. */
export const reasonText = (intl: IntlShape, reason: ClassifyReason): string =>
    intl.formatMessage(messages[reason]);
