import { collection, field } from '@orthacms/content-server/define';
import { testSeo } from './test-seo';
import { testTag } from './test-tag';

/**
 * `test_review` — the e2e-owned **publishable** collection with **required**
 * relations, one of each storage kind: `seo` is a single FK column (nullable,
 * because the type is publishable — required means required *to publish*) and
 * `tags` is a join-table many-to-many whose requiredness is a link count.
 *
 * It exists for `content:I-50`: a required relation whose target type the
 * workspace was **not granted** is not required in that workspace. A suite
 * grants `test_review` without `test_seo`/`test_tag` and proves create, update
 * and publish succeed with both empty — then grants them and proves the same
 * publish is refused again. No other fixture has a required relation on a
 * publishable type, and every existing one is granted wholesale by most
 * suites, which is why this is a type of its own.
 *
 * Owned by the server-e2e harness.
 */
export const testReview = collection('test_review', {
    label: 'Test reviews',
    description: 'A publishable type whose relations are required.',
    publishable: true,
    fields: {
        title: field.text({
            required: true,
            minLength: 1,
            maxLength: 200,
            admin: { label: 'Title' }
        }),
        seo: field.relation({
            to: () => testSeo,
            required: true,
            onDelete: 'restrict',
            admin: { label: 'SEO metadata' }
        }),
        tags: field.relation({
            to: () => testTag,
            many: true,
            required: true,
            admin: { label: 'Tags' }
        })
    }
});
