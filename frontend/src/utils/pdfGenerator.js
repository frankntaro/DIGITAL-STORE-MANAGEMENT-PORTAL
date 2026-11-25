import { formatDate, formatQtyNumber, formatQtyWithUnit, formatTZS, printHtmlDocument } from './format.js';

// ============================================================================
// PURE-JS BINARY PDF 1.4 GENERATOR (ZERO EXTERNAL DEPENDENCIES, 100% OFFLINE)
// Generates crisp, multi-page A4 Landscape PDF documents with exact byte xrefs
// for Downloading and Sharing Missing Ordered Products reports.
// ============================================================================

const PAGE_W = 842; // A4 Landscape width in pt
const PAGE_H = 595; // A4 Landscape height in pt
const MARGIN_X = 36;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 770pt

function sanitizePdfText(value) {
  return String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00D7/g, 'x')
    .replace(/\u2192/g, '->')
    .replace(/\u2022/g, '*')
    .replace(/\u00B7/g, '|')
    .replace(/\u2713|\u2714/g, 'OK')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pdfStr(value) {
  const clean = sanitizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  return `(${clean})`;
}

// Approximate character width in Helvetica (average ~0.52 * fontSize)
function approxTextWidth(text, fontSize, bold = false) {
  const clean = sanitizePdfText(text);
  let w = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if ('ilIjtf.,:;!|\' '.includes(ch)) w += 0.28;
    else if ('mwMW@%#'.includes(ch)) w += 0.82;
    else if (ch >= 'A' && ch <= 'Z') w += 0.66;
    else if (ch >= '0' && ch <= '9') w += 0.56;
    else w += 0.52;
  }
  return w * fontSize * (bold ? 1.05 : 1.0);
}

function truncateText(text, maxWidth, fontSize, bold = false) {
  const clean = sanitizePdfText(text);
  if (approxTextWidth(clean, fontSize, bold) <= maxWidth) return clean;
  let out = clean;
  while (out.length > 3 && approxTextWidth(`${out}...`, fontSize, bold) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out.trim()}...`;
}

function wrapText(text, maxWidth, fontSize, maxLines = 2, bold = false) {
  const clean = sanitizePdfText(text);
  if (!clean) return [''];
  if (approxTextWidth(clean, fontSize, bold) <= maxWidth) return [clean];

  const words = clean.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (approxTextWidth(candidate, fontSize, bold) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        current = word;
      } else {
        lines.push(truncateText(word, maxWidth, fontSize, bold));
        current = '';
      }
      if (lines.length === maxLines - 1) break;
    }
  }

  const usedWordCount = lines.join(' ').split(' ').filter(Boolean).length;
  if (lines.length < maxLines) {
    const remainder = words.slice(usedWordCount).join(' ');
    if (remainder) {
      lines.push(truncateText(remainder, maxWidth, fontSize, bold));
    } else if (current && !lines.includes(current)) {
      lines.push(truncateText(current, maxWidth, fontSize, bold));
    }
  }

  return lines.length ? lines.slice(0, maxLines) : [truncateText(clean, maxWidth, fontSize, bold)];
}

function drawRect(ops, x, yTop, w, h, fillRgb = null, strokeRgb = null, lineWidth = 0.6) {
  const yBottom = PAGE_H - yTop - h;
  ops.push('q');
  if (fillRgb) ops.push(`${fillRgb} rg`);
  if (strokeRgb) {
    ops.push(`${strokeRgb} RG`);
    ops.push(`${lineWidth} w`);
  }
  ops.push(`${x.toFixed(2)} ${yBottom.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
  if (fillRgb && strokeRgb) ops.push('B');
  else if (fillRgb) ops.push('f');
  else if (strokeRgb) ops.push('S');
  ops.push('Q');
}

function drawLine(ops, x1, yTop1, x2, yTop2, strokeRgb = '0.80 0.84 0.88', lineWidth = 0.6) {
  const y1 = PAGE_H - yTop1;
  const y2 = PAGE_H - yTop2;
  ops.push(`q ${strokeRgb} RG ${lineWidth} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
}

function drawText(ops, text, x, yTop, fontSize = 9, options = {}) {
  const { bold = false, rgb = '0.06 0.09 0.16', align = 'left', maxWidth = null } = options;
  const font = bold ? '/F2' : '/F1';
  const rendered = maxWidth ? truncateText(text, maxWidth, fontSize, bold) : sanitizePdfText(text);
  let tx = x;
  if (align === 'right') {
    tx = x - approxTextWidth(rendered, fontSize, bold);
  } else if (align === 'center') {
    tx = x - approxTextWidth(rendered, fontSize, bold) / 2;
  }
  const ty = PAGE_H - yTop;
  ops.push(`BT ${font} ${fontSize} Tf ${rgb} rg ${tx.toFixed(2)} ${ty.toFixed(2)} Td ${pdfStr(rendered)} Tj ET`);
}

function assemblePdfDocument(pageStreams) {
  const encoder = new TextEncoder();
  const chunks = [];
  let offset = 0;

  const pushStr = (s) => {
    const bytes = encoder.encode(s);
    chunks.push(bytes);
    offset += bytes.length;
  };

  // Object numbering:
  // 1: Catalog, 2: Pages, 3: Font Helvetica (/F1), 4: Font Helvetica-Bold (/F2)
  // For each page i (0..N-1):
  //   pageObjId = 5 + i*2
  //   streamObjId = 6 + i*2
  const totalObjects = 4 + pageStreams.length * 2;
  const xrefOffsets = new Array(totalObjects + 1).fill(0);

  pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const writeObj = (objNum, bodyStr) => {
    xrefOffsets[objNum] = offset;
    pushStr(`${objNum} 0 obj\n${bodyStr}\nendobj\n`);
  };

  const pageKids = pageStreams.map((_, idx) => `${5 + idx * 2} 0 R`).join(' ');
  writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  writeObj(2, `<< /Type /Pages /Kids [${pageKids}] /Count ${pageStreams.length} >>`);
  writeObj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  writeObj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  pageStreams.forEach((streamContent, idx) => {
    const pageObjId = 5 + idx * 2;
    const streamObjId = 6 + idx * 2;
    const streamBytes = encoder.encode(streamContent);

    writeObj(
      pageObjId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamObjId} 0 R >>`
    );

    xrefOffsets[streamObjId] = offset;
    pushStr(`${streamObjId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
    chunks.push(streamBytes);
    offset += streamBytes.length;
    pushStr('\nendstream\nendobj\n');
  });

  const xrefStart = offset;
  pushStr(`xref\n0 ${totalObjects + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let i = 1; i <= totalObjects; i++) {
    pushStr(`${String(xrefOffsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  );

  const combined = new Uint8Array(offset);
  let pos = 0;
  for (const chunk of chunks) {
    combined.set(chunk, pos);
    pos += chunk.length;
  }
  return new Blob([combined], { type: 'application/pdf' });
}

export function buildMissingOrderedProductsText({ items = [], shopSettings = {}, filterLabel = '', t = (s) => s }) {
  const shopName = shopSettings?.shop_name || 'KAMPANGO PHONES AND ELECTRONICS';
  const totalUnits = items.reduce((s, it) => s + Number(it.missing_quantity || 0), 0);
  const totalValue = items.reduce((s, it) => s + Number(it.missing_value || 0), 0);

  const lines = [
    `================================`,
    shopName,
    t('MISSING ORDERED PRODUCTS REPORT'),
    `${t('Generated:')} ${formatDate(new Date().toISOString(), true)}`,
    filterLabel ? `${t('Filter:')} ${filterLabel}` : null,
    `--------------------------------`,
    ...items.map((it, idx) => {
      const unit = it.unit_snapshot || it.unit || 'piece';
      return (
        `${idx + 1}. ${it.product_name_snapshot || it.product_name} (${it.sku_snapshot || it.sku || '-'})\n` +
        `   ${t('Order:')} ${it.purchase_reference || '-'} | ${t('Supplier:')} ${it.supplier_name || '-'}\n` +
        `   ${t('Ordered:')} ${formatQtyWithUnit(it.ordered_quantity, unit)} | ` +
        `${t('Arrived:')} ${formatQtyWithUnit(it.received_quantity, unit)} | ` +
        `${t('Missing:')} ${formatQtyWithUnit(it.missing_quantity, unit)} (${formatTZS(it.missing_value)})`
      );
    }),
    `--------------------------------`,
    `${t('Missing Line Items:')} ${items.length}`,
    `${t('Total Missing Units:')} ${formatQtyNumber(totalUnits)}`,
    `${t('Total Missing Value:')} ${formatTZS(totalValue)}`,
    `================================`,
  ];

  return lines.filter(Boolean).join('\n');
}

export function buildMissingProductsPdf({
  items = [],
  shopSettings = {},
  filterLabel = '',
  orderRef = '',
  t = (s) => s,
}) {
  const shopName = shopSettings?.shop_name || 'KAMPANGO PHONES AND ELECTRONICS';
  const shopAddress = shopSettings?.shop_address || 'Dar es Salaam, Tanzania';
  const contactPhone = shopSettings?.contact_phone || '';
  const tinNumber = shopSettings?.tin_number || '';
  const generatedStr = formatDate(new Date().toISOString(), true);

  const totalUnits = items.reduce((s, it) => s + Number(it.missing_quantity || 0), 0);
  const totalValue = items.reduce((s, it) => s + Number(it.missing_value || 0), 0);
  const unresolvedCount = items.filter((it) => it.status !== 'resolved').length;

  // Table column layout summing to CONTENT_W = 770pt
  const cols = [
    { key: 'num', label: '#', w: 26, align: 'left' },
    { key: 'order', label: t('Order / Date'), w: 86, align: 'left' },
    { key: 'supplier', label: t('Supplier'), w: 124, align: 'left' },
    { key: 'product', label: t('Product & SKU'), w: 194, align: 'left' },
    { key: 'ordered', label: t('Ordered'), w: 55, align: 'right' },
    { key: 'arrived', label: t('Arrived'), w: 55, align: 'right' },
    { key: 'missing', label: t('Missing'), w: 60, align: 'right' },
    { key: 'cost', label: t('Unit Cost'), w: 82, align: 'right' },
    { key: 'value', label: t('Missing Value'), w: 88, align: 'right' },
  ];

  const colX = [];
  let cx = MARGIN_X;
  for (const col of cols) {
    colX.push(cx);
    cx += col.w;
  }

  const pageOpsList = [];
  let ops = [];
  let y = 0;

  const drawHeader = (isFirstPage) => {
    // Brand dark header banner
    drawRect(ops, 0, 0, PAGE_W, 66, '0.06 0.09 0.16');
    drawRect(ops, 0, 66, PAGE_W, 4, '0.816 0.455 0.380');

    drawText(ops, shopName, MARGIN_X, 26, 14, { bold: true, rgb: '1 1 1' });
    const subParts = [shopAddress, contactPhone ? `${t('Tel:')} ${contactPhone}` : '', tinNumber ? `TIN: ${tinNumber}` : ''].filter(Boolean);
    drawText(ops, subParts.join('  |  '), MARGIN_X, 42, 8.5, { rgb: '0.80 0.84 0.88' });
    drawText(ops, t('Digital Store Management Portal'), MARGIN_X, 55, 8, { rgb: '0.58 0.64 0.72' });

    const docTitle = orderRef
      ? t('MISSING ORDERED PRODUCTS ({ref})', { ref: orderRef })
      : t('MISSING ORDERED PRODUCTS REPORT');
    drawText(ops, docTitle, PAGE_W - MARGIN_X, 28, 12, { bold: true, rgb: '1 1 1', align: 'right' });
    drawText(ops, `${t('Generated:')} ${generatedStr}`, PAGE_W - MARGIN_X, 44, 8.5, { rgb: '0.80 0.84 0.88', align: 'right' });
    if (filterLabel) {
      drawText(ops, filterLabel, PAGE_W - MARGIN_X, 56, 8, { rgb: '0.95 0.75 0.68', align: 'right' });
    }

    y = 84;

    if (isFirstPage) {
      // 3 KPI summary cards
      const cardGap = 12;
      const cardW = (CONTENT_W - cardGap * 2) / 3;
      const cardH = 44;

      // Card 1: Missing Items
      drawRect(ops, MARGIN_X, y, cardW, cardH, '0.97 0.98 0.99', '0.84 0.87 0.91', 0.8);
      drawText(ops, t('Missing Product Lines'), MARGIN_X + 12, y + 15, 8, { bold: true, rgb: '0.39 0.45 0.55' });
      drawText(
        ops,
        `${items.length} (${unresolvedCount} ${t('Unresolved')})`,
        MARGIN_X + 12,
        y + 34,
        12,
        { bold: true, rgb: '0.06 0.09 0.16' }
      );

      // Card 2: Total Missing Units
      const c2x = MARGIN_X + cardW + cardGap;
      drawRect(ops, c2x, y, cardW, cardH, '0.99 0.97 0.94', '0.95 0.78 0.52', 0.8);
      drawText(ops, t('Total Missing Units'), c2x + 12, y + 15, 8, { bold: true, rgb: '0.68 0.35 0.05' });
      drawText(ops, formatQtyNumber(totalUnits), c2x + 12, y + 34, 13, { bold: true, rgb: '0.72 0.25 0.05' });

      // Card 3: Total Missing Value
      const c3x = c2x + cardW + cardGap;
      drawRect(ops, c3x, y, cardW, cardH, '0.99 0.95 0.95', '0.94 0.68 0.68', 0.8);
      drawText(ops, t('Total Missing Value (TZS)'), c3x + 12, y + 15, 8, { bold: true, rgb: '0.72 0.11 0.11' });
      drawText(ops, formatTZS(totalValue), c3x + 12, y + 34, 13, { bold: true, rgb: '0.72 0.11 0.11' });

      y += cardH + 14;
    }

    // Table Header Bar
    drawRect(ops, MARGIN_X, y, CONTENT_W, 24, '0.12 0.16 0.23');
    cols.forEach((col, i) => {
      const tx = col.align === 'right' ? colX[i] + col.w - 6 : colX[i] + 6;
      drawText(ops, col.label, tx, y + 15, 8.2, {
        bold: true,
        rgb: '1 1 1',
        align: col.align,
        maxWidth: col.w - 10,
      });
    });
    y += 24;
  };

  const startNewPage = (isFirstPage) => {
    if (!isFirstPage) {
      pageOpsList.push(ops);
      ops = [];
    }
    drawHeader(isFirstPage);
  };

  startNewPage(true);

  if (items.length === 0) {
    drawRect(ops, MARGIN_X, y, CONTENT_W, 38, '0.98 0.99 1.0', '0.85 0.88 0.92');
    drawText(ops, t('No missing ordered products recorded for this filter.'), PAGE_W / 2, y + 23, 10, {
      rgb: '0.39 0.45 0.55',
      align: 'center',
    });
    y += 46;
  } else {
    items.forEach((item, idx) => {
      const prodName = item.product_name_snapshot || item.product_name || '-';
      const sku = item.sku_snapshot || item.sku || '';
      const unit = item.unit_snapshot || item.unit || 'piece';
      const statusTag = item.status === 'resolved' ? `[${t('RESOLVED')}]` : `[${t('MISSING')}]`;
      const prodLines = wrapText(prodName, cols[3].w - 12, 8.4, 2, true);
      const supLines = wrapText(item.supplier_name || '-', cols[2].w - 12, 8.2, 2, false);
      const subDetail = [sku ? `SKU: ${sku}` : '', statusTag, item.notes ? item.notes : ''].filter(Boolean).join(' | ');
      const rowHeight = Math.max(30, Math.max(prodLines.length, supLines.length) * 11 + 14);

      if (y + rowHeight > PAGE_H - 70) {
        startNewPage(false);
      }

      const bgRgb = idx % 2 === 1 ? '0.97 0.98 0.99' : '1 1 1';
      drawRect(ops, MARGIN_X, y, CONTENT_W, rowHeight, bgRgb, '0.88 0.90 0.93', 0.4);

      // Col 0: #
      drawText(ops, String(idx + 1), colX[0] + 6, y + 14, 8.2, { rgb: '0.39 0.45 0.55' });

      // Col 1: Order Ref & Date
      drawText(ops, item.purchase_reference || '-', colX[1] + 6, y + 13, 8.4, {
        bold: true,
        rgb: '0.11 0.30 0.65',
        maxWidth: cols[1].w - 10,
      });
      drawText(ops, formatDate(item.purchase_date || item.created_at), colX[1] + 6, y + 24, 7.5, {
        rgb: '0.45 0.51 0.59',
        maxWidth: cols[1].w - 10,
      });

      // Col 2: Supplier & Phone
      supLines.forEach((line, li) => {
        drawText(ops, line, colX[2] + 6, y + 13 + li * 10.5, 8.2, {
          bold: li === 0,
          rgb: '0.06 0.09 0.16',
          maxWidth: cols[2].w - 10,
        });
      });
      if (item.supplier_phone && supLines.length === 1) {
        drawText(ops, item.supplier_phone, colX[2] + 6, y + 24, 7.4, {
          rgb: '0.45 0.51 0.59',
          maxWidth: cols[2].w - 10,
        });
      }

      // Col 3: Product & SKU
      prodLines.forEach((line, li) => {
        drawText(ops, line, colX[3] + 6, y + 13 + li * 10.5, 8.4, {
          bold: true,
          rgb: '0.06 0.09 0.16',
          maxWidth: cols[3].w - 10,
        });
      });
      drawText(ops, subDetail, colX[3] + 6, y + 13 + prodLines.length * 10.5, 7.2, {
        rgb: item.status === 'resolved' ? '0.05 0.50 0.30' : '0.45 0.51 0.59',
        maxWidth: cols[3].w - 10,
      });

      // Col 4: Ordered
      drawText(ops, formatQtyWithUnit(item.ordered_quantity, unit), colX[4] + cols[4].w - 6, y + 15, 8.2, {
        align: 'right',
        rgb: '0.15 0.20 0.28',
      });

      // Col 5: Arrived
      drawText(ops, formatQtyWithUnit(item.received_quantity, unit), colX[5] + cols[5].w - 6, y + 15, 8.2, {
        align: 'right',
        rgb: '0.05 0.48 0.30',
      });

      // Col 6: Missing
      drawText(ops, formatQtyWithUnit(item.missing_quantity, unit), colX[6] + cols[6].w - 6, y + 15, 8.6, {
        bold: true,
        align: 'right',
        rgb: item.status === 'resolved' ? '0.05 0.48 0.30' : '0.75 0.10 0.10',
      });

      // Col 7: Unit Cost
      drawText(ops, formatTZS(item.unit_purchase_price), colX[7] + cols[7].w - 6, y + 15, 8.1, {
        align: 'right',
        rgb: '0.28 0.34 0.42',
      });

      // Col 8: Missing Value
      drawText(ops, formatTZS(item.missing_value), colX[8] + cols[8].w - 6, y + 15, 8.5, {
        bold: true,
        align: 'right',
        rgb: item.status === 'resolved' ? '0.28 0.34 0.42' : '0.75 0.10 0.10',
      });

      y += rowHeight;
    });

    // Grand Total Row
    if (y + 30 > PAGE_H - 72) {
      startNewPage(false);
    }
    drawRect(ops, MARGIN_X, y, CONTENT_W, 26, '0.95 0.96 0.98', '0.58 0.64 0.72', 0.8);
    drawText(ops, t('GRAND TOTAL (MISSING ORDERED PRODUCTS)'), MARGIN_X + 10, y + 16, 8.8, {
      bold: true,
      rgb: '0.06 0.09 0.16',
    });
    drawText(ops, formatQtyNumber(totalUnits), colX[6] + cols[6].w - 6, y + 16, 9.2, {
      bold: true,
      align: 'right',
      rgb: '0.75 0.10 0.10',
    });
    drawText(ops, formatTZS(totalValue), colX[8] + cols[8].w - 6, y + 16, 9.2, {
      bold: true,
      align: 'right',
      rgb: '0.75 0.10 0.10',
    });
    y += 38;
  }

  // Signature block on last page
  if (y + 44 > PAGE_H - 42) {
    startNewPage(false);
  }
  const sigW = 220;
  drawLine(ops, MARGIN_X, y + 22, MARGIN_X + sigW, y + 22, '0.58 0.64 0.72', 0.7);
  drawText(ops, t('Prepared / Verified By (Shop Admin)'), MARGIN_X, y + 34, 8, { rgb: '0.39 0.45 0.55' });

  const sig2X = PAGE_W - MARGIN_X - sigW;
  drawLine(ops, sig2X, y + 22, sig2X + sigW, y + 22, '0.58 0.64 0.72', 0.7);
  drawText(ops, t('Supplier Acknowledgement & Signature'), sig2X, y + 34, 8, { rgb: '0.39 0.45 0.55' });

  pageOpsList.push(ops);

  // Add page footer + Page X of N to every page
  const totalPages = pageOpsList.length;
  const finalizedStreams = pageOpsList.map((pOps, idx) => {
    const fOps = [...pOps];
    drawLine(fOps, MARGIN_X, PAGE_H - 34, PAGE_W - MARGIN_X, PAGE_H - 34, '0.85 0.88 0.92', 0.6);
    drawText(
      fOps,
      `${shopName} - ${t('Missing Ordered Products Report')} - Developed by SOFT-LINK Africa Team`,
      MARGIN_X,
      PAGE_H - 20,
      7.5,
      { rgb: '0.45 0.51 0.59' }
    );
    drawText(
      fOps,
      `${t('Page')} ${idx + 1} / ${totalPages}`,
      PAGE_W - MARGIN_X,
      PAGE_H - 20,
      7.8,
      { bold: true, rgb: '0.30 0.36 0.44', align: 'right' }
    );
    return fOps.join('\n');
  });

  const blob = assemblePdfDocument(finalizedStreams);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const safeRef = orderRef ? `_${String(orderRef).replace(/[^A-Za-z0-9_-]/g, '')}` : '';
  const filename = `KAMPANGO_Missing_Ordered_Products${safeRef}_${dateStamp}.pdf`;
  const file =
    typeof File !== 'undefined'
      ? new File([blob], filename, { type: 'application/pdf' })
      : null;
  const summaryText = buildMissingOrderedProductsText({ items, shopSettings, filterLabel, t });

  return { blob, file, filename, summaryText };
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadMissingProductsPdf(options) {
  const result = buildMissingProductsPdf(options);
  triggerBlobDownload(result.blob, result.filename);
  return result;
}

export async function shareMissingProductsPdf(options) {
  const { t = (s) => s, orderRef = '' } = options;
  const { blob, file, filename, summaryText } = buildMissingProductsPdf(options);
  const shareTitle = orderRef
    ? t('Missing Ordered Products ({ref})', { ref: orderRef })
    : t('Missing Ordered Products Report');

  // Native Web Share API with real .pdf File attachment (Android, iOS, macOS, Windows Edge/Chrome)
  if (
    typeof navigator !== 'undefined' &&
    file &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] }) &&
    typeof navigator.share === 'function'
  ) {
    try {
      await navigator.share({
        files: [file],
        title: shareTitle,
        text: summaryText,
      });
      return { status: 'shared', filename, summaryText };
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return { status: 'cancelled', filename, summaryText };
      }
      // Fall through to download + clipboard fallback
    }
  }

  // Fallback for browsers without native PDF file sharing: download the PDF and copy summary
  triggerBlobDownload(blob, filename);
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(summaryText);
    } catch {
      // Ignore clipboard denial
    }
  }
  return { status: 'downloaded_fallback', filename, summaryText };
}

export function printMissingProductsPdfReport({
  items = [],
  shopSettings = {},
  filterLabel = '',
  orderRef = '',
  t = (s) => s,
}) {
  const shopName = shopSettings?.shop_name || 'KAMPANGO PHONES AND ELECTRONICS';
  const totalUnits = items.reduce((s, it) => s + Number(it.missing_quantity || 0), 0);
  const totalValue = items.reduce((s, it) => s + Number(it.missing_value || 0), 0);

  const rowsHtml = items
    .map((it, idx) => {
      const unit = it.unit_snapshot || it.unit || 'piece';
      return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${it.purchase_reference || '—'}</strong><br/><small style="color:#64748b;">${formatDate(it.purchase_date || it.created_at)}</small></td>
        <td><strong>${it.supplier_name || '—'}</strong>${it.supplier_phone ? `<br/><small style="color:#64748b;">${it.supplier_phone}</small>` : ''}</td>
        <td><strong>${it.product_name_snapshot || it.product_name || '—'}</strong><br/><small style="color:#64748b;">SKU: ${it.sku_snapshot || it.sku || '—'}${it.notes ? ` · ${it.notes}` : ''}</small></td>
        <td class="text-right">${formatQtyWithUnit(it.ordered_quantity, unit)}</td>
        <td class="text-right" style="color:#047857;">${formatQtyWithUnit(it.received_quantity, unit)}</td>
        <td class="text-right" style="color:#b91c1c; font-weight:700;">${formatQtyWithUnit(it.missing_quantity, unit)}</td>
        <td class="text-right">${formatTZS(it.unit_purchase_price)}</td>
        <td class="text-right" style="color:#b91c1c; font-weight:700;">${formatTZS(it.missing_value)}</td>
      </tr>`;
    })
    .join('');

  const title = orderRef
    ? t('Missing Ordered Products ({ref})', { ref: orderRef })
    : t('Missing Ordered Products Report');

  printHtmlDocument(
    title,
    `
    <div class="header">
      <h2>${shopName}</h2>
      <p>${shopSettings?.shop_address || 'Dar es Salaam, Tanzania'}${shopSettings?.contact_phone ? ` | ${t('Tel:')} ${shopSettings.contact_phone}` : ''}${shopSettings?.tin_number ? ` | TIN: ${shopSettings.tin_number}` : ''}</p>
      <p><strong>${title}</strong>${filterLabel ? ` · ${filterLabel}` : ''} · ${t('Generated:')} ${formatDate(new Date().toISOString(), true)}</p>
    </div>

    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px;">
      <div style="padding:10px; border:1px solid #cbd5e1; border-radius:8px; background:#f8fafc;">
        <div style="font-size:11px; color:#64748b;">${t('Missing Product Lines')}</div>
        <div style="font-size:16px; font-weight:800; color:#0f172a;">${items.length}</div>
      </div>
      <div style="padding:10px; border:1px solid #fdba74; border-radius:8px; background:#fff7ed;">
        <div style="font-size:11px; color:#9a3412;">${t('Total Missing Units')}</div>
        <div style="font-size:16px; font-weight:800; color:#c2410c;">${formatQtyNumber(totalUnits)}</div>
      </div>
      <div style="padding:10px; border:1px solid #fca5a5; border-radius:8px; background:#fef2f2;">
        <div style="font-size:11px; color:#991b1b;">${t('Total Missing Value (TZS)')}</div>
        <div style="font-size:16px; font-weight:800; color:#b91c1c;">${formatTZS(totalValue)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>${t('Order / Date')}</th>
          <th>${t('Supplier')}</th>
          <th>${t('Product & SKU')}</th>
          <th class="text-right">${t('Ordered')}</th>
          <th class="text-right">${t('Arrived')}</th>
          <th class="text-right">${t('Missing')}</th>
          <th class="text-right">${t('Unit Cost')}</th>
          <th class="text-right">${t('Missing Value')}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="9" style="text-align:center; padding:16px; color:#64748b;">${t('No missing ordered products recorded for this filter.')}</td></tr>`}
      </tbody>
    </table>

    <div style="margin-top:26px; display:flex; justify-content:space-between; gap:24px; font-size:11px; color:#475569;">
      <div style="flex:1; border-top:1px solid #94a3b8; padding-top:6px;">${t('Prepared / Verified By (Shop Admin)')}</div>
      <div style="flex:1; border-top:1px solid #94a3b8; padding-top:6px;">${t('Supplier Acknowledgement & Signature')}</div>
    </div>

    <div class="footer">
      <p>${shopName} — ${t('Digital Store Management Portal')}</p>
    </div>
    `
  );
}
