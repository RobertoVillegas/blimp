export type ErrorKind =
  | 'not-configured'
  | 'permission'
  | 'auth'
  | 'quota'
  | 'model'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'invalid-output'
  | 'page-unavailable'
  | 'nothing-to-do'
  | 'internal';

/** Errors that are safe to show to the user verbatim. Never put secrets in `message`. */
export class UserFacingError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export interface SerializedError {
  kind: ErrorKind;
  message: string;
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof UserFacingError) return { kind: error.kind, message: error.message };
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { kind: 'cancelled', message: 'Cancelled.' };
  }
  return { kind: 'internal', message: 'Something went wrong inside Blimp.' };
}
