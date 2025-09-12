import * as vscode from 'vscode';
import { PdfViewerProvider } from './pdfViewerProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new PdfViewerProvider(context);
    const registration = vscode.window.registerCustomEditorProvider(
        'pdfViewerPro.pdfEditor',
        provider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
                enableFindWidget: true
            },
            supportsMultipleEditorsPerDocument: true
        }
    );

    const commands = [
        vscode.commands.registerCommand('pdfViewerPro.openPdf', async (uri?: vscode.Uri) => {
            if (!uri) {
                const options: vscode.OpenDialogOptions = {
                    canSelectMany: false,
                    openLabel: 'Open PDF',
                    filters: {
                        'PDF files': ['pdf']
                    }
                };
                const fileUri = await vscode.window.showOpenDialog(options);
                if (fileUri && fileUri[0]) {
                    uri = fileUri[0];
                } else {
                    return;
                }
            }
            vscode.commands.executeCommand('vscode.openWith', uri, 'pdfViewerPro.pdfEditor');
        }),
        vscode.commands.registerCommand('pdfViewerPro.zoomIn', () => {
            provider.zoomIn();
        }),
        vscode.commands.registerCommand('pdfViewerPro.zoomOut', () => {
            provider.zoomOut();
        })
    ];

    context.subscriptions.push(registration, ...commands);
}

export function deactivate() {}