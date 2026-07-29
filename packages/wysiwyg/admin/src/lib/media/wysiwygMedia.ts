/**
 * The editor's **media port** — how an image block reaches the host's asset
 * library, without this package knowing that a library exists.
 *
 * The editor's value is HTML, so an image block ultimately needs one thing: a
 * URL. Everything else about media — where assets live, who may upload, what
 * counts as an image, whether an abandoned edit should leave a file behind —
 * belongs to whoever mounted the editor. So the port is deliberately one
 * method: *ask the host for an image, get back somewhere to point at*.
 *
 * With no port the image block still works from a pasted URL, which is why it
 * is optional rather than a required dependency.
 */

/** An asset the host handed back — enough to fill in an image block. */
export interface WysiwygMediaAsset {
    /** Where the image is served from. Becomes the `<img src>`. */
    readonly url: string;
    /** The asset's stored alt text, when it has any. */
    readonly alt?: string;
    /** A human name, used as a last-resort caption/alt hint. */
    readonly name?: string;
}

/** The host's media library, when it has one. */
export interface WysiwygMediaPort {
    /**
     * Opens the host's picker and resolves with the chosen asset, or `null`
     * when the author dismissed it. Rejecting is fine too — the block treats a
     * failure and a dismissal the same way, by leaving what was there alone.
     */
    pick(): Promise<WysiwygMediaAsset | null>;
}
