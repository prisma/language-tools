import * as vscode from 'vscode'

export function registerChatTools(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.lm.registerTool('get_prismas', new PrismaTool()))
}

interface IGetPrismasParameters {
    context: string
}

export class PrismaTool implements vscode.LanguageModelTool<IGetPrismasParameters> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGetPrismasParameters>,
        _token: vscode.CancellationToken,
    ) {

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`You provided this context while asking about Prismas: ${options.input.context}. Thank you for that!`),
        ])
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGetPrismasParameters>,
        _token: vscode.CancellationToken,
    ) {
        const confirmationMessages = {
            title: 'Return Prismas',
            message: new vscode.MarkdownString(
                `Do you really want to get all Prismas?`),
        }

        return {
            invocationMessage: 'Getting information about all Prismas',
            confirmationMessages,
        }
    }
}


