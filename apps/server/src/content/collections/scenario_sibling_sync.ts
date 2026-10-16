// @orthacms-generated — managed by the Schema Builder.

/**
 * `scenario_sibling_sync` — a save that reaches other languages. A shared
 * required field and a required synced link: clearing either on one language
 * would leave every published sibling failing validation, which is what the
 * editor's sibling-sync dialog asks about.
 */

import {
    collection,
    field,
    type AnyContentType
} from '@orthacms/content-server/define';
import { rel_target } from './rel_target';

export const scenario_sibling_sync = collection('scenario_sibling_sync', {
    label: 'Scenario · Sibling sync',
    description: 'Shared required values that every translation depends on.',
    publishable: true,
    i18n: true,
    fields: {
        title: field.text({ required: true, localized: true }),
        sku: field.text({
            required: true,
            admin: { description: 'Shared and required.' }
        }),
        owner: field.relation({
            to: (): AnyContentType => rel_target,
            required: true,
            onDelete: 'restrict',
            admin: { description: 'Synced and required.' }
        })
    }
});
