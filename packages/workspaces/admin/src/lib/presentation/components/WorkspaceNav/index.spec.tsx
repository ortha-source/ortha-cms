import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '@orthacms/design-system';
import { AuthStatus, useAuth } from '@orthacms/identity-admin';
import { useWorkspaces } from '../../../application/useWorkspaces';
import type { Workspace } from '../../../domain/types/workspace';
import {
    WORKSPACE_NAV_SLOT,
    WORKSPACE_SECTION_SLOT
} from '../../slots/workspaceSlots';
import { WorkspaceNav } from './index';

// jsdom has neither, and the sidebar primitives read both on mount.
if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    })) as typeof window.matchMedia;
}
if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
        observe() {
            return undefined;
        }
        unobserve() {
            return undefined;
        }
        disconnect() {
            return undefined;
        }
    } as unknown as typeof ResizeObserver;
}

vi.mock('../../../application/useWorkspaces', () => ({
    useWorkspaces: vi.fn()
}));

vi.mock('@orthacms/identity-admin', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@orthacms/identity-admin')>()),
    useAuth: vi.fn()
}));

const WORKSPACE: Workspace = {
    id: 'ws_1',
    name: 'Marketing site',
    slug: 'marketing-site',
    description: '',
    color: 'violet',
    status: 'Active',
    members: [],
    content: [],
    isShared: false,
    sharedContent: []
};

function renderAt(pathname: string) {
    return render(
        <IntlProvider locale="en">
            <MemoryRouter initialEntries={[pathname]}>
                <SidebarProvider>
                    <WorkspaceNav workspace={WORKSPACE} />
                </SidebarProvider>
            </MemoryRouter>
        </IntlProvider>
    );
}

/**
 * `WorkspaceSectionItem.takeover` — a section that, for some locations, *is*
 * the sidebar. The copilot's Agents view is the user: its chat list replaces
 * the content tree and the Tools group while you are in it, and leaving puts
 * them back.
 */
describe('WorkspaceNav — a section that takes the sidebar over', () => {
    beforeEach(() => {
        vi.mocked(useWorkspaces).mockReturnValue({
            data: [WORKSPACE]
        } as unknown as ReturnType<typeof useWorkspaces>);
        vi.mocked(useAuth).mockReturnValue({
            status: AuthStatus.Authenticated,
            user: { permissions: [] }
        } as unknown as ReturnType<typeof useAuth>);
        WORKSPACE_SECTION_SLOT._register([
            {
                id: 'content',
                order: 10,
                Component: () => <p>Content tree</p>
            },
            {
                id: 'chats',
                order: 5,
                Component: () => <p>Chat list</p>,
                takeover: (pathname) => pathname.includes('/agents')
            }
        ]);
        WORKSPACE_NAV_SLOT._register([
            {
                to: 'media',
                labelId: 'media',
                defaultLabel: 'Media Library',
                icon: () => null,
                order: 10
            } as never
        ]);
    });

    afterEach(() => {
        WORKSPACE_SECTION_SLOT._reset();
        WORKSPACE_NAV_SLOT._reset();
    });

    it('renders every section and the Tools group elsewhere', () => {
        renderAt('/workspaces/ws_1/content');

        expect(screen.getByText('Content tree')).toBeTruthy();
        expect(screen.getByText('Chat list')).toBeTruthy();
        expect(screen.getByText('Media Library')).toBeTruthy();
    });

    it('renders the taking-over section alone where it claims the location', () => {
        renderAt('/workspaces/ws_1/agents');

        expect(screen.getByText('Chat list')).toBeTruthy();
        expect(screen.queryByText('Content tree')).toBeNull();
        expect(screen.queryByText('Media Library')).toBeNull();
        // The workspace header stays: the way home and the switcher.
        expect(screen.getByText('Home')).toBeTruthy();
    });
});
