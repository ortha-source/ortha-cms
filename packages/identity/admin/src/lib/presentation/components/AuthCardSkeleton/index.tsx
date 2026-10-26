import { Skeleton } from '@orthacms/design-system';

/** Props for {@link AuthCardSkeleton}. */
type AuthCardSkeletonProps = {
    /** The screen's name, as its visually-hidden `<h1>`. */
    heading: string;
    /** What is being waited on, announced through the `role="status"` region. */
    status: string;
    /** How many label-and-input rows to sketch. Defaults to two. */
    fields?: number;
};

/**
 * The busy state of a public auth screen: the {@link AuthCard} silhouette —
 * heading, its line of context, the fields, the button — while a chunk or a
 * link lookup is in flight.
 *
 * It carries a visually-hidden `<h1>` (`ORT-167`: a loading state is the one a
 * slow connection sits in longest, so it is the one most likely to be
 * navigated by heading) and announces itself through one `role="status"`
 * region; the drawing is `aria-hidden`. Render it inside an `AuthLayout` with
 * `focusHeading={false}` — focus should not land on a heading that is about to
 * be replaced.
 */
export function AuthCardSkeleton({
    heading,
    status,
    fields = 2
}: AuthCardSkeletonProps) {
    return (
        <>
            <h1 className="sr-only">{heading}</h1>
            <div role="status">
                <span className="sr-only">{status}</span>
                <div
                    aria-hidden
                    className="flex flex-col gap-4 rounded-2xl border bg-card p-7 shadow-[0_12px_32px_rgba(16,16,24,0.06)]"
                >
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-56 max-w-full" />
                    </div>
                    {Array.from({ length: fields }, (_, index) => (
                        <div key={index} className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-9 w-full" />
                        </div>
                    ))}
                    <Skeleton className="h-9 w-full" />
                </div>
            </div>
        </>
    );
}
