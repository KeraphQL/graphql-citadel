/**
 * Citadel error codes are custom error codes inspired by Apollo server V2.
 * @see {@link https://www.apollographql.com/docs/apollo-server/v2/data/errors/}
 *
 * The built-in error codes of Apollo V4 have limited expressiveness and can be difficult to handle, so we have defined our own set of error codes in this package.
 * @see {@link https://www.apollographql.com/docs/apollo-server/v4/data/errors/}
 */

export enum CitadelErrorCode {
  FORBIDDEN = "FORBIDDEN",
  UNAUTHENTICATED = "UNAUTHENTICATED",
}
