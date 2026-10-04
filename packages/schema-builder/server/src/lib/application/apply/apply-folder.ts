import { WORK_DIR } from '../../types/schema-builder-config';

/** One apply's scratch folder and what lives in it, relative to the project root. */
export const applyFolder = (operationId: string) => {
    const root = `${WORK_DIR}/apply/${operationId}`;
    return {
        root,
        content: `${root}/content`,
        backup: `${root}/backup`,
        backupMigrations: `${root}/backup/migrations`,
        backupContent: `${root}/backup/content`
    } as const;
};
