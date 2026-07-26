import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import type {
    ImageDerivative,
    ImageProcessor,
    ProcessedImage
} from '../../domain/image-processor';

/** The derivative sizes the library generates — the longest edge, in pixels. */
const VARIANTS = [
    { name: 'thumb', maxEdge: 320 },
    { name: 'preview', maxEdge: 1280 }
] as const;

/** Raster MIME types Sharp can safely decode and re-encode. */
const RASTER_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/tiff'
]);

/** WebP quality for generated derivatives — a good size/quality trade-off. */
const WEBP_QUALITY = 80;

/**
 * Sharp-backed {@link ImageProcessor}. Decodes the source once to read its
 * dimensions, then emits a WebP `thumb` + `preview` (never upscaled, so a small
 * source yields small — or no — derivatives). Vector (SVG) and non-image types
 * are skipped: they return `null` so the original is served as-is. Decoding is
 * bounded by Sharp's input-pixel limit, and any decode failure degrades to
 * `null` rather than failing the upload.
 */
@Injectable()
export class SharpImageProcessor implements ImageProcessor {
    private readonly logger = new Logger(SharpImageProcessor.name);

    async process(input: {
        body: Buffer;
        contentType: string;
    }): Promise<ProcessedImage | null> {
        if (!RASTER_MIME_TYPES.has(input.contentType)) {
            return null;
        }
        try {
            // `limitInputPixels` (Sharp's default ~268 MP) guards against
            // decompression bombs; `animated: false` takes the first frame of a
            // GIF for a still thumbnail.
            const metadata = await sharp(input.body).metadata();
            const width = metadata.width ?? 0;
            const height = metadata.height ?? 0;
            if (width === 0 || height === 0) {
                return null;
            }

            const derivatives: ImageDerivative[] = [];
            for (const variant of VARIANTS) {
                // Never upscale: skip a variant whose target is >= the source's
                // longest edge (the smaller variant already covers that size).
                if (
                    variant.name === 'preview' &&
                    Math.max(width, height) <= VARIANTS[0].maxEdge
                ) {
                    continue;
                }
                const output = await sharp(input.body)
                    .rotate() // honour EXIF orientation before stripping metadata
                    .resize({
                        width: variant.maxEdge,
                        height: variant.maxEdge,
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .webp({ quality: WEBP_QUALITY })
                    .toBuffer({ resolveWithObject: true });
                derivatives.push({
                    name: variant.name,
                    body: output.data,
                    contentType: 'image/webp',
                    width: output.info.width,
                    height: output.info.height
                });
            }

            return { width, height, derivatives };
        } catch (error) {
            // A corrupt or unsupported image must not fail the upload — the
            // original is already safe to store; it just gets no derivatives.
            this.logger.warn(
                `image processing failed (${input.contentType}): ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return null;
        }
    }
}
