import { entry } from '../../../testing/document';
import { fieldDrop, type FieldDropList } from './index';

describe('fieldDrop', () => {
    const title = entry('t', 'title', { type: 'text' });
    const count = entry('t', 'count', { type: 'number' });
    const flag = entry('t', 'flag', { type: 'boolean' });
    const slug = entry('t', 'slug', { type: 'text', admin: { group: 'seo' } });
    const meta = entry('t', 'meta', { type: 'json', admin: { group: 'seo' } });

    const loose: FieldDropList = { group: null, fields: [title, count, flag] };
    const seo: FieldDropList = { group: 'seo', fields: [slug, meta] };
    const empty: FieldDropList = { group: 'place', fields: [] };

    describe('inside one list', () => {
        it('reorders to where the target is', () => {
            expect(fieldDrop(count, loose, loose, title)).toEqual({
                kind: 'move',
                before: title.key
            });
            expect(fieldDrop(meta, seo, seo, slug)).toEqual({
                kind: 'move',
                before: slug.key
            });
        });

        it('refuses a move across ranks above the groups', () => {
            expect(fieldDrop(flag, loose, loose, title)).toEqual({
                kind: 'refused'
            });
        });

        it('does nothing dropped on itself or nowhere', () => {
            expect(fieldDrop(title, loose, loose, title)).toEqual({
                kind: 'none'
            });
            expect(fieldDrop(title, loose, loose, null)).toEqual({
                kind: 'none'
            });
        });
    });

    describe('into another list', () => {
        it('joins a group before the field it is dropped on', () => {
            expect(fieldDrop(title, loose, seo, meta)).toEqual({
                kind: 'regroup',
                group: 'seo',
                before: meta.key
            });
        });

        it('lands where the drag drew it, the list already holding it', () => {
            // Drawn between slug and meta, dropped on itself.
            const drawn: FieldDropList = {
                group: 'seo',
                fields: [slug, title, meta]
            };
            expect(fieldDrop(title, loose, drawn, title)).toEqual({
                kind: 'regroup',
                group: 'seo',
                before: meta.key
            });
            expect(fieldDrop(title, loose, drawn, null)).toEqual({
                kind: 'regroup',
                group: 'seo',
                before: meta.key
            });
        });

        it('then moves to where the field it is over is, as a reorder does', () => {
            const drawn: FieldDropList = {
                group: 'seo',
                fields: [title, slug, meta]
            };
            // Down over meta: after it, last.
            expect(fieldDrop(title, loose, drawn, meta)).toEqual({
                kind: 'regroup',
                group: 'seo',
                before: null
            });
            const below: FieldDropList = {
                group: 'seo',
                fields: [slug, meta, title]
            };
            // Up over slug: before it, first.
            expect(fieldDrop(title, loose, below, slug)).toEqual({
                kind: 'regroup',
                group: 'seo',
                before: slug.key
            });
        });

        it('joins an empty group, dropped on the group itself', () => {
            expect(fieldDrop(title, loose, empty, null)).toEqual({
                kind: 'regroup',
                group: 'place',
                before: null
            });
        });

        it('moves between two groups', () => {
            expect(fieldDrop(slug, seo, empty, null)).toEqual({
                kind: 'regroup',
                group: 'place',
                before: null
            });
        });

        it('leaves a group for the loose fields whatever their ranks', () => {
            // The editor sorts it among them by rank — leaving the group is the change.
            expect(fieldDrop(meta, seo, loose, title)).toEqual({
                kind: 'regroup',
                group: null,
                before: title.key
            });
        });
    });
});
