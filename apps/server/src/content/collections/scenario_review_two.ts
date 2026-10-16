// @orthacms-generated — managed by the Schema Builder.

/**
 * `scenario_review_two` — publish protection. Publishing needs two approvals from people other than the author, with no admin bypass. The rule itself lives in the
 * database (seeded); the type only gives it something to guard.
 */

import { collection, field } from '@orthacms/content-server/define';

export const scenario_review_two = collection('scenario_review_two', {
    label: 'Scenario · Review (two)',
    description:
        'Publishing needs two approvals from people other than the author, with no admin bypass.',
    publishable: true,
    paranoid: true,
    fields: {
        title: field.text({ required: true }),
        body: field.richtext({ required: true })
    }
});
