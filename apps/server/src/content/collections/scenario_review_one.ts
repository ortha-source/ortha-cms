// @orthacms-generated — managed by the Schema Builder.

/**
 * `scenario_review_one` — publish protection. Publishing needs one approval. The rule itself lives in the
 * database (seeded); the type only gives it something to guard.
 */

import { collection, field } from '@orthacms/content-server/define';

export const scenario_review_one = collection('scenario_review_one', {
    label: 'Scenario · Review (one)',
    description: 'Publishing needs one approval.',
    publishable: true,
    paranoid: true,
    fields: {
        title: field.text({ required: true }),
        body: field.richtext({ required: true })
    }
});
