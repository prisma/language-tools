/**
 * Imports
 */

import zlib from 'zlib'
import fs from 'fs'
import path from 'path'
import { getProxyAgent } from '@prisma/fetch-engine'
import fetch from 'node-fetch'
import tempy from 'tempy'
import retry from 'p-retry'
import hasha from 'hasha'
import { promisify } from 'util'
import rimraf from 'rimraf'
const del = promisify(rimraf)
/**
 * Install prisma format
 */

export function plusXSync(file: string): void {
  const s = fs.statSync(file)
  const newMode = s.mode | 64 | 8 | 1
  if (s.mode === newMode) {
    // console.log(`Execution permissions of ${file} are fine`)
    return
  }
  const base8 = newMode.toString(8).slice(-3)
  // console.log(`Have to call plusX on ${file}`)
  fs.chmodSync(file, base8)
}

export type DownloadResult = {
  lastModified: string
  sha256: string
  zippedSha256: string
}

//
// From https://github.com/prisma/prisma/blob/4bd1d2850f1dc7c09054fd7c776c3707fc601b55/src/packages/fetch-engine/src/downloadZip.ts#L21
//
async function fetchSha256(
  url: string,
): Promise<{ sha256: string; zippedSha256: string }> {
  // We get a string like this:
  // "3c82ee6cd9fedaec18a5e7cd3fc41f8c6b3dd32575dc13443d96aab4bd018411  query-engine.gz\n"
  // So we split it by whitespace and just get the hash, as that's what we're interested in
  const [zippedSha256, sha256] = [
    (
      await fetch(`${url}.sha256`, {
        agent: getProxyAgent(url),
      }).then((res) => res.text())
    ).split(/\s+/)[0],
    (
      await fetch(`${url.slice(0, url.length - 3)}.sha256`, {
        agent: getProxyAgent(url.slice(0, url.length - 3)),
      }).then((res) => res.text())
    ).split(/\s+/)[0],
  ]

  return { sha256, zippedSha256 }
}

export async function downloadZip(
  url: string,
  target: string,
): Promise<DownloadResult> {
  const tmpDir = tempy.directory()
  const partial = path.join(tmpDir, 'partial')
  const { sha256, zippedSha256 } = await fetchSha256(url)
  const result = await retry(
    async () => {
      try {
        const resp = await fetch(url, {
          compress: false,
          agent: getProxyAgent(url),
        })

        if (resp.status !== 200) {
          throw new Error(resp.statusText + ' ' + url)
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const lastModified = resp.headers.get('last-modified')!
        const ws = fs.createWriteStream(partial)

        // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
        return await new Promise(async (resolve, reject) => {
          resp.body.on('error', reject)

          const gunzip = zlib.createGunzip()

          gunzip.on('error', reject)

          const zipStream = resp.body.pipe(gunzip)
          const zippedHashPromise = hasha.fromStream(resp.body, {
            algorithm: 'sha256',
          })
          const hashPromise = hasha.fromStream(zipStream, {
            algorithm: 'sha256',
          })
          zipStream.pipe(ws)

          ws.on('error', reject).on('close', () => {
            resolve({ lastModified, sha256, zippedSha256 })
          })

          const hash = await hashPromise
          const zippedHash = await zippedHashPromise

          if (zippedHash !== zippedSha256) {
            throw new Error(
              `sha256 of ${url} (zipped) should be ${zippedSha256} but is ${zippedHash}`,
            )
          }

          if (hash !== sha256) {
            throw new Error(
              `sha256 of ${url} (uzipped) should be ${sha256} but is ${hash}`,
            )
          }
        })
      } finally {
        //
      }
    },
    {
      retries: 2,
      onFailedAttempt: (err) => console.error(err),
    },
  )

  fs.copyFileSync(partial, target)

  // it's ok if the unlink fails
  try {
    await del(partial)
    await del(tmpDir)
  } catch (e) {
    console.error(e)
  }

  return result as DownloadResult
}

export default async function install(
  url: string,
  fmtPath: string,
): Promise<string> {
  const targetDir = path.dirname(fmtPath)

  try {
    fs.accessSync(targetDir, fs.constants.W_OK)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EACCES') {
      throw e
    } else {
      throw new Error(`Can't write to ${targetDir}`)
    }
  }

  try {
    console.debug(`Downloading ${url} to ${fmtPath}`)

    await downloadZip(url, fmtPath)
  } catch (e) {
    console.error(
      `Language Server failed while downloading url ${url} with fmtPath ${fmtPath}.`,
    )
    console.error(e)
    throw e
  }

  if (process.platform !== 'win32') {
    plusXSync(fmtPath)
  }

  return fmtPath
}
