import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SiblingSyncRefusal } from '../../../../../infrastructure/entryIssues';
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
                    added: [{ id: 'ada-de', title: 'Ada (DE)' }],
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
    onConfirm: (skipped: string[]) => void = () => undefined
) {
    return render(
        <IntlProvider locale="en">
            <SiblingSyncDialog
                refusal={refusal}
                sharedFields={['Reading time']}
                labelFor={(name) => name}
                onCancel={() => undefined}
                onConfirm={onConfirm}
            />
        </IntlProvider>
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
        expect(preview.textContent).toContain('German');
        expect(preview.textContent).toContain('Published · becomes Modified');
        expect(preview.textContent).toContain('Reading time: 7 → 9');
        // A value nobody compares by eye is only said to have changed.
        expect(preview.textContent).toContain('Body: changed');
        expect(preview.textContent).toContain('Contributors: + “Ada (DE)”');
        expect(preview.textContent).toContain('Contributors: − “Grace (DE)”');
        expect(preview.textContent).toContain(
            '“Linus” has no German translation'
        );
        // A row the sync keeps consistent cannot be declined.
        expect(within(preview).queryByRole('checkbox')).toBeNull();
    });

    it('lets a person leave out a record a new translation would fill in', () => {
        const onConfirm = vi.fn();
        renderDialog(REFERRER_REFUSAL, onConfirm);
        const dialog = screen.getByRole('dialog', {
            name: 'This also changes 2 other records'
        });
        const second = within(dialog).getByRole('checkbox', {
            name: 'Change Articles: Article second · German'
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
