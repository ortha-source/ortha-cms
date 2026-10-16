// @orthacms-generated — managed by the Schema Builder.

/**
 * `i18n_relations` — the three ways a link behaves across translations:
 *   - shared ..... a synced link to non-localized content: the same row for all
 *   - mirrored ... a synced link to localized content: the row in each language
 *   - independent  `syncAcrossLocales: false`: each language keeps its own
 */

import {
    collection,
    field,
    type AnyContentType
} from '@orthacms/content-server/define';
import { i18n_target } from './i18n_target';
import { rel_target } from './rel_target';

export const i18n_relations = collection('i18n_relations', {
    label: 'I18n · Relations',
    description: 'Shared, mirrored and independent links across languages.',
    publishable: true,
    i18n: true,
    fields: {
        title: field.text({ required: true, localized: true }),
        shared_link: field.relation({
            to: (): AnyContentType => rel_target,
            onDelete: 'set null'
        }),
        mirrored_link: field.relation({
            to: (): AnyContentType => i18n_target,
            onDelete: 'set null'
        }),
        mirrored_many: field.relation({
            to: (): AnyContentType => i18n_target,
            many: true
        }),
        independent_link: field.relation({
            to: (): AnyContentType => rel_target,
            onDelete: 'set null',
            syncAcrossLocales: false
        })
    }
});
