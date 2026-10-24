import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, Sparkles } from 'lucide-react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    Button,
    TopBar,
    TopBarActions,
    TopBarIcon
} from '@orthacms/design-system';
import { useConversations } from '../../../application/useConversations';
import { readAgentThreadId } from '../../../domain/agentsRoute';

// The product is **Ortha CMS AI**; the code keeps `copilot`. See the naming note in
// `docs/design/copilot.md`.
const messages = defineMessages({
    nav: {
        id: 'copilot.agents.topbar.nav',
        defaultMessage: 'Breadcrumb'
    },
    root: {
        id: 'copilot.agents.topbar.root',
        defaultMessage: 'Ortha CMS AI'
    },
    newChat: {
        id: 'copilot.agents.topbar.newChat',
        defaultMessage: 'New chat'
    },
    untitled: {
        id: 'copilot.agents.topbar.untitled',
        defaultMessage: 'Untitled chat'
    }
});

export interface AgentsTopBarProps {
    /** The workspace whose threads this bar titles. */
    workspaceId: string;
    /** Where the "Ortha CMS AI" crumb links — a new chat. */
    basePath: string;
    /**
     * The crumb after "Ortha CMS AI". Omitted, it is the open thread's title,
     * or "New chat" on the base path — a page that is not a chat (Skills)
     * names itself.
     */
    leaf?: string;
    /**
     * The bar's actions, at its end. Omitted, a **New chat** button — the one
     * action every chat page offers (R7); the Skills page passes New skill.
     */
    actions?: ReactNode;
}

/**
 * The Agents view's one bar: icon tile, breadcrumb, the page's action.
 *
 * **One bar, not two.** A `PageTopBar` for the breadcrumb plus a header of the
 * thread's own would spend 6rem of a chat surface on chrome, so this composes
 * the `TopBar` primitive directly — the same thing `ContentTopBar` does, and for
 * the same reason. Rendering a real `TopBar` also hosts the sidebar-reveal
 * trigger when the app sidebar is collapsed.
 *
 * The thread's title comes from the **list** query rather than from the open
 * chat: the title is a property of the saved thread, and the list is already
 * invalidated as each turn lands.
 *
 * There is no Chats button any more: the chat list lives in the sidebar
 * (`AgentsSidebar`), which is where a phone finds it too.
 */
export function AgentsTopBar({
    workspaceId,
    basePath,
    leaf: leafOverride,
    actions
}: AgentsTopBarProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { data: conversations } = useConversations(workspaceId);

    const conversationId = readAgentThreadId(pathname);
    const saved = conversations?.find((item) => item.id === conversationId);
    const leaf =
        leafOverride ??
        (conversationId
            ? (saved?.title ?? intl.formatMessage(messages.untitled))
            : intl.formatMessage(messages.newChat));

    return (
        <TopBar>
            <TopBarIcon className="bg-info-soft text-info">
                <Sparkles />
            </TopBarIcon>

            <Breadcrumb
                aria-label={intl.formatMessage(messages.nav)}
                className="min-w-0 overflow-hidden"
            >
                <BreadcrumbList className="flex-nowrap font-medium">
                    {/* Below `sm` only the leaf survives — the trail would
                        otherwise shrink past its own text. */}
                    <BreadcrumbItem className="hidden min-w-0 whitespace-nowrap sm:inline-flex">
                        <BreadcrumbLink asChild>
                            <Link to={basePath}>
                                {intl.formatMessage(messages.root)}
                            </Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:flex" />
                    <BreadcrumbItem className="min-w-0 whitespace-nowrap">
                        <BreadcrumbPage className="flex min-w-0 items-center truncate font-medium">
                            {leaf}
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* `ml-auto`, so nothing may follow it on the bar. */}
            <TopBarActions>
                {actions ?? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => navigate(basePath)}
                    >
                        <Plus aria-hidden className="size-4" />
                        {intl.formatMessage(messages.newChat)}
                    </Button>
                )}
            </TopBarActions>
        </TopBar>
    );
}
