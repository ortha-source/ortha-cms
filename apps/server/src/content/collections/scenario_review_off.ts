// @orthacms-generated — managed by the Schema Builder.

/**
 * `scenario_review_off` — publish protection. Has a protection rule that is switched off: publishes freely. The rule itself lives in the
 * database (seeded); the type only gives it something to guard.
 */

import { collection, field } from '@orthacms/content-server/define';

export const scenario_review_off = collection('scenario_review_off', {
    label: 'Scenario · Review (off)',
    description:
        'Has a protection rule that is switched off: publishes freely.',
    publishable: true,
    paranoid: true,
    fields: {
        title: field.text({ required: true }),
        body: field.richtext({ required: true })
    }
});
