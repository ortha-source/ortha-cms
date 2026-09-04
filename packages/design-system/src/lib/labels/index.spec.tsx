import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DesignSystemLabelsProvider, useDesignSystemLabels } from '.';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '../components/ui/sheet';

/**
 * ORT-159 — the labels context, which is the whole of the library's answer to
 * i18n and had no coverage of its own.
 *
 * Two promises live in six lines of `labels/index.tsx`, and both are the kind
 * that break silently. The `{ ...DEFAULT_LABELS, ...labels }` merge is what
 * makes adding a key to `DesignSystemLabels` a non-breaking change: a host
 * pinned to an older version supplies a `Partial` that omits it, and the
 * default has to fill the hole rather than leaving an icon-only control with an
 * empty accessible name. And `closeLabel ?? labels.close` is what keeps a call
 * site able to say something more specific than the host's generic chrome —
 * inverted, the context would quietly overwrite every deliberate name in the
 * admin and nothing would throw.
 *
 * `localizable-copy.spec.tsx` covers the prop and the bare default. Neither of
 * those mounts a provider, so neither can tell the merge or the precedence
 * apart from their absence; that is what these add.
 */

/** Reads the context the way a library component does. */
function LabelProbe() {
    const labels = useDesignSystemLabels();
    return <span data-testid="close-label">{labels.close}</span>;
}

const closeLabel = () => screen.getByTestId('close-label').textContent;

describe('DesignSystemLabelsProvider', () => {
    it('keeps the English default for a key the host did not supply [design-system:I-07]', () => {
        // The host that has not heard of a key yet, exactly: an empty
        // `Partial`. Drop the `...DEFAULT_LABELS` half of the merge and every
        // key in the context is `undefined`.
        render(
            <DesignSystemLabelsProvider labels={{}}>
                <LabelProbe />
            </DesignSystemLabelsProvider>
        );

        expect(closeLabel()).toBe('Close');
    });

    it('leaves the icon-only control named when the host supplies nothing [design-system:I-07]', () => {
        // The same merge read through the control it exists for. A missing
        // default does not throw here — it produces a button with no
        // accessible name at all, which is a 4.1.2 failure a type checker
        // cannot see because `Partial` permits the omission by design.
        render(
            <DesignSystemLabelsProvider labels={{}}>
                <Dialog open>
                    <DialogContent>
                        <DialogTitle>Remove member</DialogTitle>
                    </DialogContent>
                </Dialog>
            </DesignSystemLabelsProvider>
        );

        expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    });

    it('hands a supplied key down to the components below it [design-system:I-07]', () => {
        // The other direction of the same merge: the host's value has to win
        // over the default, or the provider does nothing at all.
        render(
            <DesignSystemLabelsProvider labels={{ close: 'Schließen' }}>
                <LabelProbe />
            </DesignSystemLabelsProvider>
        );

        expect(closeLabel()).toBe('Schließen');
    });
});

describe('a call-site prop against the labels context', () => {
    it('lets the dialog call site outrank the host chrome [design-system:I-08]', () => {
        // Both are present and they disagree, which is the only fixture that
        // separates `closeLabel ?? labels.close` from either half alone.
        render(
            <DesignSystemLabelsProvider labels={{ close: 'Schließen' }}>
                <Dialog open>
                    <DialogContent closeLabel="Entwurf verwerfen">
                        <DialogTitle>Entwurf</DialogTitle>
                    </DialogContent>
                </Dialog>
            </DesignSystemLabelsProvider>
        );

        expect(
            screen.getByRole('button', { name: 'Entwurf verwerfen' })
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Schließen' })).toBeNull();
    });

    it('lets the sheet call site outrank the host chrome [design-system:I-08]', () => {
        render(
            <DesignSystemLabelsProvider labels={{ close: 'Schließen' }}>
                <Sheet open>
                    <SheetContent closeLabel="Filter schließen">
                        <SheetTitle>Filter</SheetTitle>
                    </SheetContent>
                </Sheet>
            </DesignSystemLabelsProvider>
        );

        expect(
            screen.getByRole('button', { name: 'Filter schließen' })
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Schließen' })).toBeNull();
    });

    it('falls back to the context when the call site says nothing [design-system:I-08]', () => {
        // The complement, so "the prop wins" cannot be satisfied by a
        // component that ignores the context outright.
        render(
            <DesignSystemLabelsProvider labels={{ close: 'Schließen' }}>
                <Dialog open>
                    <DialogContent>
                        <DialogTitle>Entwurf</DialogTitle>
                    </DialogContent>
                </Dialog>
            </DesignSystemLabelsProvider>
        );

        expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy();
    });
});
