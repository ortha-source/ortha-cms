import { moveGroup } from './index';

describe('moveGroup', () => {
    const seo = { key: 'seo', label: 'SEO' };
    const place = { key: 'place', label: 'Place' };
    const extra = { key: 'extra', label: 'Extra' };
    const groups = [seo, place, extra];

    it('moves a group down to where the target is', () => {
        expect(moveGroup(groups, 'seo', 'extra')).toEqual([place, extra, seo]);
    });

    it('moves a group up to where the target is', () => {
        expect(moveGroup(groups, 'extra', 'seo')).toEqual([extra, seo, place]);
    });

    it('leaves the list alone on itself or an unknown key', () => {
        expect(moveGroup(groups, 'seo', 'seo')).toBe(groups);
        expect(moveGroup(groups, 'seo', 'nope')).toBe(groups);
        expect(moveGroup(groups, 'nope', 'seo')).toBe(groups);
    });
});
