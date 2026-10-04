import type { SchemaChange } from '@orthacms/schema-builder-domain';
import { MIGRATION_NAME, suggestMigrationName } from './index';

const add = (type: string, field: string): SchemaChange => ({
    kind: 'field.add',
    type,
    field,
    spec: { type: 'text' }
});

describe('suggestMigrationName', () => {
    it('names a single change after itself', () => {
        expect(
            suggestMigrationName([{ kind: 'type.add', type: 'event' }])
        ).toBe('add_event');
        expect(suggestMigrationName([add('event', 'startsAt')])).toBe(
            'add_event_starts_at'
        );
        expect(
            suggestMigrationName([
                {
                    kind: 'field.remove',
                    type: 'event',
                    field: 'legacy',
                    spec: { type: 'text' }
                }
            ])
        ).toBe('remove_event_legacy');
    });

    it('summarises several changes by their type, or the whole model', () => {
        expect(
            suggestMigrationName([add('event', 'a'), add('event', 'b')])
        ).toBe('update_event');
        expect(
            suggestMigrationName([add('event', 'a'), add('venue', 'b')])
        ).toBe('update_content_model');
    });

    it('always produces a name the server takes', () => {
        const long = add('a'.repeat(70), 'b');
        expect(suggestMigrationName([long])).toMatch(MIGRATION_NAME);
        expect(
            suggestMigrationName([{ kind: 'type.add', type: '9lives' }])
        ).toMatch(MIGRATION_NAME);
    });
});
