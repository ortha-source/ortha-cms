import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Card, CardContent } from '@ortha-cms/design-system';

/** Props for {@link WidgetBoundary}. */
export type WidgetBoundaryProps = {
    /** The widget's name, so a failed card still says which one broke. */
    title: string;
    /** The widget being isolated. */
    children: ReactNode;
};

type WidgetBoundaryState = { failed: boolean };

/**
 * Isolates one contributed widget so a throw inside it cannot unmount the whole
 * Insights page.
 *
 * This matters more here than on a normal page: the widgets come from *other
 * packages*, and the Insights plugin has no way to review what they render. One
 * mapper hitting an unexpected null in `media-admin` must not take down the
 * content and team sections with it.
 *
 * Deliberately a class component — React still offers no hook equivalent of
 * `componentDidCatch`, and a render-phase throw is exactly what needs catching.
 */
export class WidgetBoundary extends Component<
    WidgetBoundaryProps,
    WidgetBoundaryState
> {
    override state: WidgetBoundaryState = { failed: false };

    static getDerivedStateFromError(): WidgetBoundaryState {
        return { failed: true };
    }

    override componentDidCatch(error: Error, info: ErrorInfo): void {
        // Named so the console says which contributed widget threw; without the
        // title a stack from a lazily-loaded chunk is close to unattributable.
        console.error(
            `[insights] widget "${this.props.title}" failed to render`,
            error,
            info.componentStack
        );
    }

    override render(): ReactNode {
        if (!this.state.failed) return this.props.children;

        return (
            <Card className="h-full shadow-none">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                    <h4 className="text-sm font-semibold tracking-[-0.005em]">
                        {this.props.title}
                    </h4>
                    <p
                        role="alert"
                        className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-4 text-sm text-destructive"
                    >
                        This widget stopped working. The rest of the page is
                        unaffected.
                    </p>
                </CardContent>
            </Card>
        );
    }
}
