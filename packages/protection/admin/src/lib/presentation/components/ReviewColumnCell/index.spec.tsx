import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IntlProvider } from 'react-intl';
import type { EntryReviewStatus } from '../../../domain/types';
import { ReviewColumnCell } from './index';

const ENTRY = 'entry-1';

/** Render the cell for one row's status, or for no status at all. */
function show(status?: Partial<EntryReviewStatus>) {
    const byEntry = status
        ? {
              [ENTRY]: {
                  protected: true,
                  required: 2,
                  given: 0,
                  stale: 0,
                  changesRequested: false,
                  requested: false,
                  blocked: true,
                  ...status
              }
          }
        : {};
    return render(
        <IntlProvider locale="en">
            <ReviewColumnCell
                entry={{ id: ENTRY } as never}
                data={{ data: byEntry }}
                typePath="/workspaces/w/content/article"
            />
        </IntlProvider>
    );
}

describe('the records list review column', () => {
    /**
     * The column is hidden by default and its data arrives a beat after the
     * rows, so "we have not asked yet" is the common state. Rendering a
     * placeholder would claim the row is unprotected, which is a different fact.
     */
    it('renders nothing at all when there is no status for the row', () => {
        const { container } = show();

        expect(container.innerHTML).toBe('');
    });

    it('says a type without a rule needs no review', () => {
        show({ protected: false, required: 0, blocked: false });

        expect(screen.getByText('No review')).toBeTruthy();
    });

    it('reads the tally when the rule is not yet satisfied', () => {
        show({ given: 1, requested: true });

        expect(screen.getByText('1 of 2')).toBeTruthy();
    });

    it('says ready once the rule is satisfied', () => {
        show({ given: 2, blocked: false });

        expect(screen.getByText('Ready')).toBeTruthy();
    });

    /**
     * A bare "1 of 2" in a row of numbers says nothing about what was counted.
     * A screen-reader user arrives at the cell with only the column header for
     * context, and headers are not announced on every cell — so the meaning has
     * to be on the cell itself.
     */
    it('names what the number means, for a reader who has only the cell', () => {
        show({ given: 1, requested: true });

        expect(
            screen.getByLabelText('1 of 2 approvals; publishing is held')
        ).toBeTruthy();
    });

    /**
     * `changes_requested` never lowers the count, so it is reported beside the
     * tally rather than folded into it — the number still says how far the
     * approvals got, and the label says somebody asked for something.
     */
    it('mentions requested changes in the label without changing the count', () => {
        show({ given: 1, requested: true, changesRequested: true });

        expect(screen.getByText('1 of 2')).toBeTruthy();
        expect(
            screen.getByLabelText(
                '1 of 2 approvals; publishing is held and changes were requested'
            )
        ).toBeTruthy();
    });

    it('distinguishes an untouched row from one being worked on', () => {
        show({ given: 0, requested: false });

        expect(screen.getByText('Not requested')).toBeTruthy();
    });
});
