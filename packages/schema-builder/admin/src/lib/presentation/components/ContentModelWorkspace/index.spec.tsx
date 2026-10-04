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

    it('adds a field in three steps, and nothing reaches the draft until it is added', () => {
        renderWorkspace();
        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
        expect(
            screen.getByRole('heading', { level: 1, name: 'Add a field' })
        ).toBeTruthy();

        // Kind: one radio per kind of field, each saying what it is for.
        fireEvent.click(screen.getByRole('radio', { name: 'Number' }));
        expect(
            screen
                .getByRole('radio', { name: 'Number' })
                .getAttribute('aria-checked')
        ).toBe('true');
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        // Basics: the machine name follows the label.
        fireEvent.change(screen.getByLabelText('Label'), {
            target: { value: 'Reading time' }
        });
        expect(
            (screen.getByLabelText('Machine name') as HTMLInputElement).value
        ).toBe('readingTime');
        expect(screen.queryByText(/unsaved change/)).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        // Rules and display: a number takes rules.
        expect(
            screen.getByRole('heading', { level: 3, name: 'Validation' })
        ).toBeTruthy();
        expect(screen.queryByText(/unsaved change/)).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));

        // Back in the editor, with the field in the draft.
        expect(
            screen.getByRole('heading', { level: 1, name: 'Content Model' })
        ).toBeTruthy();
        expect(screen.getByText('1 unsaved change')).toBeTruthy();
        expect(within(general()).getByText('readingTime')).toBeTruthy();
    });

    it('refuses a name the type already uses before the next step', () => {
        renderWorkspace();
        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.change(screen.getByLabelText('Machine name'), {
            target: { value: 'title' }
        });
        expect(
            screen.getByText('This type already has a field by that name.')
        ).toBeTruthy();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Continue'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });

    it('shows the schema rules’ words about the new field as it is named', () => {
        renderWorkspace();
        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.change(screen.getByLabelText('Machine name'), {
            target: { value: 'status' }
        });
        expect(
            screen.getByText(/collides with an envelope column/)
        ).toBeTruthy();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Continue'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });

    it('asks a relation what it links to and how many, among the basics', () => {
        renderWorkspace();
        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Relation' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('group', { name: 'How many' })).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(3);
    });

    it('goes back to the type with the draft as it was', () => {
        renderWorkspace();
        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.change(screen.getByLabelText('Label'), {
            target: { value: 'Subtitle' }
        });
        fireEvent.click(screen.getByRole('link', { name: 'Back to Articles' }));
        expect(
            screen.getByRole('heading', { level: 1, name: 'Content Model' })
        ).toBeTruthy();
        expect(screen.queryByText(/unsaved change/)).toBeNull();
        expect(within(general()).queryByText('subtitle')).toBeNull();
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

        // And the add-field page asks for rules only when the kind takes them.
        fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Yes / no' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.change(screen.getByLabelText('Label'), {
            target: { value: 'Featured' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(
            screen.queryByRole('heading', { level: 3, name: 'Validation' })
        ).toBeNull();
        expect(
            screen.getByRole('heading', { level: 3, name: 'Display' })
        ).toBeTruthy();
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

    it('greets a new type with no fields with an empty state that leads to the first one', () => {
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

        expect(screen.getByText('No fields yet')).toBeTruthy();
        expect(screen.queryByRole('region', { name: 'General' })).toBeNull();
        // The description is a small text box of its own.
        expect(screen.getByLabelText('Description').tagName.toLowerCase()).toBe(
            'textarea'
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Add the first field' })
        );
        expect(
            screen.getByRole('heading', { level: 1, name: 'Add a field' })
        ).toBeTruthy();
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

    it('lets an unapplied flag change be taken back — on a new type and on an existing one', () => {
        renderWorkspace(owned, '/content-model/author');
        const trash = () =>
            screen.getByRole('switch', {
                name: 'Trash (soft delete)'
            }) as HTMLButtonElement;
        fireEvent.click(trash());
        expect(trash().getAttribute('aria-checked')).toBe('true');
        expect(trash().disabled).toBe(false);
        fireEvent.click(trash());
        expect(trash().getAttribute('aria-checked')).toBe('false');
        expect(screen.queryByText(/unsaved change/)).toBeNull();

        // A type created in this draft: every flag goes on and off freely.
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
        for (const name of [
            'Draft & publish',
            'Trash (soft delete)',
            'Localized'
        ]) {
            const flag = () =>
                screen.getByRole('switch', { name }) as HTMLButtonElement;
            const before = flag().getAttribute('aria-checked');
            fireEvent.click(flag());
            fireEvent.click(flag());
            expect(flag().getAttribute('aria-checked')).toBe(before);
            expect(flag().disabled).toBe(false);
        }
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
