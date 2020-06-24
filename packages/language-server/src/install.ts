/**
 * Imports
 */

import * as util from './util'
import https from 'https'
import zlib from 'zlib'
import fs from 'fs'

/**
 * Install prisma format
 */

export default async function install(fmtPath: string): Promise<string> {
  const url = await util.getDownloadURL()
  const file = fs.createWriteStream(fmtPath)

  // Fetch fetch fetch.
  return new Promise<string>(function (resolve, reject) {
    https.get(url, function (response) {
      // Did everything go well?
      if (response.statusCode !== 200) {
        reject(response.statusMessage)
      }

      // If so, unzip and pipe into our file.
      const unzip = zlib.createGunzip()
      response.pipe(unzip).pipe(file)
      file.on('finish', function () {
        fs.chmodSync(fmtPath, '755')
        file.close()
        resolve(fmtPath)
      })
    })
  })
}
