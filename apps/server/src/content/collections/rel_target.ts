// @orthacms-generated — managed by the Schema Builder.

/**
 * `rel_target` — the plain, non-localized target of every `rel_*` relation,
 * and the one `library` shares with other workspaces. Its inverse fields show
 * who links here, with no storage of their own.
 */

import {
    collection,
    field,
    type AnyContentType
} from '@orthacms/content-server/define';
import { rel_many_to_many } from './rel_many_to_many';
import { rel_many_to_one } from './rel_many_to_one';

export const rel_target = collection('rel_target', {
    label: 'Rel · Target',
    description: 'The target every relation type points at.',
    publishable: true,
    fields: {
        title: field.text({ required: true }),
        restricted_by: field.relationInverse({
            of: (): AnyContentType => rel_many_to_one,
            field: 'required_restrict'
        }),
        linked_from: field.relationInverse({
            of: (): AnyContentType => rel_many_to_many,
            field: 'many'
        })
    }
});
