import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { InviteDetails } from '../../../../types/auth';
import { ssoProvidersKey } from '../../../application/useSsoProviders';
import { AcceptInviteForm } from './index';

function renderForm(invite: InviteDetails) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    // No providers: the SSO block renders nothing and asks nobody.
    queryClient.setQueryData(ssoProvidersKey, []);
    return render(
        <QueryClientProvider client={queryClient}>
            <IntlProvider locale="en" onError={() => undefined}>
                <MemoryRouter>
                    <AcceptInviteForm invite={invite} token={'a'.repeat(64)} />
                </MemoryRouter>
            </IntlProvider>
        </QueryClientProvider>
    );
}

/** The text an element's `aria-describedby` points at. */
function description(element: HTMLElement): string {
    return (element.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ');
}

const BASE: InviteDetails = { email: 'lena@growth.io', name: 'Lena Hale' };

describe('AcceptInviteForm', () => {
    it('says what the invite is for — the role and the workspaces', () => {
        renderForm({
            ...BASE,
            role: 'Contributor',
            workspaces: ['Marketing site', 'Support hub']
        });

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'You’re invited to Ortha CMS'
            })
        ).toBeTruthy();
        expect(
            screen.getByText(
                'as a Contributor in Marketing site and Support hub'
            )
        ).toBeTruthy();
    });

    it('chooses the article by the role, and drops what the server did not say', () => {
        renderForm({ ...BASE, role: 'Admin', workspaces: [] });
        expect(screen.getByText('as an Admin')).toBeTruthy();
    });

    it('names no inviter — the heading says “You’re invited”, not who did it', () => {
        renderForm({ ...BASE, role: 'Editor', workspaces: ['Docs'] });
        // The board's "Ada Lovelace invited you" is the shape that must not
        // come back; the read-only fields' "whoever invited you" is fine.
        expect(screen.queryByText(/\S+ invited you$/)).toBeNull();
    });

    it('shows the name and email read-only, each with its reason', () => {
        renderForm(BASE);

        const name = screen.getByLabelText('Name');
        const email = screen.getByLabelText('Email');
        expect(name.hasAttribute('readonly')).toBe(true);
        expect(email.hasAttribute('readonly')).toBe(true);
        expect(description(name)).toMatch(
            /You can change it later in your profile/
        );
        expect(description(email)).toMatch(/ask them for a new invite/);
    });

    it('asks for the password once, with a strength meter', () => {
        renderForm(BASE);

        const password = screen.getByLabelText('Password', {
            selector: 'input'
        });
        expect(password.getAttribute('autocomplete')).toBe('new-password');
        expect(
            document.querySelectorAll('input[autocomplete="new-password"]')
        ).toHaveLength(1);
        expect(
            document.querySelector('[data-slot="password-strength"]')
        ).not.toBeNull();
    });
});
