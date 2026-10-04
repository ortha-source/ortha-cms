import { defineMessages, useIntl } from 'react-intl';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { fieldsOnTab } from '../../../../domain/builtInTab';
import { generalTabLayout } from '../../../../domain/generalTabLayout';
import { BuiltInTabBlock } from './BuiltInTabBlock';
import { FieldRow } from './FieldRow';
import { GeneralOrderHint } from './GeneralOrderHint';
import { GroupAccordion } from './GroupAccordion';

const messages = defineMessages({
    title: { id: 'schemaBuilder.fields.title', defaultMessage: 'Fields' }
});

/**
 * A type's fields under the tab the entry editor draws each on: General
 * (loose fields by rank, then the groups as accordions), Relations, Media.
 * A tab with nothing on it is left out, as the editor leaves it out.
 */
export function FieldList({ type }: { type: TypeDoc }) {
    const intl = useIntl();
    const general = generalTabLayout(type);
    const generalCount =
        general.loose.length +
        general.groups.reduce((sum, { fields }) => sum + fields.length, 0);
    const relations = fieldsOnTab(type, 'relations');
    const media = fieldsOnTab(type, 'media');

    return (
        <section
            aria-labelledby="schema-fields-title"
            className="overflow-hidden rounded-xl border bg-card shadow-xs"
        >
            <div className="flex items-center gap-2 px-4 py-3">
                <h3 id="schema-fields-title" className="text-sm font-semibold">
                    {intl.formatMessage(messages.title)}
                </h3>
                <span className="text-xs text-muted-foreground">
                    {type.fields.length}
                </span>
            </div>
            {(generalCount > 0 || general.groups.length > 0) && (
                <BuiltInTabBlock tab="general" count={generalCount}>
                    <ul className="divide-y">
                        {general.loose.map((entry) => (
                            <FieldRow key={entry.key} entry={entry} />
                        ))}
                    </ul>
                    {general.groups.length > 0 && (
                        <>
                            <GeneralOrderHint />
                            {general.groups.map((block) => (
                                <GroupAccordion
                                    key={block.group.key}
                                    {...block}
                                />
                            ))}
                        </>
                    )}
                </BuiltInTabBlock>
            )}
            {relations.length > 0 && (
                <BuiltInTabBlock tab="relations" count={relations.length}>
                    <ul className="divide-y">
                        {relations.map((entry) => (
                            <FieldRow key={entry.key} entry={entry} />
                        ))}
                    </ul>
                </BuiltInTabBlock>
            )}
            {media.length > 0 && (
                <BuiltInTabBlock tab="media" count={media.length}>
                    <ul className="divide-y">
                        {media.map((entry) => (
                            <FieldRow key={entry.key} entry={entry} />
                        ))}
                    </ul>
                </BuiltInTabBlock>
            )}
        </section>
    );
}
