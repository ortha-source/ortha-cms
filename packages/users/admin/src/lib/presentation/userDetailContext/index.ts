import { useOutletContext } from 'react-router-dom';
import type { Member } from '../../domain/types/member';

/**
 * Outlet context shared by the user-detail layout with every tab. The layout
 * fetches the member once and exposes it here, so the tabs read the same
 * record instead of each issuing its own request.
 */
export type UserDetailContext = {
    /** The member whose detail page is open. */
    member: Member;
};

/** Reads the current member from the user-detail layout's Outlet context. */
export function useUserDetailContext(): UserDetailContext {
    return useOutletContext<UserDetailContext>();
}
