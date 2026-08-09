import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Checkbox,
    Label,
    Spinner
} from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import {
    useCopilotPolicy,
    useSetCopilotPolicy,
    type CopilotOptInCandidate
} from '../../application/useCopilotPolicy';

// The product is **Ortha AI**; the code, routes and permission keys keep the
// `copilot` name (see the naming note in `docs/design/copilot.md`).
const messages = defineMessages({
    title: {
        id: 'copilot.settings.title',
        defaultMessage: 'Ortha AI'
    },
    subtitle: {
        id: 'copilot.settings.subtitle',
        defaultMessage:
            'Choose which changes Ortha AI may make without asking first.'
    },
    forbiddenTitle: {
        id: 'copilot.settings.forbiddenTitle',
        defaultMessage: 'You cannot configure Ortha AI'
    },
    forbidden: {
        id: 'copilot.settings.forbidden',
        defaultMessage:
            'Deciding what may change without review is an administrator’s call. Ask one of your workspace’s administrators.'
    },
    // The question this page gets asked, answered on the page: people read a
    // screen of unticked checkboxes as a list of things they are not allowed to
    // do, and conclude the copilot is crippled. It is the opposite — every one
    // of these is something they *are* allowed to do, listed so they can decide
    // which ones stop pausing for review.
    permissionNote: {
        id: 'copilot.settings.permissionNote',
        defaultMessage:
            'This is not about permissions. Ortha AI can only ever do what your own role already allows, and it is re-checked on every change. What this page decides is which of those changes still wait for a person to approve them.'
    },
    sectionTitle: {
        id: 'copilot.settings.sectionTitle',
        defaultMessage: 'Apply without asking'
    },
    sectionHelp: {
        id: 'copilot.settings.sectionHelp',
        defaultMessage:
            'By default every change Ortha AI drafts waits for someone to approve it. Tick a tool here and its changes are applied the moment they are drafted. They are still recorded and still undoable — you just stop being asked.'
    },
    empty: {
        id: 'copilot.settings.empty',
        defaultMessage:
            'This deployment has no tools that can change anything, so there is nothing to configure.'
    },
    warningTitle: {
        id: 'copilot.settings.warningTitle',
        defaultMessage: 'Think about this one per tool'
    },
    warning: {
        id: 'copilot.settings.warning',
        defaultMessage:
            'Anything you tick here writes to real content as soon as Ortha AI decides to. Tick the ones whose mistakes are cheap to spot and undo — alt text, say — and leave the rest asking.'
    },
    selectAll: {
        id: 'copilot.settings.selectAll',
        defaultMessage: 'Tick all'
    },
    selectNone: {
        id: 'copilot.settings.selectNone',
        defaultMessage: 'Untick all'
    },
    selectedCount: {
        id: 'copilot.settings.selectedCount',
        defaultMessage: '{selected} of {total} ticked'
    },
    save: {
        id: 'copilot.settings.save',
        defaultMessage: 'Save'
    },
    saved: {
        id: 'copilot.settings.saved',
        defaultMessage: 'Saved.'
    },
    failed: {
        id: 'copilot.settings.failed',
        defaultMessage: 'That could not be saved. Please try again.'
    }
});

/** The permission this page is gated on, both here and on the server. */
const COPILOT_CONFIGURE = 'copilot:configure';

/**
 * The workspace's auto-apply policy
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §6):
 * one checkbox per `propose` tool the deployment has bound.
 *
 * **The default is every box unticked**, and the page says in words what that
 * means. Enabling the copilot must never read as enabling direct writes, so the
 * copy leads with "every change waits for approval" and frames ticking a box as
 * *removing* a step rather than granting a capability.
 *
 * **"Tick all" is a shortcut, not a wildcard**, and the distinction is the
 * whole reason it is allowed here. ADR-0005 §6 rules out storing "everything";
 * what this ticks is the tools *on screen right now*, and what is saved is
 * their names. A tool that ships next release is not in that list, so it
 * arrives asking for approval like any other — which is exactly the property
 * the ADR is protecting, and it survives the shortcut. What it buys is the
 * common case of a workspace that has already decided it trusts the four write
 * tools it has, and should not have to re-express that four times.
 */
export function CopilotSettingsPage() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const canConfigure = useHasPermission(COPILOT_CONFIGURE);
    const policy = useCopilotPolicy(workspace.id, canConfigure);
    const save = useSetCopilotPolicy(workspace.id);
    const [selected, setSelected] = useState<string[] | null>(null);

    // Seeded from the server once loaded, then owned locally so ticking a box
    // is instant and Save is a deliberate act. `null` means "not seeded yet",
    // which is distinguishable from "seeded as empty" — the ordinary case here.
    useEffect(() => {
        if (policy.data && selected === null) {
            setSelected(policy.data.autoApplyTools);
        }
    }, [policy.data, selected]);

    if (!canConfigure) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-8">
                <Alert>
                    <ShieldCheck className="size-4" />
                    <AlertTitle>
                        {intl.formatMessage(messages.forbiddenTitle)}
                    </AlertTitle>
                    <AlertDescription>
                        {intl.formatMessage(messages.forbidden)}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const candidates: CopilotOptInCandidate[] =
        policy.data?.optInCandidates ?? [];
    const current = selected ?? [];
    const dirty =
        policy.data !== undefined &&
        JSON.stringify([...current].sort()) !==
            JSON.stringify([...policy.data.autoApplyTools].sort());

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
            <header>
                <h1 className="text-xl font-semibold">
                    {intl.formatMessage(messages.title)}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    {intl.formatMessage(messages.subtitle)}
                </p>
            </header>

            <Alert>
                <ShieldCheck className="size-4" />
                <AlertDescription>
                    {intl.formatMessage(messages.permissionNote)}
                </AlertDescription>
            </Alert>

            <section className="space-y-3">
                <div>
                    <h2 className="text-sm font-medium">
                        {intl.formatMessage(messages.sectionTitle)}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {intl.formatMessage(messages.sectionHelp)}
                    </p>
                </div>

                {policy.isPending ? (
                    <Spinner className="size-4" />
                ) : candidates.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        {intl.formatMessage(messages.empty)}
                    </p>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <span
                                className="text-muted-foreground mr-auto text-xs"
                                role="status"
                            >
                                {intl.formatMessage(messages.selectedCount, {
                                    selected: current.length,
                                    total: candidates.length
                                })}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={current.length === 0}
                                onClick={() => setSelected([])}
                            >
                                {intl.formatMessage(messages.selectNone)}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={current.length === candidates.length}
                                // The **names** on screen, never a wildcard: a
                                // tool that ships later is not in this list and
                                // therefore still asks (ADR-0005 §6).
                                onClick={() =>
                                    setSelected(
                                        candidates.map((tool) => tool.name)
                                    )
                                }
                            >
                                {intl.formatMessage(messages.selectAll)}
                            </Button>
                        </div>

                        <ul className="divide-y rounded-lg border">
                            {candidates.map((tool) => {
                                const checked = current.includes(tool.name);
                                return (
                                    <li
                                        key={tool.name}
                                        className="flex items-start gap-3 p-3"
                                    >
                                        <Checkbox
                                            id={`auto-${tool.name}`}
                                            checked={checked}
                                            onCheckedChange={(next) =>
                                                setSelected(
                                                    next === true
                                                        ? [
                                                              ...current,
                                                              tool.name
                                                          ]
                                                        : current.filter(
                                                              (name) =>
                                                                  name !==
                                                                  tool.name
                                                          )
                                                )
                                            }
                                        />
                                        <div className="min-w-0 flex-1">
                                            <Label
                                                htmlFor={`auto-${tool.name}`}
                                                className="font-mono text-xs"
                                            >
                                                {tool.name}
                                            </Label>
                                            {/* The tool's own description — the
                                            model reads it to decide when to
                                            call the tool, so it is the most
                                            honest account of what ticking this
                                            box lets happen. */}
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                {tool.description}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}

                {candidates.length > 0 && (
                    <Alert variant="warning">
                        <TriangleAlert className="size-4" />
                        <AlertTitle>
                            {intl.formatMessage(messages.warningTitle)}
                        </AlertTitle>
                        <AlertDescription>
                            {intl.formatMessage(messages.warning)}
                        </AlertDescription>
                    </Alert>
                )}

                {save.isError && (
                    <p className="text-destructive text-sm" role="alert">
                        {intl.formatMessage(messages.failed)}
                    </p>
                )}

                <div className="flex items-center gap-3">
                    <Button
                        disabled={!dirty || save.isPending}
                        onClick={() => save.mutate(current)}
                    >
                        {save.isPending && <Spinner className="size-3.5" />}
                        {intl.formatMessage(messages.save)}
                    </Button>
                    {save.isSuccess && !dirty && (
                        <span
                            className="text-muted-foreground text-sm"
                            role="status"
                        >
                            {intl.formatMessage(messages.saved)}
                        </span>
                    )}
                </div>
            </section>
        </div>
    );
}
