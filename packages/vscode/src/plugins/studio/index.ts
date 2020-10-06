import { ViewColumn, window } from 'vscode'
import { PrismaVSCodePlugin } from '../types'

const plugin: PrismaVSCodePlugin = {
  name: 'nextjs',
  commands: [
    {
      commandId: 'prisma.plugin.studio.open',
      action: () => {
        void window.showInformationMessage('Open Prisma Studio')
        const panel = window.createWebviewPanel(
          'prisma.studio',
          'Prisma Studio',
          ViewColumn.One,
          {
            enableScripts: true,
          },
        )

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
      },
    },
  ],
}
export default plugin
