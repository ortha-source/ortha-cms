import type { ContentField, ContentFieldGroup } from '../types/contentType';
import { sectionFields } from '.';

/** A text field named `name`, joining `group` when given. */
function field(name: string, group?: unknown): ContentField {
    return {
        name,
        type: 'text',
        required: false,
        validation: {},
        admin: group === undefined ? {} : { group }
    };
}

/** A declared group. */
function group(key: string): ContentFieldGroup {
    return { key, label: key, collapsed: false };
}

/** The split reduced to names. */
function shape(result: ReturnType<typeof sectionFields>) {
    return {
        ungrouped: result.ungrouped.map((f) => f.name),
        sections: result.sections.map((s) => [
            s.group.key,
            s.fields.map((f) => f.name)
        ])
    };
}

describe('sectionFields', () => {
    it('leaves every field ungrouped when the type declares no groups', () => {
        expect(
            shape(sectionFields([field('a'), field('b')], undefined))
        ).toEqual({ ungrouped: ['a', 'b'], sections: [] });
    });

    it('buckets fields by group, in the groups’ declared order', () => {
        const result = sectionFields(
            [field('title'), field('meta', 'advanced'), field('start', 'when')],
            [group('when'), group('advanced')]
        );
        expect(shape(result)).toEqual({
            ungrouped: ['title'],
            sections: [
                ['when', ['start']],
                ['advanced', ['meta']]
            ]
        });
    });

    it('keeps declaration order inside a section', () => {
        const result = sectionFields(
            [field('b', 'g'), field('a', 'g'), field('c', 'g')],
            [group('g')]
        );
        expect(result.sections[0].fields.map((f) => f.name)).toEqual([
            'b',
            'a',
            'c'
        ]);
    });

    it('drops a section with nothing left to draw', () => {
        // Its only member lives on another tab, so the caller never passed it.
        const result = sectionFields([field('title')], [group('links')]);
        expect(result.sections).toEqual([]);
    });

    it('keeps a field naming an unknown group, ungrouped', () => {
        const result = sectionFields(
            [field('a', 'gone'), field('b', 42)],
            [group('g')]
        );
        expect(shape(result)).toEqual({ ungrouped: ['a', 'b'], sections: [] });
    });
});
