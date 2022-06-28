# Example

## Run the server

```console
// Install dependencies
$ yarn 

// Run the server
$ yarn run start
```

And then send a request.

```console
$ curl -X POST localhost:4000 -d 'query GetBooks {
  books {
    title
  }
}'
