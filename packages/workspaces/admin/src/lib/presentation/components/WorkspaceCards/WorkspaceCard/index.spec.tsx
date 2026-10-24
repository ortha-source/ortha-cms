import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Workspace } from '../../../../domain/types/workspace';
import { WorkspaceCard } from './index';

const member = (id: string, name: string) => ({
    id,
    name,
    email: `${id}@orthacms.dev`,
    initials: name.slice(0, 2).toUpperCase(),
    color: 'teal' as const,
    pending: false
});

function workspace(overrides: Partial<Workspace> = {}): Workspace {
    return {
        id: 'w1',
        slug: 'marketing-site',
        name: 'Marketing site',
        description: 'Landing pages and the blog.',
        color: 'violet',
        status: 'Active',
        members: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) =>
            member(id, `Person ${id}`)
        ),
        content: ['article', 'author'],
        isShared: true,
        sharedContent: [],
        recordCount: 842,
        recordCountByType: { article: 842 },
        createdAt: null,
        lastEditedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
        archivedAt: null,
        ...overrides
    };
}

function renderCard(subject: Workspace, canUpdate = true) {
    const onRestore = vi.fn();
    render(
        <IntlProvider locale="en">
            <MemoryRouter>
                <ul>
                    <WorkspaceCard
                        workspace={subject}
                        justCreated={false}
                        canUpdate={canUpdate}
                        onArchive={() => undefined}
                        onRestore={onRestore}
                        statusPending={false}
                    />
                </ul>
            </MemoryRouter>
        </IntlProvider>
    );
    return { onRestore };
}

describe('WorkspaceCard', () => {
    it('says what is inside and when it last moved', () => {
        renderCard(workspace());

        expect(screen.getByText('Shared')).toBeTruthy();
        expect(screen.getByText(/^Edited 12 min\. ago$/)).toBeTruthy();
        expect(screen.getByText('842').parentElement?.textContent).toBe(
            '842 records'
        );
        expect(screen.getByText('2').parentElement?.textContent).toBe(
            '2 content types'
        );
        // Four faces and "+2", read once as the whole roster.
        expect(screen.getByText('+2')).toBeTruthy();
        expect(screen.getByRole('img', { name: /^6 members:/ })).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Open Marketing site' })
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'More for Marketing site' })
        ).toBeTruthy();
    });

    it('turns into a Restore card once archived', () => {
        const { onRestore } = renderCard(
            workspace({
                status: 'Archived',
                archivedAt: new Date(Date.now() - 60 * 60_000).toISOString()
            })
        );

        expect(screen.getByText('Archived')).toBeTruthy();
        expect(screen.getByText(/^Archived 1 hr\. ago$/)).toBeTruthy();
        expect(screen.queryByText('Shared')).toBeNull();
        expect(
            screen.queryByRole('link', { name: 'Open Marketing site' })
        ).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Restore Marketing site' })
        );
        expect(onRestore).toHaveBeenCalledOnce();
    });

    it('keeps an archived card openable for someone who cannot restore it', () => {
        renderCard(workspace({ status: 'Archived' }), false);
        expect(
            screen.queryByRole('button', { name: 'Restore Marketing site' })
        ).toBeNull();
        expect(
            screen.getByRole('link', { name: 'Open Marketing site' })
        ).toBeTruthy();
    });
});
