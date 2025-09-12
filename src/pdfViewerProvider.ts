import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PdfRenderer } from './pdfRenderer';
import { PdfCache } from './pdfCache';

export class PdfViewerProvider implements vscode.CustomReadonlyEditorProvider {
    private renderer: PdfRenderer;
    private cache: PdfCache;
    private activeEditors = new Set<vscode.WebviewPanel>();

    constructor(private context: vscode.ExtensionContext) {
        this.renderer = new PdfRenderer();
        this.cache = new PdfCache(100);
    }

    async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => {} };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel
    ): Promise<void> {
        this.activeEditors.add(webviewPanel);
        
        webviewPanel.onDidDispose(() => {
            this.activeEditors.delete(webviewPanel);
        });

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
                vscode.Uri.file(path.dirname(document.uri.fsPath))
            ]
        };

        webviewPanel.webview.html = await this.getWebviewContent(
            webviewPanel.webview, 
            document.uri
        );

        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            console.log('Received message:', message.type, message.page ? `page: ${message.page}` : '');
            
            switch (message.type) {
                case 'requestPage':
                    await this.handlePageRequest(webviewPanel.webview, document.uri, message.page);
                    break;
                case 'ready':
                    await this.initializePdf(webviewPanel.webview, document.uri);
                    break;
                case 'createImage':
                    console.log('Processing createImage for page', message.page, 'data length:', message.data?.length);
                    await this.handleCreateImage(document.uri, message.data, message.page, message.format, message.extension);
                    break;
                case 'createImageAllPages':
                    console.log('Processing createImageAllPages for', message.totalPages, 'pages');
                    await this.handleCreateImageAllPages(webviewPanel.webview, document.uri, message.totalPages);
                    break;
                case 'saveSettings':
                    this.saveSettings(message.settings);
                    break;
                case 'loadSettings':
                    const settings = this.loadSettings();
                    webviewPanel.webview.postMessage({
                        type: 'settingsLoaded',
                        settings: settings
                    });
                    break;
            }
        });
    }

    private async handlePageRequest(webview: vscode.Webview, uri: vscode.Uri, pageNum: number) {
        try {
            const cacheKey = uri.fsPath;
            let pdfData = this.cache.get(cacheKey);

            if (!pdfData) {
                console.log(`Loading PDF data from ${uri.fsPath}`);
                pdfData = await this.renderer.renderPage(uri.fsPath, pageNum);
                this.cache.set(cacheKey, pdfData);
            }

            webview.postMessage({
                type: 'pdfData',
                data: pdfData
            });
        } catch (error) {
            console.error('Error loading PDF:', error);
            webview.postMessage({
                type: 'error',
                message: `Failed to load PDF: ${error}`
            });
        }
    }

    private async initializePdf(webview: vscode.Webview, uri: vscode.Uri) {
        try {
            console.log(`Initializing PDF: ${uri.fsPath}`);
            webview.postMessage({
                type: 'initialize'
            });
        } catch (error) {
            console.error('Error initializing PDF:', error);
            webview.postMessage({
                type: 'error',
                message: `Failed to initialize PDF: ${error}`
            });
        }
    }

    private async getWebviewContent(webview: vscode.Webview, uri: vscode.Uri): Promise<string> {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'main.js'))
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'styles.css'))
        );

        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>PDF Viewer Pro</title>
        </head>
        <body>
            <div id="toolbar">
                <div id="zoom-controls">
                    <button id="zoomOut">-</button>
                    <span id="zoomLevel">70%</span>
                    <button id="zoomIn">+</button>
                </div>
                <div id="image-controls">
                    <button id="createImage">Create Image</button>
                    <button id="createImageAll">Create Image All Pages</button>
                    <select id="imageFormat">
                        <option value="png">PNG</option>
                        <option value="jpeg" selected>JPEG</option>
                    </select>
                    <select id="jpegQuality" title="JPEG Quality">
                        <option value="0.70">70%</option>
                        <option value="0.75" selected>75%</option>
                        <option value="0.80">80%</option>
                        <option value="0.85">85%</option>
                        <option value="0.90">90%</option>
                        <option value="0.95">95%</option>
                        <option value="1.00">100%</option>
                    </select>
                </div>
                <div id="page-controls">
                    <button id="prevPage">←</button>
                    <span id="pageInfo">Page <span id="currentPage">1</span> of <span id="totalPages">1</span></span>
                    <button id="nextPage">→</button>
                </div>
            </div>
            <div id="pdfContainer"></div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    zoomIn() {
        this.activeEditors.forEach(editor => {
            editor.webview.postMessage({ type: 'zoomIn' });
        });
    }

    zoomOut() {
        this.activeEditors.forEach(editor => {
            editor.webview.postMessage({ type: 'zoomOut' });
        });
    }

    private async handleCreateImage(uri: vscode.Uri, imageData: string, pageNum: number, format?: string, extension?: string) {
        try {
            console.log('handleCreateImage called with:', {
                uriPath: uri.fsPath,
                pageNum,
                dataLength: imageData?.length
            });

            if (!imageData) {
                throw new Error('No image data provided');
            }

            const pdfPath = uri.fsPath;
            const pdfDir = path.dirname(pdfPath);
            const pdfName = path.basename(pdfPath); // Keep full filename including .pdf
            const ext = extension || 'png';
            
            const imagePath = path.join(pdfDir, `${pdfName}.page${pageNum.toString().padStart(2, '0')}.${ext}`);
            
            console.log('Attempting to save image to:', imagePath);
            console.log('PDF directory exists:', await fs.promises.access(pdfDir).then(() => true).catch(() => false));
            
            // Convert base64 to buffer and save
            const buffer = Buffer.from(imageData, 'base64');
            console.log('Buffer size:', buffer.length);
            
            await fs.promises.writeFile(imagePath, buffer);
            
            console.log(`Image successfully created: ${imagePath}`);
            vscode.window.showInformationMessage(`Image saved: ${path.basename(imagePath)}`);
        } catch (error) {
            console.error('Error creating image:', error);
            vscode.window.showErrorMessage(`Failed to create image: ${error}`);
        }
    }

    private async handleCreateImageAllPages(webview: vscode.Webview, uri: vscode.Uri, totalPages: number) {
        try {
            vscode.window.showInformationMessage(`Creating images for all ${totalPages} pages...`);
            
            // This will trigger the webview to create images for each page sequentially
            webview.postMessage({
                type: 'startBatchImageCreation',
                totalPages: totalPages
            });
        } catch (error) {
            console.error('Error starting batch image creation:', error);
            vscode.window.showErrorMessage(`Failed to start batch image creation: ${error}`);
        }
    }

    private saveSettings(settings: any) {
        try {
            this.context.globalState.update('pdfViewerSettings', settings);
            console.log('Settings saved:', settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    private loadSettings() {
        try {
            const settings = this.context.globalState.get('pdfViewerSettings', {
                imageFormat: 'jpeg',
                jpegQuality: '0.75'
            });
            console.log('Settings loaded:', settings);
            return settings;
        } catch (error) {
            console.error('Failed to load settings:', error);
            return {
                imageFormat: 'jpeg',
                jpegQuality: '0.75'
            };
        }
    }
}