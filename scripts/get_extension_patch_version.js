import { readVersionFile } from './util'


if (require.main === module) {
    const tag = readVersionFile('extension_patch')
    console.log(`::set-output name=tag::${tag}`)
}
