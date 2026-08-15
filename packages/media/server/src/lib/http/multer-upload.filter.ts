import {
    ArgumentsHost,
    Catch,
    PayloadTooLargeException
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

/** Multer's error code when a part exceeds the configured `fileSize` limit. */
const LIMIT_FILE_SIZE = 'LIMIT_FILE_SIZE';

/** The message `@nestjs/platform-express` puts on the 413 it already raises. */
const MULTER_FILE_TOO_LARGE = 'File too large';

/**
 * Replaces the over-size upload error with a message that says what the limit
 * is about, rather than multer's bare `File too large`.
 *
 * It has to match on **two** shapes. `FileInterceptor` runs multer's error
 * through `transformException` first, which already turns `LIMIT_FILE_SIZE`
 * into a `PayloadTooLargeException('File too large')` — so a filter that only
 * looked for `error.code === 'LIMIT_FILE_SIZE'` (as this one used to) never
 * fired at all, and its friendlier message was unreachable. The raw-code branch
 * stays as a belt for any path that throws before that transform.
 *
 * The interceptor's `limits.fileSize` is what actually bounds memory (multer
 * stops buffering at the cap); this filter only makes the response readable.
 */
@Catch()
export class MulterUploadFilter extends BaseExceptionFilter {
    override catch(exception: unknown, host: ArgumentsHost): void {
        if (isFileTooLarge(exception)) {
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

/** True for either spelling of "the upload crossed the byte cap". */
function isFileTooLarge(exception: unknown): boolean {
    if (exception === null || typeof exception !== 'object') {
        return false;
    }
    if ((exception as { code?: string }).code === LIMIT_FILE_SIZE) {
        return true;
    }
    return (
        exception instanceof PayloadTooLargeException &&
        (exception as Error).message === MULTER_FILE_TOO_LARGE
    );
}
