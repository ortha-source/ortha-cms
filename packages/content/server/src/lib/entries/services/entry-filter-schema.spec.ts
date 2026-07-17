import { ScalarFieldType } from '@ortha-cms/utils-server';
import { collection } from '../../collection/define';
import { field } from '../../fields';
import { buildEntryFilterSchema } from './entry-filter-schema';

/**
 * `buildEntryFilterSchema` derives the query-builder whitelist from a content
 * type's schema. The model invariant under test: `status`/`publishedAt` are
 * filterable only on publishable types, and unfilterable field kinds
 * (`json`/`multiselect`/`relation`) are dropped — keyed by field name so the
 * engine resolves them straight to table columns.
 */
describe('buildEntryFilterSchema', () => {
    const fields = {
        title: field.text({ required: true }),
        count: field.number(),
        tag: field.select({ options: ['a', 'b'] as const }),
        flag: field.boolean(),
        when: field.date(),
        meta: field.json(),
        labels: field.multiselect({ options: ['x', 'y'] as const })
    };

    it('whitelists envelope + scalar fields, dropping json/multiselect', () => {
        const type = collection('publishable_doc', {
            publishable: true,
            fields
        });

        const schema = buildEntryFilterSchema(type);

        // Always-present envelope timestamps.
        expect(schema.fields?.createdAt).toEqual({ type: ScalarFieldType.Date });
        expect(schema.fields?.updatedAt).toEqual({ type: ScalarFieldType.Date });

        // Scalar fields, type-mapped and keyed by field name.
        expect(schema.fields?.title).toEqual({ type: ScalarFieldType.String });
        expect(schema.fields?.count).toEqual({ type: ScalarFieldType.Number });
        expect(schema.fields?.tag).toEqual({
            type: ScalarFieldType.Enum,
            enumValues: ['a', 'b']
        });
        expect(schema.fields?.flag).toEqual({ type: ScalarFieldType.Boolean });
        expect(schema.fields?.when).toEqual({ type: ScalarFieldType.Date });

        // No scalar editor → omitted from the filter surface.
        expect(schema.fields?.meta).toBeUndefined();
        expect(schema.fields?.labels).toBeUndefined();
    });

    it('exposes status + publishedAt only on publishable types', () => {
        const schema = buildEntryFilterSchema(
            collection('pub', { publishable: true, fields })
        );
        expect(schema.fields?.status).toEqual({
            type: ScalarFieldType.Enum,
            enumValues: ['draft', 'published']
        });
        expect(schema.fields?.publishedAt).toEqual({
            type: ScalarFieldType.Date
        });
    });

    it('omits status + publishedAt on a non-publishable type', () => {
        const schema = buildEntryFilterSchema(
            collection('plain', { fields })
        );
        expect(schema.fields?.status).toBeUndefined();
        expect(schema.fields?.publishedAt).toBeUndefined();
        // Scalar fields are still filterable.
        expect(schema.fields?.title).toEqual({ type: ScalarFieldType.String });
    });

    it('exposes the locale column only on i18n types', () => {
        const i18nType = collection('loc', {
            i18n: true,
            fields: { title: field.text({ localized: true }) }
        });
        expect(buildEntryFilterSchema(i18nType).fields?.locale).toEqual({
            type: ScalarFieldType.String
        });
        const plain = collection('plain2', { fields });
        expect(buildEntryFilterSchema(plain).fields?.locale).toBeUndefined();
    });

    it('merges extension fields and registers them as extensionFields', () => {
        const type = collection('loc2', {
            i18n: true,
            fields: { title: field.text({ localized: true }) }
        });
        const schema = buildEntryFilterSchema(type, {
            hasLocale: {
                type: ScalarFieldType.Enum,
                enumValues: ['en', 'de']
            },
            localeCount: { type: ScalarFieldType.Number }
        });
        // Declared in `fields` so the parser can coerce values...
        expect(schema.fields?.hasLocale).toEqual({
            type: ScalarFieldType.Enum,
            enumValues: ['en', 'de']
        });
        expect(schema.fields?.localeCount).toEqual({
            type: ScalarFieldType.Number
        });
        // ...and registered as virtual so the translator routes them out.
        expect(schema.extensionFields).toEqual(
            new Set(['hasLocale', 'localeCount'])
        );
    });

    it('does not let an extension field shadow a real column', () => {
        const type = collection('loc3', {
            i18n: true,
            fields: { title: field.text({ localized: true }) }
        });
        // `title` is a real field — an extension declaration for it is ignored.
        const schema = buildEntryFilterSchema(type, {
            title: { type: ScalarFieldType.Number }
        });
        expect(schema.fields?.title).toEqual({ type: ScalarFieldType.String });
        expect(schema.extensionFields?.has('title')).toBe(false);
    });
});
