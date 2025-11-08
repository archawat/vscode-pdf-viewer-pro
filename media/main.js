(function() {
    const vscode = acquireVsCodeApi();
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 0.7;
    let batchImageCreation = false;
    let currentBatchPage = 1;
    let totalBatchPages = 0;

    const container = document.getElementById('pdfContainer');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');
    const zoomLevelSpan = document.getElementById('zoomLevel');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const createImageBtn = document.getElementById('createImage');
    const createImageAllBtn = document.getElementById('createImageAll');
    const imageFormatSelect = document.getElementById('imageFormat');
    const jpegQualitySelect = document.getElementById('jpegQuality');
    const nextPageBtn = document.getElementById('nextPage');
    const prevPageBtn = document.getElementById('prevPage');

    // Load PDF.js from CDN
    const pdfjsScript = document.createElement('script');
    pdfjsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    pdfjsScript.onload = function() {
        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        console.log('PDF.js loaded successfully');
    };
    document.head.appendChild(pdfjsScript);

    function updateUI() {
        currentPageSpan.textContent = pageNum;
        totalPagesSpan.textContent = pdfDoc ? pdfDoc.numPages : 1;
        zoomLevelSpan.textContent = Math.round(scale * 100) + '%';
        
        // Update button states
        if (prevPageBtn) {
            prevPageBtn.disabled = pageNum <= 1;
        }
        if (nextPageBtn) {
            nextPageBtn.disabled = !pdfDoc || pageNum >= pdfDoc.numPages;
        }
    }

    function saveSettings() {
        const settings = {
            imageFormat: imageFormatSelect?.value || 'jpeg',
            jpegQuality: jpegQualitySelect?.value || '0.75'
        };
        vscode.postMessage({
            type: 'saveSettings',
            settings: settings
        });
    }

    function loadSettings() {
        vscode.postMessage({
            type: 'loadSettings'
        });
    }

    function renderPage(num) {
        pageRendering = true;
        
        container.innerHTML = '<div class="loading"><p>Rendering page...</p></div>';

        pdfDoc.getPage(num).then(function(page) {
            const viewport = page.getViewport({ scale: scale });
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);

            renderTask.promise.then(function() {
                pageRendering = false;
                container.innerHTML = '';
                
                const wrapper = document.createElement('div');
                wrapper.className = 'page-wrapper';
                wrapper.appendChild(canvas);
                container.appendChild(wrapper);

                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                } else if (batchImageCreation) {
                    // Trigger batch image creation after page is rendered
                    setTimeout(processBatchImageCreation, 100);
                }
            });
        }).catch(function(error) {
            pageRendering = false;
            container.innerHTML = `<div class="error">Error rendering page: ${error}</div>`;
        });
    }

    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    function onPrevPage() {
        console.log('Previous page clicked, current page:', pageNum);
        if (pageNum <= 1) {
            console.log('Already at first page');
            return;
        }
        pageNum--;
        console.log('Going to page:', pageNum);
        queueRenderPage(pageNum);
        updateUI();
    }

    function onNextPage() {
        console.log('Next page clicked, current page:', pageNum, 'total pages:', pdfDoc ? pdfDoc.numPages : 'unknown');
        if (!pdfDoc || pageNum >= pdfDoc.numPages) {
            console.log('Already at last page or PDF not loaded');
            return;
        }
        pageNum++;
        console.log('Going to page:', pageNum);
        queueRenderPage(pageNum);
        updateUI();
    }

    function zoomIn() {
        scale = Math.min(scale + 0.1, 5.0);
        queueRenderPage(pageNum);
        updateUI();
    }

    function zoomOut() {
        scale = Math.max(scale - 0.1, 0.1);
        queueRenderPage(pageNum);
        updateUI();
    }

    // Helper function to render a page at 100% scale to a canvas for export
    function renderPageForExport(page, format, quality) {
        return new Promise((resolve, reject) => {
            try {
                // Always use scale 1.0 for export to get full quality image
                const viewport = page.getViewport({ scale: 1.0 });

                // Create a temporary canvas for export
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };

                const renderTask = page.render(renderContext);

                renderTask.promise.then(function() {
                    // Convert canvas to base64
                    let dataURL;
                    let extension;

                    if (format === 'png') {
                        dataURL = canvas.toDataURL('image/png');
                        extension = 'png';
                    } else {
                        dataURL = canvas.toDataURL('image/jpeg', quality);
                        extension = 'jpg';
                    }

                    const base64 = dataURL.split(',')[1];
                    resolve({ base64, extension });
                }).catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    function createImage() {
        console.log('createImage() called');

        if (!pdfDoc) {
            console.error('No PDF loaded');
            return;
        }

        const format = imageFormatSelect?.value || 'jpeg';
        const quality = parseFloat(jpegQualitySelect?.value || '0.75');

        console.log('Exporting page', pageNum, 'at 100% scale');

        // Get the current page and render at 100% scale for export
        pdfDoc.getPage(pageNum).then(function(page) {
            return renderPageForExport(page, format, quality);
        }).then(function(result) {
            console.log('Canvas converted to', format, 'quality:', quality, 'length:', result.base64.length);
            console.log('Sending createImage message for page', pageNum);

            vscode.postMessage({
                type: 'createImage',
                data: result.base64,
                page: pageNum,
                format: format,
                extension: result.extension
            });
        }).catch(function(error) {
            console.error('Failed to convert canvas to image:', error);
        });
    }

    function createImageAllPages() {
        console.log('createImageAllPages() called');
        
        if (!pdfDoc) {
            console.error('No PDF loaded');
            return;
        }

        console.log('Sending createImageAllPages message for', pdfDoc.numPages, 'pages');

        vscode.postMessage({
            type: 'createImageAllPages',
            totalPages: pdfDoc.numPages
        });
    }

    function toggleQualitySelector() {
        if (imageFormatSelect && jpegQualitySelect) {
            const isPng = imageFormatSelect.value === 'png';
            jpegQualitySelect.style.display = isPng ? 'none' : 'inline-block';
        }
    }

    // Event listeners
    if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
    if (createImageBtn) createImageBtn.addEventListener('click', createImage);
    if (createImageAllBtn) createImageAllBtn.addEventListener('click', createImageAllPages);
    if (imageFormatSelect) {
        imageFormatSelect.addEventListener('change', function() {
            toggleQualitySelector();
            saveSettings();
        });
    }
    if (jpegQualitySelect) jpegQualitySelect.addEventListener('change', saveSettings);
    if (nextPageBtn) nextPageBtn.addEventListener('click', onNextPage);
    if (prevPageBtn) prevPageBtn.addEventListener('click', onPrevPage);

    document.addEventListener('keydown', function(e) {
        switch(e.key) {
            case 'ArrowLeft':
            case 'PageUp':
                onPrevPage();
                break;
            case 'ArrowRight':
            case 'PageDown':
                onNextPage();
                break;
            case '+':
            case '=':
                zoomIn();
                break;
            case '-':
                zoomOut();
                break;
        }
    });

    // Handle messages from extension
    window.addEventListener('message', function(event) {
        const message = event.data;
        console.log('Received message:', message.type);

        switch (message.type) {
            case 'initialize':
                console.log('Initializing PDF viewer');
                vscode.postMessage({ type: 'requestPage', page: 1 });
                break;
                
            case 'pdfData':
                console.log('Received PDF data, loading...');
                if (typeof pdfjsLib === 'undefined') {
                    container.innerHTML = '<div class="error">PDF.js not loaded yet. Please wait...</div>';
                    return;
                }
                
                const pdfData = Uint8Array.from(atob(message.data), c => c.charCodeAt(0));
                
                pdfjsLib.getDocument({ data: pdfData }).promise.then(function(pdf) {
                    pdfDoc = pdf;
                    console.log('PDF loaded successfully, pages:', pdf.numPages);
                    renderPage(pageNum);
                    updateUI();
                }).catch(function(error) {
                    console.error('Error loading PDF:', error);
                    container.innerHTML = `<div class="error">Error loading PDF: ${error}</div>`;
                });
                break;
                
            case 'error':
                console.error('PDF Error:', message.message);
                container.innerHTML = `<div class="error">Error: ${message.message}</div>`;
                break;
                
            case 'zoomIn':
                zoomIn();
                break;
                
            case 'zoomOut':
                zoomOut();
                break;
                
            case 'startBatchImageCreation':
                console.log('Starting batch image creation for', message.totalPages, 'pages');
                batchImageCreation = true;
                currentBatchPage = 1;
                totalBatchPages = message.totalPages;
                
                // Start with the first page
                if (pageNum !== 1) {
                    pageNum = 1;
                    queueRenderPage(pageNum);
                    updateUI();
                } else {
                    // If already on page 1, start immediately
                    setTimeout(processBatchImageCreation, 100);
                }
                break;
                
            case 'settingsLoaded':
                if (message.settings) {
                    if (imageFormatSelect && message.settings.imageFormat) {
                        imageFormatSelect.value = message.settings.imageFormat;
                    }
                    if (jpegQualitySelect && message.settings.jpegQuality) {
                        jpegQualitySelect.value = message.settings.jpegQuality;
                    }
                    toggleQualitySelector();
                    console.log('Settings loaded:', message.settings);
                }
                break;
        }
    });

    function processBatchImageCreation() {
        if (!batchImageCreation || !pdfDoc) {
            return;
        }

        if (currentBatchPage <= totalBatchPages) {
            const format = imageFormatSelect?.value || 'jpeg';
            const quality = parseFloat(jpegQualitySelect?.value || '0.75');

            console.log('Batch: Exporting page', currentBatchPage, 'at 100% scale');

            // Get the page and render at 100% scale for export
            pdfDoc.getPage(currentBatchPage).then(function(page) {
                return renderPageForExport(page, format, quality);
            }).then(function(result) {
                console.log('Batch: Creating', format, 'for page', currentBatchPage, 'quality:', quality, 'base64 length:', result.base64.length);

                vscode.postMessage({
                    type: 'createImage',
                    data: result.base64,
                    page: currentBatchPage,
                    format: format,
                    extension: result.extension
                });

                // Move to next page
                currentBatchPage++;
                if (currentBatchPage <= totalBatchPages) {
                    // Update displayed page for visual feedback
                    pageNum = currentBatchPage;
                    queueRenderPage(pageNum);
                    updateUI();

                    // Continue with next page after a short delay
                    setTimeout(processBatchImageCreation, 500);
                } else {
                    // Batch creation complete
                    batchImageCreation = false;
                    console.log('Batch image creation completed');
                }
            }).catch(function(error) {
                console.error('Batch: Failed to convert page to image:', error);
                batchImageCreation = false;
            });
        }
    }

    // Initial setup
    container.innerHTML = '<div class="loading"><p>Loading PDF...</p></div>';
    console.log('PDF viewer initialized, waiting for messages...');
    vscode.postMessage({ type: 'ready' });
    
    // Load saved settings
    loadSettings();
})();