import { Link, useMatch } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { useHasPermission } from '@orthacms/identity-admin';
import { SidebarMenuButton, SidebarMenuItem } from '@orthacms/design-system';
import type { SidebarItem } from '../../../slots/sidebarSlots';
import { NavBadges, navBadgeText, useNoBadge } from '../../NavBadges';

type SidebarNavButtonProps = {
    /** The nav item to render. */
    item: SidebarItem;
};

/**
 * One primary-nav row in the global sidebar: an icon + label link. Resolves the
 * translated label, derives active state from the current route, and hides
 * itself when the item is permission-gated and the user lacks the permission
 * (the UI mirror of the linked route's server-side gate).
 */
export function SidebarNavButton({ item }: SidebarNavButtonProps) {
    const intl = useIntl();
    const match = useMatch(item.end ? item.to : `${item.to}/*`);
    const isActive = Boolean(match);
    const Icon = item.icon;
    const label = intl.formatMessage({
        id: item.labelId,
        defaultMessage: item.defaultLabel
    });

    // Always call the hook (an empty key is never granted) so hook order stays
    // stable; an entry with no `permission` is visible to every signed-in user.
    const hasRequired = useHasPermission(item.permission ?? '');
    const visible = !item.permission || hasRequired;
    // Same rule for the badge: always called, told whether the row shows.
    const useBadge = item.useBadge ?? useNoBadge;
    const badge = useBadge(visible);
    if (!visible) {
        return null;
    }
    const badges = badge ? [badge] : [];
    const badgeText = navBadgeText(badges);

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={label}
                className={badgeText ? 'pr-10' : undefined}
            >
                <Link to={item.to} aria-current={isActive ? 'page' : undefined}>
                    <Icon className={isActive ? item.iconColor : undefined} />
                    <span>
                        {label}
                        {badgeText ? (
                            <span className="sr-only">, {badgeText}</span>
                        ) : null}
                    </span>
                </Link>
            </SidebarMenuButton>
            <NavBadges badges={badges} />
        </SidebarMenuItem>
    );
}
