import { CONTENT_OVERLAY_SLOT } from '../../slots/contentSlots';

/**
 * Renders every {@link CONTENT_OVERLAY_SLOT} contribution, mounted once by
 * `ContentLibraryPage` **outside** its `<Routes>` so it survives navigation
 * within the library — including the window where the entry editor has replaced
 * itself with a loading state.
 *
 * Slot items are boot-frozen, so this list never changes between renders.
 */
export function ContentOverlays() {
    const items = CONTENT_OVERLAY_SLOT.getItems();
    if (!items.length) return null;
    return (
        <>
            {items.map(({ id, Component }) => (
                <Component key={id} />
            ))}
        </>
    );
}
