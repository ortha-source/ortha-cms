import { defineMessages } from 'react-intl';
import { FIELD_TYPE, type FilterField } from '@orthacms/query-builder-admin';

/**
 * Field labels for the activity query builder, co-located per the admin i18n
 * convention. Display only — the `id`s below are what travel on the wire.
 */
const messages = defineMessages({
    kind: { id: 'activity.filter.kind', defaultMessage: 'Kind' },
    actorEmail: {
        id: 'activity.filter.actorEmail',
        defaultMessage: 'Actor email'
    },
    actorId: { id: 'activity.filter.actorId', defaultMessage: 'Actor ID' },
    subjectType: {
        id: 'activity.filter.subjectType',
        defaultMessage: 'Subject type'
    },
    subjectId: {
        id: 'activity.filter.subjectId',
        defaultMessage: 'Subject ID'
    },
    at: { id: 'activity.filter.at', defaultMessage: 'Time' }
});

/**
 * The activity-log filter surface the query builder offers. A static mirror of
 * the server's `ACTIVITY_FILTER_SCHEMA` — each `id` matches a whitelisted field
 * the BE accepts, so a rule built here always validates server-side.
 */
export const ACTIVITY_FILTER_FIELDS: readonly FilterField[] = [
    { id: 'kind', label: messages.kind, type: FIELD_TYPE.String },
    { id: 'actorEmail', label: messages.actorEmail, type: FIELD_TYPE.String },
    { id: 'actorId', label: messages.actorId, type: FIELD_TYPE.Uuid },
    {
        id: 'subjectType',
        label: messages.subjectType,
        type: FIELD_TYPE.String
    },
    { id: 'subjectId', label: messages.subjectId, type: FIELD_TYPE.String },
    { id: 'at', label: messages.at, type: FIELD_TYPE.Date }
];
