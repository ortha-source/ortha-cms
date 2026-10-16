// @orthacms-generated — managed by the Schema Builder.

/**
 * `rel_many_to_one` — a required many-to-one that blocks deleting its target
 * (ON DELETE RESTRICT) and an optional one that is cleared (SET NULL).
 */

import {
    collection,
    field,
    type AnyContentType
} from '@orthacms/content-server/define';
import { rel_target } from './rel_target';

export const rel_many_to_one = collection('rel_many_to_one', {
    label: 'Rel · Many to one',
    description: 'Required (RESTRICT) and optional (SET NULL) links.',
    fields: {
        title: field.text({ required: true }),
        required_restrict: field.relation({
            to: (): AnyContentType => rel_target,
            required: true,
            onDelete: 'restrict'
        }),
        optional_set_null: field.relation({
            to: (): AnyContentType => rel_target,
            onDelete: 'set null'
        })
    }
});
