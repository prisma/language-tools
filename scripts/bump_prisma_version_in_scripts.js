import { writeToVersionFile } from './util'


if (require.main === module) {
    const args = process.argv.slice(2)
    writeToVersionFile(`prisma_${args[0]}`, args[1])
    console.log(`Updating to Prisma CLI version ${args[1]} for channel ${args[0]}.`)
}
