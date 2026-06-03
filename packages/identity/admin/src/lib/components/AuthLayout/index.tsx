import type { ReactNode } from 'react';
import { Logo } from '@ortha-cms/design-system';

/**
 * Props for the {@link AuthLayout} component.
 */
type AuthLayoutProps = {
    /** Content rendered inside the centered column (Card, footer, etc.). */
    children: ReactNode;
};

/**
 * Reusable centered page wrapper for authentication screens.
 * Provides the muted background, vertical/horizontal centering,
 * logo, and a max-width column. Each page owns its own Card and footer.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <a
                    href="#"
                    className="flex items-center gap-2 self-center font-medium"
                >
                    <Logo />
                </a>
                {children}
            </div>
        </div>
    );
}
