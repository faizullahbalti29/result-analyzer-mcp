export const ALLOWED_COLLECTIONS = {
  tenth_students: "tenth_students",
  nineth_students: "nineth_students",
} as const;

export type AllowedCollection =
  (typeof ALLOWED_COLLECTIONS)[keyof typeof ALLOWED_COLLECTIONS];