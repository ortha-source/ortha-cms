import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import { membersKeys } from '../../utils/membersKeys';

/** A live session as the detail page's Sessions tab renders it. */
export type UserSession = {
    /** Revocation handle (the session row id). */
    id: string;
    /** Originating `User-Agent`, or `null` if it was never captured. */
    userAgent: string | null;
    /** Originating IP, or `null` if it was never captured. */
    ipAddress: string | null;
    /** When the session was opened. */
    createdAt: Date;
    /** Last authenticated request seen on this session. */
    lastSeenAt: Date;
    /** Absolute expiry. */
    expiresAt: Date;
    /** Whether this is the viewer's own session (never revocable from here). */
    current: boolean;
};

/** A session as returned by `GET /api/users/:id/sessions`. */
type UserSessionResponse = {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: string;
    lastUsedAt: string;
    expiresAt: string;
    current: boolean;
};

/** Maps a session from the wire to the admin's model (timestamps → `Date`). */
function toUserSession(dto: UserSessionResponse): UserSession {
    return {
        id: dto.id,
        userAgent: dto.userAgent,
        ipAddress: dto.ipAddress,
        createdAt: new Date(dto.createdAt),
        lastSeenAt: new Date(dto.lastUsedAt),
        expiresAt: new Date(dto.expiresAt),
        current: dto.current
    };
}

/** Fetches a member's live sessions from `GET /api/users/:id/sessions`. */
async function fetchUserSessions(id: string): Promise<UserSession[]> {
    const { data } = await apiClient.get<UserSessionResponse[]>(
        `/users/${id}/sessions`
    );
    return data.map(toUserSession);
}

/**
 * Fetches the live sessions for a member (the Sessions tab). `staleTime: 0` so
 * a session that has since expired or been revoked elsewhere drops off on the
 * next mount/refocus rather than lingering. Gated on `users:update` (the tab
 * is only shown to admins who can act on what they see).
 */
export function useUserSessions(id: string, enabled = true) {
    return useQuery({
        queryKey: membersKeys.sessions(id),
        queryFn: () => fetchUserSessions(id),
        staleTime: 0,
        enabled
    });
}
