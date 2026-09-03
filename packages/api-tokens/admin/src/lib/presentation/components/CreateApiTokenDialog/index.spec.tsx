import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceOptions } from '../../../application/useWorkspaceOptions';
import { CreateApiTokenDialog } from './index';

// jsdom implements none of the browser APIs the Radix/cmdk primitives reach
// for, and this package registers no vitest setup file, so the shims the
// design-system's own suite installs globally are installed here instead —
// without them the dialog throws before any assertion is reached.
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

if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
}

if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
}

// The workspace list is a collaborator with its own coverage; what is under
// test is the form's gate and its reset, so the selector is simply fed.
vi.mock('../../../application/useWorkspaceOptions', () => ({
    useWorkspaceOptions: vi.fn()
}));

const workspaceOptions = vi.mocked(useWorkspaceOptions);

const WORKSPACE = 'Marketing site';
const SUBMIT = 'Create token';
const CANCEL = 'Cancel';
const PLACEHOLDER = 'Select workspaces';

/**
 * Renders the dialog open, with the parent still owning `open` — the same
 * arrangement `ApiTokensPage` uses. `setOpen` drives that prop directly, which
 * is how a *successful mint* closes the dialog: the page flips `open` and Radix
 * never hears about it.
 */
function renderDialog() {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    const ui = (open: boolean) => (
        <IntlProvider locale="en" onError={() => undefined}>
            <CreateApiTokenDialog
                open={open}
                onOpenChange={onOpenChange}
                onSubmit={onSubmit}
                submitting={false}
            />
        </IntlProvider>
    );

    const { rerender } = render(ui(true));

    return {
        onOpenChange,
        onSubmit,
        setOpen: (open: boolean) => rerender(ui(open))
    };
}

const nameField = () => screen.getByLabelText('Name') as HTMLInputElement;

const submitButton = () =>
    screen.getByRole('button', { name: SUBMIT }) as HTMLButtonElement;

/** The multi-select trigger, named by its own label — the two `Select`s are combo boxes too. */
const workspacesTrigger = () =>
    screen.getByRole('combobox', { name: 'Workspaces' });

/** Opens the workspace selector and picks the one workspace on offer. */
async function pickWorkspace() {
    fireEvent.click(workspacesTrigger());
    await waitFor(() => expect(screen.getAllByRole('option').length).toBe(1));
    fireEvent.click(screen.getByRole('option', { name: WORKSPACE }));
}

/**
 * The create-token form. Two invariants live here.
 *
 * The first is the submit gate: a token scoped to no workspace is refused by
 * the server with a `400`, so offering an enabled button for one would be a
 * lie — the admin fills the form, presses Create, and is told no by the API.
 *
 * The second is the reset, and it is the reason this file exists. Closing this
 * dialog happens four ways, and only three of them reach Radix's
 * `onOpenChange`: a successful mint closes it by flipping the controlled `open`
 * prop from the page. Cancel used to call `onOpenChange` directly, skipping the
 * wrapper that resets — so cancelling with "Production website" typed and
 * reopening presented the draft as a fresh form, one click from minting a
 * *second* live credential under the same name.
 */
describe('CreateApiTokenDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        workspaceOptions.mockReturnValue({
            data: [{ id: 'ws_1', name: WORKSPACE }],
            isError: false,
            refetch: vi.fn()
        } as unknown as ReturnType<typeof useWorkspaceOptions>);
    });

    it('refuses to submit an empty form', () => {
        renderDialog();

        expect(submitButton().disabled).toBe(true);
    });

    it('still refuses with a name but no workspace [api-tokens:I-05]', () => {
        renderDialog();

        fireEvent.change(nameField(), {
            target: { value: 'Production website' }
        });

        expect(submitButton().disabled).toBe(true);
    });

    // The other half of the same rule. A name is not optional either — an
    // unnamed token is unidentifiable in the table it will sit in for months.
    it('still refuses with a workspace but no name', async () => {
        renderDialog();

        await pickWorkspace();

        expect(submitButton().disabled).toBe(true);
    });

    // Whitespace is not a name: `canSubmit` trims before measuring, so a form
    // holding only spaces has to stay shut like an empty one.
    it('treats a whitespace-only name as no name', () => {
        renderDialog();

        fireEvent.change(nameField(), { target: { value: '   ' } });

        expect(submitButton().disabled).toBe(true);
    });

    it('opens the gate only once both a name and a workspace exist', async () => {
        const { onSubmit } = renderDialog();

        fireEvent.change(nameField(), {
            target: { value: '  Production website  ' }
        });
        await pickWorkspace();

        expect(submitButton().disabled).toBe(false);

        fireEvent.click(submitButton());

        // The trim is not cosmetic — it is the name the token carries forever.
        // `never` is the default expiry, and the gateway expresses that by
        // omitting the field rather than sending a null.
        expect(onSubmit).toHaveBeenCalledWith({
            name: 'Production website',
            workspaceIds: ['ws_1'],
            scope: 'read',
            expiresAt: undefined
        });
    });

    it('shows an empty form after a cancelled draft is reopened', async () => {
        const { onOpenChange, setOpen } = renderDialog();
        fireEvent.change(nameField(), {
            target: { value: 'Production website' }
        });
        await pickWorkspace();

        fireEvent.click(screen.getByRole('button', { name: CANCEL }));
        expect(onOpenChange).toHaveBeenCalledWith(false);

        // The parent obeys, then the admin opens the dialog again.
        setOpen(false);
        setOpen(true);

        expect(nameField().value).toBe('');
        expect(workspacesTrigger().textContent).toContain(PLACEHOLDER);
    });

    /**
     * The success path: the page closes the dialog by flipping `open`, so Radix's
     * `onOpenChange` never fires and no handler on this component runs. Only a
     * reset keyed off the *opening* edge catches this one — and getting it wrong
     * here is the worst case, because the draft that reappears is the draft of a
     * token that was actually minted.
     */
    it('shows an empty form after a controlled close, which no handler sees', () => {
        const { onOpenChange, setOpen } = renderDialog();
        fireEvent.change(nameField(), {
            target: { value: 'Production website' }
        });

        setOpen(false);
        setOpen(true);

        expect(onOpenChange).not.toHaveBeenCalled();
        expect(nameField().value).toBe('');
    });
});
