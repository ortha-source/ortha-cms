import { useCallback, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import type {
    EntryPublishVerdict,
    EntrySlotContext
} from '@orthacms/content-admin';
import { reviewScopeOf, useEntryReview } from '../../../application/hooks';
import { BypassDialog } from '../../components/BypassDialog';

const messages = defineMessages({
    short: {
        id: 'protection.guard.short',
        defaultMessage:
            '{required, plural, one {# approval} other {# approvals}} required on this version, {given} given.'
    },
    bypass: {
        id: 'protection.guard.bypass',
        defaultMessage: 'Publish anyway'
    }
});

/**
 * What protection tells the entry editor's publish button.
 *
 * A **hook**, per `ENTRY_PUBLISH_GUARD_SLOT`: it is called unconditionally in
 * slot order on every render of `EntryActions`, so it may hold state — which is
 * what lets the bypass dialog's open flag live here rather than in content.
 *
 * It returns `null` — no opinion — whenever protection has nothing to say:
 * a create form, a non-publishable type, an unprotected one, and while the read
 * is still in flight or has failed. That last one matters: a guard that blocked
 * on a failed read would make an unreachable API look like a refused publish,
 * and the person could not tell the two apart. The server refuses the publish
 * regardless, with the reason, so the honest client-side default is silence.
 */
export function usePublishProtectionVerdict(
    context: EntrySlotContext
): EntryPublishVerdict | null {
    const intl = useIntl();
    const [bypassOpen, setBypassOpen] = useState(false);
    const scope = reviewScopeOf(context);
    const { data } = useEntryReview(scope);

    /**
     * The control that opened the dialog, so closing it can put focus back.
     *
     * Radix restores focus to whatever it captured when the content mounted,
     * and that is not reliable here: the button belongs to `content-admin` and
     * is re-rendered as this verdict changes, so the element Radix is holding
     * can be a node React has since replaced — leaving focus on `<body>` and a
     * keyboard user at the top of the page. Capturing the trigger ourselves, at
     * the moment of the click, is the only reference that is certainly right.
     */
    const trigger = useRef<HTMLElement | null>(null);

    const closeBypass = useCallback((open: boolean) => setBypassOpen(open), []);

    if (!scope || !data?.protected) return null;

    if (!data.blocked) return { blocked: false };

    const reason = intl.formatMessage(messages.short, {
        required: data.required,
        given: data.given
    });

    if (!data.bypassable) return { blocked: true, reason };

    return {
        blocked: true,
        reason,
        action: {
            label: intl.formatMessage(messages.bypass),
            onSelect: () => {
                const active = document.activeElement;
                trigger.current = active instanceof HTMLElement ? active : null;
                setBypassOpen(true);
            }
        },
        // Rendered outside the actions cluster by content, which is what keeps
        // it mounted while the button it hangs off is relabelled and re-rendered
        // as the verdict changes.
        overlay: (
            <BypassDialog
                open={bypassOpen}
                onOpenChange={closeBypass}
                scope={scope}
                review={data}
                returnFocusTo={trigger}
            />
        )
    };
}
