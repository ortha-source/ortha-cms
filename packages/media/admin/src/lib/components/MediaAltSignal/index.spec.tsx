import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { Sheet, SheetContent } from '@orthacms/design-system';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaAltSignal } from './index';
import { MediaAltDrill } from '../MediaAltDrill';

const hooks = vi.hoisted(() => ({ coverage: vi.fn(), missing: vi.fn() }));

vi.mock('../../hooks/useMediaInsights', () => ({
    useMediaAltCoverage: hooks.coverage,
    useMediaAltMissing: hooks.missing
}));

vi.mock('@orthacms/workspaces-admin', () => ({
    useCurrentWorkspace: () => ({
        id: 'ws',
        name: 'Docs',
        members: [{ id: 'u1', name: 'Amara', initials: 'AO', color: 'teal' }]
    })
}));

const wrap = (children: ReactNode) => (
    <IntlProvider locale="en">
        <MemoryRouter>{children}</MemoryRouter>
    </IntlProvider>
);

beforeEach(() => {
    hooks.coverage.mockReset();
    hooks.missing.mockReset();
});

describe('MediaAltSignal', () => {
    it('counts the images missing alt text, as a share of the library', () => {
        hooks.coverage.mockReturnValue({
            data: { images: 2481, withAlt: 1687, missing: 794 },
            isPending: false,
            isError: false
        });
        render(wrap(<MediaAltSignal onOpen={vi.fn()} isOpen={false} />));
        const line = screen.getByRole('button');
        expect(line.textContent).toContain('794');
        expect(line.textContent).toContain(
            'In Media Library · 32% of 2,481 images'
        );
    });
});

describe('MediaAltDrill', () => {
    it('lists the images with who uploaded them, and opens the library', () => {
        hooks.missing.mockReturnValue({
            data: {
                total: 23,
                assets: [
                    {
                        id: 'a1',
                        name: 'hero.jpg',
                        folderId: null,
                        uploadedBy: 'u1',
                        createdAt: '2025-03-04T10:00:00Z'
                    }
                ]
            },
            isPending: false,
            isError: false
        });
        render(
            wrap(
                <Sheet open>
                    <SheetContent>
                        <MediaAltDrill />
                    </SheetContent>
                </Sheet>
            )
        );
        expect(
            screen.getByRole('dialog', {
                name: 'Images missing alt text · 23 images'
            })
        ).toBeTruthy();
        expect(screen.getByText('hero.jpg')).toBeTruthy();
        expect(screen.getByText('Uploaded by Amara')).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Open Media Library' })
                .getAttribute('href')
        ).toBe('/media');
    });
});
