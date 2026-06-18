import { useNavigate, useMatch } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    navbarItemVariants,
    Tooltip,
    TooltipTrigger,
    TooltipContent
} from '@ortha-cms/design-system';
import type { NavbarItem } from '../../../slots/navbarSlots';

type NavbarNavButtonProps = {
    /** The nav item to render. */
    item: NavbarItem;
};

/**
 * Renders a single top-toolbar entry as a real `<button>`: resolves the
 * translated label, derives active state from the current route, navigates on
 * click, and (when an icon is set) wraps the button in a tooltip revealing the
 * label on hover.
 */
export function NavbarNavButton({ item }: NavbarNavButtonProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const match = useMatch(item.end ? item.to : `${item.to}/*`);
    const isActive = Boolean(match);
    const Icon = item.icon;
    const label = intl.formatMessage({
        id: item.labelId,
        defaultMessage: item.defaultLabel
    });

    // Hide a permission-gated entry from users who lack it. The hook is always
    // called (an empty key is simply never granted) so hook order stays stable;
    // an entry with no `permission` is visible to every signed-in user.
    const hasRequired = useHasPermission(item.permission ?? '');
    if (item.permission && !hasRequired) {
        return null;
    }

    const button = (
        <button
            type="button"
            onClick={() => navigate(item.to)}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            className={navbarItemVariants(isActive)}
        >
            {Icon ? <Icon className="size-4" /> : label}
        </button>
    );

    if (!Icon) return button;

    return (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
                {label}
            </TooltipContent>
        </Tooltip>
    );
}
