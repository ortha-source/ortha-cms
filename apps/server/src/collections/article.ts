import {
    collection,
    field,
} from '@ortha-cms/content-server/define';
import { author } from './author';
import { tag } from './tag';
import { seoMeta } from './seo-meta';

/**
 * Articles — the reference collection. Exercises **every** scalar field type in
 * the `field.*` vocabulary, then every relation cardinality:
 *
 * - **many-to-one** — `author` (a single FK; many articles share one author).
 * - **one-to-many** — the inverse of `author`, and `comment.article` (one
 *   article has many comments; the FK lives on `comment`).
 * - **one-to-one** — `seo` (a single FK with a `UNIQUE` constraint).
 * - **many-to-many** — `tags` (a generated `content_article_tags` join table).
 *
 * Relation thunks (`to: () => …`) keep the imports lazy so collections can
 * reference each other without import-order pain.
 *
 * Also the reference **i18n** type: each locale is a full row sharing a
 * `locale_group_id`. Content fields (`text`, `richtext`) are `localized`;
 * everything else is shared — synced across the translation group by the
 * i18n plugin on every update.
 */
export const article = collection('article', {
    label: 'Articles',
    description: 'The reference collection — every field type, end to end.',
    publishable: true,
    paranoid: true,
    i18n: true,
    fields: {
        text: field.text({
            required: true,
            localized: true,
            minLength: 3,
            maxLength: 200,
            admin: {
                label: 'Text',
                description: 'A short single-line string (3–200 characters).',
                placeholder: 'e.g. Getting started with Ortha'
            }
        }),
        richtext: field.richtext({
            localized: true,
            admin: {
                label: 'Richtext',
                widget: 'textarea',
                description: 'Long-form body copy for the article.',
                placeholder: 'Write the article body…'
            }
        }),
        number: field.number({
            integer: true,
            min: 1,
            max: 120,
            admin: {
                label: 'Number',
                description: 'A whole number between 1 and 120.',
                placeholder: 'e.g. 42'
            }
        }),
        money: field.money({
            min: 0,
            admin: {
                label: 'Money',
                description: 'An amount stored in minor units (cents).',
                placeholder: 'e.g. 1999 for $19.99'
            }
        }),
        boolean: field.boolean({
            admin: {
                label: 'Boolean',
                description: 'Toggle this article on or off.'
            }
        }),
        date: field.date({
            admin: {
                label: 'Date',
                description: 'A calendar date, no time of day.'
            }
        }),
        datetime: field.datetime({
            admin: {
                label: 'Datetime',
                description: 'A specific point in time (date and time).'
            }
        }),
        select: field.select({
            options: ['article', 'tutorial', 'changelog'] as const,
            required: true,
            admin: {
                label: 'Select',
                description: 'Pick exactly one content category.'
            }
        }),
        multiselect: field.multiselect({
            options: ['draft', 'featured', 'archived', 'pinned'] as const,
            admin: {
                label: 'Multiselect',
                description: 'Choose any number of labels for this article.'
            }
        }),
        json: field.json({
            admin: {
                label: 'Json',
                description: 'Arbitrary structured data as raw JSON.',
                placeholder: '{\n  "key": "value"\n}'
            }
        }),
        // many-to-one: many articles → one author. Single FK column
        // `author_id`; deleting an author nulls it (the article survives).
        author: field.relation({
            to: () => author,
            onDelete: 'set null',
            admin: {
                label: 'Author',
                description: 'The author who wrote this article (many-to-one).'
            }
        }),
        // one-to-one: an article owns at most one SEO record. `unique: true`
        // adds a UNIQUE constraint on the `seo_id` FK; deleting the record nulls
        // it (default onDelete for an optional relation).
        seo: field.relation({
            to: () => seoMeta,
            unique: true,
            admin: {
                label: 'SEO metadata',
                description: 'Search-engine metadata for this article (one-to-one).'
            }
        }),
        // many-to-many: an article links to any number of tags via the
        // generated `content_article_tags` join table.
        tags: field.relation({
            to: () => tag,
            many: true,
            admin: {
                label: 'Tags',
                description: 'Labels applied to this article (many-to-many).'
            }
        }),
    }
});
