import { WorkspaceColor, WORKSPACE_COLORS } from './workspace-color';
import { InvalidWorkspaceColorError } from '../errors';

describe('WorkspaceColor', () => {
    it.each([...WORKSPACE_COLORS])('accepts the palette key %s', (key) => {
        expect(WorkspaceColor.create(key).value).toBe(key);
    });

    it.each([
        ['off the palette', 'chartreuse'],
        ['empty', ''],
        ['a hex value', '#ff0000'],
        ['a css token', 'var(--color-avatar-slate)'],
        ['right key, wrong case', 'Violet'],
        ['padded', ' violet ']
    ])('rejects %s', (_label, value) => {
        // The point of the VO: an arbitrary string must never reach the column,
        // because the admin casts what it reads back to an `AvatarColor`.
        expect(() => WorkspaceColor.create(value)).toThrow(
            InvalidWorkspaceColorError
        );
    });

    it('defaults to slate', () => {
        expect(WorkspaceColor.default().value).toBe('slate');
    });

    it('keeps the palette in the order the admin renders swatches in', () => {
        // The swatch row is positional — a reorder here silently reshuffles the
        // picker, so pin it rather than leaving it to the array literal.
        expect([...WORKSPACE_COLORS]).toEqual([
            'slate',
            'green',
            'amber',
            'violet',
            'rose',
            'teal',
            'indigo'
        ]);
    });
});
