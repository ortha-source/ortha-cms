/**
 * The activity filter for one member's own log: events **about** them
 * (`subjectType=user`, `subjectId=:id` — they were added to a workspace, their
 * role changed) **or by** them (`actorId=:id` — they published an entry,
 * signed in), in the wire grammar the activity endpoint parses. Shared by the
 * Activity tab and the Overview's "Recent activity" card, so the two can never
 * disagree about what counts as this person's activity.
 */
export function memberActivityFilter(memberId: string): string {
    return JSON.stringify({
        or: [
            {
                and: [
                    { field: 'subjectType', op: 'eq', value: 'user' },
                    { field: 'subjectId', op: 'eq', value: memberId }
                ]
            },
            { field: 'actorId', op: 'eq', value: memberId }
        ]
    });
}
