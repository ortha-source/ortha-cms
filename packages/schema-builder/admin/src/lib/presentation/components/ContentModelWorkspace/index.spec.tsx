import type { ReactNode } from 'react';
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
vi.mock('@orthacms/shell-admin', () => ({
    PageTopBar: () => null,
    PageActionsPortal: ({ children }: { children: ReactNode }) => children
}));

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

const general = () => screen.getByRole('region', { name: 'Fields' });
const button = (name: string | RegExp) =>
    screen.getByRole('button', { name }) as HTMLButtonElement;

/** Opens "Add field" and picks a kind; the field's panel is open after. */
function addFieldOfKind(kind?: string) {
    fireEvent.click(button('Add field'));
    if (kind) fireEvent.click(screen.getByRole('radio', { name: kind }));
    fireEvent.click(button('Continue'));
    return screen.getByRole('dialog', { name: 'New field' });
}

/** Creates a type from the rail, blank unless a template is named. */
function createType(label: string, template?: RegExp) {
    fireEvent.click(button('New content type'));
    const dialog = screen.getByRole('dialog', { name: 'New content type' });
    fireEvent.change(within(dialog).getByLabelText('Name'), {
        target: { value: label }
    });
    if (template)
        fireEvent.click(within(dialog).getByRole('radio', { name: template }));
    fireEvent.click(
        within(dialog).getByRole('button', { name: 'Create type' })
    );
}

/** The open type's Settings sheet. */
function openSettings() {
    fireEvent.click(button('Settings'));
    return screen.getByRole('dialog', { name: /settings$/ });
}

describe('ContentModelWorkspace — editing', () => {
    beforeEach(() => hasPermission.mockReturnValue(true));

    it('says nothing about the draft until something changes', () => {
        renderWorkspace();
        expect(screen.queryByText(/unsaved change/)).toBeNull();
        expect(button('Add field')).toBeTruthy();
    });

    it('heads the page with the open type, its machine name and its flags', () => {
        renderWorkspace();
        expect(
            screen.getByRole('heading', { level: 1, name: 'Articles' })
        ).toBeTruthy();
        // The line under the heading: machine name, kind, flags, field count.
        const meta = screen.getByText('article').closest('p') as HTMLElement;
        for (const fact of [
            'Collection',
            'Draft & publish',
            'Trash',
            'Localized',
            '6 fields'
        ])
            expect(within(meta).getByText(fact)).toBeTruthy();
    });

    it('draws each field label first, its machine name under it, its type in words', () => {
        renderWorkspace();
        const row = within(general())
            .getByRole('button', { name: 'Edit title' })
            .closest('li') as HTMLElement;
        expect(within(row).getByText('Title')).toBeTruthy();
        expect(within(row).getByText('title')).toBeTruthy();
        expect(within(row).getByText('Required')).toBeTruthy();
        expect(within(row).getByText('Short text')).toBeTruthy();
    });

    it('adds a field in a kind dialog and the field’s panel, and nothing reaches the draft until it is added', () => {
        renderWorkspace();
        fireEvent.click(button('Add field'));
        const kinds = screen.getByRole('dialog', {
            name: 'Add a field to Articles'
        });
        fireEvent.click(within(kinds).getByRole('radio', { name: 'Number' }));
        expect(
            within(kinds)
                .getByRole('radio', { name: 'Number' })
                .getAttribute('aria-checked')
        ).toBe('true');
        fireEvent.click(
            within(kinds).getByRole('button', { name: 'Continue' })
        );

        // The same panel that edits a field: the machine name follows the label.
        const sheet = screen.getByRole('dialog', { name: 'New field' });
        fireEvent.change(within(sheet).getByLabelText('Label'), {
            target: { value: 'Reading time' }
        });
        expect(
            (screen.getByLabelText('Machine name') as HTMLInputElement).value
        ).toBe('readingTime');
        // A number takes rules.
        expect(screen.getByRole('tab', { name: 'Validation' })).toBeTruthy();
        expect(screen.queryByText(/unsaved change/)).toBeNull();
        fireEvent.click(button('Add field'));

        expect(screen.getByText('1 unsaved change')).toBeTruthy();
        expect(within(general()).getByText('readingTime')).toBeTruthy();
    });

    it('finds a kind by what it holds', () => {
        renderWorkspace();
        fireEvent.click(button('Add field'));
        fireEvent.change(screen.getByLabelText('Find a kind of field'), {
            target: { value: 'date' }
        });
        expect(
            screen.getAllByRole('radio').map((radio) => radio.textContent)
        ).toEqual([
            expect.stringMatching(/^Date/),
            expect.stringMatching(/^Date & time/)
        ]);
    });

    it('refuses a name the type already uses', () => {
        renderWorkspace();
        addFieldOfKind();
        fireEvent.change(screen.getByLabelText('Machine name'), {
            target: { value: 'title' }
        });
        expect(
            screen.getByText('This type already has a field by that name.')
        ).toBeTruthy();
        expect(button('Add field').disabled).toBe(true);
    });

    it('shows the schema rules’ words about the new field as it is named', () => {
        renderWorkspace();
        addFieldOfKind();
        fireEvent.change(screen.getByLabelText('Machine name'), {
            target: { value: 'status' }
        });
        expect(
            screen.getByText(/collides with an envelope column/)
        ).toBeTruthy();
        expect(button('Add field').disabled).toBe(true);
    });

    it('asks a relation what it links to and how many', () => {
        renderWorkspace();
        const sheet = addFieldOfKind('Relation');
        expect(
            within(sheet).getByRole('group', { name: 'How many' })
        ).toBeTruthy();
        expect(within(sheet).getAllByRole('radio')).toHaveLength(3);
    });

    it('goes back to the kinds, or away, with the draft as it was', () => {
        renderWorkspace();
        const sheet = addFieldOfKind();
        fireEvent.change(within(sheet).getByLabelText('Label'), {
            target: { value: 'Subtitle' }
        });
        fireEvent.click(button('Another kind'));
        expect(
            screen.getByRole('dialog', { name: 'Add a field to Articles' })
        ).toBeTruthy();
        fireEvent.click(button('Cancel'));
        expect(screen.queryByText(/unsaved change/)).toBeNull();
        expect(within(general()).queryByText('subtitle')).toBeNull();
    });

    it('edits a field in its panel, straight into the draft, with a preview on top', () => {
        renderWorkspace();
        fireEvent.click(
            within(general()).getByRole('button', { name: 'Edit title' })
        );
        const sheet = screen.getByRole('dialog', { name: 'Title' });
        expect(
            within(sheet).getByRole('region', {
                name: 'Preview — how editors see it'
            })
        ).toBeTruthy();
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
        fireEvent.click(button('Done'));

        addFieldOfKind('Yes / no');
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
                screen.getByRole('dialog', { name: 'Title' })
            ).getByLabelText('Machine name'),
            { target: { value: 'id' } }
        );
        expect(
            screen.getAllByText(/collides with an envelope column/).length
        ).toBeGreaterThan(0);
        // Counted in the header and on the field's row.
        expect(screen.getAllByText('1 problem')).toHaveLength(2);
    });

    it('removes a field from its menu or its panel, and discards the draft back to the served document', () => {
        renderWorkspace();
        // Radix opens a menu from the keyboard (or pointer-down), not on click.
        fireEvent.keyDown(
            within(general()).getByRole('button', { name: 'Actions for kind' }),
            { key: 'Enter' }
        );
        fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
        expect(within(general()).queryByText('kind')).toBeNull();
        fireEvent.click(
            within(general()).getByRole('button', { name: 'Edit title' })
        );
        fireEvent.click(button('Remove field'));
        expect(within(general()).queryByText('title')).toBeNull();
        expect(screen.getByText('2 unsaved changes')).toBeTruthy();
        fireEvent.click(button('Discard changes'));
        expect(within(general()).getByText('kind')).toBeTruthy();
        expect(screen.queryByText(/unsaved change/)).toBeNull();
    });

    it('adds a type from the rail and opens it', () => {
        renderWorkspace();
        createType('Events');
        expect(
            screen.getByRole('heading', { level: 1, name: 'Events' })
        ).toBeTruthy();
        const settings = openSettings();
        expect(
            (
                within(settings).getByLabelText(
                    'Machine name'
                ) as HTMLInputElement
            ).disabled
        ).toBe(false);
    });

    it('starts a type from a template’s fields', () => {
        renderWorkspace();
        createType('Events', /^Event/);
        for (const name of ['title', 'starts', 'ends', 'place'])
            expect(within(general()).getByText(name)).toBeTruthy();
        expect(screen.queryByText('No fields yet')).toBeNull();
    });

    it('greets a blank type with an empty state that leads to the first field', () => {
        renderWorkspace();
        createType('Events');
        expect(screen.getByText('No fields yet')).toBeTruthy();
        fireEvent.click(button('Add the first field'));
        expect(
            screen.getByRole('dialog', { name: 'Add a field to Events' })
        ).toBeTruthy();
    });

    it('fixes the storage flags of an existing type, except turning the trash on', () => {
        renderWorkspace(owned, '/content-model/author');
        openSettings();
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
        openSettings();
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
        fireEvent.click(button('Done'));

        // A type created in this draft: every flag goes on and off freely.
        createType('Events');
        openSettings();
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
        expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
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
