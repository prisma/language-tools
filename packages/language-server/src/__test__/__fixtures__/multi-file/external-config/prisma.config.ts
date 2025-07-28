export default {
  experimental: {
    externalTables: true,
  },
  tables: {
    external: ['public.P0st', 'likes.Like'],
  },
  enums: {
    external: ['public.Role'],
  },
}
