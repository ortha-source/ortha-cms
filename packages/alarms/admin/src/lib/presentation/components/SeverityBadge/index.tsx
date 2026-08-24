import { defineMessages, useIntl } from 'react-intl';
import { Badge, cn } from '@orthacms/design-system';
import type { AlarmSeverity } from '../../../types/alarm';

const messages = defineMessages({
    error: { id: 'alarms.severity.error', defaultMessage: 'Error' },
    warn: { id: 'alarms.severity.warn', defaultMessage: 'Warning' },
    info: { id: 'alarms.severity.info', defaultMessage: 'Info' }
});

/**
 * Severity as colour **and** a word.
 *
 * Colour alone would put the whole meaning of a finding behind hue, which fails
 * for anyone who cannot distinguish the three (WCAG 1.4.1). The tints are drawn
 * from the design system's semantic palette rather than the accent, because
 * severity is not branding.
 */
const TINTS: Record<AlarmSeverity, string> = {
    error: 'border-destructive/30 bg-destructive/10 text-destructive',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400'
};

/** Props for {@link SeverityBadge}. */
export type SeverityBadgeProps = {
    /** Which severity to render. */
    severity: AlarmSeverity;
    className?: string;
};

/** Renders one severity as a tinted, labelled badge. */
export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
    const intl = useIntl();
    return (
        <Badge
            variant="outline"
            className={cn(TINTS[severity], 'font-medium', className)}
        >
            {intl.formatMessage(messages[severity])}
        </Badge>
    );
}
