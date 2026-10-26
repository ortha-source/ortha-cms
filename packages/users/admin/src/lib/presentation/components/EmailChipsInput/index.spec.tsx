import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import { EmailChipsInput } from './index';

/** A controlled host, as the sheet is. */
function Host({ flagged = new Set<string>() }: { flagged?: Set<string> }) {
    const [emails, setEmails] = useState<string[]>([]);
    return (
        <IntlProvider locale="en">
            <label htmlFor="emails">Emails</label>
            <EmailChipsInput
                id="emails"
                emails={emails}
                flagged={flagged}
                onChange={setEmails}
            />
        </IntlProvider>
    );
}

const input = () => screen.getByRole('textbox', { name: 'Emails' });
const chips = () =>
    screen.queryAllByRole('listitem').map((chip) => chip.textContent);

describe('EmailChipsInput', () => {
    it('commits what was typed on Enter and on a comma', () => {
        render(<Host />);
        fireEvent.change(input(), { target: { value: 'lena@growth.io' } });
        fireEvent.keyDown(input(), { key: 'Enter' });
        fireEvent.change(input(), { target: { value: 'Sam@Growth.io' } });
        fireEvent.keyDown(input(), { key: ',' });

        expect(chips()).toEqual(['lena@growth.io', 'sam@growth.io']);
        expect(input()).toHaveProperty('value', '');
    });

    it('splits a pasted list into one chip per address', () => {
        render(<Host />);
        fireEvent.paste(input(), {
            clipboardData: {
                getData: () => 'a@x.io\nb@x.io; a@x.io'
            }
        });
        expect(chips()).toEqual(['a@x.io', 'b@x.io']);
    });

    it('takes the last chip back on Backspace in an empty box', () => {
        render(<Host />);
        fireEvent.change(input(), { target: { value: 'a@x.io, b@x.io,' } });
        fireEvent.keyDown(input(), { key: 'Backspace' });
        expect(chips()).toEqual(['a@x.io']);
    });

    it('removes a chip from its own labelled button', () => {
        render(<Host />);
        fireEvent.change(input(), { target: { value: 'a@x.io, b@x.io,' } });
        fireEvent.click(screen.getByRole('button', { name: 'Remove a@x.io' }));
        expect(chips()).toEqual(['b@x.io']);
    });

    it('lets plain Tab move on when nothing is typed', () => {
        render(<Host />);
        const event = fireEvent.keyDown(input(), { key: 'Tab' });
        // `fireEvent` answers false when the default was prevented.
        expect(event).toBe(true);
    });

    it('marks a flagged address on its chip, and keeps it', () => {
        render(<Host flagged={new Set(['ada@orthacms.dev'])} />);
        fireEvent.change(input(), {
            target: { value: 'ada@orthacms.dev, ok@x.io,' }
        });
        const flagged = screen
            .getAllByRole('listitem')
            .filter((chip) => chip.dataset.flagged === 'true');
        expect(flagged.map((chip) => chip.textContent)).toEqual([
            'ada@orthacms.dev'
        ]);
    });
});
