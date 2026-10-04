import { defineMessages, useIntl } from 'react-intl';
import { Badge, Checkbox, Label } from '@orthacms/design-system';
import type { ClassifiedChange } from '@orthacms/schema-builder-domain';
import { changeTitle } from './changeTitle';
import { reasonText } from './reasonText';

const messages = defineMessages({
    safe: { id: 'schemaBuilder.safety.safe', defaultMessage: 'Safe' },
    data: { id: 'schemaBuilder.safety.data', defaultMessage: 'Check data' },
    destructive: {
        id: 'schemaBuilder.safety.destructive',
        defaultMessage: 'Deletes data'
    },
    blocked: {
        id: 'schemaBuilder.safety.blocked',
        defaultMessage: 'Not applied'
    },
    confirm: {
        id: 'schemaBuilder.change.confirm',
        defaultMessage: 'I understand this deletes data'
    }
});

const VARIANT = {
    safe: 'success',
    data: 'warning',
    destructive: 'destructive-soft',
    blocked: 'outline'
} as const;

type Props = {
    item: ClassifiedChange;
    confirmed: boolean;
    onToggle: (id: string) => void;
};

/**
 * One change: its verdict, what it does, why it got that verdict. A change
 * that deletes data carries its own confirmation — there is no "confirm all".
 */
export function ChangeRow({ item, confirmed, onToggle }: Props) {
    const intl = useIntl();
    const id = `confirm-${item.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    return (
        <li className="flex flex-col gap-1.5 border-b py-3 last:border-0">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant={VARIANT[item.safety]} className="font-normal">
                    {intl.formatMessage(messages[item.safety])}
                </Badge>
                <span className="text-sm font-medium">
                    {changeTitle(intl, item.change)}
                </span>
            </div>
            <p className="text-xs text-muted-foreground">
                {reasonText(intl, item.reason)}
            </p>
            {item.safety === 'destructive' && (
                <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                        id={id}
                        checked={confirmed}
                        onCheckedChange={() => onToggle(item.id)}
                    />
                    <Label htmlFor={id} className="text-sm">
                        {intl.formatMessage(messages.confirm)}
                    </Label>
                </div>
            )}
        </li>
    );
}
