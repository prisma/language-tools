/**
 * Imports
 */

import { getPlatform, Platform } from '@prisma/get-platform'
import * as https from 'https'
import * as zlib from 'zlib'
import * as fs from 'fs'

/**
 * Gets the download URL for a platform
 */

function getFmtDownloadUrl(platform: Platform) {
  const extension = platform === 'windows' ? '.exe.gz' : '.gz'
  return `https://prisma-builds.s3-eu-west-1.amazonaws.com/master/latest/${platform}/prisma-fmt${extension}`
}

/**
 * Install prisma format
 */

export default async function install(fmtPath: string): Promise<string> {
  const platform = await getPlatform()
  const url = getFmtDownloadUrl(platform)
  const file = fs.createWriteStream(fmtPath)

  // Fetch fetch fetch.
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
