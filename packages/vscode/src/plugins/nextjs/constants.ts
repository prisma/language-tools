export const NextFunctions = {
  getServerSideProps: {
    import: 'InferGetServerSidePropsType',
    type: 'InferGetServerSidePropsType<typeof getServerSideProps>',
  },
  getStaticProps: {
    import: 'InferGetStaticPropsType',
    type: 'InferGetStaticPropsType<typeof getStaticProps>',
  },
}
export type NextFunctionName = keyof typeof NextFunctions

export type NextFunctionType = {
  [nextFunctionName in NextFunctionName]: {
    import: string
    type: string
  }
}
