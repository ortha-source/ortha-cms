// Read off the DOM rather than through `jest-dom`: this package registers no
// matcher setup.
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import { ReaderTagsInput, splitTags } from './index';

/** A controlled harness, with the current value printed for the assertions. */
function Harness({ initial = [] as string[] }) {
    const [tags, setTags] = useState(initial);
    return (
        <IntlProvider locale="en">
            <label htmlFor="tags">Reader tags</label>
            <ReaderTagsInput id="tags" value={tags} onChange={setTags} />
            <span data-testid="value">{tags.join('|')}</span>
        </IntlProvider>
    );
}

const value = () => screen.getByTestId('value').textContent;
const input = () =>
    screen.getByRole('textbox', { name: 'Reader tags' }) as HTMLInputElement;

describe('splitTags', () => {
    it('splits on commas and line breaks, trimming and dropping blanks', () => {
        expect(splitTags(' acme ,acme-legacy\n\nplan-pro\r\n')).toEqual([
            'acme',
            'acme-legacy',
            'plan-pro'
        ]);
    });
});

describe('ReaderTagsInput', () => {
    it('turns what was typed into a chip on Enter', () => {
        render(<Harness />);
        fireEvent.change(input(), { target: { value: 'acme' } });
        fireEvent.keyDown(input(), { key: 'Enter' });

        expect(value()).toBe('acme');
        expect(input().value).toBe('');
        expect(
            screen.getByRole('button', { name: 'Remove tag acme' })
        ).toBeTruthy();
    });

    it('turns what was typed into a chip on a comma', () => {
        render(<Harness initial={['acme']} />);
        fireEvent.change(input(), { target: { value: 'acme-legacy' } });
        fireEvent.keyDown(input(), { key: ',' });

        expect(value()).toBe('acme|acme-legacy');
    });

    it('does not add a tag twice', () => {
        render(<Harness initial={['acme']} />);
        fireEvent.change(input(), { target: { value: 'acme' } });
        fireEvent.keyDown(input(), { key: 'Enter' });

        expect(value()).toBe('acme');
    });

    it('makes a pasted list into as many chips', () => {
        render(<Harness />);
        fireEvent.paste(input(), {
            clipboardData: { getData: () => 'acme\nacme-legacy, plan-pro' }
        });

        expect(value()).toBe('acme|acme-legacy|plan-pro');
    });

    it('keeps an uncommitted tag when the field is left', () => {
        render(<Harness />);
        fireEvent.change(input(), { target: { value: 'acme' } });
        fireEvent.blur(input());

        expect(value()).toBe('acme');
    });

    it('takes the last chip back for editing on Backspace in an empty input', () => {
        render(<Harness initial={['acme', 'acme-legacy']} />);
        fireEvent.keyDown(input(), { key: 'Backspace' });

        expect(value()).toBe('acme');
        expect(input().value).toBe('acme-legacy');
    });

    it('removes a chip from its × and returns focus to the input', () => {
        render(<Harness initial={['acme', 'acme-legacy']} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'Remove tag acme' })
        );

        expect(value()).toBe('acme-legacy');
        expect(document.activeElement).toBe(input());
    });

    it('announces what changed', () => {
        render(<Harness />);
        fireEvent.change(input(), { target: { value: 'acme' } });
        fireEvent.keyDown(input(), { key: 'Enter' });

        expect(screen.getByRole('status').textContent).toBe('Added acme.');
    });
});
