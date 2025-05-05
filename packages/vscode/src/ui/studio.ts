/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import path from 'path'
import { commands, Event, EventEmitter, ExtensionContext, TreeDataProvider, TreeItem, Uri, ViewColumn, WebviewPanel, window } from 'vscode'

export function activate(context: ExtensionContext): void {
  window.registerTreeDataProvider('Prisma-StudioView', new SimpleTreeDataProvider())
  addWebViewPanel(context)
}

export function deactivate(): void {
  // No specific deactivation logic needed for this example
}

class SimpleItem extends TreeItem {
  constructor(label: string) {
    super(label)
    this.tooltip = `View data for the ${label} model`
    // this.description = `Description`
    this.command = {
      command: 'prisma.studio.openWebview', // or a custom command
      title: `View data for ${label}`,
      arguments: [label],
    }
  }
}

class SimpleTreeDataProvider implements TreeDataProvider<SimpleItem> {
  private _onDidChangeTreeData: EventEmitter<SimpleItem | undefined | void> = new EventEmitter<
    SimpleItem | undefined | void
  >()
  readonly onDidChangeTreeData: Event<SimpleItem | undefined | void> = this._onDidChangeTreeData.event

  getTreeItem(element: SimpleItem): TreeItem {
    return element
  }

  getChildren(element?: SimpleItem): Thenable<SimpleItem[]> {
    if (element) {
      return Promise.resolve([])
    } else {
      return Promise.resolve([
        new SimpleItem('User'),
        new SimpleItem('Post'),
        new SimpleItem('Comment'),
      ])
    }
  }
}

function addWebViewPanel(context: ExtensionContext): void {
  context.subscriptions.push(
    commands.registerCommand('prisma.studio.openWebview', (model: string) => {
      const panel = window.createWebviewPanel(
        'Prisma-studio-webview',
        `${model}`,
        ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [Uri.file(path.join(context.extensionPath, 'static', 'studio'))],
        }
      );
      panel.iconPath = Uri.file(
        context.asAbsolutePath('./prisma_icon.svg')
      )

      panel.webview.html = getWebviewContent(model, panel);
    })
  );

  function getWebviewContent(model: string, panel: WebviewPanel): string {

    const imagePath = Uri.file(
      path.join(context.extensionPath, 'static', 'studio', 'studio.png')
    );
    const imageSrc = panel.webview.asWebviewUri(imagePath);
    return `
          <!DOCTYPE html>
          <html>
          <body>
            <h2>${model}</h2>
            <img src="${imageSrc}" alt="Studio Content">
          </body>
          </html>
        `;
  }
}
