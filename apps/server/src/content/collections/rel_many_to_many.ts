// @orthacms-generated — managed by the Schema Builder.

/**
 * `rel_many_to_many` — an ordered many-to-many through a join table.
 */

import {
    collection,
    field,
    type AnyContentType
} from '@orthacms/content-server/define';
import { rel_target } from './rel_target';

export const rel_many_to_many = collection('rel_many_to_many', {
    label: 'Rel · Many to many',
    description: 'A join-table link to many targets.',
    fields: {
        title: field.text({ required: true }),
        many: field.relation({
            to: (): AnyContentType => rel_target,
            many: true
        })
    }
});
