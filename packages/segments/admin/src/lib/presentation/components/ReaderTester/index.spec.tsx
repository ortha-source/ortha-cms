import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import { ReaderTester } from './index';

function draw(name: string, tags: string[]) {
    return render(
        <IntlProvider locale="en">
            <ReaderTester name={name} tags={tags} />
        </IntlProvider>
    );
}

const tryReader = (text: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: 'Try a reader' }), {
        target: { value: text }
    });

describe('ReaderTester', () => {
    it('says nothing until a reader is typed', () => {
        draw('Acme Corp', ['acme', 'acme-legacy']);
        expect(screen.getByRole('status').textContent).toBe('');
    });

    it('puts a reader carrying one of the tags in the audience', () => {
        draw('Acme Corp', ['acme', 'acme-legacy']);
        tryReader('acme-legacy');
        expect(screen.getByRole('status').textContent).toBe('In Acme Corp');
    });

    it('leaves a reader carrying none of them out', () => {
        draw('Acme Corp', ['acme']);
        tryReader('globex, plan-pro');
        expect(screen.getByRole('status').textContent).toBe('Not in Acme Corp');
    });

    it('calls out a near miss that only differs in case', () => {
        draw('Acme Corp', ['acme']);
        tryReader('Acme');
        expect(screen.getByRole('status').textContent).toContain(
            'Tags match exactly'
        );
    });

    it('explains which tags let a reader in', () => {
        draw('Acme Corp', ['acme', 'acme-legacy']);
        expect(
            screen.getByText(/see entries restricted to Acme Corp/).textContent
        ).toBe(
            'Readers with acme or acme-legacy see entries restricted to Acme Corp.'
        );
    });
});
