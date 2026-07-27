import {
    ArgumentsHost,
    Catch,
    PayloadTooLargeException
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

/** Multer's error code when a part exceeds the configured `fileSize` limit. */
const LIMIT_FILE_SIZE = 'LIMIT_FILE_SIZE';

/**
 * Maps multer's `LIMIT_FILE_SIZE` error — thrown by the upload interceptor once
 * a file crosses the byte cap — to a clean `413 Payload Too Large`, instead of
 * the generic `500` Nest would otherwise return for an unrecognized error. Any
 * other exception is delegated untouched to the default handler.
 *
 * The interceptor's `limits.fileSize` is what actually bounds memory (multer
 * stops buffering at the cap); this filter only makes the resulting status
 * honest.
 */
@Catch()
export class MulterUploadFilter extends BaseExceptionFilter {
    override catch(exception: unknown, host: ArgumentsHost): void {
        if (
            exception !== null &&
            typeof exception === 'object' &&
            (exception as { code?: string }).code === LIMIT_FILE_SIZE
        ) {
            super.catch(
                new PayloadTooLargeException(
                    'File exceeds the maximum upload size.'
                ),
                host
            );
            return;
        }
        super.catch(exception, host);
    }
}
