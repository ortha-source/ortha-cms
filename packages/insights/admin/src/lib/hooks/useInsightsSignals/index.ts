import { useMemo } from 'react';
import { AuthStatus, useAuth } from '@orthacms/identity-admin';
import {
    INSIGHTS_SIGNAL_SLOT,
    type InsightsSignal
} from '../../presentation/slots/insightsSlots';
import { resolveInsightsSignals } from '../../utils/resolveInsightsSignals';

/**
 * The Needs-attention lines the signed-in user may see, in order.
 *
 * A thin adapter over the pure {@link resolveInsightsSignals}, shaped like
 * `useInsightsLayout`: permissions are read once from the auth state, so the
 * page knows whether the card has any lines before it renders the card.
 */
export function useInsightsSignals(): InsightsSignal[] {
    const auth = useAuth();
    const permissions =
        auth.status === AuthStatus.Authenticated ? auth.user.permissions : [];
    const permissionKey = permissions.join(',');

    return useMemo(
        () =>
            resolveInsightsSignals({
                signals: INSIGHTS_SIGNAL_SLOT.getItems(),
                permissions: permissionKey ? permissionKey.split(',') : []
            }),
        [permissionKey]
    );
}
