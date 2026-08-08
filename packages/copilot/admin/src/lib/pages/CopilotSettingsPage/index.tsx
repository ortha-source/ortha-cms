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
 * There is deliberately no "select all". ADR-0005 §6's opt-in is per tool, and
 * one control that ticks everything would turn a team's judgement about alt
 * text into blanket write access the next time a tool ships.
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
                                                    ? [...current, tool.name]
                                                    : current.filter(
                                                          (name) =>
                                                              name !== tool.name
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
