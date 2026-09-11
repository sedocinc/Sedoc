# Sedoc

**Live site:** [www.thesedoc.com](https://www.thesedoc.com)

Sedoc is a free, browser-based platform for generating everyday HR and finance
documents instantly — no sign-up, no installs, and nothing saved on a server.
Everything runs client-side in plain HTML/CSS/JS and exports straight to PDF.

## Tools

| Tool | File |
|---|---|
| Resume Builder | `resume-builder.html` |
| Salary Slip Generator | `salary-slip.html` |
| Offer Letter Maker | `offer-letter.html` |
| Experience Letter Maker | `experience-letter.html` |
| Warning Letter Maker | `warning-letter.html` |
| KPI Sheet Maker | `kpi-sheet.html` |
| Invoice Generator | `invoice-generator.html` |
| Quotation Maker | `quotation-maker.html` |
| GST / VAT Calculator | `tax-calculator.html` |

## Stack

- Static HTML, CSS, and vanilla JavaScript — no build step, no framework.
- PDF export via [html2pdf.js](https://github.com/eKoopmans/html2PDF.js).
- Hosted on GitHub Pages, served at the custom domain `www.thesedoc.com`
  (see `CNAME`).
- `sitemap.xml` / `robots.txt` are included for search indexing.

## Local development

This is a static site — clone the repo and open any `.html` file directly in
a browser, or serve the folder with any static file server:

```bash
git clone https://github.com/sedocinc/Sedoc.git
cd Sedoc
python3 -m http.server 8000
```

## Privacy

All document generation happens in the browser. User-entered data is never
uploaded to or stored on a server — see `privacy-policy.html` for details.

## License

© Sedoc. All rights reserved.
