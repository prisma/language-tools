import { TreeItem, Command, TreeItemCollapsibleState } from "vscode";

export class PrismaTreeItem extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly tooltip: string,
        public readonly command?: Command
    ) {
        super(label, collapsibleState)
    }
}