import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Blocks } from 'lucide-react';
import type { ClassifiedChange } from '@orthacms/schema-builder-domain';
import { Button, Container, ContainerHeader } from '@orthacms/design-system';
import { PageActionsPortal, PageTopBar } from '@orthacms/shell-admin';
import type { ApplyFlow } from '../../../application/useApplyFlow';
import { AppliedSummary } from '../AppliedSummary';
import { ApplyProgress } from '../ApplyProgress';
import { ApplyBar } from './ApplyBar';
import { ChangeGroup, type ReviewType } from './ChangeGroup';
import { ChangesSkeleton } from './ChangesSkeleton';
import { PlanError } from './PlanError';
import { TechnicalDetails } from './TechnicalDetails';

const messages = defineMessages({
    crumb: { id: 'schemaBuilder.page.title', defaultMessage: 'Content Model' },
    crumbReview: {
        id: 'schemaBuilder.review.title',
        defaultMessage: 'Review changes'
    },
    title: {
        id: 'schemaBuilder.review.titleCount',
        defaultMessage:
            'Review {count, plural, one {# change} other {# changes}}'
    },
    subtitle: {
        id: 'schemaBuilder.review.subtitleOnePage',
        defaultMessage:
            'Nothing is applied until you press Apply. The server writes the files, runs one migration and restarts.'
    },
    back: {
        id: 'schemaBuilder.review.backToEditing',
        defaultMessage: 'Back to editing'
    }
});

type Props = {
    flow: ApplyFlow;
    /** The editor's URL — where "back" goes, with the draft intact. */
    editorHref: string;
    /** A type's label and kind, from the draft or the served model. */
    typeOf: (name: string) => ReviewType | undefined;
    /** Leaves the review after a successful apply. */
    onFinish: () => void;
    /** Leaves for a type the apply created. */
    onOpenType: (name: string) => void;
};

/** The changes in the order the diff gives them, one group per type. */
function byType(changes: readonly ClassifiedChange[]) {
    const groups = new Map<string, ClassifiedChange[]>();
    for (const item of changes) {
        const list = groups.get(item.change.type) ?? [];
        list.push(item);
        groups.set(item.change.type, list);
    }
    return [...groups];
}

/**
 * The review on one page: every change grouped by type with its risk, each
 * destructive one confirmed on its own; the files and SQL folded under
 * "Technical details"; and a bar at the foot holding the migration's name
 * and Apply, saying what still blocks it. Once Apply is pressed the page
 * follows the apply step by step, then shows its outcome. It is a state of
 * the content model page (`?review`), not a route of its own, so the draft
 * it reviews is the editor's — the browser's Back returns to it unchanged.
 */
export function ChangesReview({
    flow,
    editorHref,
    typeOf,
    onFinish,
    onOpenType
}: Props) {
    const intl = useIntl();
    const plan = flow.plan.data;
    const applying = flow.stage !== 'idle';

    return (
        <>
            <PageTopBar
                icon={Blocks}
                crumbs={[
                    {
                        key: 'content-model',
                        label: intl.formatMessage(messages.crumb),
                        to: applying ? undefined : editorHref
                    },
                    {
                        key: 'review',
                        label: intl.formatMessage(messages.crumbReview)
                    }
                ]}
            />
            {!applying && (
                <PageActionsPortal>
                    {/* The draft travels with the page; going back keeps it. */}
                    <Button variant="outline" asChild>
                        <Link to={editorHref} data-keeps-unsaved-changes>
                            {intl.formatMessage(messages.back)}
                        </Link>
                    </Button>
                </PageActionsPortal>
            )}
            <Container className="max-w-[880px]">
                {flow.stage === 'done' ? (
                    <AppliedSummary
                        flow={flow}
                        typeOf={typeOf}
                        onFinish={onFinish}
                        onOpenType={onOpenType}
                    />
                ) : flow.stage !== 'idle' ? (
                    <ApplyProgress
                        flow={flow}
                        stage={flow.stage}
                        onDismiss={flow.dismiss}
                    />
                ) : (
                    <>
                        <ContainerHeader
                            title={intl.formatMessage(messages.title, {
                                count: plan?.changes.length ?? 0
                            })}
                            subtitle={intl.formatMessage(messages.subtitle)}
                        />
                        <div className="flex flex-col gap-4">
                            {flow.plan.isError ? (
                                <PlanError
                                    error={flow.plan.error}
                                    onRetry={() => flow.plan.mutate()}
                                />
                            ) : !plan ? (
                                <ChangesSkeleton />
                            ) : (
                                <>
                                    {byType(plan.changes).map(
                                        ([name, changes]) => (
                                            <ChangeGroup
                                                key={name}
                                                name={name}
                                                type={typeOf(name)}
                                                changes={changes}
                                                confirmed={flow.confirmed}
                                                onToggle={flow.toggle}
                                            />
                                        )
                                    )}
                                    <TechnicalDetails plan={plan} />
                                    <ApplyBar flow={flow} />
                                </>
                            )}
                        </div>
                    </>
                )}
            </Container>
        </>
    );
}
