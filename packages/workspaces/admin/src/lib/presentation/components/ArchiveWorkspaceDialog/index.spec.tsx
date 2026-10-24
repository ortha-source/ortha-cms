import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useArchiveImpact } from '../../../application/useArchiveImpact';
import { ArchiveWorkspaceDialog } from './index';

vi.mock('../../../application/useArchiveImpact', () => ({
    useArchiveImpact: vi.fn()
}));

const impact = vi.mocked(useArchiveImpact);

/** Stubs the impact query in one of its three states. */
function answer(
    state:
        | { isPending: true }
        | { isError: true }
        | {
              data: {
                  records: number;
                  members: number;
                  linkedWorkspaces: number;
              };
          }
) {
    impact.mockReturnValue({
        isPending: 'isPending' in state,
        isError: 'isError' in state,
        data: 'data' in state ? state.data : undefined
    } as unknown as ReturnType<typeof useArchiveImpact>);
}

function renderDialog(busy = false) {
    return render(
        <IntlProvider locale="en">
            <ArchiveWorkspaceDialog
                workspace={{ id: 'w1', name: 'Support hub' }}
                onClose={() => undefined}
                onConfirm={() => undefined}
                busy={busy}
            />
        </IntlProvider>
    );
}

const confirmButton = () =>
    screen.getByRole('button', {
        name: 'Archive workspace'
    }) as HTMLButtonElement;

/**
 * The archive confirmation says what archiving touches before its button:
 * what stays, and who notices. Archiving deletes nothing, so — unlike the
 * delete dialog — an unknown count does not hold the button.
 */
describe('ArchiveWorkspaceDialog', () => {
    beforeEach(() => impact.mockReset());

    it('names the workspace and lists what stays and who notices', () => {
        answer({ data: { records: 318, members: 2, linkedWorkspaces: 2 } });
        renderDialog();

        expect(
            screen.getByRole('heading', { name: 'Archive Support hub?' })
        ).toBeTruthy();
        expect(screen.getByText(/318 records stay/)).toBeTruthy();
        expect(screen.getByText(/2 members keep their accounts/)).toBeTruthy();
        expect(
            screen.getByText(
                /2 workspaces linking its records see them as unavailable/
            )
        ).toBeTruthy();
        expect(confirmButton().disabled).toBe(false);
    });

    it('leaves the linking line out when nothing links its records', () => {
        answer({ data: { records: 1, members: 1, linkedWorkspaces: 0 } });
        renderDialog();

        expect(screen.getByText(/1 record stays/)).toBeTruthy();
        expect(screen.queryByText(/linking its records/)).toBeNull();
    });

    it('announces the count while it loads', () => {
        answer({ isPending: true });
        renderDialog();

        expect(screen.getByRole('status').textContent).toContain(
            'Counting what this affects'
        );
    });

    it('says the count failed without blocking a reversible archive', () => {
        answer({ isError: true });
        renderDialog();

        expect(
            screen.getByText(/Couldn’t count what this affects/)
        ).toBeTruthy();
        expect(confirmButton().disabled).toBe(false);
    });

    it('holds both buttons while the archive is in flight', () => {
        answer({ data: { records: 0, members: 1, linkedWorkspaces: 0 } });
        renderDialog(true);

        expect(confirmButton().disabled).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Cancel'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });
});
