import { defineMessages, useIntl } from 'react-intl';
import {
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@orthacms/design-system';
import {
    LOCALE_SYNC_CHOICES,
    localeSyncChoiceOf,
    relationLocaleMode,
    toLocaleSyncFlags,
    type LocaleSyncChoice,
    type RelationLocaleMode
} from '../../../../../../domain/relationLocaleSync';

const messages = defineMessages({
    label: {
        id: 'schemaBuilder.relation.localeSync',
        defaultMessage: 'Links in translations'
    },
    shared: {
        id: 'schemaBuilder.relation.localeSync.shared',
        defaultMessage: 'The same {target} in every locale'
    },
    sharedHint: {
        id: 'schemaBuilder.relation.localeSync.sharedHint',
        defaultMessage:
            'Every translation of a {source} entry links to the same {target} entries. {target} is not translated, so one link fits every locale. Change it in one locale and the others follow; a new translation starts with it filled in.'
    },
    mirrored: {
        id: 'schemaBuilder.relation.localeSync.mirrored',
        defaultMessage: 'The {target} translation in each locale'
    },
    mirroredHint: {
        id: 'schemaBuilder.relation.localeSync.mirroredHint',
        defaultMessage:
            'Each translation of a {source} entry links to the {target} entries in its own locale — the German one to the German {target}. Change it in one locale and the others follow; a new translation starts with it filled in.'
    },
    mirroredGap: {
        id: 'schemaBuilder.relation.localeSync.mirroredGap',
        defaultMessage:
            'Where a linked {target} entry has no translation in a locale, that locale goes without the link. Nothing is translated or created for you, and a translation added later is not linked by itself — set the link again once it exists.'
    },
    separate: {
        id: 'schemaBuilder.relation.localeSync.separate',
        defaultMessage: 'Set separately in each locale'
    },
    separateHint: {
        id: 'schemaBuilder.relation.localeSync.separateHint',
        defaultMessage:
            'Each translation of a {source} entry keeps its own links: changing them in one locale never touches another, and a new translation starts with none.'
    }
});

const OPTION = {
    shared: messages.shared,
    mirrored: messages.mirrored,
    separate: messages.separate
} as const satisfies Record<RelationLocaleMode, unknown>;

const HINT = {
    shared: messages.sharedHint,
    mirrored: messages.mirroredHint,
    separate: messages.separateHint
} as const satisfies Record<RelationLocaleMode, unknown>;

type Props = {
    syncAcrossLocales?: boolean;
    localized?: boolean;
    /** Whether the linked type is translated — what splits "the same" from "the translation". */
    targetI18n: boolean;
    /** Display names for the hint: this type and the linked one. */
    names: { source: string; target: string };
    onChange: (patch: Record<string, unknown>) => void;
};

/**
 * `syncAcrossLocales` as a choice that says what it does. The DSL has one
 * boolean, but "on" means two different things depending on the target —
 * one shared link, or the target's own translation in each locale — so the
 * option and its explanation are named for the mode the link will actually
 * run in, and the hint spells out what happens where a translation is missing.
 */
export function LocaleSyncSelect({
    syncAcrossLocales,
    localized,
    targetI18n,
    names,
    onChange
}: Props) {
    const intl = useIntl();
    const choice = localeSyncChoiceOf({ syncAcrossLocales, localized });
    const mode = relationLocaleMode(choice, targetI18n);
    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor="relation-locale-sync">
                {intl.formatMessage(messages.label)}
            </Label>
            <Select
                value={choice}
                onValueChange={(value) =>
                    onChange(toLocaleSyncFlags(value as LocaleSyncChoice))
                }
            >
                <SelectTrigger
                    id="relation-locale-sync"
                    aria-describedby="relation-locale-sync-hint"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {LOCALE_SYNC_CHOICES.map((value) => (
                        <SelectItem key={value} value={value}>
                            {intl.formatMessage(
                                OPTION[relationLocaleMode(value, targetI18n)],
                                names
                            )}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div
                id="relation-locale-sync-hint"
                className="flex flex-col gap-1 text-xs text-muted-foreground"
            >
                <p>{intl.formatMessage(HINT[mode], names)}</p>
                {mode === 'mirrored' && (
                    <p>{intl.formatMessage(messages.mirroredGap, names)}</p>
                )}
            </div>
        </div>
    );
}
