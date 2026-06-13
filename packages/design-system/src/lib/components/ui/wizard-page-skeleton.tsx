import { Container } from './container';
import { Skeleton } from './skeleton';

/**
 * Props for the {@link WizardPageSkeleton} component.
 */
type WizardPageSkeletonProps = {
    /**
     * The announced loading text. Defaults to `'Loading…'`; localized callers
     * should pass a translated string (the design system stays intl-agnostic).
     */
    label?: string;
    /** Number of placeholder rows in the stepper rail. Defaults to 3. */
    steps?: number;
    /** Number of placeholder fields in the step card. Defaults to 4. */
    fields?: number;
};

/**
 * Full-page placeholder for the shared "create" wizard shell — back link,
 * header, a sticky stepper rail, and the step card — used as the lazy-route
 * `Suspense` fallback for the workspace- and member-creation wizards (both
 * render the same `Container max-w-[920px]` + `lg:grid-cols-[244px_1fr]`
 * layout). Holds the layout steady while the chunk loads. The whole block is a
 * single `role="status"` region; its contents are `aria-hidden`.
 */
export function WizardPageSkeleton({
    label = 'Loading…',
    steps = 3,
    fields = 4
}: WizardPageSkeletonProps) {
    return (
        <Container className="max-w-[920px]" role="status" aria-busy="true">
            <span className="sr-only">{label}</span>

            <div aria-hidden>
                <Skeleton className="mb-4 h-4 w-28" />

                <div className="mb-6 flex flex-col gap-2">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                </div>

                <div className="grid gap-8 lg:grid-cols-[244px_1fr]">
                    <div className="flex flex-col gap-4">
                        {Array.from({ length: steps }).map((_, index) => (
                            <div key={index} className="flex items-start gap-3">
                                <Skeleton className="size-8 shrink-0 rounded-full" />
                                <div className="flex flex-1 flex-col gap-1.5 pt-1">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-6 rounded-xl border bg-card p-6">
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-4 w-64 max-w-full" />
                        </div>
                        {Array.from({ length: fields }).map((_, index) => (
                            <div key={index} className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        ))}
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <Skeleton className="h-9 w-24" />
                            <Skeleton className="h-9 w-28" />
                        </div>
                    </div>
                </div>
            </div>
        </Container>
    );
}
