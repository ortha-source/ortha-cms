import { defineMessages, useIntl } from 'react-intl';
import { Layers, Plus } from 'lucide-react';
import { Button } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { fieldsOnTab } from '../../../../domain/builtInTab';
import { generalTabLayout } from '../../../../domain/generalTabLayout';
import { BuiltInTabBlock } from './BuiltInTabBlock';
import type { FieldListEditing } from './fieldListEditing';
import { FieldRows } from './FieldRows';
import { GeneralOrderHint } from './GeneralOrderHint';
import { GroupAccordion } from './GroupAccordion';

const messages = defineMessages({
    title: { id: 'schemaBuilder.fields.title', defaultMessage: 'Fields' },
    add: { id: 'schemaBuilder.fields.add', defaultMessage: 'Add field' },
    groups: { id: 'schemaBuilder.fields.groups', defaultMessage: 'Groups' }
});

type Props = { type: TypeDoc; editing?: FieldListEditing };

/**
 * A type's fields under the tab the entry editor draws each on: General
 * (loose fields by rank, then the groups as accordions), Relations, Media.
 * A tab with nothing on it is left out, as the editor leaves it out — except
 * General while editing, where groups are managed.
 */
export function FieldList({ type, editing }: Props) {
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
                {editing && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        onClick={editing.onAddField}
                    >
                        <Plus />
                        {intl.formatMessage(messages.add)}
                    </Button>
                )}
            </div>
            {(generalCount > 0 || general.groups.length > 0 || editing) && (
                <BuiltInTabBlock
                    tab="general"
                    count={generalCount}
                    action={
                        editing && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7"
                                onClick={editing.onManageGroups}
                            >
                                <Layers />
                                {intl.formatMessage(messages.groups)}
                            </Button>
                        )
                    }
                >
                    <FieldRows fields={general.loose} editing={editing} />
                    {general.groups.length > 0 && (
                        <>
                            <GeneralOrderHint />
                            {general.groups.map((block) => (
                                <GroupAccordion
                                    key={block.group.key}
                                    {...block}
                                    editing={editing}
                                />
                            ))}
                        </>
                    )}
                </BuiltInTabBlock>
            )}
            {relations.length > 0 && (
                <BuiltInTabBlock tab="relations" count={relations.length}>
                    <FieldRows fields={relations} editing={editing} />
                </BuiltInTabBlock>
            )}
            {media.length > 0 && (
                <BuiltInTabBlock tab="media" count={media.length}>
                    <FieldRows fields={media} editing={editing} />
                </BuiltInTabBlock>
            )}
        </section>
    );
}
