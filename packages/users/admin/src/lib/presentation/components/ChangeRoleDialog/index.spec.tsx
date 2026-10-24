import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@orthacms/utils-admin';
import { useAuth, useHasPermission } from '@orthacms/identity-admin';
import { installDomShims } from '../../../../test/domShims';
import { httpMemberGateway } from '../../../infrastructure/httpMemberGateway';
import type { Member } from '../../../domain/types/member';
import { ChangeRoleDialog } from './index';

installDomShims();

vi.mock('../../../infrastructure/httpMemberGateway', () => ({
    httpMemberGateway: { listRoles: vi.fn(), update: vi.fn() }
}));

vi.mock('@orthacms/identity-admin', () => ({
    useAuth: vi.fn(),
    useHasPermission: vi.fn()
}));

const listRoles = vi.mocked(httpMemberGateway.listRoles);
const update = vi.mocked(httpMemberGateway.update);

/** Grace, an ordinary contributor nothing guards. */
const GRACE: Member = {
    id: 'u_grace',
    name: 'Grace Hopper',
    email: 'grace@x.io',
    initials: 'GH',
    color: 'violet',
    role: 'contributor',
    roleName: 'Contributor',
    status: 'active',
    joinedAt: new Date('2026-01-01'),
    isLastAdmin: false,
    workspaces: [],
    lastActiveAt: null
};

function renderDialog(member: Member = GRACE) {
    const onOpenChange = vi.fn();
    render(
        <QueryClientProvider
            client={
                new QueryClient({
                    defaultOptions: {
                        queries: { retry: false },
                        mutations: { retry: false }
                    }
                })
            }
        >
            <IntlProvider locale="en">
                <ChangeRoleDialog
                    member={member}
                    open
                    onOpenChange={onOpenChange}
                />
            </IntlProvider>
        </QueryClientProvider>
    );
    return { onOpenChange };
}

describe('ChangeRoleDialog', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            user: { id: 'u_admin' }
        } as ReturnType<typeof useAuth>);
        vi.mocked(useHasPermission).mockReturnValue(true);
        listRoles.mockResolvedValue([
            {
                key: 'admin',
                name: 'Administrator',
                permissions: [
                    'content:update',
                    'content:publish',
                    'users:update',
                    'tokens:create',
                    'webhooks:manage',
                    'workspaces:create',
                    'workspaces:update'
                ]
            },
            {
                key: 'contributor',
                name: 'Contributor',
                permissions: ['content:update', 'content:publish']
            },
            { key: 'viewer', name: 'Viewer', permissions: [] }
        ]);
        update.mockReset();
    });

    it('highlights what the chosen role changes and names the outcome', async () => {
        renderDialog();
        fireEvent.click(screen.getByRole('radio', { name: /^Admin/ }));

        const table = await screen.findByRole('table', {
            name: 'What changes'
        });
        const changed = [
            ...table.querySelectorAll('tr[data-changed="true"] th')
        ].map((cell) => cell.textContent);
        expect(changed).toEqual([
            'Manage members and roles',
            'API tokens and webhooks',
            'Create and configure workspaces'
        ]);
        expect(
            screen.getByRole('button', { name: 'Make Grace an admin' })
        ).toBeTruthy();
    });

    it('sends the role and closes', async () => {
        update.mockResolvedValue({ ...GRACE, role: 'viewer' });
        const { onOpenChange } = renderDialog();
        fireEvent.click(screen.getByRole('radio', { name: /^Viewer/ }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Make Grace a viewer' })
        );

        await waitFor(() =>
            expect(update).toHaveBeenCalledWith({
                id: 'u_grace',
                role: 'viewer'
            })
        );
        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('locks your own role, with the reason written out', () => {
        vi.mocked(useAuth).mockReturnValue({
            user: { id: 'u_grace' }
        } as ReturnType<typeof useAuth>);
        renderDialog();

        expect(screen.getByText(/can’t change your own role/)).toBeTruthy();
        expect(
            (screen.getByRole('radio', { name: /^Admin/ }) as HTMLButtonElement)
                .disabled
        ).toBe(true);
    });

    it('turns a last-admin refusal from the server into the reason', async () => {
        update.mockRejectedValue(
            new ApiError(409, 'Conflict', { code: 'LAST_ADMIN_PROTECTED' })
        );
        renderDialog();
        fireEvent.click(screen.getByRole('radio', { name: /^Viewer/ }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Make Grace a viewer' })
        );

        expect(
            await screen.findByText(
                'Grace is the last admin — make someone else admin first.'
            )
        ).toBeTruthy();
    });
});
