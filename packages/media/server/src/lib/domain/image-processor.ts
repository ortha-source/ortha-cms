/**
 * One generated derivative of a source image — a resized, re-encoded copy the
 * upload flow stores alongside the original under its own key.
 */
export interface ImageDerivative {
    /** Variant name (`thumb`, `preview`) — the key suffix and the wire label. */
    name: string;
    /** Encoded bytes (always WebP today). */
    body: Buffer;
    /** MIME type of {@link body}. */
    contentType: string;
    /** Intrinsic pixel width of the derivative. */
    width: number;
    /** Intrinsic pixel height of the derivative. */
    height: number;
}

/** The result of processing a source image: its dimensions plus derivatives. */
export interface ProcessedImage {
    /** Intrinsic width of the source image. */
    width: number;
    /** Intrinsic height of the source image. */
    height: number;
    /** The derivatives to store (may be empty if the source is tiny). */
    derivatives: ImageDerivative[];
}

/**
 * The image-processing boundary — probes a source image's dimensions and
 * generates the display derivatives (thumb/preview) the library serves instead
 * of the full original. A port so the domain/application layers never import a
 * concrete image library; the Sharp adapter binds it at the module.
 */
export interface ImageProcessor {
    /**
     * Processes a source image buffer. Returns `null` when the content type is
     * not a raster image this processor handles (e.g. SVG) or the bytes can't be
     * decoded — the caller then stores the original with no derivatives.
     */
    process(input: {
        body: Buffer;
        contentType: string;
    }): Promise<ProcessedImage | null>;
}

/** DI token the module binds to a concrete {@link ImageProcessor}. */
export const IMAGE_PROCESSOR = Symbol('IMAGE_PROCESSOR');
