/**
 * Fixture record drafts for the dynamic record editor. Stands in for the content
 * API until a matching endpoint lands: {@link loadRecordDraft} is what the
 * editor's TanStack Query hook calls, so swapping in a real `fetch` later is a
 * one-line change with the rest of the UI untouched.
 *
 * Two schemas ship on purpose:
 * - **`articles`** — the 11-field reference collection, one of every field type.
 * - **`stress`** — a 40-field collection, to exercise the outline's
 *   *problems-first* mode (> 25 fields) and the grouped island separators.
 */

import type { FieldDef, RecordDraft, RecordValues } from '../../types/recordDraft';

/** The reference collection's field schema — every type, end to end. */
const ARTICLE_FIELDS: FieldDef[] = [
    {
        key: 'title',
        label: 'Text',
        type: 'text',
        required: true,
        description: 'A short single-line string (3–200 characters).',
        placeholder: 'English'
    },
    {
        key: 'reading_minutes',
        label: 'Number',
        type: 'number',
        min: 1,
        max: 120,
        description: 'A whole number between 1 and 120.',
        placeholder: 'e.g. 42'
    },
    {
        key: 'price',
        label: 'Money',
        type: 'money',
        description: 'Stored in minor units; shown as a currency preview.',
        placeholder: '1999'
    },
    {
        key: 'published_on',
        label: 'Date',
        type: 'date',
        description: 'The day this article goes live.'
    },
    {
        key: 'featured',
        label: 'Boolean',
        type: 'boolean',
        description: 'Whether the article is pinned to the homepage.'
    },
    {
        key: 'category',
        label: 'Select',
        type: 'select',
        required: true,
        options: ['Guide', 'Tutorial', 'Announcement', 'Case study', 'Opinion'],
        description: 'Pick exactly one content category.'
    },
    {
        key: 'tags',
        label: 'Multiselect',
        type: 'multiselect',
        options: ['React', 'Design', 'Infra', 'Security', 'Performance', 'DX'],
        description: 'Any number of topic tags.'
    },
    {
        key: 'body',
        label: 'Richtext',
        type: 'richtext',
        description: 'Long-form body copy for the article.'
    },
    {
        key: 'excerpt',
        label: 'Excerpt',
        type: 'textarea',
        description: 'A one-paragraph summary used in listings.'
    },
    {
        key: 'metadata',
        label: 'Json',
        type: 'json',
        description: 'Arbitrary structured metadata. Must be valid JSON.'
    },
    {
        key: 'canonical_url',
        label: 'Canonical URL',
        type: 'url',
        description: 'The canonical address for SEO.',
        placeholder: 'https://'
    }
];

/** Reference record — matches the design screenshot's values + timestamps. */
const ARTICLE_DRAFT: RecordDraft = {
    id: '17a1a081-0524-4b75-ab54-10a75ce47ccf',
    collection: {
        name: 'articles',
        label: 'Articles',
        description: 'The reference collection — every field type, end to end.',
        titleField: 'title'
    },
    status: 'draft',
    createdAt: '2026-07-06T11:12:00.000Z',
    updatedAt: '2026-07-06T11:12:00.000Z',
    locale: 'en',
    locales: [
        { code: 'en', label: 'English', status: 'draft' },
        { code: 'de', label: 'Deutsch', status: 'draft' },
        { code: 'fr', label: 'Français', status: null }
    ],
    fields: ARTICLE_FIELDS,
    // `title` + `featured` filled → the outline reads "2 of 11". `category`
    // (required) is empty, so the publish gate blocks — as in the screenshot.
    values: {
        title: 'English',
        featured: true
    }
};

/** Cycle of types used to synthesize the stress schema, deterministically. */
const STRESS_CYCLE: FieldDef['type'][] = [
    'text',
    'number',
    'select',
    'boolean',
    'multiselect',
    'money',
    'date',
    'url',
    'textarea',
    'json'
];

/** Build the 40-field stress schema — enough to trip problems-first mode. */
function buildStressFields(): FieldDef[] {
    return Array.from({ length: 40 }, (_, index): FieldDef => {
        const type = STRESS_CYCLE[index % STRESS_CYCLE.length];
        // Every 5th field is required, so the problems-first outline has a
        // healthy set of always-visible rows to collapse the rest behind.
        const required = index % 5 === 0;
        const base: FieldDef = {
            key: `field_${index + 1}`,
            label: `${labelFor(type)} ${index + 1}`,
            type,
            required,
            description: `Stress field ${index + 1} of 40 (${type}).`
        };
        if (type === 'select' || type === 'multiselect') {
            base.options = ['Alpha', 'Beta', 'Gamma', 'Delta'];
        }
        if (type === 'number') {
            base.min = 0;
            base.max = 1000;
        }
        return base;
    });
}

/** Title-cased human label for a field type. */
function labelFor(type: FieldDef['type']): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
}

/** A few stress values so the progress bar isn't at zero. */
const STRESS_VALUES: RecordValues = {
    field_2: 12,
    field_3: 'Beta',
    field_6: 4900
};

const STRESS_DRAFT: RecordDraft = {
    id: '9f3c77e2-1b40-4a1e-9d22-6a0f5e2c8b41',
    collection: {
        name: 'stress',
        label: 'Everything',
        description: 'A 40-field collection — proves the outline scales.',
        titleField: 'field_1'
    },
    status: 'draft',
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-04T14:30:00.000Z',
    locale: 'en',
    locales: [
        { code: 'en', label: 'English', status: 'draft' },
        { code: 'de', label: 'Deutsch', status: null }
    ],
    fields: buildStressFields(),
    values: STRESS_VALUES
};

/** All fixture drafts, keyed by collection machine name. */
const FIXTURES: Record<string, RecordDraft> = {
    articles: ARTICLE_DRAFT,
    stress: STRESS_DRAFT
};

/**
 * Resolve a record draft for a collection, in a given locale. Returns a deep
 * clone so the editor's local mutations never leak back into the shared fixture.
 * Unknown collections fall back to the reference draft (this is a design fixture,
 * not a router guard). Rejects for a would-be-404 only when explicitly asked.
 */
export async function loadRecordDraft(
    collection: string,
    recordId: string,
    locale: string
): Promise<RecordDraft> {
    const base = FIXTURES[collection] ?? ARTICLE_DRAFT;
    const active = base.locales.some((entry) => entry.code === locale)
        ? locale
        : base.locale;
    return {
        ...base,
        id: recordId || base.id,
        locale: active,
        locales: base.locales.map((entry) => ({ ...entry })),
        fields: base.fields.map((field) => ({ ...field })),
        values: { ...base.values }
    };
}

/** The collections a fixture exists for — handy for building preview links. */
export const FIXTURE_COLLECTIONS = Object.keys(FIXTURES);
