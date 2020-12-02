/**
 * Imports
 */

import zlib from 'zlib'
import fs from 'fs'
import { getProxyAgent } from '@prisma/fetch-engine'
import fetch from 'node-fetch'

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
    const response = await fetch(url, {
      agent: getProxyAgent(url),
    })
    return await new Promise((resolve, reject) => {
      const unzip = zlib.createGunzip()
      response.body.pipe(unzip).pipe(file).on('error', reject)
      file.on('finish', function () {
        fs.chmodSync(fmtPath, '755')
        file.close()
        resolve(fmtPath)
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
