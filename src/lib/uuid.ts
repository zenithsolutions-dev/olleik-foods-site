// An id taken from a URL must be a UUID before it reaches a uuid column: otherwise Postgres rejects it with
// "invalid input syntax for type uuid" and the server logs an error for what is just a mistyped link. Data readers
// call this first and answer "not found" exactly as they do for a well-formed id that matches nothing.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: string): boolean => UUID_RE.test(v);
