import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Lock } from 'lucide-react';
import {
    Container,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle
} from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { CopilotModelChoice } from '../../application/useCopilotModels';
import { useRouteContext } from '../../application/useRouteContext';
import { COPILOT_USE, agentsPath } from '../../domain/agentsRoute';
import { AgentsRail } from './AgentsRail';
import { AgentsThread } from './AgentsThread';
import { AgentsTopBar } from './AgentsTopBar';

const messages = defineMessages({
    forbiddenTitle: {
        id: 'copilot.agents.forbiddenTitle',
        defaultMessage: 'No access'
    },
    forbiddenBody: {
        id: 'copilot.agents.forbiddenBody',
        defaultMessage: 'You don’t have permission to use Ortha AI here.'
    }
});

/**
 * The **Agents view** — the copilot as a place you go, mounted inside the
 * workspace shell at `/workspaces/:id/agents`.
 *
 * The docked panel and this page are two shapes of the same thing, and both
 * earn their keep:
 *
 * - the **panel** is for a question *about the page you are on*. It is
 *   non-modal so you can act on the answer without closing it, and several can
 *   run at once behind the dock.
 * - the **page** is for the work where the conversation *is* the task —
 *   a long thread, a change you want to read carefully, or picking up something
 *   you asked yesterday. History is a column rather than a dropdown, and the
 *   transcript gets the width to render a table or a diff.
 *
 * Three columns, and the third one is the point: the app sidebar keeps the
 * workspace's CMS navigation on screen, so leaving the Agents view is one click
 * on something already visible rather than a trip back through a menu. The
 * sidebar's own `ViewSwitcher` is the two-way control between the modes.
 *
 * The permission check mirrors the server's gate rather than replacing it — the
 * run route enforces `copilot:use` regardless, and `useHasPermission` is
 * fail-closed, so a user whose permissions have not loaded sees the empty state
 * rather than a composer that 403s on Enter.
 */
export function AgentsPage() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const canUse = useHasPermission(COPILOT_USE);
    const routeContext = useRouteContext();
    // Which backend the next turn runs on. Held here rather than in the thread
    // because the control that sets it lives in the top bar — and per *page*
    // rather than per thread, so a conversation can start cheap and escalate.
    const [choice, setChoice] = useState<CopilotModelChoice | null>(null);

    if (!canUse) {
        return (
            <Container className="py-8">
                <Empty className="border" role="alert">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Lock />
                        </EmptyMedia>
                        <EmptyTitle>
                            {intl.formatMessage(messages.forbiddenTitle)}
                        </EmptyTitle>
                        <EmptyDescription>
                            {intl.formatMessage(messages.forbiddenBody)}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </Container>
        );
    }

    return (
        <>
            {/* Hoists itself into the inset's fixed bar strip, so it spans the
                rail and the thread both and neither of them scrolls under it. */}
            <AgentsTopBar
                workspaceId={workspace.id}
                basePath={agentsPath(workspace.id)}
                choice={choice}
                onChoiceChange={setChoice}
            />
            {/* `min-h-0` against the shell's bounded column: the rail and the
                transcript each run their own inner scroll, and without it both
                would grow the page instead. */}
            <div className="flex min-h-0 min-w-0 flex-1">
                <AgentsRail workspaceId={workspace.id} />
                <AgentsThread
                    workspaceId={workspace.id}
                    workspaceName={workspace.name}
                    routeContext={routeContext}
                    choice={choice}
                />
            </div>
        </>
    );
}
