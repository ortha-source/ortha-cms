import type { AnyContentType } from '@orthacms/content-server/define';
import { post, author } from '../../../testing/types';
import { toRelationDoc } from './to-relation-doc';

function relationOf(type: AnyContentType, field: string) {
    const spec = type.fields[field];
    if (!spec?.relation)
        throw new Error(`${type.name}.${field} is not a relation`);
    return toRelationDoc(spec, spec.relation);
}

describe('toRelationDoc', () => {
    it('names the target and nothing else when every option is the default', () => {
        expect(relationOf(post, 'author')).toEqual({ to: 'sb_author' });
    });

    it('keeps many and unique when set', () => {
        expect(relationOf(post, 'related')).toEqual({
            to: 'sb_post',
            many: true
        });
        expect(relationOf(post, 'lead')).toEqual({
            to: 'sb_author',
            unique: true
        });
    });

    it("omits cascade on a required relation — it is that relation's default", () => {
        expect(relationOf(post, 'owner')).toEqual({ to: 'sb_author' });
    });

    it('keeps an onDelete that differs from the default', () => {
        expect(relationOf(post, 'keep')).toEqual({
            to: 'sb_author',
            onDelete: 'restrict'
        });
    });

    it('keeps a syncAcrossLocales that differs from the localized default', () => {
        expect(relationOf(post, 'local')).toEqual({
            to: 'sb_author',
            syncAcrossLocales: false
        });
    });

    it('reads an inverse by its owning field, with to-many left implicit', () => {
        expect(relationOf(author, 'posts')).toEqual({
            to: 'sb_post',
            inverseOf: 'author'
        });
        expect(relationOf(author, 'primary')).toEqual({
            to: 'sb_post',
            inverseOf: 'lead',
            many: false
        });
    });
});
