import { spawn } from 'child_process'

export default function exec(
  execPath: string,
  args: string[],
  input: string,
): Promise<string> {
  const fmt = spawn(execPath, args)

  const chunks: string[] = []

  fmt.stdout.on('data', (data) => {
    chunks.push(data.toString()) // eslint-disable-line
  })

  const errChunks: string[] = []

  fmt.stderr.on('data', (data) => {
    errChunks.push(data.toString()) // eslint-disable-line
  })

  fmt.stdin.setDefaultEncoding('utf-8')
  fmt.stdin.write(input)
  fmt.stdin.end()

  return new Promise((resolve, reject) => {
    fmt.on('exit', (code) => {
      if (code === 0 && errChunks.length === 0) {
        resolve(chunks.join(''))
      } else {
        reject(errChunks.join(''))
      }
    })
  })
}
