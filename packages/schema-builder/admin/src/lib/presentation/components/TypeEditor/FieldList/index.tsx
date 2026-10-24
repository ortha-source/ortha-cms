import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    SortableContext,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Button } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { generalTabLayout } from '../../../../domain/generalTabLayout';
import type { FieldListEditing } from './fieldListEditing';
import { FieldRows } from './FieldRows';
import { GeneralOrderHint } from './GeneralOrderHint';
import { GroupAccordion } from './GroupAccordion';
import { NoFields } from './NoFields';
import { SortableFieldScope } from './SortableFieldScope';
import { SortableGroupAccordion } from './SortableGroupAccordion';
import { groupSortId, type SortableList } from './sortableList';

const messages = defineMessages({
    title: { id: 'schemaBuilder.fields.title', defaultMessage: 'Fields' },
    hint: {
        id: 'schemaBuilder.fields.hint',
        defaultMessage: 'Drag to reorder · drop on a group to move it in'
    },
    add: { id: 'schemaBuilder.fields.add', defaultMessage: 'Add field' },
    group: { id: 'schemaBuilder.fields.group', defaultMessage: 'Group' },
    groupLabel: {
        id: 'schemaBuilder.fields.groupLabel',
        defaultMessage: 'Add a group'
    },
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
 * A type's fields, first thing under its header, as the entry editor's one
 * form draws them (ADR-0022): loose fields by rank, then each group as a
 * section header inside the same list with its fields under it — relations
 * and media included. "Add field" and "Group" close the list. A type with
 * no fields and no groups gets an empty state instead: what fields are, and
 * the way in.
 *
 * While editing, the loose fields and the groups are one sortable scope — a
 * field is dragged into a group and back out, and the groups are dragged into
 * a new order.
 */
export function FieldList({ type, editing }: Props) {
    const intl = useIntl();
    const general = generalTabLayout(type);
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
    const empty = type.fields.length === 0 && general.groups.length === 0;
    return (
        <section
            aria-labelledby="schema-fields-title"
            className="flex flex-col gap-2"
        >
            <div className="flex flex-wrap items-baseline gap-x-2">
                <h2 id="schema-fields-title" className="text-sm font-semibold">
                    {intl.formatMessage(messages.title)}
                </h2>
                {editing && !empty && (
                    <span className="text-xs text-muted-foreground">
                        {intl.formatMessage(messages.hint)}
                    </span>
                )}
            </div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
                {empty ? (
                    <NoFields onAdd={editing?.onAddField} />
                ) : (
                    <SortableFieldScope
                        lists={[loose, ...groups.map(({ list }) => list)]}
                        groups={type.groups}
                        editing={editing}
                    >
                        <FieldRows
                            list={loose}
                            editing={editing}
                            empty={
                                editing &&
                                groups.length > 0 && (
                                    <p className="px-4 py-3 text-xs text-muted-foreground">
                                        {intl.formatMessage(messages.looseDrop)}
                                    </p>
                                )
                            }
                        />
                        {groups.length > 0 && (
                            <>
                                {general.loose.length > 0 && (
                                    <GeneralOrderHint />
                                )}
                                {editing ? (
                                    <SortableContext
                                        id="groups"
                                        items={groups.map(({ group }) =>
                                            groupSortId(group.key)
                                        )}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {groups.map(({ group, list }) => (
                                            <SortableGroupAccordion
                                                key={group.key}
                                                group={group}
                                                list={list}
                                                editing={editing}
                                            />
                                        ))}
                                    </SortableContext>
                                ) : (
                                    groups.map(({ group, list }) => (
                                        <GroupAccordion
                                            key={group.key}
                                            group={group}
                                            list={list}
                                        />
                                    ))
                                )}
                            </>
                        )}
                    </SortableFieldScope>
                )}
                {editing && !empty && (
                    <div className="flex items-center gap-1 border-t px-3 py-2.5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={editing.onAddField}
                        >
                            <Plus />
                            {intl.formatMessage(messages.add)}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            aria-label={intl.formatMessage(messages.groupLabel)}
                            onClick={editing.onManageGroups}
                        >
                            <Plus />
                            {intl.formatMessage(messages.group)}
                        </Button>
                    </div>
                )}
            </div>
        </section>
    );
}
