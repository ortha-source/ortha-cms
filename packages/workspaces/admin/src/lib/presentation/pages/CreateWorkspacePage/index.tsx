import { useEffect, useMemo, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link, Navigate } from 'react-router-dom';
import { useAuth, useHasPermission } from '@orthacms/identity-admin';
import { PageTopBar } from '@orthacms/shell-admin';
import { ArrowLeft, Layers } from 'lucide-react';
import {
    Button,
    Container,
    ContainerHeader,
    Spinner,
    WizardStepCard
} from '@orthacms/design-system';
import { initialsOf, useDocumentTitle } from '@orthacms/utils-admin';
import { useContentTypes } from '../../../application/useContentTypes';
import { useCreateWorkspaceFlow } from '../../../application/useCreateWorkspaceFlow';
import { ContentStep } from '../../components/CreateWorkspaceWizard/ContentStep';
import { IdentityFields } from '../../components/CreateWorkspaceWizard/IdentityFields';
import { PeopleStep } from '../../components/CreateWorkspaceWizard/PeopleStep';
import { WizardProgress } from '../../components/CreateWorkspaceWizard/WizardProgress';
import {
    WizardPreview,
    type PreviewTag
} from '../../components/CreateWorkspaceWizard/WizardPreview';
import { useSlug } from '../../hooks/useSlug';
import { useWizard } from '../../hooks/useWizard';
import { SlugStatus } from '../../../domain/types/wizard';
import { count, isSelected } from '../../../domain/resourceSelection';

const messages = defineMessages({
    title: {
        id: 'workspaces.create.pageTitle',
        defaultMessage: 'New workspace'
    },
    subtitle: {
        id: 'workspaces.create.pageSubtitle',
        defaultMessage:
            'Three short steps. Only a name is required — everything else can change later.'
    },
    crumbWorkspaces: {
        id: 'workspaces.create.crumbWorkspaces',
        defaultMessage: 'Workspaces'
    },
    progress: {
        id: 'workspaces.create.progress',
        defaultMessage: 'Progress'
    },
    stepBasics: {
        id: 'workspaces.create.stepBasics',
        defaultMessage: 'Basics'
    },
    stepContent: {
        id: 'workspaces.create.stepContent',
        defaultMessage: 'Content'
    },
    stepPeople: {
        id: 'workspaces.create.stepPeople',
        defaultMessage: 'People'
    },
    stepState: {
        id: 'workspaces.create.stepState',
        defaultMessage:
            'Step {number}: {label}{state, select, complete {, done} current {, current step} other {}}'
    },
    stepAnnouncement: {
        id: 'workspaces.create.stepAnnouncement',
        defaultMessage: 'Step {number} of {total}: {label}.'
    },
    cancel: { id: 'workspaces.create.cancel', defaultMessage: 'Cancel' },
    continue: { id: 'workspaces.create.continue', defaultMessage: 'Continue' },
    back: { id: 'workspaces.create.back', defaultMessage: 'Back' },
    skipJustMe: {
        id: 'workspaces.create.skipJustMe',
        defaultMessage: 'Skip — just me'
    },
    create: {
        id: 'workspaces.create.create',
        defaultMessage: 'Create workspace'
    },
    creating: {
        id: 'workspaces.create.creating',
        defaultMessage: 'Creating…'
    }
});

/**
 * Full-page wizard for creating a workspace — Basics → Content → People, with
 * a live preview of the card it becomes beside every step. Owns navigation
 * and submission; all form state lives in {@link useWizard}, and each step
 * body is presentational. Rendered at `/workspaces/new` inside the
 * authenticated shell; a created workspace lands on its "ready" screen.
 */
export function CreateWorkspacePage() {
    const intl = useIntl();
    const stepTitleRef = useRef<HTMLHeadingElement>(null);
    useDocumentTitle(intl.formatMessage(messages.title));
    const canCreate = useHasPermission('workspaces:create');
    const canInvite = useHasPermission('users:create');
    const auth = useAuth();
    const user = 'user' in auth ? auth.user : undefined;
    const wizard = useWizard();
    const flow = useCreateWorkspaceFlow();
    const slug = useSlug({ data: wizard.data, update: wizard.update });
    const contentTypes = useContentTypes();

    // `WizardStepCard` is keyed on the step so the entrance animation replays —
    // which unmounts the button the user just pressed and drops focus to
    // <body>, making every step change restart Tab at the top of the document.
    // Move focus to the new step's heading instead. `previousStep` keeps this
    // to real step *changes*: stealing focus on first paint would be its own
    // bug.
    const previousStep = useRef(wizard.step);
    useEffect(() => {
        if (previousStep.current === wizard.step) return;
        previousStep.current = wizard.step;
        stepTitleRef.current?.focus();
    }, [wizard.step]);

    // What the preview shows: the own types chosen (every one, for
    // "Everything"), the shared grants, and who is in.
    const preview = useMemo(() => {
        const catalog = contentTypes.data ?? [];
        const own =
            wizard.contentMode === 'all'
                ? catalog
                : catalog.filter((type) =>
                      isSelected(
                          type.kind === 'single'
                              ? wizard.pages
                              : wizard.collections,
                          type.name
                      )
                  );
        const ownCount =
            wizard.contentMode === 'all'
                ? catalog.length
                : count(
                      wizard.collections,
                      catalog.filter((t) => t.kind === 'collection').length
                  ) +
                  count(
                      wizard.pages,
                      catalog.filter((t) => t.kind === 'single').length
                  );
        const shared =
            wizard.contentMode === 'specific' ? wizard.sharedContent : [];
        const labelOf = (slug: string) =>
            catalog.find((type) => type.name === slug)?.label ?? slug;
        const tags: PreviewTag[] = [
            ...own.map((type) => ({
                label: type.label ?? type.name,
                shared: false
            })),
            ...shared.map((choice) => ({
                label: labelOf(choice.slug),
                shared: true
            }))
        ];
        const creatorName = user?.name ?? user?.email ?? '';
        const creator = {
            id: user?.id ?? 'me',
            name: creatorName,
            initials: initialsOf(creatorName) || '—',
            color: wizard.data.color
        };
        const people = [
            creator,
            ...wizard.members
                .filter((member) => !member.invited)
                .map((member, index) => ({
                    id: member.id,
                    name: member.name,
                    initials: initialsOf(member.name),
                    color: (['teal', 'green', 'amber', 'indigo'] as const)[
                        index % 4
                    ]
                }))
        ];
        const invites = wizard.members
            .filter((member) => member.invited)
            .map((member) => member.email);
        return {
            ownCount,
            sharedCount: shared.length,
            tags,
            people,
            invites
        };
    }, [
        contentTypes.data,
        wizard.contentMode,
        wizard.collections,
        wizard.pages,
        wizard.sharedContent,
        wizard.members,
        wizard.data.color,
        user
    ]);

    // The server enforces `workspaces:create`; redirect rather than render the
    // wizard for users who can't create one (e.g. deep-linking to
    // `/workspaces/new`). Auth is already resolved here — this route renders
    // inside the shell's `RequireAuth`, so `canCreate` reflects real grants.
    if (!canCreate) {
        return (
            <Navigate
                to="/workspaces"
                replace
                // Tell the list why it's showing instead of the wizard, so the
                // redirect isn't silent for a screen-reader user.
                state={{ redirectNotice: 'create-denied' }}
            />
        );
    }

    const basicsCanContinue =
        wizard.basicsValid && slug.status === SlugStatus.Available;
    const contentBlocked =
        wizard.contentMode === 'specific' &&
        (wizard.ctLoading || wizard.ctError);
    // `useWizard` already falls back to step 1 when the basics are incomplete,
    // so this is defense in depth: submitting without a name/slug can only ever
    // throw inside the `Slug` guard and surface as a generic failure, which
    // reads as "the server refused" when nothing was ever sent.
    const createBlocked =
        flow.submitting || contentBlocked || !wizard.basicsValid;

    // Submission (slug VO validation → create → invitations → the "ready"
    // screen) lives in the create use-case hook; the page only assembles the
    // snapshot. "Skip — just me" submits without the people step's additions,
    // leaving the wizard's own state alone.
    const submit = (justMe: boolean) => {
        if (createBlocked) return;
        void flow.submit(
            justMe ? { ...wizard.snapshot, members: [] } : wizard.snapshot
        );
    };

    const steps = [
        { label: intl.formatMessage(messages.stepBasics) },
        { label: intl.formatMessage(messages.stepContent) },
        { label: intl.formatMessage(messages.stepPeople) }
    ];

    const backButton = (to: number) => (
        <Button type="button" variant="ghost" onClick={() => wizard.goStep(to)}>
            <ArrowLeft />
            {intl.formatMessage(messages.back)}
        </Button>
    );

    return (
        <>
            <PageTopBar
                icon={Layers}
                iconClassName="bg-violet-soft text-violet-soft-foreground"
                crumbs={[
                    {
                        key: 'workspaces',
                        label: intl.formatMessage(messages.crumbWorkspaces),
                        to: '/workspaces'
                    },
                    {
                        key: 'new',
                        label: intl.formatMessage(messages.title)
                    }
                ]}
            />
            <Container className="flex max-w-[940px] flex-col gap-5">
                <ContainerHeader
                    className="mb-0"
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                />

                <WizardProgress
                    steps={steps}
                    current={wizard.step}
                    maxReached={wizard.maxReached}
                    onStepClick={wizard.goStep}
                    label={intl.formatMessage(messages.progress)}
                    stepLabel={(step, number, state) =>
                        intl.formatMessage(messages.stepState, {
                            number,
                            label: step.label,
                            state
                        })
                    }
                />

                {/* The heading swap is silent and the progress ("2 of 3")
                    lives in the line's styling; restate where the user is. */}
                <span role="status" aria-live="polite" className="sr-only">
                    {intl.formatMessage(messages.stepAnnouncement, {
                        number: wizard.step,
                        total: steps.length,
                        label: steps[wizard.step - 1]?.label ?? ''
                    })}
                </span>

                <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <WizardStepCard key={wizard.step} className="shadow-none">
                        <div className="p-5">
                            {wizard.step === 1 ? (
                                <>
                                    {/* The step's place in the heading
                                        outline and the focus target on a
                                        step change; the fields speak for
                                        themselves visually. */}
                                    <h2
                                        ref={stepTitleRef}
                                        tabIndex={-1}
                                        className="sr-only"
                                    >
                                        {steps[0].label}
                                    </h2>
                                    <IdentityFields
                                        data={wizard.data}
                                        update={wizard.update}
                                        slug={slug}
                                    />
                                </>
                            ) : wizard.step === 2 ? (
                                <ContentStep
                                    titleRef={stepTitleRef}
                                    contentMode={wizard.contentMode}
                                    setContentMode={wizard.setContentMode}
                                    collections={wizard.collections}
                                    setCollections={wizard.setCollections}
                                    pages={wizard.pages}
                                    setPages={wizard.setPages}
                                    sharedContent={wizard.sharedContent}
                                    onToggleSharedContent={
                                        wizard.toggleSharedContent
                                    }
                                />
                            ) : (
                                <PeopleStep
                                    titleRef={stepTitleRef}
                                    members={wizard.members}
                                    addMember={wizard.addMember}
                                    removeMember={wizard.removeMember}
                                    canInvite={canInvite}
                                    color={wizard.data.color}
                                />
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
                            {wizard.step === 1 ? (
                                <Button asChild variant="ghost">
                                    <Link to="/workspaces">
                                        {intl.formatMessage(messages.cancel)}
                                    </Link>
                                </Button>
                            ) : (
                                backButton(wizard.step - 1)
                            )}
                            <span className="flex-1" />
                            {wizard.step === 1 ? (
                                <Button
                                    type="button"
                                    onClick={() => wizard.goStep(2)}
                                    disabled={!basicsCanContinue}
                                >
                                    {intl.formatMessage(messages.continue)}
                                </Button>
                            ) : wizard.step === 2 ? (
                                <Button
                                    type="button"
                                    onClick={() => wizard.goStep(3)}
                                >
                                    {intl.formatMessage(messages.continue)}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => submit(true)}
                                        disabled={createBlocked}
                                    >
                                        {intl.formatMessage(
                                            messages.skipJustMe
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => submit(false)}
                                        disabled={createBlocked}
                                    >
                                        {flow.submitting ? (
                                            <>
                                                <Spinner />
                                                {intl.formatMessage(
                                                    messages.creating
                                                )}
                                            </>
                                        ) : (
                                            intl.formatMessage(messages.create)
                                        )}
                                    </Button>
                                </>
                            )}
                        </div>
                    </WizardStepCard>

                    <WizardPreview
                        step={wizard.step}
                        name={wizard.data.name}
                        color={wizard.data.color}
                        description={wizard.data.description}
                        ownCount={preview.ownCount}
                        sharedCount={preview.sharedCount}
                        tags={preview.tags}
                        people={preview.people}
                        invites={preview.invites}
                    />
                </div>
            </Container>
        </>
    );
}
