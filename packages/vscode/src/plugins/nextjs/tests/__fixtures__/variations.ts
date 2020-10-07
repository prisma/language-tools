export const import_variations = {
  no_import: `
      import { Box, Button, Heading, Text } from '@chakra-ui/core';
    `,

  named_next_import: `
      import { Box, Button, Heading, Text } from '@chakra-ui/core';
      import { NextLink } from 'next';
      import { PrismaClient } from '@prisma/client';
    `,
  // Could they make it longer :-|
  server_type_import: `
      import { Box, Button, Heading, Text } from '@chakra-ui/core';
      import { InferGetServerSidePropsType } from "next";
      import { PrismaClient } from '@prisma/client';
    `,

  static_type_import: `
    import { Box, Button, Heading, Text } from '@chakra-ui/core';
    import { InferGetStaticPropsType } from "next";
    import { PrismaClient } from '@prisma/client';
    `,
}
export const export_variations = {
  const_getStaticProps_export: `
  export const getStaticProps = async (ctx) => {}; 
  `,
  const_getServerSideProps_export: `
  export const getServerSideProps = async (ctx) => {}; 
  `,
  const_both_export: `
  export const getStaticProps = async (ctx) => {}; 
  export const getServerSideProps = async (ctx) => {}; 
  `,
  function_getStaticProps_export: `
  export async function getStaticProps(ctx){}; 
  `,
  function_getServerSideProps_export: `
  export async function getServerSideProps(ctx){}; 
  `,
  function_both_export: `
  export async function getServerSideProps(ctx){}; 
  export async function getStaticProps(ctx){}; 
  `,
}

export const page_export_variations = {
  // Named const
  const_named_with_destructed_props: `
    const MyApp = ({ Component, pageProps }) => {return ()}
    export default MyApp;    
    `,
  const_named_with_props: `
    const MyApp = (props) => {return ()}
    export default MyApp;    
    `,
  const_named_without_props: `
    const MyApp = () => {return ()}
    export default MyApp;    
    `,
  // Anonymous const
  const_anon_with_destructed_props: `
    export default ({ Component, pageProps }) => {return ()}
    `,
  const_anon_with_props: `
    export default (props) => {return ()}
    `,
  const_anon_without_props: `
    export default () => {return ()}
    `,
  // Named function
  function_named_with_destructed_props: `
    function MyApp({ Component, pageProps }) {return ()}
    export default MyApp;    
    `,
  function_named_with_props: `
    function MyApp(props){return ()}
    export default MyApp;    
    `,
  function_named_without_props: `
    function MyApp(){return ()}
    export default MyApp;    
    `,
  // Anonymous function
  function_anon_with_destructed_props: `
    export default function({ Component, pageProps }){return ()}
    `,
  function_anon_with_props: `
    export default function(props){return ()}
    `,
  function_anon_without_props: `
    export default function(){return ()}
    `,
}
