import { fieldOf } from '../../testing/fixtures';
import { diffField } from './diff-field';

describe('diffField', () => {
    it('reports nothing for an unchanged field', () => {
        const field = fieldOf('post', 'title', { type: 'text', maxLength: 80 });
        expect(diffField('post', field, { ...field })).toEqual([]);
    });

    it('reports a rename by key, not a remove and an add', () => {
        const before = fieldOf('post', 'title', { type: 'text' });
        expect(
            diffField('post', before, { ...before, name: 'headline' })
        ).toEqual([
            {
                kind: 'field.rename',
                type: 'post',
                from: 'title',
                to: 'headline'
            }
        ]);
    });

    it('reports a retype alone, whatever else changed with it', () => {
        const before = fieldOf('post', 'rating', {
            type: 'text',
            maxLength: 5
        });
        const after = { ...before, spec: { type: 'number' as const, min: 0 } };
        expect(diffField('post', before, after)).toEqual([
            {
                kind: 'field.retype',
                type: 'post',
                field: 'rating',
                from: 'text',
                to: 'number'
            }
        ]);
    });

    it('reports an update with the keys that changed', () => {
        const before = fieldOf('post', 'title', {
            type: 'text',
            maxLength: 80
        });
        const after = {
            ...before,
            spec: { type: 'text' as const, maxLength: 40, required: true }
        };
        expect(diffField('post', before, after)).toEqual([
            {
                kind: 'field.update',
                type: 'post',
                field: 'title',
                keys: ['maxLength', 'required'],
                before: before.spec,
                after: after.spec
            }
        ]);
    });
});
