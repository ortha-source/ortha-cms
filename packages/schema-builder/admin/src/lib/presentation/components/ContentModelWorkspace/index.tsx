import { useParams } from 'react-router-dom';
import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';
import { ContentModelEmpty } from '../ContentModelEmpty';
import { ContentModelLayout } from '../ContentModelLayout';
import { ReadOnlyNotice } from '../ReadOnlyNotice';
import { TypeEditor } from '../TypeEditor';
import { TypeRail } from '../TypeRail';

/**
 * The loaded document: why it is read-only, the rail, the selected type. The
 * type comes from the URL; an unknown name (a bookmark to a type since
 * removed) falls back to the first type rather than to nothing.
 */
export function ContentModelWorkspace({
    envelope
}: {
    envelope: SchemaDocumentEnvelope;
}) {
    const { typeName } = useParams();
    const { types } = envelope.document;
    if (types.length === 0) return <ContentModelEmpty />;
    const selected = types.find((type) => type.name === typeName) ?? types[0];

    return (
        <>
            <ReadOnlyNotice reason={envelope.capabilities.reason} />
            <ContentModelLayout
                rail={<TypeRail types={types} selected={selected.name} />}
                editor={
                    <TypeEditor
                        type={selected}
                        capabilities={envelope.capabilities}
                    />
                }
            />
        </>
    );
}
