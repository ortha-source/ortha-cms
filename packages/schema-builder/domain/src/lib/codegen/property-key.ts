const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** An object key as source: bare when it is an identifier, quoted otherwise. */
export const propertyKey = (key: string): string =>
    IDENTIFIER.test(key) ? key : `'${key.replace(/'/g, "\\'")}'`;
