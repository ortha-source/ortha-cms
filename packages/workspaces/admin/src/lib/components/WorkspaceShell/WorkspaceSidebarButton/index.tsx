import { useNavigate, useMatch, useParams } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { cn } from '@ortha-cms/design-system';
import type { WorkspaceNavItem } from '../../../slots/workspaceSlots';
import { RailTooltip } from '../RailTooltip';

type WorkspaceSidebarButtonProps = {
    /** The rail entry to render. */
    item: WorkspaceNavItem;
};

/**
 * Renders a single section as a 40×40 icon button. The item's `to` is relative
 * to the workspace, so this resolves it against the active `:id`, derives active
 * state from the current location, and navigates on click. At rest it's a muted
 * icon; hover tints the background neutral (`--accent`); active fills it
 * `--primary` with a primary marker bar bleeding off the rail's left edge.
 * Transitions colors only — no transform on press (Ortha rule).
 */
export function WorkspaceSidebarButton({ item }: WorkspaceSidebarButtonProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const { id } = useParams();
    const to = `/workspaces/${id}/${item.to}`;
    const match = useMatch(`${to}/*`);
    const isActive = Boolean(match);
    const Icon = item.icon;
    const label = intl.formatMessage({
        id: item.labelId,
        defaultMessage: item.defaultLabel
    });

    // Hide a permission-gated entry from members who lack it. The hook is always
    // called (an empty key is simply never granted) so hook order stays stable;
    // an entry with no `permission` is visible to every member.
    const hasRequired = useHasPermission(item.permission ?? '');
    if (item.permission && !hasRequired) {
        return null;
    }

    return (
        <RailTooltip label={label}>
            <button
                type="button"
                onClick={() => navigate(to)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                    'relative flex size-8 items-center justify-center rounded-lg transition-colors duration-[120ms]',
                    isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
            >
                {isActive ? (
                    <span
                        aria-hidden
                        className="absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-primary"
                    />
                ) : null}
                <Icon className="size-4" />
            </button>
        </RailTooltip>
    );
}
