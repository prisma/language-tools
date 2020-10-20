import * as cp from 'child_process'
import * as vscode from 'vscode'
import { commands } from 'vscode'
import { getExecutor } from '../../helpers/workspace'
import { getResourceURI } from '../../util'
import { PrismaVSCodePlugin } from '../types'

let studioProcess: cp.ChildProcessWithoutNullStreams

const plugin: PrismaVSCodePlugin = {
  name: 'studio',
  enabled: () => true,
  activate: (context) => {
    context.subscriptions.push(
      commands.registerCommand('prisma.plugin.studio.kill', () => {
        console.log('Killing Prisma Studio')
        if (studioProcess) {
          studioProcess.kill()
        }
      }),
      commands.registerCommand('prisma.plugin.studio.open', () => {
        if (!vscode.workspace.rootPath) return
        const options: cp.SpawnOptionsWithoutStdio | undefined = {
          cwd: vscode.workspace.rootPath,
          env: {
            ...process.env,
            BROWSER: 'none',
          },
        }
        const executor = getExecutor()
        if (!executor) {
          void vscode.window.showErrorMessage(
            'It looks like your dependencies are not installed',
          )
          return
        }
        studioProcess = cp.spawn(
          executor,
          ['dotenv', '--', 'prisma', 'studio'],
          options,
        )
        let decoded = ''
        if (studioProcess.pid) {
          studioProcess.stdout.on('data', (data: Buffer) => {
            decoded += data
            if (decoded.includes('Prisma Studio is up on')) {
              decoded = ''
              console.log('Opening Prisma Studio')
              const panel = vscode.window.createWebviewPanel(
                'prisma.studio',
                'Prisma Studio',
                vscode.ViewColumn.One,
                {
                  enableScripts: true,
                },
              )
              panel.iconPath = {
                dark: getResourceURI('prisma-icon-light.svg', context),
                light: getResourceURI('prisma-icon-dark.svg', context),
              }
              panel.onDidDispose(() => {
                if (studioProcess) {
                  studioProcess.kill()
                }
              })
              // And set its HTML content
              panel.webview.html = `
            <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html xmlns="http://www.w3.org/1999/xhtml">
              <head>
                  <title>Test Layout</title>
                  <style type="text/css">
                      body, html
                      {
                          margin: 0; padding: 0; height: 100%; overflow: hidden;
                      }
      
                      #content
                      {
                          position:absolute; left: 0; right: 0; bottom: 0; top: 0px; 
                      }
                  </style>
              </head>
              <body>
                  <div id="content">
                      <iframe width="100%" height="100%" frameborder="0" src="http://localhost:5555" />
                  </div>
              </body>
          </html>
            `
            }
          })
          studioProcess.stdout.on('end', () => {
            console.log(decoded)
          })
          studioProcess.stdout.on('close', () => {
            console.log('Closed')
          })
        }
      }),
    )
  },
}
export default plugin
