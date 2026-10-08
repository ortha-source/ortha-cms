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
import { NoFields } from './NoFields';
import { SortableFieldScope } from './SortableFieldScope';
import type { SortableList } from './sortableList';

const messages = defineMessages({
    title: { id: 'schemaBuilder.fields.title', defaultMessage: 'Fields' },
    add: { id: 'schemaBuilder.fields.add', defaultMessage: 'Add field' },
    groups: { id: 'schemaBuilder.fields.groups', defaultMessage: 'Groups' },
    looseList: {
        id: 'schemaBuilder.fields.looseList',
        defaultMessage: 'the fields above the groups'
    },
    groupList: {
        id: 'schemaBuilder.fields.groupList',
        defaultMessage: 'the group {label}'
    },
    looseDrop: {
        id: 'schemaBuilder.fields.looseDrop',
        defaultMessage: 'Drag a field here to take it out of its group.'
    }
});

type Props = { type: TypeDoc; editing?: FieldListEditing };

/**
 * A type's fields under the tab the entry editor draws each on: General
 * (loose fields by rank, then the groups as accordions), Relations, Media.
 * A tab with nothing on it is left out, as the editor leaves it out — except
 * General while editing, where groups are managed. A type with no fields
 * and no groups gets an empty state instead: what fields are, and the way in.
 *
 * While editing, General's loose fields and its groups are one sortable scope
 * — a field is dragged into a group and back out — and Relations and Media
 * are a scope each.
 */
export function FieldList({ type, editing }: Props) {
    const intl = useIntl();
    const general = generalTabLayout(type);
    const generalCount =
        general.loose.length +
        general.groups.reduce((sum, { fields }) => sum + fields.length, 0);
    const loose: SortableList = {
        id: 'fields:loose',
        label: intl.formatMessage(messages.looseList),
        group: null,
        fields: general.loose
    };
    const groups = general.groups.map(({ group, fields }) => ({
        group,
        list: {
            id: `fields:group:${group.key}`,
            label: intl.formatMessage(messages.groupList, {
                label: group.label
            }),
            group: group.key,
            fields
        } satisfies SortableList
    }));
    // Nothing leaves or joins these, so their label is never announced.
    const relations: SortableList = {
        id: 'fields:relations',
        label: 'Relations',
        group: null,
        fields: fieldsOnTab(type, 'relations')
    };
    const media: SortableList = {
        id: 'fields:media',
        label: 'Media',
        group: null,
        fields: fieldsOnTab(type, 'media')
    };

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
            {type.fields.length === 0 && general.groups.length === 0 ? (
                <NoFields onAdd={editing?.onAddField} />
            ) : (
                (generalCount > 0 || general.groups.length > 0 || editing) && (
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
                        <SortableFieldScope
                            lists={[loose, ...groups.map(({ list }) => list)]}
                            editing={editing}
                        >
                            <FieldRows
                                list={loose}
                                editing={editing}
                                empty={
                                    editing &&
                                    groups.length > 0 && (
                                        <p className="px-4 py-3 text-xs text-muted-foreground">
                                            {intl.formatMessage(
                                                messages.looseDrop
                                            )}
                                        </p>
                                    )
                                }
                            />
                            {groups.length > 0 && (
                                <>
                                    <GeneralOrderHint />
                                    {groups.map(({ group, list }) => (
                                        <GroupAccordion
                                            key={group.key}
                                            group={group}
                                            list={list}
                                            editing={editing}
                                        />
                                    ))}
                                </>
                            )}
                        </SortableFieldScope>
                    </BuiltInTabBlock>
                )
            )}
            {relations.fields.length > 0 && (
                <BuiltInTabBlock
                    tab="relations"
                    count={relations.fields.length}
                >
                    <SortableFieldScope lists={[relations]} editing={editing}>
                        <FieldRows list={relations} editing={editing} />
                    </SortableFieldScope>
                </BuiltInTabBlock>
            )}
            {media.fields.length > 0 && (
                <BuiltInTabBlock tab="media" count={media.fields.length}>
                    <SortableFieldScope lists={[media]} editing={editing}>
                        <FieldRows list={media} editing={editing} />
                    </SortableFieldScope>
                </BuiltInTabBlock>
            )}
        </section>
    );
}
