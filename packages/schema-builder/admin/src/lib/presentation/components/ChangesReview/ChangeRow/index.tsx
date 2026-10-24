import { defineMessages, useIntl } from 'react-intl';
import { Minus, Pencil, Plus } from 'lucide-react';
import { Checkbox, cn, Label } from '@orthacms/design-system';
import type { ClassifiedChange } from '@orthacms/schema-builder-domain';
import { changeTitle } from './changeTitle';
import { reasonText } from './reasonText';

const messages = defineMessages({
    confirm: {
        id: 'schemaBuilder.change.confirm',
        defaultMessage: 'I understand this deletes data'
    },
    blocked: {
        id: 'schemaBuilder.safety.blocked',
        defaultMessage: 'Not applied'
    }
});

type Props = {
    item: ClassifiedChange;
    confirmed: boolean;
    onToggle: (id: string) => void;
};

/** What a change does to the model, as its mark: adds, removes, or changes. */
const markOf = (kind: ClassifiedChange['change']['kind']) =>
    kind.endsWith('.add')
        ? 'add'
        : kind.endsWith('.remove')
          ? 'remove'
          : 'change';

const MARK = {
    add: {
        Icon: Plus,
        className: 'bg-success-soft text-success-soft-foreground'
    },
    remove: {
        Icon: Minus,
        className: 'bg-destructive-soft text-destructive-soft-foreground'
    },
    change: {
        Icon: Pencil,
        className: 'bg-info-soft text-info-soft-foreground'
    }
} as const;

/**
 * One change: a mark for what it does, the sentence, and why it got its
 * verdict. A change that deletes data carries its own confirmation — there
 * is no "confirm all"; one this version cannot apply says so.
 */
export function ChangeRow({ item, confirmed, onToggle }: Props) {
    const intl = useIntl();
    const id = `confirm-${item.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const { Icon, className } = MARK[markOf(item.change.kind)];
    return (
        <li
            className={cn(
                'flex items-start gap-3 border-t px-4 py-3 first:border-t-0',
                item.safety === 'destructive' && 'bg-destructive-soft/30'
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded',
                    className
                )}
            >
                <Icon className="size-3" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm">
                    {changeTitle(intl, item.change)}
                    {item.safety === 'blocked' && (
                        <span className="ml-2 text-xs font-medium text-destructive">
                            {intl.formatMessage(messages.blocked)}
                        </span>
                    )}
                </span>
                <p className="text-xs text-muted-foreground">
                    {reasonText(intl, item.reason)}
                </p>
                {item.safety === 'destructive' && (
                    <div className="flex items-center gap-2 pt-1.5">
                        <Checkbox
                            id={id}
                            checked={confirmed}
                            onCheckedChange={() => onToggle(item.id)}
                        />
                        <Label htmlFor={id} className="text-sm font-normal">
                            {intl.formatMessage(messages.confirm)}
                        </Label>
                    </div>
                )}
            </div>
        </li>
    );
}
