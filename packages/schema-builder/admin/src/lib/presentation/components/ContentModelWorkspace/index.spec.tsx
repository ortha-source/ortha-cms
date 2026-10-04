import '../../../../testing/jsdomShims';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHasPermission } from '@orthacms/identity-admin';
import { article, author, envelopeOf } from '../../../../testing/document';
import { ContentModelWorkspace } from './index';

vi.mock('@orthacms/identity-admin', () => ({ useHasPermission: vi.fn() }));
vi.mock('@orthacms/shell-admin', () => ({ PageTopBar: () => null }));

const hasPermission = vi.mocked(useHasPermission);
const editable = { editable: true, restart: 'watch' } as const;
// The builder owns both types here, so both are editable.
const owned = envelopeOf(
    [
        { ...article, origin: 'builder' },
        { ...author, origin: 'builder' }
    ],
    editable
);

function renderWorkspace(envelope = owned, path = '/content-model/article') {
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <IntlProvider locale="en">
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route
                            path="/content-model/:typeName?"
                            element={
                                <ContentModelWorkspace envelope={envelope} />
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </IntlProvider>
        </QueryClientProvider>
    );
}

const general = () => screen.getByRole('region', { name: 'General' });

describe('ContentModelWorkspace — editing', () => {
    beforeEach(() => hasPermission.mockReturnValue(true));

    it('says nothing about the draft until something changes', () => {
        renderWorkspace();
        expect(screen.queryByText(/unsaved change/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Add field' })).toBeTruthy();
    });

    it('adds a field through the dialog, then opens its sheet', () => {
        renderWorkspace();
        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
        const dialog = screen.getByRole('dialog', { name: 'Add a field' });
        fireEvent.click(within(dialog).getByRole('radio', { name: 'Number' }));
        fireEvent.change(within(dialog).getByLabelText('Label'), {
            target: { value: 'Reading time' }
        });
        expect(
            (within(dialog).getByLabelText('Machine name') as HTMLInputElement)
                .value
        ).toBe('readingTime');
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Add field' })
        );

        expect(
            screen.getByRole('dialog', { name: 'readingTime' })
        ).toBeTruthy();
        expect(screen.getByText('1 unsaved change')).toBeTruthy();
        expect(
            within(
                screen.getByRole('navigation', {
                    name: 'Content types',
                    // The open sheet is modal: the page behind it is hidden from assistive tech.
                    hidden: true
                })
            ).getByRole('img', { name: 'Unsaved changes', hidden: true })
        ).toBeTruthy();
    });

    it('refuses a name the type already uses', () => {
        renderWorkspace();
        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
        const dialog = screen.getByRole('dialog', { name: 'Add a field' });
        fireEvent.change(within(dialog).getByLabelText('Machine name'), {
            target: { value: 'title' }
        });
        expect(
            within(dialog).getByText(
                'This type already has a field by that name.'
            )
        ).toBeTruthy();
        expect(
            (
                within(dialog).getByRole('button', {
                    name: 'Add field'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });

    it('edits a field in its sheet, straight into the draft', () => {
        renderWorkspace();
        fireEvent.click(
            within(general()).getByRole('button', { name: 'Edit title' })
        );
        const sheet = screen.getByRole('dialog', { name: 'title' });
        fireEvent.change(within(sheet).getByLabelText('Label'), {
            target: { value: 'Headline' }
        });
        expect(within(general()).getByText('Headline')).toBeTruthy();
        expect(screen.getByText('1 unsaved change')).toBeTruthy();
    });

    it('offers the Validation tab only to a type that takes rules', () => {
        renderWorkspace();
        fireEvent.click(
            within(general()).getByRole('button', { name: 'Edit title' })
        );
        expect(screen.getByRole('tab', { name: 'Validation' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));

        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
        const dialog = screen.getByRole('dialog', { name: 'Add a field' });
        fireEvent.click(
            within(dialog).getByRole('radio', { name: 'Yes / no' })
        );
        fireEvent.change(within(dialog).getByLabelText('Label'), {
            target: { value: 'Featured' }
        });
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Add field' })
        );
        expect(screen.queryByRole('tab', { name: 'Validation' })).toBeNull();
        expect(screen.getByRole('tab', { name: 'Display' })).toBeTruthy();
    });

    it('shows the schema rules’ words for a field that breaks one', () => {
        renderWorkspace();
        fireEvent.click(
            within(general()).getByRole('button', { name: 'Edit title' })
        );
        fireEvent.change(
            within(
                screen.getByRole('dialog', { name: 'title' })
            ).getByLabelText('Machine name'),
            {
                target: { value: 'id' }
            }
        );
        expect(
            screen.getAllByText(/collides with an envelope column/).length
        ).toBeGreaterThan(0);
        // Counted in the header and on the field's row.
        expect(screen.getAllByText('1 problem')).toHaveLength(2);
    });

    it('removes a field and discards the draft back to the served document', () => {
        renderWorkspace();
        // Radix opens a menu from the keyboard (or pointer-down), not on click.
        fireEvent.keyDown(
            within(general()).getByRole('button', { name: 'Actions for kind' }),
            { key: 'Enter' }
        );
        fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
        expect(within(general()).queryByText('kind')).toBeNull();
        fireEvent.click(
            screen.getByRole('button', { name: 'Discard changes' })
        );
        expect(within(general()).getByText('kind')).toBeTruthy();
        expect(screen.queryByText(/unsaved change/)).toBeNull();
    });

    it('adds a type from the rail and opens it', () => {
        renderWorkspace();
        fireEvent.click(
            screen.getByRole('button', { name: 'New content type' })
        );
        const dialog = screen.getByRole('dialog', { name: 'New content type' });
        fireEvent.change(within(dialog).getByLabelText('Label'), {
            target: { value: 'Events' }
        });
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Add type' })
        );
        expect(
            screen.getByRole('heading', { level: 2, name: 'Events' })
        ).toBeTruthy();
        expect(
            (screen.getByLabelText('Machine name') as HTMLInputElement).disabled
        ).toBe(false);
    });

    it('fixes the storage flags of an existing type, except turning the trash on', () => {
        renderWorkspace(owned, '/content-model/author');
        expect(
            (
                screen.getByRole('switch', {
                    name: 'Draft & publish'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
        expect(
            (
                screen.getByRole('switch', {
                    name: 'Trash (soft delete)'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(false);
    });

    it('keeps a hand-written type read-only, saying why', () => {
        renderWorkspace(envelopeOf([article, author], editable));
        expect(screen.getByText(/is written by hand in/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Add field' })).toBeNull();
    });

    it('without schema:manage, reads the model and says what editing needs', () => {
        hasPermission.mockReturnValue(false);
        renderWorkspace();
        expect(screen.getByText(/Changing it needs the/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Add field' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'New content type' })
        ).toBeNull();
    });
});
