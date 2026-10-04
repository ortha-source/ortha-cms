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
    CARDINALITIES,
    CARDINALITY_NOTATION,
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
        defaultMessage: 'Many-to-one'
    },
    manyToOneHint: {
        id: 'schemaBuilder.relation.manyToOneHint',
        defaultMessage:
            'Each entry in {source} links to one entry in {target}; one entry in {target} can be linked from many in {source}.'
    },
    manyToOneExample: {
        id: 'schemaBuilder.relation.manyToOneExample',
        defaultMessage:
            'Like many posts by one author. Stored as a column on {source}.'
    },
    oneToOne: {
        id: 'schemaBuilder.relation.oneToOne',
        defaultMessage: 'One-to-one'
    },
    oneToOneHint: {
        id: 'schemaBuilder.relation.oneToOneHint',
        defaultMessage:
            'Each entry in {source} links to one entry in {target}, and no other entry in {source} may link the same one.'
    },
    oneToOneExample: {
        id: 'schemaBuilder.relation.oneToOneExample',
        defaultMessage:
            'Like a product and its spec sheet. Stored as a unique column on {source}.'
    },
    manyToMany: {
        id: 'schemaBuilder.relation.manyToMany',
        defaultMessage: 'Many-to-many'
    },
    manyToManyHint: {
        id: 'schemaBuilder.relation.manyToManyHint',
        defaultMessage:
            'Each entry in {source} links to any number of entries in {target}, and each of those can be linked from any number in {source}.'
    },
    manyToManyExample: {
        id: 'schemaBuilder.relation.manyToManyExample',
        defaultMessage: 'Like posts and tags. Stored in a separate join table.'
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
    const names = {
        source: type.label || type.name,
        target: target?.label || spec.to
    };
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
                <legend className="mb-2 text-sm font-medium">
                    {intl.formatMessage(messages.cardinality)}
                </legend>
                <RadioGroup
                    className="gap-3"
                    value={cardinalityOf(spec)}
                    onValueChange={(value) =>
                        onChange(toRelationFlags(value as Cardinality))
                    }
                >
                    {CARDINALITIES.map((value) => (
                        <CardinalityOption
                            key={value}
                            value={value}
                            label={intl.formatMessage(messages[value])}
                            notation={CARDINALITY_NOTATION[value]}
                            description={intl.formatMessage(
                                messages[`${value}Hint`],
                                names
                            )}
                            example={intl.formatMessage(
                                messages[`${value}Example`],
                                names
                            )}
                        />
                    ))}
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
