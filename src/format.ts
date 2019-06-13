import { spawn } from 'child_process'
import * as path from 'path'

export default function format(text: string): Promise<string> {
  const exec_path = path.join(__dirname, '../prisma-fmt')
  const fmt = spawn(exec_path)

  const chunks = []

  fmt.stdout.on('data', (data) => {
    chunks.push(data.toString())
  });

  const err_chunks = []

  fmt.stderr.on('data', (data) => {
    err_chunks.push(data.toString())
  });


  fmt.stdin.setDefaultEncoding('utf-8');
  fmt.stdin.write(text);
  fmt.stdin.end();

  return new Promise((resolve, reject) => {
    fmt.on('exit', (code) => {
      if(code === 0 && err_chunks.length === 0) {
        resolve(chunks.join(""))
      } else {
        console.log("prisma-fmt error'd during formatting.");
        console.log(err_chunks);
        resolve(text);
      }
    })
  })
}