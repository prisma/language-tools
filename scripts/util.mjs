import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function writeToVersionFile({ fileName, content }) {
  fs.writeFileSync(path.join(__dirname, 'versions', `./${fileName}`), content)
}

export function readVersionFile({ fileName = '' }) {
  return fs
    .readFileSync(path.join(__dirname, 'versions', `./${fileName}`), {
      encoding: 'utf-8',
    })
    .replace('\n', '')
}

export function getPackageJsonContent({ path: filePath }) {
  const content = fs.readFileSync(filePath, { encoding: 'utf-8' })
  return JSON.parse(content)
}

export function writeJsonToPackageJson({ content, path: filePath }) {
  fs.writeFileSync(filePath, JSON.stringify(content, undefined, 2))
}

