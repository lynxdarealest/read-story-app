import JSZip from 'jszip';
import { Book, Chapter } from '../types';

/**
 * Clean up text content and format for TXT export
 */
export function exportBookToTXT(book: Book, chapters: Chapter[]): void {
  const sortedChapters = [...chapters].sort((a, b) => a.chapterIndex - b.chapterIndex);

  let output = `${book.title}\n`;
  if (book.author) {
    output += `Tác giả: ${book.author}\n`;
  }
  if (book.description) {
    output += `\n${book.description}\n`;
  }
  output += `\n${'='.repeat(40)}\n\n`;

  for (let i = 0; i < sortedChapters.length; i++) {
    const ch = sortedChapters[i];
    output += `${ch.title}\n\n`;
    output += `${ch.content.trim()}\n\n`;
    if (i < sortedChapters.length - 1) {
      output += `${'-'.repeat(30)}\n\n`;
    }
  }

  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(book.title)}.txt`);
}

/**
 * Generate a valid, compliant EPUB 3 document with chapters and metadata
 */
export async function exportBookToEPUB(book: Book, chapters: Chapter[]): Promise<void> {
  const zip = new JSZip();
  const sortedChapters = [...chapters].sort((a, b) => a.chapterIndex - b.chapterIndex);
  const bookId = `urn:uuid:${book.id}`;
  const title = escapeXML(book.title || 'Truyện chữ');
  const author = escapeXML(book.author || 'Khuyết danh');
  const language = 'vi';

  // 1. mimetype (Must be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.folder('META-INF')?.file('container.xml', containerXml);

  const oebps = zip.folder('OEBPS');
  if (!oebps) throw new Error('Không thể khởi tạo cấu trúc EPUB');

  // 3. Stylesheet
  const css = `
body {
  font-family: serif;
  margin: 5%;
  line-height: 1.8;
  color: #1a1a1a;
  background-color: #faf9f5;
}
h1, h2 {
  text-align: center;
  font-weight: bold;
  margin-top: 1.5em;
  margin-bottom: 1em;
}
p {
  text-indent: 1.5em;
  margin-top: 0;
  margin-bottom: 0.8em;
  text-align: justify;
}
`;
  oebps.file('stylesheet.css', css);

  // 4. Chapter XHTML files
  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  const navListItems: string[] = [];
  const ncxNavPoints: string[] = [];

  for (let i = 0; i < sortedChapters.length; i++) {
    const ch = sortedChapters[i];
    const filename = `chapter_${i + 1}.xhtml`;
    const itemId = `chapter_${i + 1}`;
    const chTitle = escapeXML(ch.title || `Chương ${i + 1}`);

    // Parse paragraphs
    const paragraphs = ch.content
      .split(/\r?\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const bodyHtml = paragraphs.map((p) => `    <p>${escapeXML(p)}</p>`).join('\n');

    const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>${chTitle}</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <h2>${chTitle}</h2>
${bodyHtml}
</body>
</html>`;

    oebps.file(filename, xhtml);

    manifestItems.push(`    <item id="${itemId}" href="${filename}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`    <itemref idref="${itemId}"/>`);
    navListItems.push(`      <li><a href="${filename}">${chTitle}</a></li>`);
    ncxNavPoints.push(`    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${chTitle}</text></navLabel>
      <content src="${filename}"/>
    </navPoint>`);
  }

  // 5. Navigation Document (EPUB 3 nav.xhtml)
  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Mục lục</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Mục lục</h1>
    <ol>
${navListItems.join('\n')}
    </ol>
  </nav>
</body>
</html>`;
  oebps.file('nav.xhtml', navXhtml);

  // 6. NCX Table of Contents (for backwards EPUB 2 compatibility)
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${title}</text></docTitle>
  <docAuthor><text>${author}</text></docAuthor>
  <navMap>
${ncxNavPoints.join('\n')}
  </navMap>
</ncx>`;
  oebps.file('toc.ncx', tocNcx);

  // 7. content.opf Package Document
  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${bookId}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>${language}</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.[0-9]+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="css" href="stylesheet.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems.join('\n')}
  </manifest>
  <spine toc="ncx">
${spineItems.join('\n')}
  </spine>
</package>`;
  oebps.file('content.opf', contentOpf);

  // Generate EPUB Blob
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  triggerDownload(blob, `${sanitizeFilename(book.title)}.epub`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Truyen_TaiVe';
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
