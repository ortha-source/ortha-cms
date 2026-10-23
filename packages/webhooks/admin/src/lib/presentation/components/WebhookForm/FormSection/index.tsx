import type { ReactNode } from 'react';

type FormSectionProps = {
    /** The section's anchor — what "On this page" links to. */
    id: string;
    title: string;
    description: string;
    children: ReactNode;
};

/**
 * One framed block of the webhook editor: a heading and a sentence over the
 * fields, so where one question ends and the next begins is drawn.
 */
export function FormSection({
    id,
    title,
    description,
    children
}: FormSectionProps) {
    return (
        <section
            id={id}
            aria-labelledby={`${id}-title`}
            className="scroll-mt-6 rounded-xl border bg-card"
        >
            <header className="flex flex-col gap-0.5 border-b px-5 py-3.5">
                <h2
                    id={`${id}-title`}
                    className="text-[15px] font-semibold leading-5 focus:outline-none"
                >
                    {title}
                </h2>
                <p className="text-[13px] text-muted-foreground">
                    {description}
                </p>
            </header>
            <div className="flex flex-col gap-5 p-5">{children}</div>
        </section>
    );
}
