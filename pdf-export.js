/* sedoc shared PDF exporter (v2 - print quality)
 *
 * 1) sedocExportPDF(element, filename, options)
 *    One-click PDF download. Always renders the document at a fixed A4 width
 *    (794px = 210mm @ 96dpi) so nothing is cut off on any screen, and now at a
 *    much higher resolution (about 300-400 dpi on A4) that adapts to the device
 *    so phones don't run out of memory.
 *
 * 2) sedocPrintPDF(element, filename, options)
 *    Sharpest possible output. Prints ONLY the document through the browser's
 *    own print engine (true vector text, selectable, perfect on paper). The user
 *    picks "Save as PDF" or a real printer in the print dialog.
 *
 * A "Print / Save Sharp PDF" button is injected automatically next to the
 * existing "Download Now" button (#downloadNowBtn) on every tool page.
 */
(function (w) {
    var A4_W = 794;      // 210mm @ 96dpi
    var A4_H = 1120;     // just under 297mm so no blank 2nd page
    var PAPER_IDS = ['slip-paper', 'letter-paper', 'resume-paper', 'printArea'];

    /* ---------- helpers ---------- */

    function isMobile() {
        return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
            w.innerWidth < 768 ||
            !!(navigator.deviceMemory && navigator.deviceMemory <= 4);
    }

    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function withTimeout(promise, ms) {
        return Promise.race([promise, new Promise(function (res) { setTimeout(res, ms); })]);
    }

    function fontsReady(doc) {
        var d = doc || document;
        return withTimeout((d.fonts && d.fonts.ready) ? d.fonts.ready : Promise.resolve(), 5000);
    }

    function waitForImages(root) {
        var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
        return withTimeout(Promise.all(imgs.map(function (img) {
            if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
            return new Promise(function (res) { img.onload = res; img.onerror = res; });
        })), 8000);
    }

    /* Pick the highest scale the device can safely render.
     * ~3.2x = 300dpi on A4. Desktop goes up to 4x (~385dpi).
     * Canvas area is budgeted so iOS/Android never hit their canvas limits. */
    function pickScale(height) {
        var mobile = isMobile();
        var target = mobile ? 3.2 : 4;
        var budget = mobile ? 16000000 : 60000000;      // max canvas pixels
        var byArea = Math.sqrt(budget / (A4_W * height));
        var byEdge = 15000 / height;                    // max canvas edge
        var s = Math.min(target, byArea, byEdge);
        return Math.max(2, Math.floor(s * 10) / 10);
    }

    /* Isolated clone of the paper with fixed A4 width, no editing UI */
    function prepareClone(element, options, forPrint) {
        options = options || {};
        var clone = element.cloneNode(true);
        var s = clone.style;
        s.width = forPrint ? '210mm' : A4_W + 'px';
        s.minWidth = forPrint ? '210mm' : A4_W + 'px';
        s.maxWidth = 'none';
        s.margin = '0';
        s.transform = 'none';
        s.boxShadow = 'none';
        s.boxSizing = 'border-box';
        s.overflow = 'visible';
        s.height = 'auto';
        s.maxHeight = 'none';
        s.aspectRatio = 'auto';
        s.position = 'relative';
        s.left = '0'; s.top = '0';
        s.backgroundColor = s.backgroundColor || '#ffffff';
        s.minHeight = forPrint ? '296mm' : A4_H + 'px';
        if (options.padding) s.padding = options.padding;

        clone.removeAttribute('contenteditable');
        clone.style.outline = 'none';
        clone.querySelectorAll('[contenteditable]').forEach(function (el) {
            el.removeAttribute('contenteditable');
            el.style.outline = 'none';
            el.style.boxShadow = 'none';
        });
        return clone;
    }

    /* ---------- 1) High-resolution PDF download ---------- */

    w.sedocExportPDF = function (element, filename, options) {
        options = options || {};
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

        var savedX = w.scrollX, savedY = w.scrollY;
        w.scrollTo(0, 0);

        var clone = prepareClone(element, options, false);

        // Mount off-screen only to measure the real height
        var holder = document.createElement('div');
        holder.style.cssText = 'position:absolute;left:-12000px;top:0;width:' + A4_W + 'px;background:#fff;';
        holder.appendChild(clone);
        document.body.appendChild(holder);

        return fontsReady().then(function () {
            return waitForImages(clone);
        }).then(function () {
            var H = Math.max(clone.scrollHeight, clone.offsetHeight, options.singlePage ? 0 : A4_H);
            document.body.removeChild(holder);

            var scale = pickScale(H);
            var opt = {
                margin: 0,
                filename: filename || 'document.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: scale,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    scrollX: 0, scrollY: 0, x: 0, y: 0,
                    windowWidth: A4_W,
                    windowHeight: H + 40
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
                pagebreak: options.singlePage
                    ? { mode: 'avoid-all' }
                    : { mode: ['css', 'legacy'], avoid: ['tr', '.avoid-break', '.no-break'] }
            };
            return html2pdf().set(opt).from(clone).save();
        }).then(function () {
            w.scrollTo(savedX, savedY);
        }, function (err) {
            if (holder.parentNode) holder.parentNode.removeChild(holder);
            w.scrollTo(savedX, savedY);
            console.error('PDF export failed', err);
            throw err;
        });
    };

    /* ---------- 2) Vector print / Save as PDF ---------- */

    // Copy the page's own CSS (without its @media print rules, which hide
    // everything except the live preview) into the print frame.
    function collectStyles() {
        var out = [];
        Array.prototype.slice.call(document.styleSheets).forEach(function (sheet) {
            var owner = sheet.ownerNode;
            if (owner && owner.tagName === 'LINK') {
                if (sheet.href) out.push('<link rel="stylesheet" href="' + sheet.href + '">');
                return;
            }
            try {
                var css = '';
                Array.prototype.slice.call(sheet.cssRules).forEach(function (r) {
                    if (r.type === 4 /* MEDIA_RULE */ && /print/i.test(r.media ? r.media.mediaText : '')) return;
                    if (r.type === 6 /* PAGE_RULE */) return;
                    css += r.cssText + '\n';
                });
                out.push('<style>' + css + '</style>');
            } catch (e) {
                if (owner && owner.outerHTML) out.push(owner.outerHTML);
            }
        });
        return out.join('\n');
    }

    var PRINT_CSS =
        '@page{size:A4 portrait;margin:0}' +
        'html{height:auto!important;overflow:visible!important;background:#fff!important}' +
        'body{display:block!important;margin:0!important;padding:0!important;width:auto!important;max-width:none!important;' +
        'height:auto!important;min-height:0!important;overflow:visible!important;background:#fff!important}' +
        '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
        'tr,.avoid-break,.no-break{break-inside:avoid;page-break-inside:avoid}';

    function niceName(filename) {
        var base = (filename || '').replace(/\.pdf$/i, '');
        if (!base) {
            var seg = (location.pathname.split('/').pop() || 'document').replace(/\.html$/i, '');
            base = seg.split('-').map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join('_') || 'Document';
        }
        return base;
    }

    w.sedocPrintPDF = function (element, filename, options) {
        options = options || {};
        return new Promise(function (resolve, reject) {
            var name = niceName(filename);
            var iframe = document.createElement('iframe');
            iframe.setAttribute('aria-hidden', 'true');
            iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + A4_W + 'px;height:' + A4_H + 'px;border:0;';
            document.body.appendChild(iframe);

            var cleaned = false;
            var oldTitle = document.title;
            function cleanup() {
                if (cleaned) return;
                cleaned = true;
                document.title = oldTitle;
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            }

            try {
                var clone = prepareClone(element, options, true);
                var idoc = iframe.contentWindow.document;
                idoc.open();
                idoc.write('<!DOCTYPE html><html><head><meta charset="utf-8">' +
                    '<base href="' + location.href.replace(/"/g, '&quot;') + '">' +
                    '<title>' + name.replace(/</g, '') + '</title>' +
                    collectStyles() +
                    '<style>' + PRINT_CSS + '</style></head><body></body></html>');
                idoc.close();
                idoc.body.appendChild(idoc.importNode(clone, true));

                var links = Array.prototype.slice.call(idoc.querySelectorAll('link[rel="stylesheet"]'));
                var linksLoaded = withTimeout(Promise.all(links.map(function (l) {
                    return new Promise(function (res) {
                        if (l.sheet) return res();
                        l.onload = res; l.onerror = res;
                    });
                })), 6000);

                linksLoaded.then(function () {
                    return fontsReady(idoc);
                }).then(function () {
                    return waitForImages(idoc.body);
                }).then(function () {
                    return new Promise(function (res) { setTimeout(res, 350); });
                }).then(function () {
                    var win = iframe.contentWindow;
                    document.title = name;               // suggested file name in "Save as PDF"
                    win.onafterprint = function () { setTimeout(cleanup, 500); };
                    win.focus();
                    win.print();
                    setTimeout(cleanup, 60000);           // safety net
                    resolve();
                }).catch(function (err) {
                    cleanup();
                    reject(err);
                });
            } catch (err) {
                cleanup();
                reject(err);
            }
        });
    };

    /* ---------- auto-inject the "Print / Save Sharp PDF" button ---------- */

    function findPaper() {
        for (var i = 0; i < PAPER_IDS.length; i++) {
            var el = document.getElementById(PAPER_IDS[i]);
            if (el) return el;
        }
        return null;
    }

    function injectPrintButton() {
        var dlBtn = document.getElementById('downloadNowBtn');
        if (!dlBtn || document.getElementById('downloadPrintBtn')) return;
        if (isIOS()) return;   // iOS Safari can't print a hidden frame reliably; keep the HD download only

        var style = document.createElement('style');
        style.textContent =
            '.sedoc-print-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:10px;' +
            'padding:13px 16px;border-radius:12px;border:1.5px solid #cbd5e1;background:#fff;color:#0f172a;' +
            'font-weight:700;font-size:0.95rem;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s}' +
            '.sedoc-print-btn:hover{background:#f1f5f9;border-color:#94a3b8}' +
            '.sedoc-print-btn:disabled{opacity:.6;cursor:wait}' +
            '.sedoc-print-hint{margin:8px 0 0!important;font-size:.75rem!important;line-height:1.4!important;color:#64748b!important}';
        document.head.appendChild(style);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'downloadPrintBtn';
        btn.className = 'sedoc-print-btn';
        btn.innerHTML = '<i class="fas fa-print"></i> Print / Save Sharp PDF';

        var hint = document.createElement('p');
        hint.className = 'sedoc-print-hint';
        hint.textContent = 'Best for printing: opens the print dialog. Choose "Save as PDF" or your printer.';

        dlBtn.parentNode.insertBefore(btn, dlBtn.nextSibling);
        btn.parentNode.insertBefore(hint, btn.nextSibling);

        btn.addEventListener('click', function () {
            var paper = findPaper();
            if (!paper) return;
            var label = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
            w.sedocPrintPDF(paper).then(function () {
                var overlay = document.getElementById('downloadOverlay');
                if (overlay) overlay.classList.remove('active');
            }, function (e) {
                console.error('Print failed', e);
                alert('Could not open the print dialog. Please use "Download Now" instead.');
            }).then(function () {
                btn.disabled = false;
                btn.innerHTML = label;
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectPrintButton);
    } else {
        injectPrintButton();
    }
})(window);
