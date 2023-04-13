import { GraphQLError } from "graphql";

/**
 *
 * @see {@link https://www.apollographql.com/docs/apollo-server/v2/data/errors/}
 */
export function AuthenticationError(
  message: string = "unauthenticated or the user does not exist"
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code: "UNAUTHENTICATED",
    },
  });
}

export function ForbiddenError(
  message: string = "user does not have enough permissions to act this request or the user does not exist"
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code: "FORBIDDEN",
    },
  });
}
