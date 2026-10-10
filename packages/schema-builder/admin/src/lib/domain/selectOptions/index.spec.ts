import { describe, expect, it } from 'vitest';
import { addOption, removeOption, renameOption } from './index';

describe('selectOptions', () => {
    const options = ['news', 'opinion'];

    describe('renameOption', () => {
        it('renames an option, leaving a default that names another alone', () => {
            expect(
                renameOption({ options, defaultValue: 'opinion' }, 0, 'food')
            ).toEqual({ options: ['food', 'opinion'] });
        });

        it('carries a select’s default along with the option it names', () => {
            expect(
                renameOption({ options, defaultValue: 'news' }, 0, 'newsy')
            ).toEqual({ options: ['newsy', 'opinion'], defaultValue: 'newsy' });
        });

        it('carries a multiselect’s default along, keeping the others', () => {
            expect(
                renameOption(
                    { options, defaultValue: ['news', 'opinion'] },
                    1,
                    'op-ed'
                )
            ).toEqual({
                options: ['news', 'op-ed'],
                defaultValue: ['news', 'op-ed']
            });
        });
    });

    describe('removeOption', () => {
        it('clears a select’s default that named it', () => {
            expect(removeOption({ options, defaultValue: 'news' }, 0)).toEqual({
                options: ['opinion'],
                defaultValue: undefined
            });
        });

        it('drops it from a multiselect’s default', () => {
            expect(
                removeOption({ options, defaultValue: ['news', 'opinion'] }, 0)
            ).toEqual({ options: ['opinion'], defaultValue: ['opinion'] });
        });

        it('leaves a default that names another option alone', () => {
            expect(
                removeOption({ options, defaultValue: 'opinion' }, 0)
            ).toEqual({ options: ['opinion'] });
        });
    });

    describe('addOption', () => {
        it('adds a trimmed value last', () => {
            expect(addOption({ options }, '  review ')).toEqual({
                options: ['news', 'opinion', 'review']
            });
        });

        it('refuses an empty value or one already there', () => {
            expect(addOption({ options }, '  ')).toBeNull();
            expect(addOption({ options }, 'news')).toBeNull();
        });
    });
});
