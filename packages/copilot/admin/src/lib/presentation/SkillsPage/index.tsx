import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    BookOpen,
    Lock,
    MoreHorizontal,
    Pencil,
    Plus,
    PowerOff,
    Trash2
} from 'lucide-react';
import {
    Badge,
    Button,
    ConfirmDialog,
    Container,
    ContainerHeader,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    Skeleton,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    toast
} from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { useDocumentTitle } from '@orthacms/utils-admin';
import { useCopilotAvailable } from '../../application/useCopilotModels';
import {
    skillWriteMessage,
    useCreateSkill,
    useDeleteSkill,
    useManageSkills,
    useSkill,
    useUpdateSkill
} from '../../application/useManageSkills';
import type { CopilotSkill } from '../../application/useSkills';
import { COPILOT_SKILLS_MANAGE, agentsPath } from '../../domain/agentsRoute';
import { AgentsTopBar } from '../AgentsPage/AgentsTopBar';
import { SkillSheet, type SkillFormValues } from './SkillSheet';

const messages = defineMessages({
    title: { id: 'copilot.skills.page.title', defaultMessage: 'Skills' },
    intro: {
        id: 'copilot.skills.page.intro',
        defaultMessage:
            'Reusable instructions the assistant follows. Turn one on for a chat from the message box, or make it apply to every chat here.'
    },
    create: { id: 'copilot.skills.page.create', defaultMessage: 'New skill' },
    tableLabel: {
        id: 'copilot.skills.page.tableLabel',
        defaultMessage: 'Skills'
    },
    colName: { id: 'copilot.skills.page.colName', defaultMessage: 'Skill' },
    colIdentifier: {
        id: 'copilot.skills.page.colIdentifier',
        defaultMessage: 'Identifier'
    },
    colWhen: {
        id: 'copilot.skills.page.colWhen',
        defaultMessage: 'Applies'
    },
    colState: {
        id: 'copilot.skills.page.colState',
        defaultMessage: 'Available'
    },
    colActions: {
        id: 'copilot.skills.page.colActions',
        defaultMessage: 'Actions'
    },
    always: { id: 'copilot.skills.page.always', defaultMessage: 'Every chat' },
    manual: {
        id: 'copilot.skills.page.manual',
        defaultMessage: 'When turned on'
    },
    available: {
        id: 'copilot.skills.page.available',
        defaultMessage: '{title} available'
    },
    fromCode: {
        id: 'copilot.skills.page.fromCode',
        defaultMessage: 'From code'
    },
    fromCodeHint: {
        id: 'copilot.skills.page.fromCodeHint',
        defaultMessage:
            'Defined in this deployment’s configuration. Change it with a deploy.'
    },
    actions: {
        id: 'copilot.skills.page.actions',
        defaultMessage: 'Actions for {title}'
    },
    edit: { id: 'copilot.skills.page.edit', defaultMessage: 'Edit…' },
    remove: {
        id: 'copilot.skills.page.remove',
        defaultMessage: 'Delete'
    },
    emptyTitle: {
        id: 'copilot.skills.page.emptyTitle',
        defaultMessage: 'No skills yet'
    },
    emptyBody: {
        id: 'copilot.skills.page.emptyBody',
        defaultMessage:
            'A skill is a short set of instructions — a house style, a review checklist — that Ortha CMS AI follows while it is on.'
    },
    loadFailed: {
        id: 'copilot.skills.page.loadFailed',
        defaultMessage: 'Could not load the skills.'
    },
    retry: { id: 'copilot.skills.page.retry', defaultMessage: 'Try again' },
    forbiddenTitle: {
        id: 'copilot.skills.page.forbiddenTitle',
        defaultMessage: 'No access'
    },
    forbiddenBody: {
        id: 'copilot.skills.page.forbiddenBody',
        defaultMessage:
            'You don’t have permission to manage skills in this workspace.'
    },
    offTitle: {
        id: 'copilot.skills.page.offTitle',
        defaultMessage: 'Ortha CMS AI is turned off'
    },
    offBody: {
        id: 'copilot.skills.page.offBody',
        defaultMessage:
            'This deployment doesn’t run Ortha CMS AI, so there are no skills to manage.'
    },
    deleteTitle: {
        id: 'copilot.skills.page.deleteTitle',
        defaultMessage: 'Delete this skill?'
    },
    deleteBody: {
        id: 'copilot.skills.page.deleteBody',
        defaultMessage:
            '“{title}” will stop applying to new chats. Chats that already used it keep their record of it.'
    },
    deleteConfirm: {
        id: 'copilot.skills.page.deleteConfirm',
        defaultMessage: 'Delete'
    },
    cancel: { id: 'copilot.skills.page.cancel', defaultMessage: 'Cancel' },
    deleted: {
        id: 'copilot.skills.page.deleted',
        defaultMessage: 'Skill deleted.'
    },
    saved: { id: 'copilot.skills.page.saved', defaultMessage: 'Skill saved.' },
    turnedOn: {
        id: 'copilot.skills.page.turnedOn',
        defaultMessage: '{title} is available.'
    },
    turnedOff: {
        id: 'copilot.skills.page.turnedOff',
        defaultMessage: '{title} is turned off.'
    },
    deleteFailed: {
        id: 'copilot.skills.page.deleteFailed',
        defaultMessage: 'The skill could not be deleted.'
    },
    saveFailed: {
        id: 'copilot.skills.page.saveFailed',
        defaultMessage: 'The skill could not be saved.'
    }
});

/**
 * Where a workspace's skills are written — inside the Agents view at
 * `/workspaces/:id/agents/skills` (R7, `AiSkills`).
 *
 * **Inside the Agents view, not in a global settings area**: everything the
 * copilot owns is workspace-scoped, and a skill is editorial guidance about
 * *this* workspace's content. The sidebar's Tools → Skills is how you get here.
 *
 * - **On and off without editing.** "Available" is a switch on the row — the
 *   most common change to a skill is pausing it, and that should not cost a
 *   form. A code-defined skill says "From code", has no ⋯ menu, and its
 *   switch is shown but disabled: it is the deployment's configuration,
 *   identical in every workspace, and is changed with a deploy.
 * - **Editing is a sheet over the list** (`SkillSheet`).
 * - **Tables follow the admin's own `Table`**, not the board's framed one.
 *
 * The permission check mirrors the server's gate rather than replacing it —
 * the write routes enforce `copilot:skills:manage` regardless, and
 * `useHasPermission` is fail-closed.
 */
export function SkillsPage() {
    const intl = useIntl();
    // Names this route in the tab strip and a screen reader's window
    // announcement (WCAG 2.4.2, `ORT-140`).
    useDocumentTitle(intl.formatMessage(messages.title));
    const workspace = useCurrentWorkspace();
    const canManage = useHasPermission(COPILOT_SKILLS_MANAGE);
    // With the copilot off every route under `/api/copilot` 404s, and a skills
    // table that cannot load reads as a broken page rather than a switched-off
    // feature.
    const deploymentRunsCopilot = useCopilotAvailable({ enabled: canManage });

    const skills = useManageSkills(canManage ? workspace.id : null);
    const [editing, setEditing] = useState<{ id: string | null } | null>(null);
    const [removing, setRemoving] = useState<CopilotSkill | null>(null);
    const [writeError, setWriteError] = useState<string | null>(null);
    // Which row's switch is waiting on its write — that one switch is
    // disabled until it lands, rather than every row.
    const [toggling, setToggling] = useState<string | null>(null);

    const detail = useSkill(workspace.id, editing?.id ?? null);
    const create = useCreateSkill(workspace.id);
    const update = useUpdateSkill(workspace.id);
    const remove = useDeleteSkill(workspace.id);

    const basePath = agentsPath(workspace.id);
    const openCreate = () => {
        setWriteError(null);
        setEditing({ id: null });
    };

    const topBar = (
        <AgentsTopBar
            workspaceId={workspace.id}
            basePath={basePath}
            leaf={intl.formatMessage(messages.title)}
            actions={
                canManage && deploymentRunsCopilot ? (
                    <Button size="sm" className="gap-1.5" onClick={openCreate}>
                        <Plus aria-hidden className="size-4" />
                        {intl.formatMessage(messages.create)}
                    </Button>
                ) : (
                    <></>
                )
            }
        />
    );

    if (!canManage || !deploymentRunsCopilot) {
        // Told apart rather than collapsed, exactly as on the Agents page:
        // "you may not" and "nobody may here" send the reader to different
        // people.
        const denied = !canManage;
        return (
            <>
                {topBar}
                <Container>
                    <Empty className="border" role="alert">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                {denied ? <Lock /> : <PowerOff />}
                            </EmptyMedia>
                            <EmptyTitle>
                                {intl.formatMessage(
                                    denied
                                        ? messages.forbiddenTitle
                                        : messages.offTitle
                                )}
                            </EmptyTitle>
                            <EmptyDescription>
                                {intl.formatMessage(
                                    denied
                                        ? messages.forbiddenBody
                                        : messages.offBody
                                )}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </Container>
            </>
        );
    }

    const rows = skills.data ?? [];

    const save = (values: SkillFormValues) => {
        setWriteError(null);
        const onError = (error: unknown) =>
            setWriteError(
                skillWriteMessage(
                    error,
                    intl.formatMessage(messages.saveFailed)
                )
            );
        const onSuccess = () => {
            setEditing(null);
            toast.success(intl.formatMessage(messages.saved));
        };

        if (editing?.id) {
            update.mutate(
                { id: editing.id, patch: values },
                { onSuccess, onError }
            );
            return;
        }
        create.mutate(values, { onSuccess, onError });
    };

    const setAvailable = (skill: CopilotSkill, enabled: boolean) => {
        if (!skill.id) return;
        setToggling(skill.id);
        update.mutate(
            { id: skill.id, patch: { enabled } },
            {
                onSuccess: () =>
                    toast.success(
                        intl.formatMessage(
                            enabled ? messages.turnedOn : messages.turnedOff,
                            { title: skill.title }
                        )
                    ),
                onError: (error) =>
                    toast.error(
                        skillWriteMessage(
                            error,
                            intl.formatMessage(messages.saveFailed)
                        )
                    ),
                onSettled: () => setToggling(null)
            }
        );
    };

    return (
        <>
            {topBar}
            <Container className="flex flex-col">
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.intro)}
                />

                {skills.isPending ? (
                    <div className="flex flex-col gap-2" aria-hidden>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : skills.isError ? (
                    // A failed list is not an empty one: "no skills yet" would
                    // tell an admin the workspace's guidance is gone.
                    <Empty className="border" role="alert">
                        <EmptyHeader>
                            <EmptyTitle>
                                {intl.formatMessage(messages.loadFailed)}
                            </EmptyTitle>
                        </EmptyHeader>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void skills.refetch()}
                        >
                            {intl.formatMessage(messages.retry)}
                        </Button>
                    </Empty>
                ) : rows.length === 0 ? (
                    <Empty className="border">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <BookOpen />
                            </EmptyMedia>
                            <EmptyTitle>
                                {intl.formatMessage(messages.emptyTitle)}
                            </EmptyTitle>
                            <EmptyDescription>
                                {intl.formatMessage(messages.emptyBody)}
                            </EmptyDescription>
                        </EmptyHeader>
                        <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={openCreate}
                        >
                            <Plus aria-hidden className="size-4" />
                            {intl.formatMessage(messages.create)}
                        </Button>
                    </Empty>
                ) : (
                    // Named, like every other table in the admin: a screen
                    // reader's table list otherwise reads "table" with no way
                    // to tell one page's from another's (`ORT-160`).
                    <Table aria-label={intl.formatMessage(messages.tableLabel)}>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    {intl.formatMessage(messages.colName)}
                                </TableHead>
                                <TableHead>
                                    {intl.formatMessage(messages.colIdentifier)}
                                </TableHead>
                                <TableHead>
                                    {intl.formatMessage(messages.colWhen)}
                                </TableHead>
                                <TableHead>
                                    {intl.formatMessage(messages.colState)}
                                </TableHead>
                                <TableHead className="w-11">
                                    <span className="sr-only">
                                        {intl.formatMessage(
                                            messages.colActions
                                        )}
                                    </span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((skill) => (
                                <SkillRow
                                    key={`${skill.source}:${skill.name}`}
                                    skill={skill}
                                    toggling={toggling === skill.id}
                                    onToggle={(enabled) =>
                                        setAvailable(skill, enabled)
                                    }
                                    onEdit={() => {
                                        setWriteError(null);
                                        setEditing({ id: skill.id });
                                    }}
                                    onDelete={() => setRemoving(skill)}
                                />
                            ))}
                        </TableBody>
                    </Table>
                )}

                <SkillSheet
                    open={editing !== null}
                    skill={editing?.id ? (detail.data ?? null) : null}
                    workspaceName={workspace.name}
                    loading={Boolean(editing?.id) && detail.isFetching}
                    saving={create.isPending || update.isPending}
                    error={writeError}
                    onSubmit={save}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditing(null);
                            setWriteError(null);
                        }
                    }}
                />

                <ConfirmDialog
                    open={removing !== null}
                    onOpenChange={(open) => {
                        if (!open) setRemoving(null);
                    }}
                    title={intl.formatMessage(messages.deleteTitle)}
                    description={intl.formatMessage(messages.deleteBody, {
                        title: removing?.title ?? ''
                    })}
                    confirmLabel={intl.formatMessage(messages.deleteConfirm)}
                    cancelLabel={intl.formatMessage(messages.cancel)}
                    confirmVariant="destructive"
                    busy={remove.isPending}
                    onConfirm={() => {
                        const id = removing?.id;
                        if (!id) return;
                        remove.mutate(id, {
                            onSuccess: () => {
                                setRemoving(null);
                                toast.success(
                                    intl.formatMessage(messages.deleted)
                                );
                            },
                            onError: (error) =>
                                toast.error(
                                    skillWriteMessage(
                                        error,
                                        intl.formatMessage(
                                            messages.deleteFailed
                                        )
                                    )
                                )
                        });
                    }}
                />
            </Container>
        </>
    );
}

/** One skill: what it is, its identifier, when it applies, and its switch. */
function SkillRow({
    skill,
    toggling,
    onToggle,
    onEdit,
    onDelete
}: {
    skill: CopilotSkill;
    toggling: boolean;
    onToggle(enabled: boolean): void;
    onEdit(): void;
    onDelete(): void;
}) {
    const intl = useIntl();
    const fromCode = skill.source === 'code';
    const editable = skill.editable && Boolean(skill.id);

    const toggle = (
        <Switch
            checked={skill.enabled}
            disabled={!editable || toggling}
            onCheckedChange={onToggle}
            aria-label={intl.formatMessage(messages.available, {
                title: skill.title
            })}
        />
    );

    return (
        <TableRow>
            <TableCell className="max-w-md">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{skill.title}</span>
                    {fromCode ? (
                        <Badge
                            variant="line"
                            size="xs"
                            title={intl.formatMessage(messages.fromCodeHint)}
                        >
                            {intl.formatMessage(messages.fromCode)}
                        </Badge>
                    ) : null}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                    {skill.description}
                </p>
            </TableCell>
            <TableCell>
                <code className="font-mono text-xs">{skill.name}</code>
            </TableCell>
            <TableCell>
                {skill.mode === 'always' ? (
                    <Badge variant="info" size="xs">
                        {intl.formatMessage(messages.always)}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground text-[13px]">
                        {intl.formatMessage(messages.manual)}
                    </span>
                )}
            </TableCell>
            <TableCell>
                {/* A code skill's switch is drawn — it is on, and that is
                    worth seeing — but cannot be moved here; the tooltip says
                    why, and so does the "From code" badge beside its name. */}
                {fromCode ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex">{toggle}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                            {intl.formatMessage(messages.fromCodeHint)}
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    toggle
                )}
            </TableCell>
            <TableCell className="text-right">
                {/* No menu on a code skill: there is nothing here to edit or
                    delete, and a menu of disabled items explains nothing. */}
                {editable ? (
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label={intl.formatMessage(
                                    messages.actions,
                                    { title: skill.title }
                                )}
                            >
                                <MoreHorizontal className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onSelect={onEdit}>
                                <Pencil className="size-3.5" />
                                {intl.formatMessage(messages.edit)}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={onDelete}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="size-3.5" />
                                {intl.formatMessage(messages.remove)}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
            </TableCell>
        </TableRow>
    );
}
