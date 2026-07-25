/**
 * One attached asset as a media **field** renders it — the merge of what the
 * server resolved (`MediaRef`) and what the editor learned locally by picking or
 * uploading (`MediaAsset`). A ref carries no size/dimensions, so those are
 * optional: the tile shows whichever facts it has.
 */
export type MediaFieldDisplay = {
    /** The asset id stored in the field value. */
    id: string;
    /** File name, or the raw id while nothing else is known yet. */
    name: string;
    /** Raw-stream route for the preview (empty when `missing`). */
    url: string;
    /** Coarse kind; empty string when the asset hasn't been resolved yet. */
    kind: string;
    mimeType: string;
    /** File size in bytes — known only for a picked/uploaded asset. */
    size?: number;
    /** Pixel dimensions — known only for a picked/uploaded visual asset. */
    dimensions?: { width: number; height: number };
    /** The id resolved to nothing: deleted, or in another workspace. */
    missing?: boolean;
    /**
     * A file staged on the field but **not uploaded yet** — it goes up with the
     * record on Save. `url` is a local object URL (images only) and `id` is the
     * placeholder standing in for the asset.
     */
    pending?: boolean;
};
