# AutoTypes for NextJSs Funky Function

## Current Issues/Limitations

- JS Docs will only be inserted to function declerations
- `InferGetServerSidePropsType` and `InferGetStaticPropsType` will not work if the corresponding function i.e `getServerSideProps` uses destructured props

#### Good

`getServerSideProps(ctx) `

#### Bad

`getServerSideProps({why, doesnt, this, work}) `

## Development

### Setup

`yarn`

### Running all tests

`yarn test`

### Running Specific Tests

Remove the skip from `dev.test.ts`
Then run `yarn dev` and check the snapshot

You are able to filter the tests by modifying the filter function on `buildVariations`

```
buildVariations('tsx', {
  page: (value) => {
    return value.includes("const_named");
  },
  import: (value) => value.includes("server"),
});
```
