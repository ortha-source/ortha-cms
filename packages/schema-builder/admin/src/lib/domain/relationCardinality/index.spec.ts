import { cardinalityOf, toRelationFlags, type Cardinality } from './index';

describe('relation cardinality', () => {
    it.each<Cardinality>(['manyToOne', 'oneToOne', 'manyToMany'])(
        'round-trips %s',
        (cardinality) => {
            expect(cardinalityOf(toRelationFlags(cardinality))).toBe(
                cardinality
            );
        }
    );

    it('sets both flags every time, so switching never leaves one behind', () => {
        expect(toRelationFlags('manyToMany')).toEqual({
            many: true,
            unique: false
        });
        expect(toRelationFlags('manyToOne')).toEqual({
            many: false,
            unique: false
        });
    });

    it('reads a relation with no flags as many-to-one, the DSL default', () => {
        expect(cardinalityOf({})).toBe('manyToOne');
    });
});
