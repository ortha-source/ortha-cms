import { randomUUID } from 'node:crypto';

/**
 * A fresh boot id — bound once per application (`BOOT_ID`), so it is fixed for
 * the life of the process. An admin that applied a change polls the document
 * until it changes: a new value is the signal the restarted server, with the
 * new registry, is the one answering.
 */
export const newBootId = (): string => randomUUID();
