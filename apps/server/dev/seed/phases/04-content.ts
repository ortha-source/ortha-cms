/**
 * Entries for every content type, each set chosen to show that type's edge
 * cases rather than to look like a website: an empty record and a full one,
 * every lifecycle state, every translation-group shape, every link shape.
 *
 * Entry keys (`flags_pub_modified`, `i18n_fields_synced`, …) are how later
 * phases — protection, segments, alarms, views, the backdate — find them.
 * The `scenario_review_*` entries belong to the protection phase: their order
 * relative to the rules is the whole scenario.
 */
import { ContentWriter, html } from '../content-writer';
import type { SeedContext } from '../context';
import { archiveWorkspaces } from './02-workspaces';

export async function seedContent(ctx: SeedContext): Promise<void> {
    const c = new ContentWriter(ctx);
    await seedFields(c, ctx);
    await seedRelations(c);
    await seedSharing(c);
    await seedFlags(c);
    await seedI18n(c);
    await seedSingles(c);
    await seedScenarios(c);
    await archiveWorkspaces(ctx);

    ctx.section('Content', [
        'Every type in **Main** has records; open a type and the titles say what each one shows.',
        '',
        '- `flags_*` — draft, published, Modified, unpublished, gate-failing draft, trashed, restored, a long history',
        '- `i18n_*` — en only; en+de+fr published; en published with a de draft; de Modified by a shared-field sync; a link to a trashed translation',
        '- `rel_*` — every cardinality; `Target A` is held by a RESTRICT link, so deleting it is refused',
        "- **Consumer** links to **Library**'s published targets (see `/usages` on them); Library's draft and Archived's records stay invisible there",
        '- `scenario_sibling_sync` — en and de published: clearing `sku` on en asks about de'
    ]);
}

async function seedFields(c: ContentWriter, ctx: SeedContext): Promise<void> {
    await c.create('text_minimal', 'field_text', {
        required: 'Only the required field'
    });
    await c.create('text_full', 'field_text', {
        plain: 'Plain text with no rules',
        required: 'Every field filled',
        bounded: 'abc',
        slug: 'every-field-filled',
        textarea: 'Several lines\nof text\nin a textarea.',
        email: 'someone@example.com',
        color: '#6d28d9'
    });
    await c.create('text_at_max', 'field_text', {
        required: 'Bounded at its maximum',
        bounded: 'x'.repeat(20),
        textarea: 'y'.repeat(500)
    });

    await c.create('richtext_minimal', 'field_richtext', {
        required: html('Only the required body.')
    });
    await c.create('richtext_full', 'field_richtext', {
        plain: html(
            '<h2>A heading</h2>',
            'A paragraph with <strong>bold</strong>, <em>italic</em> and <a href="https://example.com">a link</a>.',
            '<ul><li>One</li><li>Two</li></ul>'
        ),
        required: html('Required body.'),
        bounded: html('Short.'),
        unstructured: html(
            '<h4>Skips heading levels</h4>',
            '<a href="https://example.com">click here</a>'
        )
    });

    await c.create('number_minimal', 'field_number', { rating: 1 });
    await c.create('number_full', 'field_number', {
        decimal: 3.14159,
        integer: -7,
        bounded: 10,
        rating: 5,
        money: 1999,
        bounded_money: 100_000
    });

    await c.create('boolean_null', 'field_boolean', {
        title: 'flag left empty',
        required_flag: false
    });
    await c.create('boolean_true', 'field_boolean', {
        title: 'flag true',
        flag: true,
        required_flag: true
    });
    await c.create('boolean_false', 'field_boolean', {
        title: 'flag false',
        flag: false,
        required_flag: false
    });

    await c.create('date_minimal', 'field_date', {
        title: 'Only the required date',
        required_date: '2026-01-15'
    });
    await c.create('date_full', 'field_date', {
        title: 'Date, datetime and required date',
        date: '2026-12-31',
        datetime: '2026-10-16T09:30:00.000Z',
        required_date: '2026-02-28'
    });

    await c.create('select_minimal', 'field_select', {
        title: 'Only the required choices',
        required_select: 'small',
        required_multiselect: ['web']
    });
    await c.create('select_full', 'field_select', {
        title: 'Every choice made',
        select: 'beta',
        required_select: 'large',
        multiselect: ['red', 'green', 'blue', 'yellow'],
        required_multiselect: ['web', 'ios', 'android']
    });

    await c.create('json_object', 'field_json', {
        title: 'Nested object',
        required_json: { nested: { list: [1, 2, 3], flag: true } }
    });
    await c.create('json_array', 'field_json', {
        title: 'Array and scalar',
        required_json: [1, 'two', null],
        json: 42
    });

    await c.create('media_full', 'field_media', {
        title: 'Every media field filled',
        image: ctx.asset('hero'),
        gallery: [
            { id: ctx.asset('gallery_1') },
            { id: ctx.asset('gallery_2') },
            { id: ctx.asset('small') }
        ],
        any_file: ctx.asset('zip'),
        attachments: [ctx.asset('pdf'), ctx.asset('audio'), ctx.asset('logo')],
        pdf_only: ctx.asset('pdf'),
        video: ctx.asset('video'),
        audio: ctx.asset('audio')
    });
    await c.create('media_alt_issues', 'field_media', {
        title: 'An image with no alt, and one used decoratively',
        image: ctx.asset('photo_no_alt'),
        gallery: [{ id: ctx.asset('divider'), decorative: true }]
    });
    await c.create('media_empty', 'field_media', { title: 'No media at all' });

    await c.create('defaults_overridden', 'field_defaults', {
        text: 'Not the default',
        number: 7,
        money: 0,
        boolean: false,
        date: '2027-06-01',
        select: 'final',
        multiselect: ['sms']
    });

    await c.create('layout_full', 'field_layout', {
        title: 'Every group filled',
        first_name: 'Grace',
        last_name: 'Hopper',
        starts_on: '2026-11-01',
        ends_on: '2026-11-30',
        notes: 'In the collapsed Advanced group.',
        internal_id: 'hidden-123'
    });
}

async function seedRelations(c: ContentWriter): Promise<void> {
    await c.create('target_a', 'rel_target', {
        title: 'Target A — held by a RESTRICT link'
    });
    await c.create('target_b', 'rel_target', { title: 'Target B' });
    await c.create('target_c', 'rel_target', { title: 'Target C — draft' });
    await c.create('target_unused', 'rel_target', {
        title: 'Target D — nothing links here'
    });
    for (const key of ['target_a', 'target_b', 'target_unused'])
        await c.publish(key);

    await c.create('m2o_both', 'rel_many_to_one', {
        title: 'Required and optional link set',
        required_restrict: c.id('target_a'),
        optional_set_null: c.id('target_b')
    });
    await c.create('m2o_required_only', 'rel_many_to_one', {
        title: 'Only the required link',
        required_restrict: c.id('target_a')
    });

    await c.create('o2o_taken', 'rel_one_to_one', {
        title: 'Holds Target B',
        unique: c.id('target_b')
    });
    await c.create('o2o_free', 'rel_one_to_one', { title: 'Holds nothing' });

    await c.create(
        'm2m_ordered',
        'rel_many_to_many',
        { title: 'Three targets, in order C, A, B' },
        {
            relations: {
                many: {
                    link: [
                        c.id('target_c'),
                        c.id('target_a'),
                        c.id('target_b')
                    ],
                    order: [
                        c.id('target_c'),
                        c.id('target_a'),
                        c.id('target_b')
                    ]
                }
            }
        }
    );
    await c.create('m2m_empty', 'rel_many_to_many', { title: 'No targets' });

    await c.create('self_root', 'rel_self', { title: 'Root' });
    await c.create('self_child_1', 'rel_self', {
        title: 'Child 1',
        parent: c.id('self_root')
    });
    await c.create(
        'self_child_2',
        'rel_self',
        { title: 'Child 2', parent: c.id('self_root') },
        {
            relations: { related: { link: [c.id('self_child_1')] } }
        }
    );
    await c.create('self_grandchild', 'rel_self', {
        title: 'Grandchild',
        parent: c.id('self_child_1')
    });
}

/** Library lends, Consumer borrows, Archived lends to nobody. */
async function seedSharing(c: ContentWriter): Promise<void> {
    await c.create(
        'lib_shared_1',
        'rel_target',
        { title: 'Library — shared and published' },
        { in: 'library' }
    );
    await c.create(
        'lib_shared_2',
        'rel_target',
        { title: 'Library — second shared target' },
        { in: 'library' }
    );
    await c.create(
        'lib_draft',
        'rel_target',
        { title: 'Library — draft, invisible to Consumer' },
        { in: 'library' }
    );
    await c.publish('lib_shared_1');
    await c.publish('lib_shared_2');

    await c.create(
        'lib_term_en',
        'i18n_target',
        { name: 'Shared term' },
        { in: 'library' }
    );
    await c.create(
        'lib_term_de',
        'i18n_target',
        { name: 'Geteilter Begriff' },
        { in: 'library', locale: 'de', translationOf: 'lib_term_en' }
    );
    await c.publish('lib_term_en');
    await c.publish('lib_term_de');

    await c.create(
        'arch_target',
        'rel_target',
        { title: 'Archived — published, but its workspace is archived' },
        { in: 'archived' }
    );
    await c.publish('arch_target');

    await c.create(
        'consumer_m2o',
        'rel_many_to_one',
        {
            title: 'Consumer — links a Library target',
            required_restrict: c.id('lib_shared_1')
        },
        { in: 'consumer', as: 'editor' }
    );
    await c.create(
        'consumer_m2m',
        'rel_many_to_many',
        { title: 'Consumer — links both Library targets' },
        {
            in: 'consumer',
            as: 'editor',
            relations: {
                many: { link: [c.id('lib_shared_1'), c.id('lib_shared_2')] }
            }
        }
    );
}

async function seedFlags(c: ContentWriter): Promise<void> {
    // No flags: a save is final and a delete is permanent.
    await c.create('flags_none_saved', 'flags_none', {
        title: 'Saved once',
        body: html('No draft, no trash.')
    });
    await c.create('flags_none_edited', 'flags_none', {
        title: 'Saved twice',
        body: html('First version.')
    });
    await c.edit('flags_none_edited', { body: html('Second version.') });

    // Publishable: every state the status badge can show.
    await c.create('flags_pub_draft', 'flags_publishable', {
        title: 'Draft — never published',
        body: html('Not live.')
    });
    await c.create('flags_pub_published', 'flags_publishable', {
        title: 'Published',
        body: html('Live and unchanged.')
    });
    await c.publish('flags_pub_published');
    await c.create('flags_pub_modified', 'flags_publishable', {
        title: 'Modified — published, then edited',
        body: html('The live version.')
    });
    await c.publish('flags_pub_modified');
    await c.edit(
        'flags_pub_modified',
        { body: html('An unpublished edit.') },
        'editor'
    );
    await c.create('flags_pub_unpublished', 'flags_publishable', {
        title: 'Unpublished',
        body: html('Was live once.')
    });
    await c.publish('flags_pub_unpublished');
    await c.unpublish('flags_pub_unpublished');
    await c.create('flags_pub_incomplete', 'flags_publishable', {
        title: 'Incomplete — publish is refused (no body)'
    });
    await c.create('flags_pub_stale', 'flags_publishable', {
        title: 'Stale — published over a year ago',
        body: html('Backdated.')
    });
    await c.publish('flags_pub_stale');

    // A long history: v1–v3 by three people, v3 published (a publish marks
    // the head live, it adds no version), v4 an edit, v5 a restore of v2 —
    // the timeline, diff and restore all have material.
    await c.create('flags_pub_history', 'flags_publishable', {
        title: 'History — five versions',
        body: html('Version 1.')
    });
    await c.edit(
        'flags_pub_history',
        { body: html('Version 2, by Edith.') },
        'editor'
    );
    await c.edit(
        'flags_pub_history',
        { body: html('Version 3, by Eric.') },
        'editor2'
    );
    await c.publish('flags_pub_history');
    await c.edit('flags_pub_history', {
        body: html('Version 5: edited after publishing.')
    });
    await c.restoreRevision('flags_pub_history', 2, 'editor');

    // Paranoid: the trash.
    await c.create('flags_par_live', 'flags_paranoid', {
        title: 'Live',
        body: html('Not in the trash.')
    });
    await c.create('flags_par_trashed', 'flags_paranoid', {
        title: 'Trashed — restore or delete for good',
        body: html('In the trash.')
    });
    await c.trash('flags_par_trashed');
    await c.create('flags_par_restored', 'flags_paranoid', {
        title: 'Restored from the trash',
        body: html('Came back.')
    });
    await c.trash('flags_par_restored');
    await c.restore('flags_par_restored');

    // All three flags at once.
    await c.create('flags_all_en', 'flags_all', {
        title: 'All flags — en published, de draft',
        body: html('English.')
    });
    await c.create(
        'flags_all_de',
        'flags_all',
        { title: 'Alle Flags — Entwurf', body: html('Deutsch.') },
        { locale: 'de', translationOf: 'flags_all_en' }
    );
    await c.publish('flags_all_en');
    await c.create('flags_all_trashed', 'flags_all', {
        title: 'All flags — trashed',
        body: html('Gone.')
    });
    await c.trash('flags_all_trashed');
}

async function seedI18n(c: ContentWriter): Promise<void> {
    // Targets for mirrored links: a full group, an en-only one, and one whose
    // de row is in the trash (a link to it is kept, not dropped).
    await c.create('term_full_en', 'i18n_target', { name: 'Apple' });
    await c.create(
        'term_full_de',
        'i18n_target',
        { name: 'Apfel' },
        { locale: 'de', translationOf: 'term_full_en' }
    );
    await c.create(
        'term_full_fr',
        'i18n_target',
        { name: 'Pomme' },
        { locale: 'fr', translationOf: 'term_full_en' }
    );
    await c.create('term_en_only', 'i18n_target', {
        name: 'Kiwi — English only'
    });
    await c.create('term_trashed_en', 'i18n_target', { name: 'Pear' });
    await c.create(
        'term_trashed_de',
        'i18n_target',
        { name: 'Birne — trashed' },
        { locale: 'de', translationOf: 'term_trashed_en' }
    );
    for (const key of [
        'term_full_en',
        'term_full_de',
        'term_full_fr',
        'term_en_only',
        'term_trashed_en',
        'term_trashed_de'
    ])
        await c.publish(key);

    // Group shapes.
    await c.create('i18n_fields_en_only', 'i18n_fields', {
        title: 'English only — de and fr missing',
        code: 'EN-ONLY',
        audience: 'everyone'
    });
    await c.publish('i18n_fields_en_only');

    await c.create('i18n_fields_full_en', 'i18n_fields', {
        title: 'Translated into all three',
        slug: 'translated',
        summary: 'English summary.',
        body: html('English body.'),
        code: 'ALL-3',
        price: 4900,
        audience: 'members',
        cover: c.asset('hero'),
        logo: c.asset('logo')
    });
    await c.create(
        'i18n_fields_full_de',
        'i18n_fields',
        {
            title: 'In alle drei übersetzt',
            slug: 'uebersetzt',
            summary: 'Deutsche Zusammenfassung.',
            body: html('Deutscher Text.'),
            cover: c.asset('gallery_1')
        },
        { locale: 'de', translationOf: 'i18n_fields_full_en' }
    );
    await c.create(
        'i18n_fields_full_fr',
        'i18n_fields',
        {
            title: 'Traduit dans les trois',
            slug: 'traduit',
            summary: 'Résumé français.',
            body: html('Texte français.'),
            cover: c.asset('gallery_2')
        },
        { locale: 'fr', translationOf: 'i18n_fields_full_en' }
    );
    for (const key of [
        'i18n_fields_full_en',
        'i18n_fields_full_de',
        'i18n_fields_full_fr'
    ])
        await c.publish(key);

    await c.create('i18n_fields_draft_en', 'i18n_fields', {
        title: 'en published, de still a draft',
        code: 'PARTIAL'
    });
    await c.create(
        'i18n_fields_draft_de',
        'i18n_fields',
        { title: 'en veröffentlicht, de Entwurf' },
        { locale: 'de', translationOf: 'i18n_fields_draft_en' }
    );
    await c.publish('i18n_fields_draft_en');

    // A shared field edited on en rewrites de: de turns Modified (still
    // serving its published version) without anyone touching it.
    await c.create('i18n_fields_synced_en', 'i18n_fields', {
        title: 'Shared field changed on en',
        code: 'BEFORE',
        audience: 'everyone'
    });
    await c.create(
        'i18n_fields_synced_de',
        'i18n_fields',
        { title: 'Gemeinsames Feld auf en geändert' },
        { locale: 'de', translationOf: 'i18n_fields_synced_en' }
    );
    await c.publish('i18n_fields_synced_en');
    await c.publish('i18n_fields_synced_de');
    await c.edit(
        'i18n_fields_synced_en',
        { code: 'AFTER', audience: 'staff' },
        'editor'
    );
    await c.publish('i18n_fields_synced_en', 'editor');

    // Links across translations: shared → the same row; mirrored → each
    // language's own row (Kiwi has no de, so de gets none); independent → its own.
    await c.create(
        'i18n_rel_en',
        'i18n_relations',
        {
            title: 'Shared, mirrored and independent links',
            shared_link: c.id('target_a'),
            mirrored_link: c.id('term_full_en'),
            independent_link: c.id('target_a')
        },
        {
            relations: {
                mirrored_many: {
                    link: [c.id('term_full_en'), c.id('term_en_only')]
                }
            }
        }
    );
    await c.create(
        'i18n_rel_de',
        'i18n_relations',
        {
            title: 'Geteilte, gespiegelte und eigene Links',
            independent_link: c.id('target_b')
        },
        { locale: 'de', translationOf: 'i18n_rel_en' }
    );
    await c.create('i18n_rel_trashed_en', 'i18n_relations', {
        title: 'Mirrored link to a translation now in the trash',
        mirrored_link: c.id('term_trashed_en')
    });
    await c.create(
        'i18n_rel_trashed_de',
        'i18n_relations',
        { title: 'Link auf eine Übersetzung im Papierkorb' },
        { locale: 'de', translationOf: 'i18n_rel_trashed_en' }
    );
    await c.trash('term_trashed_de');
    for (const key of ['i18n_rel_en', 'i18n_rel_de', 'i18n_rel_trashed_en'])
        await c.publish(key);
}

async function seedSingles(c: ContentWriter): Promise<void> {
    await c.create('single_plain', 'single_plain', {
        headline: 'The plain single',
        body: html('One row, saved in place.'),
        contact_email: 'hello@example.com'
    });
    await c.create('single_i18n_en', 'single_i18n', {
        headline: 'Translated single',
        body: html('English, published.'),
        theme: 'brand'
    });
    await c.create(
        'single_i18n_de',
        'single_i18n',
        { headline: 'Übersetzte Seite', body: html('Deutsch, Entwurf.') },
        { locale: 'de', translationOf: 'single_i18n_en' }
    );
    await c.publish('single_i18n_en');
}

async function seedScenarios(c: ContentWriter): Promise<void> {
    // en and de published and complete. Clearing `sku` or `owner` on en would
    // leave de failing validation — the editor asks before that save.
    await c.create('sibling_sync_en', 'scenario_sibling_sync', {
        title: 'Clear the SKU on en to see the dialog',
        sku: 'SKU-0001',
        owner: c.id('target_b')
    });
    await c.create(
        'sibling_sync_de',
        'scenario_sibling_sync',
        { title: 'SKU auf en leeren, um den Dialog zu sehen' },
        { locale: 'de', translationOf: 'sibling_sync_en' }
    );
    await c.create(
        'sibling_sync_fr',
        'scenario_sibling_sync',
        { title: 'Videz le SKU sur en' },
        { locale: 'fr', translationOf: 'sibling_sync_en' }
    );
    for (const key of ['sibling_sync_en', 'sibling_sync_de', 'sibling_sync_fr'])
        await c.publish(key);
}
