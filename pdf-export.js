/* sedoc shared PDF exporter
 * Fixes cut-off / half-view PDFs on every tool by always rendering the document
 * at a fixed A4 width (794px = 210mm @ 96dpi), independent of screen size,
 * scroll position, sticky/flex preview panels or mobile layouts. */
(function (w) {
    var A4_W = 794, A4_H = 1120;

    function waitForImages(root) {
        var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
        return Promise.all(imgs.map(function (img) {
            if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
            return new Promise(function (res) { img.onload = res; img.onerror = res; });
        }));
    }

    /**
     * sedocExportPDF(element, filename, options)
     *   options.padding    - optional CSS padding to force on the page (e.g. '50px 60px')
     *   options.singlePage - true => keep everything on one page (no splitting)
     * Returns a Promise that resolves when the download has been triggered.
     */
    w.sedocExportPDF = function (element, filename, options) {
        options = options || {};
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

        var savedX = w.scrollX, savedY = w.scrollY;
        w.scrollTo(0, 0);

        // 1. Isolated clone with a fixed A4 width
        var clone = element.cloneNode(true);
        var s = clone.style;
        s.width = A4_W + 'px';
        s.minWidth = A4_W + 'px';
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
        s.minHeight = A4_H + 'px'; // just under 297mm so no blank 2nd page
        if (options.padding) s.padding = options.padding;

        // No editing outlines / borders in the PDF
        clone.querySelectorAll('[contenteditable]').forEach(function (el) {
            el.removeAttribute('contenteditable');
            el.style.outline = 'none';
            el.style.boxShadow = 'none';
        });

        // 2. Mount off-screen only to measure the real height
        var holder = document.createElement('div');
        holder.style.cssText = 'position:absolute;left:-12000px;top:0;width:' + A4_W + 'px;background:#fff;';
        holder.appendChild(clone);
        document.body.appendChild(holder);

        return waitForImages(clone).then(function () {
            var H = Math.max(clone.scrollHeight, clone.offsetHeight, options.singlePage ? 0 : A4_H);
            document.body.removeChild(holder);

            var small = (w.innerWidth < 768) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
            var opt = {
                margin: 0,
                filename: filename || 'document.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: small ? 2 : 3,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    scrollX: 0, scrollY: 0, x: 0, y: 0,
                    // Full A4-sized virtual window: nothing can be clipped by the real screen size
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
})(window);
