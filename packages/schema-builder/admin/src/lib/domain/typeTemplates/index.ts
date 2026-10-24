import type { FieldDoc, FieldEntry } from '@orthacms/schema-builder-domain';
import { newFieldKey } from '../identifiers';

/** A starting point for a new type: the fields it begins with. */
export type TypeTemplate = {
    readonly id: 'blank' | 'article' | 'event' | 'faq';
    /** The fields' machine names, as the dialog lists them. */
    readonly names: readonly string[];
    /** Fresh entries — new keys every time, so two types never share one. */
    readonly fields: () => FieldEntry[];
};

const field = (name: string, label: string, spec: FieldDoc): FieldEntry => ({
    key: newFieldKey(),
    name,
    spec: { ...spec, admin: { ...spec.admin, label } }
});

const template = (
    id: TypeTemplate['id'],
    entries: [string, string, FieldDoc][]
): TypeTemplate => ({
    id,
    names: entries.map(([name]) => name),
    fields: () => entries.map(([name, label, spec]) => field(name, label, spec))
});

/**
 * The templates the "New content type" dialog offers. Each is only fields of
 * the DSL — what a person would add one by one — so the type lands in the
 * draft like any other and is edited from there.
 */
export const TYPE_TEMPLATES: readonly TypeTemplate[] = [
    template('blank', []),
    template('article', [
        ['title', 'Title', { type: 'text', required: true }],
        ['slug', 'Slug', { type: 'text', required: true }],
        ['body', 'Body', { type: 'richtext' }],
        ['cover', 'Cover', { type: 'media' }]
    ]),
    template('event', [
        ['title', 'Title', { type: 'text', required: true }],
        ['starts', 'Starts', { type: 'datetime', required: true }],
        ['ends', 'Ends', { type: 'datetime' }],
        ['place', 'Place', { type: 'text' }]
    ]),
    template('faq', [
        ['question', 'Question', { type: 'text', required: true }],
        [
            'answer',
            'Answer',
            {
                type: 'richtext',
                structure: 'off',
                admin: { widget: 'textarea' }
            }
        ]
    ])
];
