import { field } from '../fields';
import type { AnyContentType } from '../types/content-type';
import { collection } from './define';
import { toRuleField, toRuleType } from './to-rule-type';

describe('toRuleType', () => {
    it('carries what the rules read, and nothing they do not', () => {
        const rule = toRuleField(
            field.text({
                required: true,
                localized: true,
                lang: 'de',
                pattern: '^[a-z]+$',
                admin: { width: 'half', group: 'seo', label: 'Slug' }
            })
        );
        expect(rule).toEqual({
            type: 'text',
            required: true,
            localized: true,
            lang: 'de',
            pattern: '^[a-z]+$',
            width: 'half',
            group: 'seo'
        });
    });

    it('carries a relation with its target as a name', () => {
        const tag = collection('tag', { fields: { name: field.text() } });
        const rule = toRuleField(
            field.relation({ to: (): AnyContentType => tag, many: true })
        );
        expect(rule.relation).toMatchObject({
            to: 'tag',
            many: true,
            unique: false,
            onDelete: 'set null'
        });
    });

    it('resolves a relation target lazily, so collection() never touches a thunk', () => {
        const thunk = jest.fn((): AnyContentType => {
            throw new ReferenceError('Cannot access before initialization');
        });
        expect(() =>
            collection('post', {
                fields: { author: field.relation({ to: thunk }) }
            })
        ).not.toThrow();
        expect(thunk).not.toHaveBeenCalled();

        const rule = toRuleType(
            { name: 'post', kind: 'collection', i18n: false },
            { author: field.relation({ to: thunk }) }
        );
        expect(() => rule.fields['author'].relation?.to).toThrow(
            ReferenceError
        );
    });
});
