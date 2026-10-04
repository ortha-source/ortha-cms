import { useState, type FormEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    Button,
    InputField,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle
} from '@orthacms/design-system';
import type { GroupDoc, TypeDoc } from '@orthacms/schema-builder-domain';
import { toFieldName, uniqueName } from '../../../domain/identifiers';
import { GroupCard } from './GroupCard';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.groups.title',
        defaultMessage: 'Groups on the General tab'
    },
    description: {
        id: 'schemaBuilder.groups.sheetDescription',
        defaultMessage:
            'Accordion blocks inside General, below the loose fields. Tabs are built in and cannot be added; Relations and Media keep their own.'
    },
    newGroup: {
        id: 'schemaBuilder.groups.new',
        defaultMessage: 'New group title'
    },
    add: { id: 'schemaBuilder.groups.add', defaultMessage: 'Add group' },
    done: { id: 'schemaBuilder.groups.done', defaultMessage: 'Done' },
    close: { id: 'schemaBuilder.groups.close', defaultMessage: 'Close' }
});

type Props = {
    type: TypeDoc | null;
    onChange: (groups: GroupDoc[]) => void;
    onClose: () => void;
};

/** A type's `groups`, in order — never sections, never tabs. */
export function GeneralGroupsSheet({ type, onChange, onClose }: Props) {
    const intl = useIntl();
    const [title, setTitle] = useState('');
    const groups = type?.groups ?? [];
    const fieldsIn = (key: string) =>
        type?.fields.filter((entry) => entry.spec.admin?.group === key)
            .length ?? 0;
    const move = (index: number, step: -1 | 1) => {
        const next = [...groups];
        [next[index], next[index + step]] = [next[index + step], next[index]];
        onChange(next);
    };
    const add = (event: FormEvent) => {
        event.preventDefault();
        const label = title.trim();
        const base = toFieldName(label);
        if (!base) return;
        onChange([
            ...groups,
            {
                key: uniqueName(
                    base,
                    groups.map((group) => group.key)
                ),
                label
            }
        ]);
        setTitle('');
    };
    return (
        <Sheet open={Boolean(type)} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                className="flex w-full flex-col overflow-y-auto sm:max-w-lg"
                closeLabel={intl.formatMessage(messages.close)}
            >
                <SheetHeader>
                    <SheetTitle>
                        {intl.formatMessage(messages.title)}
                    </SheetTitle>
                    <SheetDescription>
                        {intl.formatMessage(messages.description)}
                    </SheetDescription>
                </SheetHeader>
                <ul className="flex flex-col gap-3 px-4">
                    {groups.map((group, index) => (
                        <GroupCard
                            key={group.key}
                            group={group}
                            fields={fieldsIn(group.key)}
                            first={index === 0}
                            last={index === groups.length - 1}
                            onChange={(next) =>
                                onChange(
                                    groups.map((candidate, at) =>
                                        at === index ? next : candidate
                                    )
                                )
                            }
                            onMove={(step) => move(index, step)}
                            onRemove={() =>
                                onChange(groups.filter((_, at) => at !== index))
                            }
                        />
                    ))}
                </ul>
                <form onSubmit={add} className="flex items-end gap-2 px-4">
                    <InputField
                        id="group-new"
                        label={intl.formatMessage(messages.newGroup)}
                        fieldClassName="flex-1"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                    />
                    <Button
                        type="submit"
                        variant="outline"
                        disabled={!toFieldName(title)}
                    >
                        <Plus />
                        {intl.formatMessage(messages.add)}
                    </Button>
                </form>
                <SheetFooter>
                    <Button onClick={onClose}>
                        {intl.formatMessage(messages.done)}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
