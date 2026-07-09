/** Shared error-detail shape used by query validation helpers. */

export interface ErrorDetailLike {
  field?: string;
  reason?: string;
  [key: string]: unknown;
}