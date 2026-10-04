import { forwardRef, type KeyboardEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowRight } from 'lucide-react';
import {
    Button,
    CardContent,
    CardFooter,
    WizardFooter
} from '@orthacms/design-system';
import { FIELD_CATALOG } from '../../../../domain/fieldCatalog';
import { StepHeading } from '../../StepHeading';
import { FieldKindTile } from './FieldKindTile';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.addField.typeTitle',
        defaultMessage: 'Kind of field'
    },
    description: {
        id: 'schemaBuilder.addField.typeDescription',
        defaultMessage:
            'What the field holds. It decides how it is stored and edited.'
    },
    group: { id: 'schemaBuilder.addField.type', defaultMessage: 'Type' },
    next: { id: 'schemaBuilder.addField.toBasics', defaultMessage: 'Continue' }
});

type Props = {
    choice: string;
    onChoose: (id: string) => void;
    onNext: () => void;
};

/** Step 1: one radio per kind of field, arrow keys move the choice. */
export const TypeStep = forwardRef<HTMLHeadingElement, Props>(function TypeStep(
    { choice, onChoose, onNext },
    ref
) {
    const intl = useIntl();
    const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = {
            ArrowRight: 1,
            ArrowDown: 1,
            ArrowLeft: -1,
            ArrowUp: -1
        }[event.key];
        if (!step) return;
        event.preventDefault();
        const index = FIELD_CATALOG.findIndex((entry) => entry.id === choice);
        const next =
            FIELD_CATALOG[
                (index + step + FIELD_CATALOG.length) % FIELD_CATALOG.length
            ].id;
        onChoose(next);
        (
            event.currentTarget.querySelector(
                `[data-kind="${next}"]`
            ) as HTMLElement | null
        )?.focus();
    };
    return (
        <>
            <StepHeading
                ref={ref}
                title={intl.formatMessage(messages.title)}
                description={intl.formatMessage(messages.description)}
            />
            <CardContent>
                <div
                    role="radiogroup"
                    aria-label={intl.formatMessage(messages.group)}
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                    onKeyDown={onKey}
                >
                    {FIELD_CATALOG.map((entry) => (
                        <FieldKindTile
                            key={entry.id}
                            entry={entry}
                            selected={entry.id === choice}
                            onSelect={() => onChoose(entry.id)}
                        />
                    ))}
                </div>
            </CardContent>
            <CardFooter>
                <WizardFooter
                    primary={
                        <Button type="button" onClick={onNext}>
                            {intl.formatMessage(messages.next)}
                            <ArrowRight />
                        </Button>
                    }
                />
            </CardFooter>
        </>
    );
});
