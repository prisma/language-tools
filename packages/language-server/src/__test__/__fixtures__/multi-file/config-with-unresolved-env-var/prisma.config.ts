import { env } from 'prisma/config'

export default {
  datasource: {
    url: env('UNSET_ENV_VAR'),
  },
}
