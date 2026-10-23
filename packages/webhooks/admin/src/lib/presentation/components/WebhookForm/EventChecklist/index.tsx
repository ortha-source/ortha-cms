import { defineMessages, useIntl } from 'react-intl';
import { Checkbox, Label } from '@orthacms/design-system';
import type { WebhookEventOption } from '../../../../domain/types/webhook';

const messages = defineMessages({
    count: {
        id: 'webhooks.form.events.count',
        defaultMessage: '{picked, number} of {total, number}'
    },
    group: {
        id: 'webhooks.form.events.group',
        defaultMessage: 'All {group} events'
    }
});

type EventChecklistProps = {
    /** The subscribable catalogue (`ping` already left out). */
    events: WebhookEventOption[];
    value: string[];
    onChange: (next: string[]) => void;
};

/**
 * The events an endpoint takes, as checkboxes grouped by the catalogue's
 * own groups, each group with a box of its own that ticks or clears the lot
 * (mixed while some are picked). Every kind is on screen at once — the list
 * is short, and a picker hid the one question worth reading in full.
 */
export function EventChecklist({
    events,
    value,
    onChange
}: EventChecklistProps) {
    const intl = useIntl();
    const picked = new Set(value);
    const groups = new Map<string, WebhookEventOption[]>();
    for (const event of events) {
        groups.set(event.group, [...(groups.get(event.group) ?? []), event]);
    }

    const setMany = (kinds: string[], on: boolean) => {
        const next = new Set(value);
        for (const kind of kinds) {
            if (on) next.add(kind);
            else next.delete(kind);
        }
        // Catalogue order, so the saved list does not depend on click order.
        onChange(
            events.map((event) => event.kind).filter((kind) => next.has(kind))
        );
    };

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
                {intl.formatMessage(messages.count, {
                    picked: value.filter((kind) =>
                        events.some((event) => event.kind === kind)
                    ).length,
                    total: events.length
                })}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...groups].map(([group, members], groupIndex) => {
                    const on = members.filter((event) =>
                        picked.has(event.kind)
                    ).length;
                    const groupId = `webhook-event-group-${groupIndex}`;
                    return (
                        <fieldset
                            key={group}
                            className="flex flex-col gap-2 rounded-[10px] border px-3 py-2.5"
                        >
                            <legend className="sr-only">{group}</legend>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id={groupId}
                                    aria-label={intl.formatMessage(
                                        messages.group,
                                        { group }
                                    )}
                                    checked={
                                        on === 0
                                            ? false
                                            : on === members.length
                                              ? true
                                              : 'indeterminate'
                                    }
                                    onCheckedChange={(checked) =>
                                        setMany(
                                            members.map((event) => event.kind),
                                            checked === true
                                        )
                                    }
                                />
                                <span
                                    aria-hidden
                                    className="text-[13px] font-semibold capitalize"
                                >
                                    {group}
                                </span>
                            </div>
                            {members.map((event) => {
                                const eventId = `webhook-event-${event.kind}`;
                                return (
                                    <div
                                        key={event.kind}
                                        className="flex items-start gap-2"
                                    >
                                        <Checkbox
                                            id={eventId}
                                            checked={picked.has(event.kind)}
                                            onCheckedChange={(checked) =>
                                                setMany(
                                                    [event.kind],
                                                    checked === true
                                                )
                                            }
                                            className="mt-0.5"
                                        />
                                        <Label
                                            htmlFor={eventId}
                                            className="flex flex-col items-start gap-0.5 font-normal"
                                        >
                                            <span className="text-[13px] leading-4">
                                                {event.label}
                                            </span>
                                            <span className="font-mono text-[11px] leading-4 text-muted-foreground">
                                                {event.kind}
                                            </span>
                                        </Label>
                                    </div>
                                );
                            })}
                        </fieldset>
                    );
                })}
            </div>
        </div>
    );
}
