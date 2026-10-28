import { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import {
    Container,
    ContainerHeader,
    Skeleton,
    SkeletonRegion,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@orthacms/design-system';
import { useAuth, useHasPermission } from '@orthacms/identity-admin';
import { PageTopBar } from '@orthacms/shell-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { ShieldCheck } from 'lucide-react';
import {
    useRecentlyApproved,
    useReviewQueue
} from '../../../application/hooks';
import {
    splitQueue,
    type RecentlyApprovedItem,
    type ReviewQueueItem
} from '../../../domain/types';
import { ProtectionSettings } from '../../components/ProtectionSettings';
import { RecentlyApprovedTable } from '../../components/RecentlyApprovedTable';
import {
    ReviewPanel,
    type ReviewPanelItem
} from '../../components/ReviewPanel';
import { ReviewQueueTable } from '../../components/ReviewQueueTable';
import { ReviewQueueTableSkeleton } from '../../components/ReviewQueueTableSkeleton';

const messages = defineMessages({
    title: { id: 'protection.reviews.title', defaultMessage: 'Reviews' },
    crumb: { id: 'protection.reviews.crumb', defaultMessage: 'Reviews' },
    subtitle: {
        id: 'protection.reviews.subtitle',
        defaultMessage:
            'Records waiting for an approval before they can be published.'
    },
    tabsLabel: {
        id: 'protection.reviews.tabsLabel',
        defaultMessage: 'Which requests to show'
    },
    tabWaiting: {
        id: 'protection.reviews.tabWaiting',
        defaultMessage: 'Waiting on me'
    },
    tabMine: {
        id: 'protection.reviews.tabMine',
        defaultMessage: 'My requests'
    },
    tabApproved: {
        id: 'protection.reviews.tabApproved',
        defaultMessage: 'Recently approved'
    },
    tabRules: {
        id: 'protection.reviews.tabRules',
        defaultMessage: 'Rules'
    },
    rulesTitle: {
        id: 'protection.reviews.rulesTitle',
        defaultMessage: 'Publishing rules'
    },
    rulesSubtitle: {
        id: 'protection.reviews.rulesSubtitle',
        defaultMessage:
            'Content types that need a review before they go live, in this workspace.'
    },
    loading: {
        id: 'protection.reviews.loading',
        defaultMessage: 'Loading review requests'
    },
    loadingApproved: {
        id: 'protection.reviews.loadingApproved',
        defaultMessage: 'Loading what you approved'
    },
    failed: {
        id: 'protection.reviews.failed',
        defaultMessage:
            'The review queue could not be loaded, so this list may be incomplete. Reload the page to try again.'
    },
    failedApproved: {
        id: 'protection.reviews.failedApproved',
        defaultMessage:
            'What you approved could not be loaded. Reload the page to try again.'
    },
    emptyWaiting: {
        id: 'protection.reviews.emptyWaiting',
        defaultMessage:
            'Nothing is waiting on you. Requests other people open appear here.'
    },
    emptyMine: {
        id: 'protection.reviews.emptyMine',
        defaultMessage:
            'You have not asked anyone to review a record yet. Ask from the record’s Review panel.'
    },
    emptyApproved: {
        id: 'protection.reviews.emptyApproved',
        defaultMessage:
            'You have not approved anything in the last {days} days. What you approve appears here.'
    }
});

/**
 * The three questions the page answers, and — for an administrator — the
 * rules that make anybody ask them.
 */
type Tab = 'waiting' | 'mine' | 'approved' | 'rules';

const TABS: readonly Tab[] = ['waiting', 'mine', 'approved', 'rules'];

/** `?tab=`, read leniently: anything unknown is the default tab. */
function tabOf(value: string | null, canManage: boolean): Tab {
    const tab = TABS.find((candidate) => candidate === value) ?? 'waiting';
    // The Rules tab is not rendered without the permission, so a link to it
    // lands on the queue rather than on a tab that is not there.
    return tab === 'rules' && !canManage ? 'waiting' : tab;
}

/** A queue line as the side panel reads it. */
function fromQueue(item: ReviewQueueItem): ReviewPanelItem {
    return {
        key: item.id,
        contentType: item.contentType,
        contentTypeLabel: item.contentTypeLabel,
        entryId: item.entryId,
        entryTitle: item.entryTitle,
        askedAt: item.createdAt,
        headRevisionNumber: item.headRevisionNumber,
        liveRevisionNumber: item.liveRevisionNumber
    };
}

/** A "Recently approved" line as the side panel reads it. */
function fromApproved(item: RecentlyApprovedItem): ReviewPanelItem {
    return {
        key: item.id,
        contentType: item.contentType,
        contentTypeLabel: item.contentTypeLabel,
        entryId: item.entryId,
        entryTitle: item.entryTitle,
        // An approved line is not waiting on the reader, so it is never
        // "overdue" for them.
        askedAt: null,
        headRevisionNumber: item.headRevisionNumber,
        liveRevisionNumber: item.liveRevisionNumber
    };
}

/**
 * The reviewer's queue — **the page without which the feature does not work**.
 *
 * A request mails the reviewers it names (when a mail provider is configured)
 * and the navigation counts what waits, but this is where the asks are — which
 * is why it is a page of its own rather
 * than a saved view of one collection's records list: a saved view can only
 * ever ask about the collection it belongs to, and an ask arrives against
 * whichever type someone happened to be editing.
 *
 * **Three tabs, two reads.** "Waiting on me" and "My requests" are one fetched
 * window split by `splitQueue`, so their counts cannot disagree with each other
 * and switching between them costs nothing. "Recently approved" — *did I
 * already approve that?* — is a different question with its own read, made the
 * first time the tab is opened.
 *
 * **Review opens a side panel beside the table** with the changes since the
 * live version and Approve, so a reviewer can work down the queue without
 * leaving it; Open record is there for a closer look.
 *
 * **The rules live here too**, on a fourth tab only `protection:manage` sees.
 * They used to be a section of workspace settings, which put "why does this
 * need a review" one page away from "what needs a review" — alarms keep their
 * rules beside their findings for the same reason. They are still the
 * workspace's rules: nothing about how a rule is stored or scoped moved. The
 * tab is in the URL (`?tab=rules`) so the old settings address can redirect
 * to it and a link can open it.
 */
export function ReviewsPage() {
    const intl = useIntl();
    const auth = useAuth();
    const workspace = useCurrentWorkspace();
    const canManage = useHasPermission('protection:manage');
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = tabOf(searchParams.get('tab'), canManage);
    const setTab = (next: Tab) =>
        setSearchParams(
            (params) => {
                const updated = new URLSearchParams(params);
                if (next === 'waiting') updated.delete('tab');
                else updated.set('tab', next);
                return updated;
            },
            { replace: true }
        );
    const [approvedClicked, setApprovedOpened] = useState(false);
    // Opened by a click or arrived at by link — either way the read is wanted.
    const approvedOpened = approvedClicked || tab === 'approved';
    const [reviewing, setReviewing] = useState<ReviewPanelItem | null>(null);
    const trigger = useRef<HTMLElement | null>(null);

    const { data, isPending, isError, isPlaceholderData } = useReviewQueue(
        workspace?.id ?? '',
        {},
        !!workspace
    );
    const approved = useRecentlyApproved(
        workspace?.id ?? '',
        !!workspace && approvedOpened
    );

    const { waitingOnMe, mine } = splitQueue(
        data?.items ?? [],
        auth.user?.id ?? ''
    );
    const overdueAfterDays = data?.overdueAfterDays ?? 3;

    const review = (item: ReviewPanelItem, button: HTMLElement) => {
        trigger.current = button;
        setReviewing(item);
    };

    const queueTab = (rows: ReviewQueueItem[], empty: string) => {
        if (isError) return null;
        if (!rows.length) {
            return <p className="text-sm text-muted-foreground">{empty}</p>;
        }
        return (
            <ReviewQueueTable
                items={rows}
                currentUserId={auth.user?.id}
                overdueAfterDays={overdueAfterDays}
                stale={isPlaceholderData}
                selectedId={reviewing?.key}
                onReview={(item, button) => review(fromQueue(item), button)}
            />
        );
    };

    return (
        <>
            <PageTopBar
                icon={ShieldCheck}
                crumbs={[
                    {
                        key: 'reviews',
                        label: intl.formatMessage(messages.crumb)
                    }
                ]}
            />
            <Container className="flex flex-col">
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                />

                {isPending ? (
                    <SkeletonRegion
                        label={intl.formatMessage(messages.loading)}
                    >
                        <Skeleton className="mb-4 h-8 w-80" />
                        <ReviewQueueTableSkeleton />
                    </SkeletonRegion>
                ) : (
                    <>
                        {/* A failed read is its own state, never the empty one.
                            "Nothing is waiting on you" is a claim about the
                            workspace; saying it when the truth is "we could not
                            ask" tells a reviewer they are free when they are
                            not — the one thing this page must never do. */}
                        {isError && (
                            <p
                                role="alert"
                                className="mb-4 text-sm text-destructive"
                            >
                                {intl.formatMessage(messages.failed)}
                            </p>
                        )}

                        <Tabs
                            value={tab}
                            onValueChange={(next) => {
                                setTab(next as Tab);
                                if (next === 'approved') {
                                    setApprovedOpened(true);
                                }
                            }}
                        >
                            <TabsList
                                className="mb-4"
                                aria-label={intl.formatMessage(
                                    messages.tabsLabel
                                )}
                            >
                                <TabsTrigger value="waiting">
                                    {intl.formatMessage(messages.tabWaiting)}
                                    {!isError ? (
                                        <TabCount value={waitingOnMe.length} />
                                    ) : null}
                                </TabsTrigger>
                                <TabsTrigger value="mine">
                                    {intl.formatMessage(messages.tabMine)}
                                    {!isError ? (
                                        <TabCount value={mine.length} />
                                    ) : null}
                                </TabsTrigger>
                                <TabsTrigger value="approved">
                                    {intl.formatMessage(messages.tabApproved)}
                                </TabsTrigger>
                                {canManage ? (
                                    <TabsTrigger value="rules">
                                        {intl.formatMessage(messages.tabRules)}
                                    </TabsTrigger>
                                ) : null}
                            </TabsList>

                            <TabsContent value="waiting">
                                {queueTab(
                                    waitingOnMe,
                                    intl.formatMessage(messages.emptyWaiting)
                                )}
                            </TabsContent>
                            <TabsContent value="mine">
                                {queueTab(
                                    mine,
                                    intl.formatMessage(messages.emptyMine)
                                )}
                            </TabsContent>
                            <TabsContent value="approved">
                                {approved.isPending ? (
                                    <SkeletonRegion
                                        label={intl.formatMessage(
                                            messages.loadingApproved
                                        )}
                                    >
                                        <ReviewQueueTableSkeleton rows={3} />
                                    </SkeletonRegion>
                                ) : approved.isError || !approved.data ? (
                                    <p
                                        role="alert"
                                        className="text-sm text-destructive"
                                    >
                                        {intl.formatMessage(
                                            messages.failedApproved
                                        )}
                                    </p>
                                ) : approved.data.items.length ? (
                                    <RecentlyApprovedTable
                                        items={approved.data.items}
                                        currentUserId={auth.user?.id}
                                        selectedId={reviewing?.key}
                                        onReview={(item, button) =>
                                            review(fromApproved(item), button)
                                        }
                                    />
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        {intl.formatMessage(
                                            messages.emptyApproved,
                                            { days: approved.data.windowDays }
                                        )}
                                    </p>
                                )}
                            </TabsContent>
                            {canManage ? (
                                <TabsContent value="rules">
                                    <section
                                        aria-labelledby="protection-rules-heading"
                                        className="flex flex-col gap-4"
                                    >
                                        <div>
                                            <h2
                                                id="protection-rules-heading"
                                                className="text-base font-semibold"
                                            >
                                                {intl.formatMessage(
                                                    messages.rulesTitle
                                                )}
                                            </h2>
                                            <p className="text-sm text-muted-foreground">
                                                {intl.formatMessage(
                                                    messages.rulesSubtitle
                                                )}
                                            </p>
                                        </div>
                                        <ProtectionSettings />
                                    </section>
                                </TabsContent>
                            ) : null}
                        </Tabs>
                    </>
                )}
            </Container>

            <ReviewPanel
                item={reviewing}
                overdueAfterDays={overdueAfterDays}
                onOpenChange={(open) => !open && setReviewing(null)}
                returnFocusTo={trigger}
            />
        </>
    );
}

/** A tab's count, beside its label — part of the tab's accessible name. */
function TabCount({ value }: { value: number }) {
    return (
        <span className="text-xs font-normal tabular-nums text-muted-foreground">
            {value}
        </span>
    );
}
