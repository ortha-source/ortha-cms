export {
    apiClient,
    setActiveWorkspaceId,
    setUnauthorizedHandler
} from './lib/apiClient';
export { queryClient } from './lib/queryClient';
export { STALE_TIME } from './lib/staleTime';
export { HTTP_STATUS } from './lib/httpStatus';
export { ApiError, toApiError } from './lib/apiError';
export { createSlot, wireSlotContributions } from './lib/slot';
export type { Slot, SlotContribution } from './lib/slot';
export { byOrder } from './lib/byOrder';
export { slugify } from './lib/slugify';
export { useDebouncedValue } from './lib/useDebouncedValue';
export { isComposingText } from './lib/isComposingText';
export {
    useTableUrlState,
    type TableUrlState,
    type TableUrlStateOptions
} from './lib/useTableUrlState';
export { asAvatarColor, avatarColorForId } from './lib/avatarColor';
export { initialsOf, initialsFromEmail } from './lib/initials';
export {
    UnsavedChangesProvider,
    useUnsavedChanges,
    useUnsavedChangesApi,
    type UnsavedChangesCopy,
    type UnsavedChangesDialog
} from './lib/unsavedChanges';
export {
    useDocumentTitle,
    setDocumentTitle,
    setTitleDecorator
} from './lib/documentTitle';
