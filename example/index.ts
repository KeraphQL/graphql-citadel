import { ApolloServer, gql } from 'apollo-server'
import { citadelDirective } from '../src'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = gql`
  enum Permission {
    ADMIN
    VIEWER
  }

  # This "Book" type defines the queryable fields for every book in our data source.
  type Book {
    title: String
    author: String
  }

  input BookInput {
    title: String!
  }

  # The "Query" type is special: it lists all of the available queries that
  # clients can execute, along with the return type for each. In this
  # case, the "books" query returns an array of zero or more Books (defined above).
  type Mutation {
    createBook (book: BookInput): Book @hasPermissions(permissions: [ADMIN])
  }

  type Query {
    books: [Book] @hasPermissions(permissions: [ADMIN])
  }
`;

// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "books" array above.
const resolvers = {
  Query: {
    books: async (parent: any, args: any, context: any, info: any) => {
      console.log('query context', context)
    },
  },
  Mutation: {
    createBook: async (parent: any, args: any, context: any, info: any) => {
      console.log('context', context)
    }
  }
};

interface AuthContext {
  reason: string
}

const { citadelDirectiveTypeDefs, citadelDirectiveTransformer } = citadelDirective({
  permissionResolver: async ({ source, args, context, directive }): Promise<string[]> => {
    return []
  }
})

let schema = makeExecutableSchema({
  typeDefs: [
    typeDefs,
    citadelDirectiveTypeDefs
  ],
  resolvers
})

schema = citadelDirectiveTransformer(schema)

const server = new ApolloServer({
  schema,
  csrfPrevention: true,
});

// The `listen` method launches a web server.
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
