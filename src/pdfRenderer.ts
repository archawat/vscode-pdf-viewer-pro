import * as fs from 'fs/promises';

export class PdfRenderer {
    private dataCache = new Map<string, string>();

    async getPageCount(filePath: string): Promise<number> {
        // We'll let the frontend PDF.js handle page counting
        return 1; 
    }

    async renderPage(filePath: string, pageNum: number): Promise<string> {
        // Just return the PDF data as base64 for the frontend to handle
        if (this.dataCache.has(filePath)) {
            return this.dataCache.get(filePath)!;
        }

        try {
            const pdfBuffer = await fs.readFile(filePath);
            const base64Data = pdfBuffer.toString('base64');
            this.dataCache.set(filePath, base64Data);
            return base64Data;
        } catch (error) {
            console.error('Error reading PDF file:', error);
            throw new Error(`Failed to read PDF file: ${error}`);
        }
    }

    clearCache() {
        this.dataCache.clear();
    }
}