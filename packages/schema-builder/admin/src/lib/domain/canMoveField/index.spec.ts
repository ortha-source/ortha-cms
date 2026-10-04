import { entry } from '../../../testing/document';
import { canMoveField } from './index';

describe('canMoveField', () => {
    const title = entry('t', 'title', { type: 'text' });
    const count = entry('t', 'count', { type: 'number' });
    const flag = entry('t', 'flag', { type: 'boolean' });
    const body = entry('t', 'body', {
        type: 'richtext',
        admin: { group: 'g' }
    });
    const note = entry('t', 'note', { type: 'text', admin: { group: 'g' } });

    it('allows a move within one rank above the groups', () => {
        expect(canMoveField(title, count)).toBe(true);
    });

    it('refuses a move across ranks — the editor would re-sort it anyway', () => {
        expect(canMoveField(title, flag)).toBe(false);
    });

    it('allows any move inside one group, whatever the ranks', () => {
        expect(canMoveField(body, note)).toBe(true);
    });

    it('refuses a move into or out of a group', () => {
        expect(canMoveField(title, note)).toBe(false);
        expect(canMoveField(note, title)).toBe(false);
    });
});
