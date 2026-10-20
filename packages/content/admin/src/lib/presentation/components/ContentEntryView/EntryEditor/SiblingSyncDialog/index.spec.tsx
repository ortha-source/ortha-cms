import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SiblingSyncRefusal } from '../../../../../infrastructure/entryIssues';
import { EntrySlotContextProvider } from '../../../../hooks/useEntrySlotContext';
import type { EntrySlotContext } from '../../../../slots/contentSlots';
import { SiblingSyncDialog } from './index';

// jsdom lacks what Radix's dialog and checkbox reach for, and this package
// registers no vitest setup file.
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

const SIBLING_REFUSAL: SiblingSyncRefusal = {
    reached: ['de'],
    invalidated: [],
    changes: [
        {
            type: 'article',
            typeLabel: 'Articles',
            entryId: 'de-1',
            locale: 'de',
            title: 'Wie Computer begannen',
            sibling: true,
            published: true,
            optional: false,
            fields: [
                {
                    field: 'readingTime',
                    label: 'Reading time',
                    before: 7,
                    after: 9
                },
                {
                    field: 'body',
                    label: 'Body',
                    before: { type: 'doc' },
                    after: { type: 'doc', content: [] }
                }
            ],
            links: [
                {
                    field: 'contributors',
                    label: 'Contributors',
                    target: 'person',
                    added: [
                        { id: 'ada-de', title: 'Ada (DE)', status: 'draft' }
                    ],
                    removed: [{ id: 'grace-de', title: 'Grace (DE)' }],
                    unresolved: [{ id: 'linus', title: 'Linus' }]
                }
            ]
        }
    ]
};

const REFERRER_REFUSAL: SiblingSyncRefusal = {
    reached: [],
    invalidated: [],
    changes: ['first', 'second'].map((id) => ({
        type: 'article',
        typeLabel: 'Articles',
        entryId: id,
        locale: 'de',
        title: `Article ${id}`,
        sibling: false,
        published: false,
        optional: true,
        fields: [],
        links: [
            {
                field: 'contributors',
                label: 'Contributors',
                added: [{ id: 'ada-de', title: 'Ada' }],
                removed: [],
                unresolved: []
            }
        ]
    }))
};

function renderDialog(
    refusal: SiblingSyncRefusal,
    onConfirm: (skipped: string[]) => void = () => undefined,
    slotContext: EntrySlotContext | null = null
) {
    return render(
        <IntlProvider locale="en">
            <EntrySlotContextProvider value={slotContext}>
                <SiblingSyncDialog
                    refusal={refusal}
                    sharedFields={['Reading time']}
                    labelFor={(name) => name}
                    onCancel={() => undefined}
                    onConfirm={onConfirm}
                />
            </EntrySlotContextProvider>
        </IntlProvider>
    );
}

/** The `<dd>` beside a preview row's `<dt>`, by the field's label. */
function valueOf(preview: HTMLElement, label: string): string {
    return (
        within(preview).getByText(label, { selector: 'dt' }).nextElementSibling
            ?.textContent ?? ''
    );
}

describe('SiblingSyncDialog', () => {
    afterEach(() => vi.restoreAllMocks());

    it('previews what changes in each locale: values, links, and who is left out', () => {
        renderDialog(SIBLING_REFUSAL);
        const dialog = screen.getByRole('dialog', {
            name: 'This also changes another locale'
        });
        const preview = within(dialog).getByRole('region', {
            name: 'What else changes'
        });
        expect(preview.textContent).toContain('German version');
        expect(preview.textContent).toContain(
            'Wie Computer begannen · translation of this record'
        );
        expect(preview.textContent).toContain(
            'Published · will show as Modified'
        );
        expect(valueOf(preview, 'Reading time')).toBe('Now: 7 After saving: 9');
        // A value nobody compares by eye is only said to have changed.
        expect(valueOf(preview, 'Body')).toBe(
            'Updated — too long to preview here'
        );
        const contributors = valueOf(preview, 'Contributors');
        expect(contributors).toContain('Will be linked: Ada (DE)Draft');
        expect(contributors).toContain('Will be unlinked: Grace (DE)');
        expect(preview.textContent).toContain(
            '“Linus” has no German version yet, so it won’t be linked here.'
        );
        // A row the sync keeps consistent cannot be declined.
        expect(within(preview).queryByRole('checkbox')).toBeNull();
        // Outside an editor there is no workspace to link into.
        expect(within(preview).queryByRole('link')).toBeNull();
    });

    it('names the languages it reaches, not their slugs', () => {
        renderDialog(SIBLING_REFUSAL);
        expect(screen.getByRole('dialog').textContent).toContain(
            '“Reading time” is shared by every language of this record, so saving also changes it in German.'
        );
    });

    it('opens each row and each linked record in its own editor, in a new tab', () => {
        renderDialog(SIBLING_REFUSAL, undefined, {
            workspaceId: 'ws-1'
        } as EntrySlotContext);
        const preview = screen.getByRole('region', {
            name: 'What else changes'
        });
        const row = within(preview).getByRole('link', {
            name: 'Open German version in a new tab'
        });
        expect(row.getAttribute('href')).toBe(
            '/workspaces/ws-1/content/article/de-1'
        );
        expect(row.getAttribute('target')).toBe('_blank');
        expect(
            within(preview)
                .getByRole('link', { name: 'Open Ada (DE) in a new tab' })
                .getAttribute('href')
        ).toBe('/workspaces/ws-1/content/person/ada-de');
    });

    it('lets a person leave out a record a new translation would fill in', () => {
        const onConfirm = vi.fn();
        renderDialog(REFERRER_REFUSAL, onConfirm);
        const dialog = screen.getByRole('dialog', {
            name: 'This also changes 2 other records'
        });
        const second = within(dialog).getByRole('checkbox', {
            name: 'Update Article second · Articles · German'
        });
        expect(second.getAttribute('aria-checked')).toBe('true');
        fireEvent.click(second);
        expect(second.getAttribute('aria-checked')).toBe('false');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
        expect(onConfirm).toHaveBeenCalledWith(['second']);
    });

    it('confirms with nothing skipped when nothing was unticked', () => {
        const onConfirm = vi.fn();
        renderDialog(REFERRER_REFUSAL, onConfirm);
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onConfirm).toHaveBeenCalledWith([]);
    });
});
