/** Default page size for `GET /api/alarms/findings`. */
export const DEFAULT_PAGE_SIZE = 25;

/** Upper bound on the requested page size. */
export const MAX_PAGE_SIZE = 100;

/** Max length of a rule name / finding title. */
export const NAME_MAX_LENGTH = 120;

/** Max length of a rule description and of a mute reason. */
export const TEXT_MAX_LENGTH = 500;

/**
 * How many entry ids the batch findings endpoint accepts in one request.
 *
 * Sized for a records page: the largest page the admin offers is 100 rows, and
 * asking for more than one page's worth means the caller is doing something the
 * endpoint was not built for.
 */
export const MAX_BATCH_ENTRY_IDS = 100;

/** How many matching ids the rule preview returns as a sample. */
export const PREVIEW_SAMPLE_SIZE = 5;
