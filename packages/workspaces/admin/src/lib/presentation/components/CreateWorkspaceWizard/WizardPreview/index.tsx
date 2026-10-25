import { defineMessages, useIntl } from 'react-intl';
import { ArrowUpRight, Mail } from 'lucide-react';
import type { AvatarColor } from '@orthacms/design-system';
import type { WorkspaceMember } from '../../../../domain/types/workspace';
import { MemberFaces } from '../../MemberFaces';
import { CardPreview } from './CardPreview';
import { SummaryPreview } from './SummaryPreview';

const messages = defineMessages({
    kicker: { id: 'workspaces.preview.kicker', defaultMessage: 'Preview' },
    contentSummary: {
        id: 'workspaces.preview.contentSummary',
        defaultMessage:
            '{own, plural, one {# content type} other {# content types}}{shared, plural, =0 {} other { · # shared}}'
    },
    peopleSummary: {
        id: 'workspaces.preview.peopleSummary',
        defaultMessage:
            '{own, plural, one {# content type} other {# content types}} · {people, plural, one {# person} other {# people}}'
    }
});

/** One content type the preview lists as a tag. */
export type PreviewTag = {
    /** Display label. */
    label: string;
    /** Granted from a shared workspace (drawn with ↗). */
    shared: boolean;
};

/** Props for {@link WizardPreview}. */
export type WizardPreviewProps = {
    /** The active step: 1 draws the card, 2 the content, 3 the people. */
    step: number;
    name: string;
    color: AvatarColor;
    description: string;
    /** Own content types chosen so far. */
    ownCount: number;
    /** Shared grants chosen so far. */
    sharedCount: number;
    /** The chosen types, own then shared. */
    tags: readonly PreviewTag[];
    /** Everyone with an account — the creator first. */
    people: readonly Pick<
        WorkspaceMember,
        'id' | 'name' | 'initials' | 'color'
    >[];
    /** Addresses that get an invitation. */
    invites: readonly string[];
};

/**
 * The live preview beside the wizard: on Basics the card the workspace will
 * become in the list; on Content what it can hold; on People who is in it.
 * It repeats what the form already says, so it is hidden from assistive
 * technology rather than read twice.
 */
export function WizardPreview({
    step,
    name,
    color,
    description,
    ownCount,
    sharedCount,
    tags,
    people,
    invites
}: WizardPreviewProps) {
    const intl = useIntl();

    return (
        <div
            aria-hidden
            data-testid="workspace-preview"
            className="flex flex-col gap-2"
        >
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {intl.formatMessage(messages.kicker)}
            </span>
            {step === 1 ? (
                <CardPreview
                    name={name}
                    color={color}
                    description={description}
                    creator={people[0]}
                />
            ) : step === 2 ? (
                <SummaryPreview
                    name={name}
                    color={color}
                    summary={intl.formatMessage(messages.contentSummary, {
                        own: ownCount,
                        shared: sharedCount
                    })}
                >
                    {tags.length > 0 ? (
                        <span className="flex flex-wrap gap-1.5">
                            {tags.map((tag) => (
                                <span
                                    key={`${tag.label}:${tag.shared}`}
                                    className="inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-xs"
                                >
                                    {tag.label}
                                    {tag.shared ? (
                                        <ArrowUpRight className="size-3" />
                                    ) : null}
                                </span>
                            ))}
                        </span>
                    ) : null}
                </SummaryPreview>
            ) : (
                <SummaryPreview
                    name={name}
                    color={color}
                    summary={intl.formatMessage(messages.peopleSummary, {
                        own: ownCount,
                        people: people.length + invites.length
                    })}
                >
                    <span className="flex flex-wrap items-center gap-1.5">
                        <MemberFaces members={people} />
                        {invites.map((email) => (
                            <span
                                key={email}
                                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs"
                            >
                                <Mail className="size-3" />
                                {email}
                            </span>
                        ))}
                    </span>
                </SummaryPreview>
            )}
        </div>
    );
}
