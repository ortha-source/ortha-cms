import { defineMessages, useIntl } from 'react-intl';
import { KeyRound, SearchX } from 'lucide-react';
import { Button } from '@orthacms/design-system';
import type { ApiTokenStatus } from '../../../domain/types/apiToken';

const messages = defineMessages({
    noActive: {
        id: 'apiTokens.noMatch.noActive',
        defaultMessage: 'No active tokens'
    },
    noActiveBody: {
        id: 'apiTokens.noMatch.noActiveBody',
        defaultMessage:
            'Every token has expired or been revoked, so nothing can call the API right now.'
    },
    noExpired: {
        id: 'apiTokens.noMatch.noExpired',
        defaultMessage: 'No expired tokens'
    },
    noExpiredBody: {
        id: 'apiTokens.noMatch.noExpiredBody',
        defaultMessage: 'Tokens that run past their expiry date show up here.'
    },
    noRevoked: {
        id: 'apiTokens.noMatch.noRevoked',
        defaultMessage: 'No revoked tokens'
    },
    noRevokedBody: {
        id: 'apiTokens.noMatch.noRevokedBody',
        defaultMessage:
            'Revoked tokens stay listed here, so you can see what was switched off and when.'
    },
    noSearch: {
        id: 'apiTokens.noMatch.noSearch',
        defaultMessage: 'No tokens match “{search}”'
    },
    noSearchBody: {
        id: 'apiTokens.noMatch.noSearchBody',
        defaultMessage:
            'Search looks at token names and the visible start of the token.'
    },
    clear: {
        id: 'apiTokens.noMatch.clear',
        defaultMessage: 'Clear search'
    },
    create: {
        id: 'apiTokens.noMatch.create',
        defaultMessage: 'New token'
    }
});

const BY_STATUS: Record<
    ApiTokenStatus,
    { title: keyof typeof messages; body: keyof typeof messages }
> = {
    active: { title: 'noActive', body: 'noActiveBody' },
    expired: { title: 'noExpired', body: 'noExpiredBody' },
    revoked: { title: 'noRevoked', body: 'noRevokedBody' }
};

/**
 * The list is empty under the current view, but tokens exist: either a search
 * matched nothing (offer to clear it) or the chosen status has none (say what
 * would show up there). The "no tokens yet" state is `ApiTokensEmpty`'s, and
 * only for a deployment that genuinely has none.
 */
export function ApiTokensNoMatch({
    status,
    search,
    onClearSearch,
    onCreate
}: {
    status: ApiTokenStatus;
    /** The committed search term, or `''`. */
    search: string;
    onClearSearch: () => void;
    /** Offered on an empty Active view when the viewer may create. */
    onCreate?: () => void;
}) {
    const intl = useIntl();
    const searching = search.length > 0;
    const copy = BY_STATUS[status];
    const Icon = searching ? SearchX : KeyRound;
    return (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <Icon className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-medium">
                {searching
                    ? intl.formatMessage(messages.noSearch, { search })
                    : intl.formatMessage(messages[copy.title])}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
                {intl.formatMessage(
                    searching ? messages.noSearchBody : messages[copy.body]
                )}
            </p>
            {searching ? (
                <Button
                    variant="outline"
                    className="mt-2"
                    onClick={onClearSearch}
                >
                    {intl.formatMessage(messages.clear)}
                </Button>
            ) : status === 'active' && onCreate ? (
                <Button className="mt-2" onClick={onCreate}>
                    {intl.formatMessage(messages.create)}
                </Button>
            ) : null}
        </div>
    );
}
