import { FIELD_TYPE } from '../types/filter-field.type';
import { OP } from '../types/filter-tree.type';
import { opsForField } from './operators';

/**
 * `opsForField` decides two things at once, and the second is easy to miss: the
 * operators a field offers, **and their order** — picking a field resets its
 * rule to `opsForField(field)[0]`, so the order is the default.
 */
describe('opsForField', () => {
    it('offers everything the type allows when the field declares nothing', () => {
        expect(opsForField({ type: FIELD_TYPE.Enum })).toContain(OP.Equals);
        expect(opsForField({ type: FIELD_TYPE.Enum })).toContain(OP.IsOneOf);
    });

    it('keeps the order the field declared, so it chooses its own default', () => {
        // The reason this is the field's call and not the type's: segments'
        // audience fields are asked "which audiences", where the multi-select
        // answers the single-audience case too. Ordered by the type instead,
        // every enum field would open on `equals`.
        expect(
            opsForField({
                type: FIELD_TYPE.Enum,
                operators: [OP.IsOneOf, OP.Equals]
            })
        ).toEqual([OP.IsOneOf, OP.Equals]);
    });

    it('still refuses an operator the type does not admit', () => {
        // The declaration picks *from* the type's set; it does not extend it. A
        // boolean field asking for a range would otherwise render an editor its
        // value shape cannot fill.
        expect(
            opsForField({
                type: FIELD_TYPE.Boolean,
                operators: [OP.Between, OP.Equals]
            })
        ).toEqual([OP.Equals]);
    });

    it('falls back to the type’s set when the declaration matches nothing', () => {
        // A config error, and an operator picker with no options at all is the
        // worse of the two failures — the rule can then never be completed.
        expect(
            opsForField({
                type: FIELD_TYPE.Boolean,
                operators: [OP.Between]
            })
        ).toEqual([OP.Equals]);
    });

    it('offers nothing for a type it has never heard of', () => {
        // `OPS_FOR_TYPE` is a plain object and the type arrives from a server
        // response, so a field naming an `Object.prototype` member must not read
        // back a truthy non-array.
        expect(
            opsForField({
                type: 'constructor' as unknown as typeof FIELD_TYPE.Enum
            })
        ).toEqual([]);
    });
});
