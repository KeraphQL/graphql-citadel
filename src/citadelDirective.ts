/**
 * @file Module for custom schema directive used for authentication and authorization.
 * @see {@link https://spec.graphql.org/October2021/#sec-Type-System.Directives} for GraphQL specification for GraphQL directives.
 *
 * GraphQL Citadel is powered by the GraphQL schema directive.
 * Policies are managed on the GraphQL schema declaratively making policy as a code.
 * Decisions are managed outside of the GraphQL schema therefore it's very easy to manage and test.
 *
 * For example, authz can be applied to the operations as below.
 *
 * type Query {
 *     weather: Weather! @public
 *     company: Company! @authenticated
 * }
 *
 * type Mutation {
 *      signIn: User! @public
 *      updateUsername: User! @authenticated @hasPermissions(permissions: [ADMIN_WRITE])
 * }
 *
 * These built-in directives specifying the policy to that operation.
 *
 *  - @public: Specified that no authentication or authorization is required.
 *  - @authenticated: Specified that the users needs to be logged in.
 *  - @hasPermissions: Specified that the permissions that users must have.
 *
 * By default, the server runs as "deny-by-default" making all requests rejected if the operations does not specify any authz.
 *
 */

import { getDirective } from "@graphql-tools/utils";
import { mapSchema, MapperKind } from "@graphql-tools/utils";
import {
  defaultFieldResolver,
  GraphQLSchema,
  GraphQLResolveInfo,
  GraphQLFieldConfig,
} from "graphql";
import { AuthenticationError, ForbiddenError } from "./errors";

export const defaultAuthenticatedDirectiveName = "authenticated";
export const defaultHasPermissionDirectiveName = "hasPermissions";
export const defaultPublicDirectiveName = "public";

/**
 * AuthenticationResolverFunc represents a function that will check user's identity.
 */
type AuthenticationResolverFunc<TContext> = (
  args: resolverFuncArgs<TContext>
) => Promise<boolean>;

/**
 * PermissionResolverFunc represents a function that will resolve (return) the user's permissions.
 */
type PermissionResolverFunc<TContext> = (
  args: resolverFuncArgs<TContext>
) => Promise<string[]>;

/**
 * resolverFuncArgs represents the type of the resolverFunc.
 */
export type resolverFuncArgs<TContext> = {
  source: unknown;
  args: unknown;
  context: TContext;
  directive: { [argName: string]: unknown };
};

/**
 * AuthzDirectiveOptions represents configurable options of auth directive.
 */
export interface AuthzDirectiveOptions<TContext> {
  /**
   * authenticatedDirectiveName of the directive name for authentication. By default, it's 'authenticated' but it's configurable by your own.
   * This is intended to avoid conflicts between other custom directives.
   * @default "authenticated"
   */
  authenticatedDirectiveName?: string;

  /**
   * byPass to true will ignore all authorization during the request handling.
   * It's intended to use for development to call the API easy.
   * @default false
   */
  bypass?: boolean;

  /**
   * hasPermissionsDirectiveName of the directive name for authorization. By default, it's 'hasPermissions' but it's configurable by your own.
   * This is intended to avoid conflicts between other custom directives.
   * @default "hasPermissions"
   */
  hasPermissionsDirectiveName?: string;

  /**
   * publicDirectiveName is a name of the directive which needs no authorization. Instead of hard coding,  we open
   * an API to dynamically configure not to conflict with other custom directives.
   * @default "public"
   */
  publicDirectiveName?: string;

  /**
   * authenticationResolver is a custom handler for resolving the field of the schema directive attached fields.
   */
  authenticationResolver?: AuthenticationResolverFunc<TContext>;

  /**
   * permissionResolver is a custom handler for resolving the field of the schema directive attached fields.
   */
  permissionResolver?: PermissionResolverFunc<TContext>;
}

/**
 * citadelDirective returns the type definitions and the transformer of the custom schema directive.
 * @param {AuthzDirectiveOptions} options
 */
export function citadelDirective<TContext>({
  authenticatedDirectiveName = defaultAuthenticatedDirectiveName,
  bypass = false,
  hasPermissionsDirectiveName = defaultHasPermissionDirectiveName,
  publicDirectiveName = defaultPublicDirectiveName,
  authenticationResolver,
  permissionResolver,
}: AuthzDirectiveOptions<TContext>) {
  const f =
    (
      schema: GraphQLSchema,
      authenticationResolver?: AuthenticationResolverFunc<TContext>,
      permissionResolver?: PermissionResolverFunc<TContext>,
      bypass = false
    ) =>
    (fieldConfig: GraphQLFieldConfig<unknown, unknown>) => {
      const { resolve = defaultFieldResolver } = fieldConfig;
      // If public directive is configured, bypass authentication and authorization.
      // There are many use-cases (e.g. sign-in) for APIs that should not authorized the request.
      const publicDirective = getDirective(
        schema,
        fieldConfig,
        publicDirectiveName
      )?.[0];
      if (publicDirective) {
        return fieldConfig;
      }

      const authenticatedDirective = getDirective(
        schema,
        fieldConfig,
        authenticatedDirectiveName
      )?.[0];
      if (authenticatedDirective && authenticationResolver) {
        return {
          ...fieldConfig,
          resolve: async function (
            source: unknown,
            args: { [argName: string]: unknown },
            context: TContext,
            info: GraphQLResolveInfo
          ) {
            const authenticated = await authenticationResolver({
              source,
              args,
              context,
              directive: {},
            });

            if (authenticated) {
              return resolve(source, args, context, info);
            }

            if (bypass) {
              return resolve(source, args, context, info);
            }

            throw AuthenticationError(
              "unauthenticated or the user does not exist"
            );
          },
        };
      }

      const permissionDirective = getDirective(
        schema,
        fieldConfig,
        hasPermissionsDirectiveName
      )?.[0];
      if (permissionDirective && permissionResolver) {
        return {
          ...fieldConfig,
          resolve: async function (
            source: unknown,
            args: { [argName: string]: unknown },
            context: TContext,
            info: GraphQLResolveInfo
          ) {
            const requiredPermissions = getPermissions(permissionDirective);

            const permissions = await permissionResolver({
              source,
              args,
              context,
              directive: permissionDirective,
            });

            const hasPermission = !requiredPermissions.every((rp) =>
              permissions.find((p) => p === rp)
            );

            // Check where the user has all permissions required.
            if (hasPermission) {
              if (bypass) {
                return resolve(source, args, context, info);
              }

              const msg =
                "user does not have enough permissions to act this request or the user does not exist";
              throw ForbiddenError(msg);
            }

            return resolve(source, args, context, info);
          },
        };
      }

      // Deny by default.
      // All queries and mutations must have directives EXPLICITLY for safer development and infrastructure as code purpose.
      // To bypass, configure `bypass` to true.
      return {
        ...fieldConfig,
        resolve: function (
          source: unknown,
          args: { [argName: string]: unknown },
          context: TContext,
          info: GraphQLResolveInfo
        ) {
          if (bypass) {
            return resolve(source, args, context, info);
          }

          throw ForbiddenError("not allowed to perform this action");
        },
      };
    };

  let citadelDirectiveTypeDefs = [
    `directive @${authenticatedDirectiveName} on FIELD_DEFINITION`,
    `directive @${publicDirectiveName} on FIELD_DEFINITION`,
  ];

  return {
    citadelDirectiveTypeDefs,
    citadelDirectiveTransformer: (schema: GraphQLSchema): GraphQLSchema =>
      mapSchema(schema, {
        [MapperKind.MUTATION_ROOT_FIELD]: f(
          schema,
          authenticationResolver,
          permissionResolver,
          bypass
        ),
        [MapperKind.QUERY_ROOT_FIELD]: f(
          schema,
          authenticationResolver,
          permissionResolver,
          bypass
        ),
      }),
  };
}

/**
 * getPermissions gets the custom directives 'permissions' argument.
 * @param {{ [argName: string]: unknown }} directive
 * @returns {string[]}
 */
function getPermissions(directive: { [argName: string]: unknown }): string[] {
  const permissions = directive["permissions"];
  if (!isPermissionMethodArray(permissions))
    throw new Error("invalid permissions type");
  return permissions;
}

/**
 * isPermissionMethodArray checks wether the input of the directive is array of the string permissions.
 * @param {unknown} value
 * @returns {string[]}
 */
function isPermissionMethodArray(value: unknown): value is string[] {
  if (!value)
    throw new Error("permissions argument is required to the directive");

  if (!Array.isArray(value))
    throw new Error("permissions argument should be an array of permissions");

  return isStringArray(value);
}

/**
 * isStringArray checks wether the array input is an array of strings.
 * @param {unknown[]} value
 * @returns {string[]}
 */
function isStringArray(value: unknown[]): value is string[] {
  return value.every((v) => typeof v === "string");
}
