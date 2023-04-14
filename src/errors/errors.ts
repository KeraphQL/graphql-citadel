import { GraphQLError } from "graphql";
import { CitadelErrorCode } from "./code";

/**
 * Errors that will be returned if the user are not authenticated resolved by the authentication resolver.
 */
export function AuthenticationError(
  message: string = "unauthenticated or the user does not exist"
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code: CitadelErrorCode.UNAUTHENTICATED,
    },
  });
}

/**
 * Errors returned if the user doesn't have required permissions resolved by the permission resolver.
 */
export function ForbiddenError(
  message: string = "user does not have enough permissions to act this request or the user does not exist"
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code: CitadelErrorCode.FORBIDDEN,
    },
  });
}
