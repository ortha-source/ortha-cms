// @orthacms-generated — managed by the Schema Builder.

/**
 * `rel_one_to_one` — a unique foreign key: a target can be taken by one
 * entry only.
 */

import {
    collection,
    field,
    type AnyContentType
} from '@orthacms/content-server/define';
import { rel_target } from './rel_target';

export const rel_one_to_one = collection('rel_one_to_one', {
    label: 'Rel · One to one',
    description: 'A unique link: one target per entry.',
    fields: {
        title: field.text({ required: true }),
        unique: field.relation({
            to: (): AnyContentType => rel_target,
            unique: true,
            onDelete: 'set null'
        })
    }
});
