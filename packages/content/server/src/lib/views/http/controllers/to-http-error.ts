import {
    ConflictException,
    ForbiddenException,
    NotFoundException
} from '@nestjs/common';
import {
    SavedViewForbiddenError,
    SavedViewLimitError,
    SavedViewNameTakenError,
    SavedViewNotFoundError
} from '../../domain/errors';

/**
 * Maps the saved-view domain errors onto HTTP. Domain errors stay
 * transport-agnostic (ADR-0003), so every controller funnels through this one
 * translation rather than each restating the status codes.
 *
 * Anything unrecognised is rethrown untouched — swallowing it here would turn a
 * genuine fault into a misleading 4xx.
 */
export function toHttpError(error: unknown): never {
    if (error instanceof SavedViewNotFoundError) {
        throw new NotFoundException(error.message);
    }
    if (error instanceof SavedViewForbiddenError) {
        throw new ForbiddenException(error.message);
    }
    if (
        error instanceof SavedViewNameTakenError ||
        error instanceof SavedViewLimitError
    ) {
        throw new ConflictException(error.message);
    }
    throw error;
}
