/**
 * One CSV export of the activity log, as `GET /api/activity/export` answers it:
 * the file, the name the server gave it, and whether it is the whole answer.
 */
export type ActivityExport = {
    /** The CSV bytes. */
    blob: Blob;
    /** The download's name, from the server's `Content-Disposition`. */
    fileName: string;
    /** How many events matched, ignoring the export's row cap. */
    total: number;
    /**
     * The file holds fewer rows than matched — the server caps an export, and
     * a truncated audit export must never pass for a complete one.
     */
    truncated: boolean;
};
