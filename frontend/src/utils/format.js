export function formatTZS(amount, showCurrency = true) {
  const num = Number(amount || 0);
  const formatted = new Intl.NumberFormat('en-TZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(num));
  return showCurrency ? `TZS ${formatted}` : formatted;
}

export function isMeterUnit(unit) {
  return String(unit || '').toLowerCase() === 'meter';
}

export function formatQtyNumber(qty) {
  const num = Number(qty || 0);
  if (!Number.isFinite(num)) return '0';
  const rounded = Math.round(num * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatQtyWithUnit(qty, unit = 'piece') {
  const n = formatQtyNumber(qty);
  return isMeterUnit(unit) ? `${n} m` : n;
}

export function formatUnitPrice(amount, unit = 'piece') {
  const base = formatTZS(amount);
  return isMeterUnit(unit) ? `${base} / m` : base;
}

export function formatDate(dateStr, includeTime = false) {
  if (!dateStr) return '—';
  const d = new Date(String(dateStr).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const lang = localStorage.getItem('esms_lang') || 'en';
  return d.toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function hasPermission(user, permOrArray) {
  if (!user) return false;
  if ((user.role_slugs || []).includes('owner')) return true;
  const userPerms = user.permissions || [];
  const list = Array.isArray(permOrArray) ? permOrArray : [permOrArray];
  return list.some((p) => userPerms.includes(p));
}

export function exportToCsv(filename, rows, columns) {
  if (!rows || rows.length === 0) return;
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
        const safe = String(val ?? '').replace(/"/g, '""');
        return `"${safe}"`;
      })
      .join(',')
  );
  const csvContent = '\uFEFF' + [header, ...lines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printHtmlDocument(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=820,height=720');
  if (!win) {
    window.print();
    return;
  }
  const lang = localStorage.getItem('esms_lang') || 'en';
  const logoUrl = `${window.location.origin}/logo.png`;
  win.document.write(`
    <!DOCTYPE html>
    <html lang="${lang}">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 24px; font-size: 13px; }
          h1, h2, h3 { margin: 0 0 6px 0; }
          .brand-banner { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid #0f172a; }
          .brand-logo { width: 56px; height: 56px; object-fit: cover; border-radius: 50%; border: 1px solid #cbd5e1; }
          .brand-title { font-size: 18px; font-weight: 800; letter-spacing: 0.4px; color: #0f172a; margin: 0; }
          .brand-sub { font-size: 11px; color: #475569; margin: 2px 0 0 0; }
          .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; }
          th { background: #f8fafc; font-weight: 700; }
          .text-right { text-align: right; }
          .totals { margin-top: 12px; border-top: 2px solid #0f172a; padding-top: 8px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #166534; }
          .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
          @media print {
            body { margin: 12px; }
          }
        </style>
      </head>
      <body>
        <div class="brand-banner">
          <img id="kampango-print-logo" src="${logoUrl}" alt="KAMPANGO PHONES AND ELECTRONICS" class="brand-logo" />
          <div>
            <p class="brand-title">KAMPANGO PHONES AND ELECTRONICS</p>
            <p class="brand-sub">${title}</p>
          </div>
        </div>
        ${bodyHtml}
        <script>
          (function() {
            var printed = false;
            function triggerPrint() {
              if (printed) return;
              printed = true;
              setTimeout(function() { window.print(); }, 150);
            }
            window.onload = function() {
              var img = document.getElementById('kampango-print-logo');
              if (!img || img.complete) {
                triggerPrint();
              } else {
                img.onload = triggerPrint;
                img.onerror = triggerPrint;
                setTimeout(triggerPrint, 800);
              }
            };
          })();
        </script>
      </body>
    </html>
  `);
  win.document.close();
}
