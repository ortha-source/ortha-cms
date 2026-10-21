import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    CONTENT_DETAIL_SEED,
    SECTIONED_DETAIL_SEED,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites
} from '../support/api/content';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The resolved `box-shadow` of one element — the design system draws a field's
 * focus mark as a ring, and a ring is a shadow.
 */
function boxShadowOf(node: unknown): string {
    return (
        globalThis as unknown as {
            getComputedStyle: (el: unknown) => { boxShadow: string };
        }
    ).getComputedStyle(node).boxShadow;
}

/** Whether focus is on this element or inside it. */
function holdsFocus(node: unknown): boolean {
    const { document } = globalThis as unknown as {
        document: { activeElement: unknown };
    };
    return (node as { contains: (other: unknown) => boolean }).contains(
        document.activeElement
    );
}

/**
 * The General tab's **outline** — bars at the editor's left edge that open
 * into a list of fields and jump to one.
 *
 * Run against the sectioned fixture on purpose: the jump that is easy to get
 * half right is the one into a **folded** section, which has to unfold before
 * there is a field to scroll to, let alone focus.
 */
test.describe('Entry field outline', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page, { details: SECTIONED_DETAIL_SEED });
        await mockContentEntries(page, { details: SECTIONED_DETAIL_SEED });
        await mockContentEntryWrites(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
    });

    test('jumps into a folded section and puts the cursor in the field', async ({
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        const pricing = contentLibraryPage.formSectionToggle('Pricing');
        await expect(pricing).toHaveAttribute('aria-expanded', 'false');

        await contentLibraryPage.fieldOutline().hover();
        await contentLibraryPage.fieldOutlineItem('Price').click();

        await expect(pricing).toHaveAttribute('aria-expanded', 'true');
        await expect(contentLibraryPage.fieldSpinbutton('Price')).toBeFocused();
    });

    /**
     * The list is transparent until hovered or focused, not hidden — hidden
     * would take it out of the tab order, and a keyboard could never open it.
     */
    test('works from the keyboard', async ({ page, contentLibraryPage }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );

        const title = contentLibraryPage.fieldOutlineItem('Title');
        await title.focus();
        await expect(title).toBeVisible();
        await page.keyboard.press('Enter');

        await expect(contentLibraryPage.fieldTextbox('Title')).toBeFocused();
    });

    /**
     * A jump picked with the **mouse** has to light the field up like any other
     * focus. The control is focused from a script after a click, and on a
     * `<button>` that never matches `:focus-visible` — so the boolean, the
     * body's preview card and the date picker, whose marks hung off it, took
     * the cursor and showed nothing, while every text box beside them lit up.
     */
    test('a mouse jump marks a button-backed field as focused', async ({
        page,
        contentLibraryPage
    }) => {
        await mockContentSchemaDetail(page, { details: CONTENT_DETAIL_SEED });
        await mockContentEntries(page, { details: CONTENT_DETAIL_SEED });
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );

        const fields = [
            {
                label: 'Excerpt',
                control: page.locator('#entry-field-excerpt'),
                // The overlay button covers the card; the card draws the ring.
                frame: page.locator('#entry-field-excerpt').locator('..')
            },
            {
                label: 'Published',
                control: page.getByRole('radiogroup', { name: 'Published' }),
                frame: page.getByRole('radiogroup', { name: 'Published' })
            },
            {
                label: 'Published at',
                control: contentLibraryPage.dateFieldTrigger('publishedAt'),
                frame: contentLibraryPage.dateFieldTrigger('publishedAt')
            }
        ];

        for (const { label, control, frame } of fields) {
            await expect(frame).toBeVisible();
            const unfocused = await frame.evaluate(boxShadowOf);

            await contentLibraryPage.fieldOutline().hover();
            await contentLibraryPage.fieldOutlineItem(label).click();

            // The cursor is in the field — the boolean's group hands it on
            // to its checked segment, hence "within", not "is".
            await expect
                .poll(() => control.evaluate(holdsFocus), { message: label })
                .toBe(true);
            await expect
                .poll(() => frame.evaluate(boxShadowOf), { message: label })
                .not.toBe(unfocused);
        }
    });

    test('has no axe violations while open', async ({
        contentLibraryPage,
        makeAxe
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        await contentLibraryPage.fieldOutline().hover();

        await expectNoA11yViolations(makeAxe());
    });
});
