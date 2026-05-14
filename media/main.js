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
    let currentPdfUrl = null;
    let currentPdfBytes = null;

    // Search state
    let searchResults = [];
    let currentMatchIndex = -1;
    let allPagesTextContent = {};

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
    const imageScaleSelect = document.getElementById('imageScale');
    const nextPageBtn = document.getElementById('nextPage');
    const prevPageBtn = document.getElementById('prevPage');
    const passwordOverlay = document.getElementById('passwordOverlay');
    const passwordInput = document.getElementById('passwordInput');
    const passwordSubmit = document.getElementById('passwordSubmit');
    const passwordError = document.getElementById('passwordError');
    const printPdfBtn = document.getElementById('printPdf');
    const searchBar = document.getElementById('searchBar');
    const searchInput = document.getElementById('searchInput');
    const searchInfo = document.getElementById('searchInfo');
    const searchPrevBtn = document.getElementById('searchPrev');
    const searchNextBtn = document.getElementById('searchNext');
    const searchCloseBtn = document.getElementById('searchClose');

    // Configure PDF.js worker — fetch as blob so the Worker URL is same-origin.
    // Without this, the cross-origin vscode-resource URL fails Worker construction
    // and PDF.js silently falls back to parsing on the UI thread (very slow).
    const workerUri = document.body.getAttribute('data-worker-uri');
    const workerReady = fetch(workerUri)
        .then(function(r) { return r.blob(); })
        .then(function(blob) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
            console.log('PDF.js worker ready (blob URL)');
        })
        .catch(function(e) {
            console.error('Worker blob init failed; falling back to direct URL:', e);
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerUri;
        });

    function updateUI() {
        currentPageSpan.textContent = pageNum;
        totalPagesSpan.textContent = pdfDoc ? pdfDoc.numPages : 1;
        zoomLevelSpan.textContent = Math.round(scale * 100) + '%';

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
            jpegQuality: jpegQualitySelect?.value || '0.75',
            imageScale: imageScaleSelect?.value || '2'
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

    function isPasswordError(error) {
        return error.name === 'PasswordException'
            || (error.message && error.message.indexOf('password') !== -1)
            || (String(error).indexOf('PasswordException') !== -1);
    }

    function showPasswordOverlay(errorMsg) {
        container.innerHTML = '';
        if (passwordOverlay) {
            passwordOverlay.style.display = 'flex';
            if (passwordInput) {
                passwordInput.value = '';
                setTimeout(function() { passwordInput.focus(); }, 100);
            }
            if (passwordError) {
                if (errorMsg) {
                    passwordError.textContent = errorMsg;
                    passwordError.style.display = 'block';
                } else {
                    passwordError.style.display = 'none';
                }
            }
        }
    }

    function hidePasswordOverlay() {
        if (passwordOverlay) {
            passwordOverlay.style.display = 'none';
        }
        if (passwordError) {
            passwordError.style.display = 'none';
        }
    }

    function setLoadingMessage(text) {
        container.innerHTML = '<div class="loading"><p>' + text + '</p></div>';
    }

    function loadPdfWithPassword(password) {
        if (!currentPdfUrl) return;

        const bytesPromise = currentPdfBytes
            ? Promise.resolve(currentPdfBytes)
            : (setLoadingMessage('Fetching PDF...'),
               console.log('Fetching', currentPdfUrl),
               fetch(currentPdfUrl)
                .then(function(r) {
                    console.log('Fetch response status:', r.status);
                    if (!r.ok) throw new Error('Fetch failed: HTTP ' + r.status);
                    return r.arrayBuffer();
                })
                .then(function(buf) {
                    console.log('Fetched bytes:', buf.byteLength);
                    currentPdfBytes = new Uint8Array(buf);
                    return currentPdfBytes;
                }));

        Promise.all([workerReady, bytesPromise]).then(function(results) {
            const bytes = results[1];
            setLoadingMessage('Parsing PDF...');
            const opts = { data: bytes.slice() };
            if (password) {
                opts.password = password;
            }
            console.time('pdf-parse');
            return pdfjsLib.getDocument(opts).promise;
        }).then(function(pdf) {
            console.timeEnd('pdf-parse');
            pdfDoc = pdf;
            hidePasswordOverlay();
            if (password) {
                vscode.postMessage({ type: 'passwordProvided', password: password });
            }
            renderPage(pageNum);
            updateUI();
        }).catch(function(error) {
            if (error.name === 'PasswordException') {
                if (!password) {
                    showPasswordOverlay();
                } else {
                    showPasswordOverlay('Incorrect password. Please try again.');
                }
            } else {
                hidePasswordOverlay();
                container.innerHTML = '<div class="error">Error loading PDF: ' + error + '</div>';
            }
        });
    }

    function renderPage(num) {
        pageRendering = true;

        container.innerHTML = '<div class="loading"><p>Rendering page...</p></div>';

        pdfDoc.getPage(num).then(function(page) {
            const dpr = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale: scale * dpr });
            const cssViewport = page.getViewport({ scale: scale });

            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.width = (viewport.width / dpr) + 'px';
            canvas.style.height = (viewport.height / dpr) + 'px';

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
                wrapper.style.width = (viewport.width / dpr) + 'px';
                wrapper.style.height = (viewport.height / dpr) + 'px';
                wrapper.appendChild(canvas);

                // Create text layer for text selection
                const textLayerDiv = document.createElement('div');
                textLayerDiv.className = 'textLayer';
                textLayerDiv.style.setProperty('--scale-factor', String(scale));
                wrapper.appendChild(textLayerDiv);

                container.appendChild(wrapper);

                // Render text layer
                page.getTextContent().then(function(textContent) {
                    pdfjsLib.renderTextLayer({
                        textContent: textContent,
                        container: textLayerDiv,
                        viewport: cssViewport
                    });
                    // Re-highlight search matches after text layer renders
                    setTimeout(highlightCurrentMatch, 50);
                });

                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                } else if (batchImageCreation) {
                    setTimeout(processBatchImageCreation, 100);
                }
            });
        }).catch(function(error) {
            pageRendering = false;
            container.innerHTML = '<div class="error">Error rendering page: ' + error + '</div>';
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
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
        updateUI();
    }

    function onNextPage() {
        if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
        pageNum++;
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

    // Render a page to a canvas for export. exportScale (e.g. 2 = 144 DPI).
    function renderPageForExport(page, format, quality, exportScale) {
        return new Promise((resolve, reject) => {
            try {
                const viewport = page.getViewport({ scale: exportScale });
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
        if (!pdfDoc) return;

        const format = imageFormatSelect?.value || 'jpeg';
        const quality = parseFloat(jpegQualitySelect?.value || '0.75');
        const exportScale = parseFloat(imageScaleSelect?.value || '2');

        pdfDoc.getPage(pageNum).then(function(page) {
            return renderPageForExport(page, format, quality, exportScale);
        }).then(function(result) {
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
        if (!pdfDoc) return;

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

    // --- Search functions ---

    function toggleSearchBar() {
        if (!searchBar) return;
        if (searchBar.style.display === 'none') {
            searchBar.style.display = 'flex';
            document.body.classList.add('search-open');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        } else {
            closeSearchBar();
        }
    }

    function closeSearchBar() {
        if (searchBar) searchBar.style.display = 'none';
        document.body.classList.remove('search-open');
        clearSearchHighlights();
        searchResults = [];
        currentMatchIndex = -1;
        if (searchInfo) searchInfo.textContent = '0 of 0';
    }

    function getAllTextContent() {
        if (!pdfDoc) return Promise.resolve();
        var promises = [];
        for (var i = 1; i <= pdfDoc.numPages; i++) {
            if (!allPagesTextContent[i]) {
                (function(pageIdx) {
                    promises.push(
                        pdfDoc.getPage(pageIdx).then(function(page) {
                            return page.getTextContent().then(function(tc) {
                                allPagesTextContent[pageIdx] = tc;
                            });
                        })
                    );
                })(i);
            }
        }
        return Promise.all(promises);
    }

    function performSearch(query) {
        if (!query || !pdfDoc) {
            searchResults = [];
            currentMatchIndex = -1;
            if (searchInfo) searchInfo.textContent = '0 of 0';
            clearSearchHighlights();
            return;
        }

        getAllTextContent().then(function() {
            searchResults = [];
            var lowerQuery = query.toLowerCase();

            for (var pageIdx = 1; pageIdx <= pdfDoc.numPages; pageIdx++) {
                var textContent = allPagesTextContent[pageIdx];
                if (!textContent || !textContent.items) continue;

                var fullText = '';
                var itemPositions = [];

                for (var i = 0; i < textContent.items.length; i++) {
                    var item = textContent.items[i];
                    var startPos = fullText.length;
                    fullText += item.str;
                    for (var c = 0; c < item.str.length; c++) {
                        itemPositions.push({ itemIndex: i, charIndex: c });
                    }
                }

                var lowerText = fullText.toLowerCase();
                var searchPos = 0;
                while (true) {
                    var idx = lowerText.indexOf(lowerQuery, searchPos);
                    if (idx === -1) break;
                    searchResults.push({
                        pageNum: pageIdx,
                        itemPositions: itemPositions.slice(idx, idx + query.length)
                    });
                    searchPos = idx + 1;
                }
            }

            if (searchResults.length > 0) {
                currentMatchIndex = 0;
                if (searchInfo) searchInfo.textContent = '1 of ' + searchResults.length;
                navigateToMatch(0);
            } else {
                currentMatchIndex = -1;
                if (searchInfo) searchInfo.textContent = '0 of 0';
                clearSearchHighlights();
            }
        });
    }

    function navigateToMatch(index) {
        if (index < 0 || index >= searchResults.length) return;
        currentMatchIndex = index;
        if (searchInfo) searchInfo.textContent = (index + 1) + ' of ' + searchResults.length;

        var match = searchResults[index];
        if (match.pageNum !== pageNum) {
            pageNum = match.pageNum;
            queueRenderPage(pageNum);
            updateUI();
        } else {
            highlightCurrentMatch();
        }
    }

    function highlightCurrentMatch() {
        clearSearchHighlights();
        if (currentMatchIndex < 0 || !searchResults.length) return;

        var textLayerDiv = document.querySelector('.textLayer');
        if (!textLayerDiv) return;

        var spans = textLayerDiv.querySelectorAll('span');
        if (!spans.length) return;

        var currentPageMatches = searchResults.filter(function(m) {
            return m.pageNum === pageNum;
        });

        currentPageMatches.forEach(function(match) {
            var isActive = searchResults[currentMatchIndex] === match;
            var highlightedItems = {};

            match.itemPositions.forEach(function(pos) {
                if (pos.itemIndex < spans.length && !highlightedItems[pos.itemIndex]) {
                    highlightedItems[pos.itemIndex] = true;
                    var span = spans[pos.itemIndex];
                    span.classList.add('search-highlight');
                    if (isActive) {
                        span.classList.add('active');
                    }
                }
            });

            if (isActive) {
                // Scroll active match into view
                var activeSpan = textLayerDiv.querySelector('.search-highlight.active');
                if (activeSpan) {
                    activeSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    }

    function clearSearchHighlights() {
        var highlights = document.querySelectorAll('.search-highlight');
        highlights.forEach(function(el) {
            el.classList.remove('search-highlight', 'active');
        });
    }

    function searchNext() {
        if (searchResults.length === 0) return;
        navigateToMatch((currentMatchIndex + 1) % searchResults.length);
    }

    function searchPrevious() {
        if (searchResults.length === 0) return;
        navigateToMatch((currentMatchIndex - 1 + searchResults.length) % searchResults.length);
    }

    // --- Event listeners ---

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
    if (imageScaleSelect) imageScaleSelect.addEventListener('change', saveSettings);
    if (nextPageBtn) nextPageBtn.addEventListener('click', onNextPage);
    if (prevPageBtn) prevPageBtn.addEventListener('click', onPrevPage);
    if (printPdfBtn) printPdfBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'printPdf' });
    });
    if (passwordSubmit) {
        passwordSubmit.addEventListener('click', function() {
            const pw = passwordInput ? passwordInput.value : '';
            if (pw) loadPdfWithPassword(pw);
        });
    }
    if (passwordInput) {
        passwordInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const pw = passwordInput.value;
                if (pw) loadPdfWithPassword(pw);
            }
        });
    }

    // Search event listeners
    if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeSearchBar);
    if (searchNextBtn) searchNextBtn.addEventListener('click', searchNext);
    if (searchPrevBtn) searchPrevBtn.addEventListener('click', searchPrevious);
    if (searchInput) {
        var searchTimeout = null;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
                performSearch(searchInput.value);
            }, 300);
        });
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    searchPrevious();
                } else {
                    searchNext();
                }
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                closeSearchBar();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        // Ctrl+F / Cmd+F for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            toggleSearchBar();
            return;
        }
        // Ctrl+P / Cmd+P for print
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            vscode.postMessage({ type: 'printPdf' });
            return;
        }
        // Don't handle navigation keys when search input is focused
        if (document.activeElement === searchInput) return;
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
                console.log('Received PDF url, loading...');
                currentPdfUrl = message.url;
                currentPdfBytes = null;
                allPagesTextContent = {};
                searchResults = [];
                currentMatchIndex = -1;
                loadPdfWithPassword(message.password || null);
                break;

            case 'error':
                console.error('PDF Error:', message.message);
                container.innerHTML = '<div class="error">Error: ' + message.message + '</div>';
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

                if (pageNum !== 1) {
                    pageNum = 1;
                    queueRenderPage(pageNum);
                    updateUI();
                } else {
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
                    if (imageScaleSelect && message.settings.imageScale) {
                        imageScaleSelect.value = message.settings.imageScale;
                    }
                    toggleQualitySelector();
                }
                break;
        }
    });

    function processBatchImageCreation() {
        if (!batchImageCreation || !pdfDoc) return;

        if (currentBatchPage <= totalBatchPages) {
            const format = imageFormatSelect?.value || 'jpeg';
            const quality = parseFloat(jpegQualitySelect?.value || '0.75');
            const exportScale = parseFloat(imageScaleSelect?.value || '2');

            pdfDoc.getPage(currentBatchPage).then(function(page) {
                return renderPageForExport(page, format, quality, exportScale);
            }).then(function(result) {
                vscode.postMessage({
                    type: 'createImage',
                    data: result.base64,
                    page: currentBatchPage,
                    format: format,
                    extension: result.extension
                });

                currentBatchPage++;
                if (currentBatchPage <= totalBatchPages) {
                    pageNum = currentBatchPage;
                    queueRenderPage(pageNum);
                    updateUI();
                    setTimeout(processBatchImageCreation, 500);
                } else {
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

    loadSettings();
})();
