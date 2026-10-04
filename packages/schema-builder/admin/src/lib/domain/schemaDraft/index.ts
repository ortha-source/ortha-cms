import type { SchemaDocument } from '@orthacms/schema-builder-domain';
import type { SchemaDraftAction } from '../schemaDraftAction';
import { addField } from './addField';
import { addType } from './addType';
import { moveField } from './moveField';
import { removeField } from './removeField';
import { removeType } from './removeType';
import { setGroups } from './setGroups';
import { updateField } from './updateField';
import { updateType } from './updateType';

type Handlers = {
    [K in SchemaDraftAction['type']]: (
        doc: SchemaDocument,
        action: Extract<SchemaDraftAction, { type: K }>
    ) => SchemaDocument;
};

/** One handler per action kind; a new kind does not compile until it has one. */
const HANDLERS: Handlers = {
    reset: (_, action) => action.document,
    'type.add': addType,
    'type.update': updateType,
    'type.remove': removeType,
    'field.add': addField,
    'field.update': updateField,
    'field.remove': removeField,
    'field.move': moveField,
    'groups.set': setGroups
};

/** The draft reducer: pure, one handler per action. */
export function schemaDraft(
    doc: SchemaDocument,
    action: SchemaDraftAction
): SchemaDocument {
    return (
        HANDLERS[action.type] as (
            doc: SchemaDocument,
            action: SchemaDraftAction
        ) => SchemaDocument
    )(doc, action);
}
