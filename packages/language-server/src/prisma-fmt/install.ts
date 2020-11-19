/**
 * Imports
 */

import https from 'https'
import zlib from 'zlib'
import fs from 'fs'

/**
 * Install prisma format
 */

export default async function install(
  url: string,
  fmtPath: string,
): Promise<string> {
  const file = fs.createWriteStream(fmtPath)

  // Fetch fetch fetch.
  try {
    return await new Promise<string>(function (resolve, reject) {
      https.get(url, function (response) {
        // Did everything go well?
        if (response.statusCode !== 200) {
          reject(new Error(response.statusMessage))
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
  } catch (e) {
    // Cleanup on failure
    try {
      console.error(
        `Language Server failed while downloading url ${url} with fmtPath ${fmtPath}.`,
      )
      console.error(e)
      fs.unlinkSync(fmtPath)
    } catch (err) {}
    throw e
  }
}
