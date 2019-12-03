/**
 * Imports
 */

import { getPlatform } from '@prisma/get-platform'
import * as https from 'https'
import * as zlib from 'zlib'
import * as fs from 'fs'

/**
 * Gets the download URL for a platform
 */

function getFmtDownloadUrl(platform: string) {
  return `https://prisma-builds.s3-eu-west-1.amazonaws.com/master/latest/${platform}/prisma-fmt.gz`
}

/**
 * Install prisma format
 */

export default async function install(fmtPath: string): Promise<string> {
  const platform = await getPlatform()
  const url = getFmtDownloadUrl(platform)
  const file = fs.createWriteStream(fmtPath)

  // Fetch fetch fetch.
  console.log('prisma-fmt: Downloading from ' + url)
  return new Promise<string>(function(resolve, reject) {
    https.get(url, function(response) {
      // Did everything go well?
      if (response.statusCode !== 200) {
        reject(response.statusMessage)
      }

      // If so, unzip and pipe into our file.
      const unzip = zlib.createGunzip()
      response.pipe(unzip).pipe(file)
      file.on('finish', function() {
        fs.chmodSync(fmtPath, '755')
        file.close()
        resolve(fmtPath)
      })
    })
  })
}
