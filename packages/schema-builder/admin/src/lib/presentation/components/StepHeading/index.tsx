import { forwardRef } from 'react';
import {
    CardDescription,
    CardHeader,
    CardTitle
} from '@orthacms/design-system';

type Props = { title: string; description: string };

/**
 * A step card's header: a real `<h2>` under the page's `<h1>`, and the focus
 * target on a step change — the card remounts to replay its entrance, which
 * would otherwise drop focus to `<body>`.
 */
export const StepHeading = forwardRef<HTMLHeadingElement, Props>(
    function StepHeading({ title, description }, ref) {
        return (
            <CardHeader>
                <CardTitle asChild>
                    <h2
                        ref={ref}
                        tabIndex={-1}
                        className="focus-visible:outline-none"
                    >
                        {title}
                    </h2>
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
        );
    }
);
