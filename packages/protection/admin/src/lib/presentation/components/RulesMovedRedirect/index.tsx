import { Navigate } from 'react-router-dom';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';

/**
 * Where the rules used to be — workspace settings › Publishing — sends a
 * bookmark or an old link to where they are now, the Reviews page's Rules
 * tab. A redirect rather than a second copy of the list: one place to edit a
 * rule is the point of the move.
 */
export function RulesMovedRedirect() {
    const workspace = useCurrentWorkspace();
    return (
        <Navigate
            to={`/workspaces/${workspace.id}/reviews?tab=rules`}
            replace
        />
    );
}
