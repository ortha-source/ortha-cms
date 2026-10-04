import { defineMessages, useIntl } from 'react-intl';
import {
    Label,
    RadioGroup,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@orthacms/design-system';
import {
    isInverseRelation,
    type RelationFieldDoc,
    type SchemaDocument,
    type TypeDoc
} from '@orthacms/schema-builder-domain';
import {
    cardinalityOf,
    toRelationFlags,
    type Cardinality
} from '../../../../../domain/relationCardinality';
import { SwitchField } from '../../SwitchField';
import { CardinalityOption } from './CardinalityOption';

const messages = defineMessages({
    target: { id: 'schemaBuilder.relation.target', defaultMessage: 'Links to' },
    cardinality: {
        id: 'schemaBuilder.relation.cardinality',
        defaultMessage: 'How many'
    },
    manyToOne: {
        id: 'schemaBuilder.relation.manyToOne',
        defaultMessage: 'One {target}'
    },
    manyToOneHint: {
        id: 'schemaBuilder.relation.manyToOneHint',
        defaultMessage: 'Each entry links one; many entries may share it.'
    },
    oneToOne: {
        id: 'schemaBuilder.relation.oneToOne',
        defaultMessage: 'One {target}, its own'
    },
    oneToOneHint: {
        id: 'schemaBuilder.relation.oneToOneHint',
        defaultMessage: 'No two entries may link the same one.'
    },
    manyToMany: {
        id: 'schemaBuilder.relation.manyToMany',
        defaultMessage: 'Any number of {target}'
    },
    manyToManyHint: {
        id: 'schemaBuilder.relation.manyToManyHint',
        defaultMessage: 'Stored in a join table.'
    },
    onDelete: {
        id: 'schemaBuilder.relation.onDelete',
        defaultMessage: 'When the linked entry is deleted'
    },
    default: {
        id: 'schemaBuilder.relation.default',
        defaultMessage: 'Default — clear it, or delete this entry when required'
    },
    cascade: {
        id: 'schemaBuilder.relation.cascade',
        defaultMessage: 'Delete this entry too'
    },
    setNull: {
        id: 'schemaBuilder.relation.setNull',
        defaultMessage: 'Clear the link'
    },
    restrict: {
        id: 'schemaBuilder.relation.restrict',
        defaultMessage: 'Refuse the delete'
    },
    sync: {
        id: 'schemaBuilder.relation.sync',
        defaultMessage: 'Same links in every locale'
    },
    inverse: {
        id: 'schemaBuilder.relation.inverse',
        defaultMessage:
            'Mirrors {to}.{field}: it stores nothing itself and is changed from that side.'
    }
});

const ON_DELETE = [
    ['cascade', messages.cascade],
    ['set null', messages.setNull],
    ['restrict', messages.restrict]
] as const;

type Props = {
    spec: RelationFieldDoc;
    type: TypeDoc;
    document: SchemaDocument;
    onChange: (patch: Record<string, unknown>) => void;
};

/** Target, cardinality, what a delete does, locale sync — the options `field.relation()` takes. */
export function RelationSettings({ spec, type, document, onChange }: Props) {
    const intl = useIntl();
    if (isInverseRelation(spec)) {
        return (
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.inverse, {
                    to: spec.to,
                    field: spec.inverseOf
                })}
            </p>
        );
    }
    const target = document.types.find(
        (candidate) => candidate.name === spec.to
    );
    const targetLabel = target?.label || spec.to;
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <Label htmlFor="relation-target">
                    {intl.formatMessage(messages.target)}
                </Label>
                <Select
                    value={spec.to}
                    onValueChange={(to) => onChange({ to })}
                >
                    <SelectTrigger id="relation-target">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {document.types.map((candidate) => (
                            <SelectItem
                                key={candidate.name}
                                value={candidate.name}
                            >
                                {candidate.label || candidate.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">
                    {intl.formatMessage(messages.cardinality)}
                </legend>
                <RadioGroup
                    value={cardinalityOf(spec)}
                    onValueChange={(value) =>
                        onChange(toRelationFlags(value as Cardinality))
                    }
                >
                    {(['manyToOne', 'oneToOne', 'manyToMany'] as const).map(
                        (value) => (
                            <CardinalityOption
                                key={value}
                                value={value}
                                label={intl.formatMessage(messages[value], {
                                    target: targetLabel
                                })}
                                description={intl.formatMessage(
                                    messages[`${value}Hint`]
                                )}
                            />
                        )
                    )}
                </RadioGroup>
            </fieldset>
            <div className="flex flex-col gap-2">
                <Label htmlFor="relation-on-delete">
                    {intl.formatMessage(messages.onDelete)}
                </Label>
                <Select
                    value={spec.onDelete ?? 'default'}
                    onValueChange={(value) =>
                        onChange({
                            onDelete: value === 'default' ? undefined : value
                        })
                    }
                >
                    <SelectTrigger id="relation-on-delete">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="default">
                            {intl.formatMessage(messages.default)}
                        </SelectItem>
                        {ON_DELETE.map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {intl.formatMessage(label)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {type.i18n && (
                <SwitchField
                    id="relation-sync"
                    label={intl.formatMessage(messages.sync)}
                    checked={spec.syncAcrossLocales ?? !spec.localized}
                    onChange={(syncAcrossLocales) =>
                        onChange({ syncAcrossLocales })
                    }
                />
            )}
        </div>
    );
}
