// @orthacms-generated — managed by the Schema Builder.

/**
 * `rel_self` — relations to the same type: a parent (SET NULL), related
 * entries (many-to-many) and the children inverse of the parent.
 */

import {
    collection,
    field,
    type AnyContentType
} from '@orthacms/content-server/define';

export const rel_self = collection('rel_self', {
    label: 'Rel · Self',
    description: 'Parent, children and related entries of the same type.',
    fields: {
        title: field.text({ required: true }),
        parent: field.relation({
            to: (): AnyContentType => rel_self,
            onDelete: 'set null'
        }),
        related: field.relation({
            to: (): AnyContentType => rel_self,
            many: true
        }),
        children: field.relationInverse({
            of: (): AnyContentType => rel_self,
            field: 'parent'
        })
    }
});
