import { defineMessages, useIntl } from 'react-intl';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useHasPermission } from '@orthacms/identity-admin';
import { PageTopBar } from '@orthacms/shell-admin';
import { Layers, Plus, Settings, Users } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader,
    Skeleton,
    SkeletonRegion
} from '@orthacms/design-system';
import { initialsOf, useDocumentTitle } from '@orthacms/utils-admin';
import { useContentTypes } from '../../../application/useContentTypes';
import { useWorkspaces } from '../../../application/useWorkspaces';
import type { WorkspaceReadyState } from '../../../application/useCreateWorkspaceFlow';
import type { InviteOutcome } from '../../../domain/types/wizard';
import {
    contentTypeCount,
    splitMembers
} from '../../../domain/workspaceSummary';
import { WorkspaceAvatar } from '../../components/WorkspaceAvatar';
import { NextStepRow } from '../../components/NextStepRow';

const messages = defineMessages({
    crumbWorkspaces: {
        id: 'workspaces.ready.crumbWorkspaces',
        defaultMessage: 'Workspaces'
    },
    title: {
        id: 'workspaces.ready.title',
        defaultMessage: '{name} is ready'
    },
    types: {
        id: 'workspaces.ready.types',
        defaultMessage:
            '{count, plural, one {# content type} other {# content types}}'
    },
    members: {
        id: 'workspaces.ready.members',
        defaultMessage: '{count, plural, one {# member} other {# members}}'
    },
    invitesSent: {
        id: 'workspaces.ready.invitesSent',
        defaultMessage:
            '{count, plural, one {# invite} other {# invites}} sent to {emails}'
    },
    invitesLink: {
        id: 'workspaces.ready.invitesLink',
        defaultMessage:
            '{count, plural, one {# invite link} other {# invite links}} ready for {emails}'
    },
    invitesPending: {
        id: 'workspaces.ready.invitesPending',
        defaultMessage:
            '{count, plural, one {# invite} other {# invites}} waiting for {emails}'
    },
    invitesPendingCount: {
        id: 'workspaces.ready.invitesPendingCount',
        defaultMessage:
            '{count, plural, one {# invite} other {# invites}} not yet accepted'
    },
    nextSteps: {
        id: 'workspaces.ready.nextSteps',
        defaultMessage: 'Next steps'
    },
    writeTitle: {
        id: 'workspaces.ready.writeTitle',
        defaultMessage: 'Write the first record'
    },
    writeHint: {
        id: 'workspaces.ready.writeHint',
        defaultMessage:
            '{types} {count, plural, one {is} other {are}} ready to use.'
    },
    writeNone: {
        id: 'workspaces.ready.writeNone',
        defaultMessage:
            'It holds no collections yet — pick what it can hold in Settings → Content.'
    },
    newRecord: {
        id: 'workspaces.ready.newRecord',
        defaultMessage: 'New record'
    },
    newRecordLabel: {
        id: 'workspaces.ready.newRecordLabel',
        defaultMessage: 'New record in {type}'
    },
    contentTypes: {
        id: 'workspaces.ready.contentTypes',
        defaultMessage: 'Content types'
    },
    inviteTitle: {
        id: 'workspaces.ready.inviteTitle',
        defaultMessage: 'Invite more people'
    },
    inviteHintSent: {
        id: 'workspaces.ready.inviteHintSent',
        defaultMessage:
            '{who} {count, plural, one {gets an email} other {get an email}}; you can resend it from Members.'
    },
    inviteHintLink: {
        id: 'workspaces.ready.inviteHintLink',
        defaultMessage:
            'No mail is set up, so copy the invite link for {who} from Members.'
    },
    inviteHintPending: {
        id: 'workspaces.ready.inviteHintPending',
        defaultMessage:
            'The invite for {who} waits in Members until someone sends it.'
    },
    inviteHintNone: {
        id: 'workspaces.ready.inviteHintNone',
        defaultMessage: 'Add teammates from the directory.'
    },
    invite: { id: 'workspaces.ready.invite', defaultMessage: 'Invite' },
    shareTitle: {
        id: 'workspaces.ready.shareTitle',
        defaultMessage: 'Share its published records'
    },
    shareHint: {
        id: 'workspaces.ready.shareHint',
        defaultMessage:
            'Make it a shared workspace so others can link to its records.'
    },
    settings: { id: 'workspaces.ready.settings', defaultMessage: 'Settings' },
    open: { id: 'workspaces.ready.open', defaultMessage: 'Open {name}' },
    back: {
        id: 'workspaces.ready.back',
        defaultMessage: 'Back to workspaces'
    },
    loading: {
        id: 'workspaces.ready.loading',
        defaultMessage: 'Loading the workspace…'
    },
    missing: {
        id: 'workspaces.ready.missing',
        defaultMessage:
            'This workspace isn’t in your list — it may have been removed, or you are no longer a member.'
    },
    loadError: {
        id: 'workspaces.ready.loadError',
        defaultMessage: 'Couldn’t load the workspace. Please try again.'
    },
    retry: { id: 'workspaces.ready.retry', defaultMessage: 'Retry' },
    people: {
        id: 'workspaces.ready.people',
        defaultMessage: '{count} people'
    }
});

/** How many addresses a sentence names before it only counts. */
const NAMED = 2;

/** Reads the wizard's router state, tolerating anything else in there. */
function readyState(state: unknown): WorkspaceReadyState | null {
    const invites = (state as WorkspaceReadyState | null)?.invites;
    return Array.isArray(invites) ? { invites } : null;
}

/**
 * Where a new workspace lands instead of a toast and a jump back to the list:
 * the outcome — "{name} is ready", what it holds, who is in, where the
 * invitations went — then the three things people do next (write the first
 * record, invite more people, share it), and the way in. Rendered at
 * `/workspaces/:id/ready`; read from the membership-scoped list, so an id the
 * user can't see reads as missing, never as someone else's workspace.
 */
export function WorkspaceReadyPage() {
    const intl = useIntl();
    const { id = '' } = useParams();
    const location = useLocation();
    const state = readyState(location.state);
    const canUpdate = useHasPermission('workspaces:update');
    const { data, isLoading, isError, refetch } = useWorkspaces();
    const catalog = useContentTypes();
    const workspace = data?.find((candidate) => candidate.id === id);
    useDocumentTitle(
        intl.formatMessage(messages.title, { name: workspace?.name ?? '' })
    );

    const crumbs = [
        {
            key: 'workspaces',
            label: intl.formatMessage(messages.crumbWorkspaces),
            to: '/workspaces'
        },
        ...(workspace ? [{ key: 'ready', label: workspace.name }] : [])
    ];
    const topBar = (
        <PageTopBar
            icon={Layers}
            iconClassName="bg-violet-soft text-violet-soft-foreground"
            crumbs={crumbs}
        />
    );
    const backLink = (
        <Button asChild variant="ghost">
            <Link to="/workspaces">{intl.formatMessage(messages.back)}</Link>
        </Button>
    );

    if (isLoading) {
        return (
            <>
                {topBar}
                <Container className="max-w-[760px]">
                    <SkeletonRegion
                        label={intl.formatMessage(messages.loading)}
                        heading={intl.formatMessage(messages.loading)}
                        className="flex flex-col gap-4"
                    >
                        <Skeleton className="h-12 w-72" />
                        <Skeleton className="h-48 w-full rounded-xl" />
                    </SkeletonRegion>
                </Container>
            </>
        );
    }

    if (isError || !workspace) {
        return (
            <>
                {topBar}
                <Container className="flex max-w-[760px] flex-col gap-4">
                    <Alert
                        variant={isError ? 'destructive' : 'default'}
                        role="alert"
                    >
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>
                                {intl.formatMessage(
                                    isError
                                        ? messages.loadError
                                        : messages.missing
                                )}
                            </span>
                            {isError ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => refetch()}
                                >
                                    {intl.formatMessage(messages.retry)}
                                </Button>
                            ) : null}
                        </AlertDescription>
                    </Alert>
                    <div>{backLink}</div>
                </Container>
            </>
        );
    }

    const base = `/workspaces/${workspace.id}`;
    const { active, pending } = splitMembers(workspace);
    const invites: InviteOutcome[] =
        state?.invites ??
        pending.map((member) => ({
            email: member.email,
            delivery: 'pending' as const
        }));
    const named = (list: InviteOutcome[]) =>
        list.length <= NAMED
            ? intl.formatList(list.map((invite) => invite.email))
            : intl.formatMessage(messages.people, { count: list.length });
    const byDelivery = (delivery: InviteOutcome['delivery']) =>
        invites.filter((invite) => invite.delivery === delivery);
    const sent = byDelivery('sent');
    const links = byDelivery('link');
    const waiting = byDelivery('pending');

    const summary = [
        intl.formatMessage(messages.types, {
            count: contentTypeCount(workspace)
        }),
        intl.formatMessage(messages.members, { count: active.length }),
        ...(sent.length
            ? [
                  intl.formatMessage(messages.invitesSent, {
                      count: sent.length,
                      emails: named(sent)
                  })
              ]
            : []),
        ...(links.length
            ? [
                  intl.formatMessage(messages.invitesLink, {
                      count: links.length,
                      emails: named(links)
                  })
              ]
            : []),
        ...(waiting.length
            ? [
                  state
                      ? intl.formatMessage(messages.invitesPending, {
                            count: waiting.length,
                            emails: named(waiting)
                        })
                      : intl.formatMessage(messages.invitesPendingCount, {
                            count: waiting.length
                        })
              ]
            : [])
    ].join(' · ');

    // The collections it may write, in catalogue order; a page has one
    // record already, so "the first record" means a collection.
    const kinds = new Map(
        (catalog.data ?? []).map((type) => [type.name, type])
    );
    const collections = workspace.content
        .map((slug) => kinds.get(slug))
        .filter((type) => type?.kind === 'collection')
        .map((type) => ({
            slug: type?.name ?? '',
            label: type?.label ?? type?.name ?? ''
        }));
    const first = collections[0];

    const inviteHint = sent.length
        ? intl.formatMessage(messages.inviteHintSent, {
              who: named(sent),
              count: sent.length
          })
        : links.length
          ? intl.formatMessage(messages.inviteHintLink, { who: named(links) })
          : waiting.length
            ? intl.formatMessage(messages.inviteHintPending, {
                  who: named(waiting)
              })
            : intl.formatMessage(messages.inviteHintNone);

    return (
        <>
            {topBar}
            <Container className="flex max-w-[760px] flex-col gap-5">
                <div className="flex items-start gap-3.5">
                    <WorkspaceAvatar
                        initials={initialsOf(workspace.name)}
                        color={workspace.color}
                        className="size-12 shrink-0 rounded-xl text-lg"
                    />
                    <ContainerHeader
                        className="mb-0"
                        title={intl.formatMessage(messages.title, {
                            name: workspace.name
                        })}
                        subtitle={summary}
                    />
                </div>

                <section
                    aria-labelledby="workspace-next-steps"
                    className="overflow-hidden rounded-xl border bg-card"
                >
                    <h2
                        id="workspace-next-steps"
                        className="px-4 py-3 text-sm font-semibold"
                    >
                        {intl.formatMessage(messages.nextSteps)}
                    </h2>
                    <ul>
                        <NextStepRow
                            icon={Plus}
                            tone="info"
                            title={intl.formatMessage(messages.writeTitle)}
                            hint={
                                first
                                    ? intl.formatMessage(messages.writeHint, {
                                          types: intl.formatList(
                                              collections
                                                  .slice(0, 3)
                                                  .map((type) => type.label)
                                          ),
                                          count: Math.min(collections.length, 3)
                                      })
                                    : intl.formatMessage(messages.writeNone)
                            }
                            action={
                                first ? (
                                    <Button asChild variant="outline" size="sm">
                                        <Link
                                            to={`${base}/content/${first.slug}/new`}
                                            aria-label={intl.formatMessage(
                                                messages.newRecordLabel,
                                                { type: first.label }
                                            )}
                                        >
                                            {intl.formatMessage(
                                                messages.newRecord
                                            )}
                                        </Link>
                                    </Button>
                                ) : canUpdate ? (
                                    <Button asChild variant="outline" size="sm">
                                        <Link to={`${base}/settings/content`}>
                                            {intl.formatMessage(
                                                messages.contentTypes
                                            )}
                                        </Link>
                                    </Button>
                                ) : null
                            }
                        />
                        {canUpdate ? (
                            <NextStepRow
                                icon={Users}
                                tone="success"
                                title={intl.formatMessage(messages.inviteTitle)}
                                hint={inviteHint}
                                action={
                                    <Button asChild variant="outline" size="sm">
                                        <Link to={`${base}/settings/members`}>
                                            {intl.formatMessage(
                                                messages.invite
                                            )}
                                        </Link>
                                    </Button>
                                }
                            />
                        ) : null}
                        {canUpdate && !workspace.isShared ? (
                            <NextStepRow
                                icon={Settings}
                                tone="muted"
                                title={intl.formatMessage(messages.shareTitle)}
                                hint={intl.formatMessage(messages.shareHint)}
                                action={
                                    <Button asChild variant="ghost" size="sm">
                                        <Link to={`${base}/settings/general`}>
                                            {intl.formatMessage(
                                                messages.settings
                                            )}
                                        </Link>
                                    </Button>
                                }
                            />
                        ) : null}
                    </ul>
                </section>

                <div className="flex flex-wrap items-center gap-2">
                    <Button asChild>
                        <Link to={base}>
                            {intl.formatMessage(messages.open, {
                                name: workspace.name
                            })}
                        </Link>
                    </Button>
                    {backLink}
                </div>
            </Container>
        </>
    );
}
