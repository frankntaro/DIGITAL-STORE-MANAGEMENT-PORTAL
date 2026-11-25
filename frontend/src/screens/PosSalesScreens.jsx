import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Eye,
  MessageCircle,
  Minus,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Share2,
  ShoppingCart,
  Trash2,
  UserPlus,
  WifiOff,
  X,
} from 'lucide-react';
import {
  apiRequest,
  enqueueOfflineTransaction,
  fetchProductsWithOfflineFallback,
  getAllFromStore,
  resolveMediaUrl,
} from '../services/api';
import {
  formatDate,
  formatQtyNumber,
  formatQtyWithUnit,
  formatTZS,
  formatUnitPrice,
  hasPermission,
  isMeterUnit,
  printHtmlDocument,
} from '../utils/format';
import { useLanguage } from '../utils/i18n';
import Pagination, { usePagination } from '../components/Pagination';

// ============================================================================
// SHARED DIGITAL & PRINTABLE PAYMENT RECEIPT HELPERS
// ============================================================================
function normalizeWhatsAppPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length >= 9) {
    return `255${digits.slice(1)}`;
  }
  return digits;
}

function buildDigitalReceiptText(receiptData, t) {
  const sale = receiptData?.sale || {};
  const items = receiptData?.items || [];
  const warranties = receiptData?.warranties || [];
  const settings = receiptData?.settings || {};

  const shopName = settings.shop_name || 'KAMPANGO PHONES AND ELECTRONICS';
  const lines = [
    `================================`,
    `${shopName}`,
    settings.shop_address ? `${settings.shop_address}` : null,
    settings.contact_phone ? `${t('Tel:')} ${settings.contact_phone}` : null,
    settings.tin_number ? `TIN: ${settings.tin_number}` : null,
    `================================`,
    `${t('DIGITAL PAYMENT RECEIPT')}`,
    `${t('Receipt #')}: ${sale.receipt_number || '—'}`,
    `${t('Date:')} ${formatDate(sale.sale_date, true)}`,
    `${t('Cashier:')} ${sale.cashier_name || '—'}`,
    `--------------------------------`,
    `${t('CUSTOMER INFORMATION')}`,
    `${t('Customer:')} ${t(sale.customer_name || 'Walk-in Customer')}${sale.customer_code ? ` (${sale.customer_code})` : ''}`,
    sale.customer_phone ? `${t('Phone:')} ${sale.customer_phone}` : null,
    sale.customer_email ? `${t('Email:')} ${sale.customer_email}` : null,
    sale.customer_address ? `${t('Address:')} ${sale.customer_address}` : null,
    `--------------------------------`,
    `${t('ITEMS PURCHASED')}`,
    ...items.map((it, idx) => {
      const name = it.product_name_snapshot || it.name;
      const sku = it.sku_snapshot || it.sku || '';
      const unit = it.unit || it.unit_snapshot || 'piece';
      const war = Number(it.warranty_months || 0) > 0 ? ` [${t('{months}M Warranty', { months: it.warranty_months })}]` : '';
      return `${idx + 1}. ${name}${sku ? ` (${sku})` : ''}${war}\n   ${formatQtyWithUnit(it.quantity, unit)} × ${formatUnitPrice(it.unit_selling_price, unit)} = ${formatTZS(it.line_total)}`;
    }),
    `--------------------------------`,
    `${t('Subtotal:')} ${formatTZS(sale.subtotal_amount)}`,
    Number(sale.discount_amount || 0) > 0 ? `${t('Discount:')} -${formatTZS(sale.discount_amount)}` : null,
    `${t('Total Payable:')} ${formatTZS(sale.total_amount)}`,
    `${t('Payment Method:')} ${t(sale.payment_method || 'Cash')}`,
    `${t('Payment Status:')} ${t(sale.payment_status || 'paid').toUpperCase()}`,
    `${t('Amount Paid:')} ${formatTZS(sale.cash_received)}`,
    Number(sale.change_amount || 0) > 0 ? `${t('Change Given:')} ${formatTZS(sale.change_amount)}` : null,
    Number(sale.outstanding_balance || 0) > 0 ? `${t('Balance Due:')} ${formatTZS(sale.outstanding_balance)}` : null,
    sale.due_date && Number(sale.outstanding_balance || 0) > 0
      ? `${t('Due Date:')} ${formatDate(sale.due_date)}`
      : null,
    ...(warranties.length > 0
      ? [
          `--------------------------------`,
          `${t('WARRANTY DETAILS')}`,
          ...warranties.map(
            (w) => `• ${w.warranty_number} (${w.serial_or_imei || 'N/A'}) — ${t('Expires:')} ${formatDate(w.expiry_date)}`
          ),
        ]
      : []),
    `================================`,
    settings.receipt_footer || t('Thank you for shopping at {shop}!', { shop: shopName }),
  ];

  return lines.filter(Boolean).join('\n');
}

function printPaymentReceipt(receiptData, t) {
  const sale = receiptData?.sale || {};
  const items = receiptData?.items || [];
  const warranties = receiptData?.warranties || [];
  const settings = receiptData?.settings || {};

  const shopName = settings.shop_name || 'KAMPANGO PHONES AND ELECTRONICS';
  const rowsHtml = items
    .map(
      (it) => {
        const unit = it.unit || it.unit_snapshot || 'piece';
        return `
      <tr>
        <td>
          <strong>${it.product_name_snapshot || it.name}</strong><br/>
          <small style="color:#64748b;">${it.sku_snapshot || it.sku || ''}${
            Number(it.warranty_months || 0) > 0
              ? ` · ${t('{months}M Warranty', { months: it.warranty_months })}`
              : ''
          }</small>
        </td>
        <td>${formatQtyWithUnit(it.quantity, unit)}</td>
        <td class="text-right">${formatUnitPrice(it.unit_selling_price, unit)}</td>
        <td class="text-right"><strong>${formatTZS(it.line_total)}</strong></td>
      </tr>`;
      }
    )
    .join('');

  const warrantyHtml =
    warranties.length > 0
      ? `
      <div style="margin-top:14px; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:11px;">
        <strong>${t('WARRANTY DETAILS')}</strong>
        <ul style="margin:6px 0 0 16px; padding:0;">
          ${warranties
            .map(
              (w) =>
                `<li>${w.warranty_number} · ${w.serial_or_imei || 'N/A'} · ${t('Expires:')} ${formatDate(w.expiry_date)}</li>`
            )
            .join('')}
        </ul>
      </div>`
      : '';

  printHtmlDocument(
    t('Payment Receipt {receipt}', { receipt: sale.receipt_number || '' }),
    `
    <div class="header">
      <h2>${shopName}</h2>
      <p>${settings.shop_address || 'Dar es Salaam, Tanzania'}${settings.contact_phone ? ` | ${t('Tel:')} ${settings.contact_phone}` : ''}${settings.tin_number ? ` | TIN: ${settings.tin_number}` : ''}</p>
      <p><strong>${t('RECEIPT: {receipt}', { receipt: sale.receipt_number })}</strong> | ${t('Date:')} ${formatDate(sale.sale_date, true)}</p>
      <p>${t('Cashier:')} <strong>${sale.cashier_name || '—'}</strong> | ${t('Payment Method:')} <strong>${t(sale.payment_method || 'Cash')}</strong> | <span class="badge">${t(sale.payment_status || 'paid').toUpperCase()}</span></p>
    </div>

    <div style="margin-bottom:14px; padding:10px 12px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; font-size:12px;">
      <strong style="display:block; margin-bottom:4px; color:#0f172a;">${t('CUSTOMER INFORMATION')}</strong>
      <div>${t('Customer:')} <strong>${t(sale.customer_name || 'Walk-in Customer')}</strong>${sale.customer_code ? ` (${sale.customer_code})` : ''}</div>
      ${sale.customer_phone ? `<div>${t('Phone:')} ${sale.customer_phone}</div>` : ''}
      ${sale.customer_email ? `<div>${t('Email:')} ${sale.customer_email}</div>` : ''}
      ${sale.customer_address ? `<div>${t('Address:')} ${sale.customer_address}</div>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th>${t('Product')}</th>
          <th>${t('Qty')}</th>
          <th class="text-right">${t('Price')}</th>
          <th class="text-right">${t('Total')}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div class="totals">
      <p class="text-right">${t('Subtotal:')} <strong>${formatTZS(sale.subtotal_amount)}</strong></p>
      ${
        Number(sale.discount_amount || 0) > 0
          ? `<p class="text-right">${t('Discount:')} <strong>-${formatTZS(sale.discount_amount)}</strong></p>`
          : ''
      }
      <p class="text-right" style="font-size:15px;">${t('Total Payable:')} <strong>${formatTZS(sale.total_amount)}</strong></p>
      <p class="text-right">${t('Amount Paid:')} <strong>${formatTZS(sale.cash_received)}</strong></p>
      ${
        Number(sale.change_amount || 0) > 0
          ? `<p class="text-right">${t('Change Given:')} <strong>${formatTZS(sale.change_amount)}</strong></p>`
          : ''
      }
      ${
        Number(sale.outstanding_balance || 0) > 0
          ? `<p class="text-right" style="color:#b91c1c;">${t('Balance Due:')} <strong>${formatTZS(sale.outstanding_balance)}</strong>${sale.due_date ? ` (${t('Due Date:')} ${formatDate(sale.due_date)})` : ''}</p>`
          : `<p class="text-right">${t('Outstanding Debt:')} <strong>${formatTZS(0)}</strong></p>`
      }
    </div>
    ${warrantyHtml}
    <div class="footer">
      <p>${settings.receipt_footer || 'Asante kwa kununua kwetu!'}</p>
    </div>
    `
  );
}

async function sharePaymentReceipt(receiptData, t) {
  const text = buildDigitalReceiptText(receiptData, t);
  const title = t('Payment Receipt {receipt}', { receipt: receiptData?.sale?.receipt_number || '' });
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch {
      // User dismissed or native share unavailable; fall back to clipboard
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }
  return 'failed';
}

function openWhatsAppPaymentReceipt(receiptData, t) {
  const text = buildDigitalReceiptText(receiptData, t);
  const waPhone = normalizeWhatsAppPhone(receiptData?.sale?.customer_phone);
  const url = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ============================================================================
// SCREEN 3: POINT OF SALE (POS)
// ============================================================================
export function PosScreen({ user, settings, isOffline, onQueueUpdated, onViewSale }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockOriginFilter, setStockOriginFilter] = useState('all');
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentScenario, setPaymentScenario] = useState('full_cash');
  const [cashReceivedInput, setCashReceivedInput] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ full_name: '', phone: '' });
  // Optional Receipt Controls (Customers who need a receipt vs those who don't)
  const [needsReceipt, setNeedsReceipt] = useState(false);
  const [receiptAction, setReceiptAction] = useState('modal'); // 'modal' | 'auto_print'
  const [walkinReceiptName, setWalkinReceiptName] = useState('');
  const [walkinReceiptPhone, setWalkinReceiptPhone] = useState('');
  const [completedReceipt, setCompletedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptShareFeedback, setReceiptShareFeedback] = useState('');

  const loadPosData = async () => {
    try {
      const prodRes = await fetchProductsWithOfflineFallback('?status=active');
      setProducts(prodRes.products || []);

      if (!isOffline && !prodRes.offline) {
        const [catRes, cusRes] = await Promise.all([
          apiRequest('/categories'),
          apiRequest('/customers'),
        ]);
        setCategories((catRes.categories || []).filter((c) => c.status === 'active'));
        setCustomers(cusRes.customers || []);
      } else {
        const [cachedCats, cachedCus] = await Promise.all([
          getAllFromStore('categories'),
          getAllFromStore('customers'),
        ]);
        setCategories(cachedCats);
        setCustomers(cachedCus);
      }
    } catch (err) {
      setFeedback({ type: 'error', key: err.message });
    }
  };

  useEffect(() => {
    loadPosData();
  }, [isOffline]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.status && p.status !== 'active') return false;
      if (selectedCategory !== 'all' && String(p.category_id) !== String(selectedCategory)) {
        return false;
      }
      if (stockOriginFilter === 'new' && Number(p.is_newly_purchased) !== 1) {
        return false;
      }
      if (stockOriginFilter === 'old' && Number(p.is_newly_purchased) === 1) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q)
      );
    });
  }, [products, selectedCategory, stockOriginFilter, search]);

  const posProductsPg = usePagination(
    filteredProducts,
    8,
    `${search}|${selectedCategory}|${stockOriginFilter}`
  );

  const addToCart = (product) => {
    const avail = Number(product.available_quantity || 0);
    const meter = isMeterUnit(product.unit);
    if (avail <= 0) {
      setFeedback({ type: 'error', key: '"{name}" is out of stock.', params: { name: product.name } });
      return;
    }
    const step = meter ? 0.5 : 1;
    const initialQty = meter ? Math.min(1, avail) : 1;
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        const nextQty = Math.round((Number(existing.quantity) + step) * 100) / 100;
        if (nextQty > avail + 0.0001) {
          setFeedback({
            type: 'error',
            key: 'Cannot exceed available stock ({count}) for "{name}".',
            params: { count: formatQtyWithUnit(avail, product.unit), name: product.name },
          });
          return prev;
        }
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: nextQty } : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit || 'piece',
          image_url: product.image_url,
          unit_selling_price: Number(product.selling_price),
          available_quantity: avail,
          warranty_months: Number(product.warranty_months || 12),
          quantity: initialQty,
        },
      ];
    });
  };

  const updateCartQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id !== productId) return item;
          const nextQty = Math.round((Number(item.quantity) + delta) * 100) / 100;
          if (nextQty > item.available_quantity + 0.0001) {
            setFeedback({
              type: 'error',
              key: 'Only {count} units available in stock.',
              params: { count: formatQtyWithUnit(item.available_quantity, item.unit) },
            });
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const setCartItemMeters = (productId, rawVal) => {
    const parsed = Math.round(Number(rawVal) * 100) / 100;
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        if (parsed > item.available_quantity + 0.0001) {
          setFeedback({
            type: 'error',
            key: 'Only {count} units available in stock.',
            params: { count: formatQtyWithUnit(item.available_quantity, item.unit) },
          });
          return { ...item, quantity: item.available_quantity };
        }
        return { ...item, quantity: parsed };
      })
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unit_selling_price, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    const val = Number(discountValue || 0);
    if (discountType === 'none' || val <= 0) return 0;
    if (discountType === 'percentage') {
      return Math.round(subtotal * (val / 100));
    }
    return Math.min(subtotal, Math.round(val));
  }, [subtotal, discountType, discountValue]);

  const totalAmount = Math.max(0, subtotal - discountAmount);

  useEffect(() => {
    if (paymentScenario === 'full_cash') {
      setCashReceivedInput(String(totalAmount));
    } else if (paymentScenario === 'zero_deposit_credit') {
      setCashReceivedInput('0');
    }
  }, [totalAmount, paymentScenario]);

  const cashReceived = Number(cashReceivedInput || 0);
  const outstandingBalance = Math.max(0, totalAmount - cashReceived);
  const changeAmount = Math.max(0, cashReceived - totalAmount);

  const handleQuickAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.full_name || !newCustomer.phone) return;
    try {
      const res = await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify(newCustomer),
      });
      await loadPosData();
      setCustomerId(String(res.id));
      setShowQuickCustomer(false);
      setNewCustomer({ full_name: '', phone: '' });
    } catch (err) {
      setFeedback({ type: 'error', key: err.message });
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setFeedback({ type: 'error', key: 'Add at least one product to the cart before checkout.' });
      return;
    }

    if (outstandingBalance > 0 && !customerId) {
      setFeedback({
        type: 'error',
        key: 'Please select or register a customer for partial-payment or credit sales.',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const selectedCustomer = customers.find((c) => String(c.id) === String(customerId)) || null;
    const cartSnapshot = [...cart];

    const payload = {
      customer_id: customerId ? Number(customerId) : null,
      walkin_customer_name: !customerId && walkinReceiptName.trim() ? walkinReceiptName.trim() : undefined,
      walkin_customer_phone: !customerId && walkinReceiptPhone.trim() ? walkinReceiptPhone.trim() : undefined,
      discount_type: discountType,
      discount_value: Number(discountValue || 0),
      discount_reason: discountReason,
      payment_method: paymentMethod,
      cash_received: cashReceived,
      due_date: dueDate || undefined,
      notes,
      items: cart.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_selling_price: i.unit_selling_price,
        warranty_months: i.warranty_months,
      })),
    };

    try {
      if (isOffline) {
        const queued = await enqueueOfflineTransaction('sale', payload, user);
        const offlineReceipt = {
          sale: {
            receipt_number: `OFF-${queued.uuid.slice(0, 8).toUpperCase()}`,
            sale_date: new Date().toISOString(),
            customer_code: selectedCustomer?.customer_code || null,
            customer_name:
              selectedCustomer?.full_name || walkinReceiptName.trim() || 'Walk-in Customer',
            customer_phone: selectedCustomer?.phone || walkinReceiptPhone.trim() || null,
            customer_email: selectedCustomer?.email || null,
            customer_address: selectedCustomer?.address || null,
            cashier_name: user?.full_name || user?.username || 'Staff',
            subtotal_amount: subtotal,
            discount_amount: discountAmount,
            total_amount: totalAmount,
            cash_received: cashReceived,
            change_amount: changeAmount,
            outstanding_balance: outstandingBalance,
            payment_method: paymentMethod,
            payment_status:
              outstandingBalance <= 0.01 ? 'paid' : cashReceived <= 0.01 ? 'unpaid' : 'partial',
            due_date: dueDate || null,
          },
          items: cartSnapshot.map((i) => ({
            product_name_snapshot: i.name,
            sku_snapshot: i.sku,
            unit: i.unit || 'piece',
            unit_snapshot: i.unit || 'piece',
            quantity: i.quantity,
            unit_selling_price: i.unit_selling_price,
            line_total: Math.round(i.quantity * i.unit_selling_price * 100) / 100,
            warranty_months: i.warranty_months,
          })),
          warranties: [],
          settings: settings || {},
        };
        setCompletedReceipt(offlineReceipt);
        setCart([]);
        setDiscountType('none');
        setDiscountValue('');
        setWalkinReceiptName('');
        setWalkinReceiptPhone('');
        setFeedback({
          type: 'warning',
          key: 'Saved Offline ({id}). Provisional stock reserved in IndexedDB; will auto-sync when internet returns.',
          params: { id: queued.uuid.slice(0, 14) },
          receipt: offlineReceipt,
        });
        if (needsReceipt) {
          setShowReceiptModal(true);
          if (receiptAction === 'auto_print') {
            printPaymentReceipt(offlineReceipt, t);
          }
        }
        onQueueUpdated?.();
        await loadPosData();
      } else {
        const res = await apiRequest('/sales', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const receiptObj = res.receipt || {
          sale: {
            id: res.sale_id,
            receipt_number: res.receipt_number,
            sale_date: new Date().toISOString(),
            customer_code: selectedCustomer?.customer_code || null,
            customer_name:
              selectedCustomer?.full_name || walkinReceiptName.trim() || 'Walk-in Customer',
            customer_phone: selectedCustomer?.phone || walkinReceiptPhone.trim() || null,
            customer_email: selectedCustomer?.email || null,
            customer_address: selectedCustomer?.address || null,
            cashier_name: user?.full_name || user?.username || 'Staff',
            subtotal_amount: subtotal,
            discount_amount: discountAmount,
            total_amount: res.total_amount,
            cash_received: res.cash_received,
            change_amount: res.change_amount,
            outstanding_balance: res.outstanding_balance,
            payment_method: paymentMethod,
            payment_status: res.payment_status,
            due_date: dueDate || null,
          },
          items: cartSnapshot.map((i) => ({
            product_name_snapshot: i.name,
            sku_snapshot: i.sku,
            unit: i.unit || 'piece',
            unit_snapshot: i.unit || 'piece',
            quantity: i.quantity,
            unit_selling_price: i.unit_selling_price,
            line_total: Math.round(i.quantity * i.unit_selling_price * 100) / 100,
            warranty_months: i.warranty_months,
          })),
          warranties: [],
          settings: settings || {},
        };
        setCompletedReceipt(receiptObj);
        setCart([]);
        setDiscountType('none');
        setDiscountValue('');
        setWalkinReceiptName('');
        setWalkinReceiptPhone('');
        setFeedback({
          type: 'success',
          key: '{message} (Total: {total}, Paid: {paid}, Debt: {debt})',
          params: {
            rawMessage: res.message,
            total: formatTZS(res.total_amount),
            paid: formatTZS(res.cash_received),
            debt: formatTZS(res.outstanding_balance),
          },
          saleId: res.sale_id,
          receipt: receiptObj,
        });
        if (needsReceipt) {
          setShowReceiptModal(true);
          if (receiptAction === 'auto_print') {
            printPaymentReceipt(receiptObj, t);
          }
        }
        await loadPosData();
      }
    } catch (err) {
      setFeedback({ type: 'error', key: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePosShareReceipt = async (receiptObj) => {
    const res = await sharePaymentReceipt(receiptObj, t);
    if (res === 'shared' || res === 'copied') {
      setReceiptShareFeedback(
        res === 'shared' ? t('Digital receipt shared!') : t('Copied Digital Receipt!')
      );
      setTimeout(() => setReceiptShareFeedback(''), 3000);
    }
  };

  const selectedCustomerObj = customers.find((c) => String(c.id) === String(customerId)) || null;

  const maxAllowedDiscount = (user?.role_slugs || []).includes('owner')
    ? 100
    : Math.max(Number(user?.max_discount_percent || 0), Number(settings?.max_cashier_discount_percent || 5));

  return (
    <div className="space-y-4">
      {isOffline && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-3.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {t('Offline POS Mode Active — Sales are stored locally in IndexedDB with provisional stock reservation. Note: stock across multiple offline devices is verified upon server synchronization.')}
            </span>
          </div>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={`rounded-2xl p-4 border text-xs font-semibold flex flex-wrap items-center justify-between gap-3 ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : feedback.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>
            {feedback.params?.rawMessage
              ? t(feedback.key, { ...feedback.params, message: t(feedback.params.rawMessage) })
              : t(feedback.key || feedback.text, feedback.params)}
          </span>
          {(feedback.saleId || feedback.receipt) && (
            <div className="flex flex-wrap items-center gap-2">
              {feedback.receipt && (
                <>
                  <button
                    type="button"
                    onClick={() => printPaymentReceipt(feedback.receipt, t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-bold"
                  >
                    <Printer className="w-3.5 h-3.5" /> {t('Print Receipt')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openWhatsAppPaymentReceipt(feedback.receipt, t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs font-bold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> {t('WhatsApp')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedReceipt(feedback.receipt);
                      setShowReceiptModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold"
                  >
                    <Share2 className="w-3.5 h-3.5" /> {t('Digital Receipt')}
                  </button>
                </>
              )}
              {feedback.saleId && (
                <button
                  type="button"
                  onClick={() => onViewSale(feedback.saleId)}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 text-xs font-bold"
                >
                  {t('View Sale Details')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main 2-Column POS Layout (Matches Screen 3 Mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search, Category Pills & Product Grid */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-extrabold text-slate-900">{t('Point of Sale (POS)')}</h1>
            <search className="flex-1 min-w-[220px] max-w-md">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="search"
                  aria-label={t('Search products by name, SKU, or barcode')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('Search products by name, SKU, or scan barcode...')}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
                />
              </div>
            </search>
          </div>

          {/* New Purchased vs Old Products Quick Filter (Updated Immediately After Admin Approval) */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Products' },
              { id: 'new', label: 'New Purchased Products' },
              { id: 'old', label: 'Old Products' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStockOriginFilter(item.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition border ${
                  stockOriginFilter === item.id
                    ? item.id === 'new'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t(item.label)}
              </button>
            ))}
          </div>

          {/* Category Filter Pills */}
          <div className="pill-scroll flex items-center gap-2 pb-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t('All Items ({count})', { count: products.length })}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(String(cat.id))}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  String(selectedCategory) === String(cat.id)
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t(cat.name)}
              </button>
            ))}
          </div>

          {/* Mobile/Tablet Quick Jump to Checkout Cart */}
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() =>
                document.getElementById('pos-checkout-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="lg:hidden w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm flex items-center justify-between gap-2"
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 shrink-0" />
                {t('View Cart ({count}) · {total}', { count: cart.length, total: formatTZS(totalAmount) })}
              </span>
              <span>↓</span>
            </button>
          )}

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
            {posProductsPg.pageItems.map((product) => {
              const avail = Number(product.available_quantity || 0);
              const isOut = avail <= 0;
              const isLow = !isOut && avail <= Number(product.min_stock_level || 5);
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={isOut}
                  onClick={() => addToCart(product)}
                  className={`group text-left rounded-2xl border p-3 transition flex flex-col justify-between ${
                    isOut
                      ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                      : 'border-slate-200 hover:border-blue-500 hover:shadow-md bg-white'
                  }`}
                >
                  <div>
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 mb-2.5">
                      <img
                        src={resolveMediaUrl(product.image_url) || '/logo.png'}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/logo.png';
                        }}
                        className="w-full h-full object-cover block group-hover:scale-105 transition"
                      />
                      {Number(product.is_newly_purchased) === 1 && !isOut && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white">
                          {t('New')}
                        </span>
                      )}
                      <span
                        className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isOut
                            ? 'bg-red-600 text-white'
                            : isLow
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {isOut
                          ? t('Out')
                          : isMeterUnit(product.unit)
                          ? t('{count} m in stock', { count: formatQtyNumber(avail) })
                          : t('{count} in stock', { count: formatQtyNumber(avail) })}
                      </span>
                      {isMeterUnit(product.unit) && !isOut && (
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-600/95 text-white">
                          {t('Sold per Meter')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                      {product.name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{product.sku}</p>
                    {(product.ram_gb || product.storage_gb || product.tv_size_inches || Number(product.socket_count || 0) > 0 || Number(product.box_count || 0) > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.tv_size_inches && (
                          <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[9px] font-extrabold">
                            {t('TV {size}', { size: product.tv_size_inches })}
                          </span>
                        )}
                        {Number(product.socket_count || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[9px] font-extrabold">
                            {t('{count} Sockets', { count: Number(product.socket_count) })}
                          </span>
                        )}
                        {product.ram_gb && product.storage_gb ? (
                          <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[9px] font-extrabold">
                            {product.ram_gb} / {product.storage_gb}
                          </span>
                        ) : (
                          <>
                            {product.ram_gb && (
                              <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[9px] font-extrabold">
                                {product.ram_gb}
                              </span>
                            )}
                            {product.storage_gb && (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 text-[9px] font-extrabold">
                                {product.storage_gb}
                              </span>
                            )}
                          </>
                        )}
                        {Number(product.box_count || 0) > 0 && Number(product.items_per_box || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                            {product.box_count}×{product.items_per_box}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-blue-600">
                      {formatUnitPrice(product.selling_price, product.unit)}
                    </span>
                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                      +
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <Pagination
            {...posProductsPg.paginationProps}
            pageSizeOptions={[5, 8, 12, 16, 24, 36]}
            standalone
          />
        </div>

        {/* Right Column: Current Sale / Checkout Panel */}
        <div
          id="pos-checkout-panel"
          className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-4 lg:sticky lg:top-20"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-extrabold text-slate-900">{t('Current Sale')}</h2>
            </div>
            <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
              {t('{count} items', { count: cart.length })}
            </span>
          </div>

          {/* Cart Items List */}
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                {t('Select or scan products on the left to add them to this sale.')}
              </div>
            ) : (
              cart.map((item) => {
                const meter = isMeterUnit(item.unit);
                const step = meter ? 0.5 : 1;
                return (
                  <div
                    key={item.product_id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <img
                        src={resolveMediaUrl(item.image_url)}
                        alt={item.name}
                        width="40"
                        height="40"
                        loading="lazy"
                        decoding="async"
                        className="w-10 h-10 rounded-lg object-cover block shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                          {meter && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-extrabold shrink-0">
                              {t('Meter (m)')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {formatUnitPrice(item.unit_selling_price, item.unit)} ×{' '}
                          {formatQtyWithUnit(item.quantity, item.unit)} ={' '}
                          <strong className="text-slate-800">
                            {formatTZS(item.quantity * item.unit_selling_price)}
                          </strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={t('Decrease quantity of {name}', { name: item.name })}
                          onClick={() => updateCartQty(item.product_id, -step)}
                          className="w-6 h-6 rounded-lg border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        {meter ? (
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number"
                              step="0.25"
                              min="0.1"
                              max={item.available_quantity}
                              aria-label={t('Meters for {name}', { name: item.name })}
                              value={item.quantity}
                              onChange={(e) => setCartItemMeters(item.product_id, e.target.value)}
                              className="w-14 px-1.5 py-0.5 rounded-lg border border-indigo-300 bg-white text-center text-xs font-bold"
                            />
                            <span className="text-[10px] font-extrabold text-indigo-700">m</span>
                          </div>
                        ) : (
                          <span className="w-6 text-center text-xs font-bold">
                            {formatQtyNumber(item.quantity)}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={t('Increase quantity of {name}', { name: item.name })}
                          onClick={() => updateCartQty(item.product_id, step)}
                          className="w-6 h-6 rounded-lg border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={t('Remove {name} from cart', { name: item.name })}
                          onClick={() => removeFromCart(item.product_id)}
                          className="w-6 h-6 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {meter && (
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200/70">
                        <span className="text-[10px] font-semibold text-slate-500 mr-1">
                          {t('Quick Meters:')}
                        </span>
                        {[0.5, 1, 1.5, 2, 3, 5].map((mVal) => (
                          <button
                            key={mVal}
                            type="button"
                            disabled={mVal > item.available_quantity}
                            onClick={() => setCartItemMeters(item.product_id, mVal)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition disabled:opacity-40 ${
                              Number(item.quantity) === mVal
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                            }`}
                          >
                            {mVal}m
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Customer Selector + Quick Add */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="pos-customer" className="text-xs font-bold text-slate-700">
                {t('Customer')}{' '}
                {outstandingBalance > 0 && (
                  <span className="text-red-600">{t('* (Required for Credit)')}</span>
                )}
              </label>
              <button
                type="button"
                onClick={() => setShowQuickCustomer((v) => !v)}
                className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                <UserPlus className="w-3 h-3" /> {t('New Customer')}
              </button>
            </div>
            <select
              id="pos-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="">{t('Walk-in Customer (Full Cash Only)')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {t('{name} ({phone}) — Debt: {debt}', {
                    name: c.full_name,
                    phone: c.phone,
                    debt: formatTZS(c.outstanding_debt || 0),
                  })}
                </option>
              ))}
            </select>

            {showQuickCustomer && (
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
                <p className="text-[11px] font-bold text-blue-900">{t('Quick Register Customer')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={t('Full Name *')}
                    value={newCustomer.full_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, full_name: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                  <input
                    type="text"
                    placeholder={t('Phone (+255...) *')}
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleQuickAddCustomer}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
                >
                  {t('Save Customer')}
                </button>
              </div>
            )}
          </div>

          {/* Authorized Discount Controls (SRS 3.12) */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="pos-discount-type" className="text-xs font-bold text-slate-700">
                {t('Authorized Discount')}
              </label>
              <span className="text-[10px] font-semibold text-slate-500">
                {t('Max limit: {pct}%', { pct: maxAllowedDiscount })}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                id="pos-discount-type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="none">{t('No Discount')}</option>
                <option value="percentage">{t('Percent (%)')}</option>
                <option value="fixed">{t('Fixed (TZS)')}</option>
              </select>
              <input
                type="number"
                min="0"
                disabled={discountType === 'none'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? t('% off') : t('TZS off')}
                className="col-span-2 px-3 py-2 rounded-xl border border-slate-300 text-xs disabled:bg-slate-100"
              />
            </div>
            {discountType !== 'none' && Number(discountValue) > 0 && (
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder={t('Reason for discount (recorded in audit log)')}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
              />
            )}
          </div>

          {/* Payment Scenario & Cash Received */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="block text-xs font-bold text-slate-700">{t('Payment Scenario')}</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'full_cash', label: 'Full Cash' },
                { id: 'zero_deposit_credit', label: 'Zero-Deposit' },
              ].map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setPaymentScenario(sc.id)}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition ${
                    paymentScenario === sc.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t(sc.label)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label htmlFor="pos-cash-received" className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {t('Cash Received (TZS)')}
                </label>
                <input
                  id="pos-cash-received"
                  type="number"
                  min="0"
                  value={cashReceivedInput}
                  onChange={(e) => setCashReceivedInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="pos-payment-method" className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {t('Payment Method')}
                </label>
                <select
                  id="pos-payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="Cash">{t('Cash')}</option>
                  <option value="Mobile Money">{t('Mobile Money (M-Pesa / Tigo)')}</option>
                  <option value="Bank Transfer">{t('Bank Transfer')}</option>
                  <option value="Credit">{t('Credit Account')}</option>
                </select>
              </div>
            </div>

            {outstandingBalance > 0 && (
              <div>
                <label htmlFor="pos-due-date" className="block text-[11px] font-semibold text-amber-800 mb-1">
                  {t('Credit Repayment Due Date')}
                </label>
                <input
                  id="pos-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50/40 text-xs"
                />
              </div>
            )}
          </div>

          {/* Totals Breakdown */}
          <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{t('Subtotal:')}</span>
              <span className="font-semibold">{formatTZS(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>{t('Authorized Discount:')}</span>
                <span className="font-bold">-{formatTZS(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1">
              <span>{t('Total Payable:')}</span>
              <span className="text-blue-600">{formatTZS(totalAmount)}</span>
            </div>
            {outstandingBalance > 0 ? (
              <div className="flex justify-between text-red-600 font-bold pt-1">
                <span>{t('Outstanding Customer Debt:')}</span>
                <span>{formatTZS(outstandingBalance)}</span>
              </div>
            ) : (
              changeAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold pt-1">
                  <span>{t('Customer Change:')}</span>
                  <span>{formatTZS(changeAmount)}</span>
                </div>
              )
            )}
          </div>

          {/* Optional Payment Receipt Preference (Print / Share Digital Receipt) */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={needsReceipt}
                  onChange={(e) => setNeedsReceipt(e.target.checked)}
                  className="rounded border-slate-300 accent-blue-600 w-4 h-4"
                />
                <Receipt className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{t('Customer needs a payment receipt (Optional)')}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
                {needsReceipt ? t('Enabled') : t('Skip')}
              </span>
            </label>

            {needsReceipt && (
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2.5 text-xs">
                {selectedCustomerObj ? (
                  <div className="text-[11px] text-blue-950 bg-white/80 rounded-lg p-2 border border-blue-100">
                    <p className="font-bold">
                      {t('Receipt Customer:')} {selectedCustomerObj.full_name}
                      {selectedCustomerObj.customer_code ? ` (${selectedCustomerObj.customer_code})` : ''}
                    </p>
                    <p className="text-slate-600">
                      {selectedCustomerObj.phone}
                      {selectedCustomerObj.address ? ` · ${selectedCustomerObj.address}` : ''}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-blue-900">
                      {t('Walk-in Customer Info for Receipt (Optional)')}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={walkinReceiptName}
                        onChange={(e) => setWalkinReceiptName(e.target.value)}
                        placeholder={t('Customer name')}
                        className="px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white text-xs"
                      />
                      <input
                        type="text"
                        value={walkinReceiptPhone}
                        onChange={(e) => setWalkinReceiptPhone(e.target.value)}
                        placeholder={t('Phone (+255...)')}
                        className="px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReceiptAction('modal')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition ${
                      receiptAction === 'modal'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {t('Show Print & Share Options')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptAction('auto_print')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition ${
                      receiptAction === 'auto_print'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {t('Auto-Print After Pay')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clear & Pay Action Buttons (Matches Screen 3 Mockup) */}
          <div className="grid grid-cols-3 gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setCart([])}
              className="py-3 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition"
            >
              {t('Clear')}
            </button>
            <button
              type="button"
              disabled={submitting || cart.length === 0}
              onClick={handleCheckout}
              className="col-span-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-lg shadow-blue-600/25 transition"
            >
              {submitting ? t('Processing...') : t('Pay {amount}', { amount: formatTZS(totalAmount) })}
            </button>
          </div>
        </div>
      </div>

      {/* Optional Digital Payment Receipt Modal (Print / WhatsApp / Share / Copy) */}
      {showReceiptModal && completedReceipt && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('Digital Payment Receipt')}
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="KAMPANGO PHONES AND ELECTRONICS"
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
                />
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    {t('Payment Receipt {receipt}', { receipt: completedReceipt.sale.receipt_number })}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {completedReceipt.settings?.shop_name || 'KAMPANGO PHONES AND ELECTRONICS'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t('Close')}
                onClick={() => setShowReceiptModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Receipt Preview */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Customer Information Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  {t('CUSTOMER INFORMATION')}
                </p>
                <p className="font-extrabold text-slate-900">
                  {t(completedReceipt.sale.customer_name || 'Walk-in Customer')}
                  {completedReceipt.sale.customer_code ? ` (${completedReceipt.sale.customer_code})` : ''}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-600">
                  {completedReceipt.sale.customer_phone && (
                    <span>
                      {t('Phone:')} <strong>{completedReceipt.sale.customer_phone}</strong>
                    </span>
                  )}
                  {completedReceipt.sale.customer_email && (
                    <span>
                      {t('Email:')} {completedReceipt.sale.customer_email}
                    </span>
                  )}
                  {completedReceipt.sale.customer_address && (
                    <span>
                      {t('Address:')} {completedReceipt.sale.customer_address}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/70">
                  {t('Date:')} {formatDate(completedReceipt.sale.sale_date, true)} · {t('Cashier:')}{' '}
                  <strong>{completedReceipt.sale.cashier_name}</strong> · {t('Payment Method:')}{' '}
                  <strong>{t(completedReceipt.sale.payment_method || 'Cash')}</strong>
                </p>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2 px-3 text-left font-bold">{t('Product')}</th>
                      <th className="py-2 px-2 text-center font-bold">{t('Qty')}</th>
                      <th className="py-2 px-3 text-right font-bold">{t('Total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(completedReceipt.items || []).map((it, i) => {
                      const unit = it.unit || it.unit_snapshot || 'piece';
                      return (
                        <tr key={i}>
                          <td className="py-2 px-3">
                            <p className="font-bold text-slate-900">{it.product_name_snapshot}</p>
                            <p className="text-[10px] text-slate-400">
                              {it.sku_snapshot} · {formatUnitPrice(it.unit_selling_price, unit)}
                            </p>
                          </td>
                          <td className="py-2 px-2 text-center font-bold">
                            {formatQtyWithUnit(it.quantity, unit)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatTZS(it.line_total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Payment Totals */}
              <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>{t('Subtotal:')}</span>
                  <span className="font-semibold">{formatTZS(completedReceipt.sale.subtotal_amount)}</span>
                </div>
                {Number(completedReceipt.sale.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>{t('Discount:')}</span>
                    <span className="font-bold">-{formatTZS(completedReceipt.sale.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-blue-200">
                  <span>{t('Total Payable:')}</span>
                  <span className="text-blue-700">{formatTZS(completedReceipt.sale.total_amount)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>{t('Amount Paid:')}</span>
                  <span>{formatTZS(completedReceipt.sale.cash_received)}</span>
                </div>
                {Number(completedReceipt.sale.change_amount || 0) > 0 && (
                  <div className="flex justify-between text-slate-700 font-semibold">
                    <span>{t('Change Given:')}</span>
                    <span>{formatTZS(completedReceipt.sale.change_amount)}</span>
                  </div>
                )}
                {Number(completedReceipt.sale.outstanding_balance || 0) > 0 && (
                  <div className="flex justify-between text-red-600 font-extrabold">
                    <span>{t('Balance Due:')}</span>
                    <span>{formatTZS(completedReceipt.sale.outstanding_balance)}</span>
                  </div>
                )}
              </div>

              {receiptShareFeedback && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-center">
                  {receiptShareFeedback}
                </div>
              )}
            </div>

            {/* Modal Action Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => printPaymentReceipt(completedReceipt, t)}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5" /> {t('Print Receipt')}
              </button>
              <button
                type="button"
                onClick={() => openWhatsAppPaymentReceipt(completedReceipt, t)}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                <MessageCircle className="w-3.5 h-3.5" /> {t('WhatsApp')}
              </button>
              <button
                type="button"
                onClick={() => handlePosShareReceipt(completedReceipt)}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                <Copy className="w-3.5 h-3.5" /> {t('Share / Copy')}
              </button>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold"
              >
                {t('Done')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCREEN 4: SALES HISTORY
// ============================================================================
export function SalesHistoryScreen({ onSelectSale, onNavigate }) {
  const { t } = useLanguage();
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (paymentStatus !== 'all') params.set('payment_status', paymentStatus);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const res = await apiRequest(`/sales?${params.toString()}`);
      setSales(res.sales || []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [paymentStatus, startDate, endDate]);

  const salesPg = usePagination(
    sales,
    5,
    `${paymentStatus}|${startDate}|${endDate}|${search}`
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Sales History')}</h1>
          <p className="text-xs text-slate-500">{t('All completed POS sales, credit invoices, and digital receipts')}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('pos')}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
        >
          {t('+ New POS Sale')}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <search className="flex-1 min-w-[200px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadSales();
            }}
            className="relative"
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search receipt #, customer name or phone...')}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </form>
        </search>

        <select
          aria-label={t('Filter by payment status')}
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
        >
          <option value="all">{t('All Payment Statuses')}</option>
          <option value="paid">{t('Paid (Full Cash)')}</option>
          <option value="partial">{t('Partial Payment (Credit)')}</option>
          <option value="unpaid">{t('Unpaid (Zero-Deposit Credit)')}</option>
        </select>

        <input
          type="date"
          aria-label={t('From date')}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
        />
        <input
          type="date"
          aria-label={t('To date')}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
        />
        <button
          type="button"
          onClick={loadSales}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
        >
          {t('Filter')}
        </button>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="table-region" role="region" aria-label={t('Sales history table')}>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Receipt #')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Date & Time')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Customer')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Total (TZS)')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Cash Paid')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Debt Balance')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Payment')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {t('Loading sales transactions...')}
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {t('No matching sales records found.')}
                  </td>
                </tr>
              ) : (
                salesPg.pageItems.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-extrabold text-blue-600">{s.receipt_number}</td>
                    <td className="py-3 px-4 text-slate-600">{formatDate(s.sale_date, true)}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{t(s.customer_name)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatTZS(s.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-semibold">
                      {formatTZS(s.total_amount - s.outstanding_balance)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-red-600">
                      {Number(s.outstanding_balance) > 0 ? formatTZS(s.outstanding_balance) : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                          s.payment_status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.payment_status === 'partial'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {t(s.payment_status)} ({t(s.payment_method)})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectSale(s.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> {t('View')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && <Pagination {...salesPg.paginationProps} />}
      </div>
    </div>
  );
}

// ============================================================================
// SCREEN 5: SALE DETAILS & RECEIPT VIEW
// ============================================================================
export function SaleDetailsScreen({ saleId, onBack, onNewSale }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!saleId) return;
    setLoading(true);
    apiRequest(`/sales/${saleId}`)
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, [saleId]);

  if (loading || !data) {
    return <div className="p-8 text-center text-xs text-slate-500">{t('Loading sale receipt details...')}</div>;
  }

  const { sale, items = [], repayments = [], warranties = [], settings = {} } = data;

  const receiptBundle = { sale, items, warranties, settings };

  const handlePrintReceipt = () => {
    printPaymentReceipt(receiptBundle, t);
  };

  const handleShareReceipt = async () => {
    const res = await sharePaymentReceipt(receiptBundle, t);
    if (res === 'shared' || res === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleWhatsAppReceipt = () => {
    openWhatsAppPaymentReceipt(receiptBundle, t);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
        >
          {t('← Back to Sales History')}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrintReceipt}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800"
          >
            <Printer className="w-3.5 h-3.5" /> {t('Print Receipt')}
          </button>
          <button
            type="button"
            onClick={handleWhatsAppReceipt}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white"
          >
            <MessageCircle className="w-3.5 h-3.5" /> {t('WhatsApp')}
          </button>
          <button
            type="button"
            onClick={handleShareReceipt}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700"
          >
            <Share2 className="w-3.5 h-3.5" /> {copied ? t('Copied Digital Receipt!') : t('Share Digital Receipt')}
          </button>
          <button
            type="button"
            onClick={onNewSale}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white"
          >
            {t('New Sale')}
          </button>
        </div>
      </div>

      {/* Sale Breakdown Card (Matches Screen 5 Mockup) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <img
              src="/logo.png"
              alt="KAMPANGO PHONES AND ELECTRONICS"
              className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-slate-900">
                  {t('Sale #{receipt}', { receipt: sale.receipt_number })}
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 capitalize">
                  {t(sale.status)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('Date:')} {formatDate(sale.sale_date, true)} · {t('Cashier:')}{' '}
                <strong className="text-slate-700">{sale.cashier_name}</strong>
              </p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-900">
              {t('Customer:')} {t(sale.customer_name)}
            </p>
            {sale.customer_phone && <p className="text-slate-500">{sale.customer_phone}</p>}
            <p className="text-slate-400 mt-0.5">
              {t('Scenario:')} {t(sale.payment_scenario)}
            </p>
          </div>
        </div>

        {/* Itemized Products Table */}
        <div className="table-region" role="region" aria-label={t('Sold items breakdown')}>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Product')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Qty')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Unit Price')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Preserved Cost')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Line Total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {item.image_url && (
                        <img
                          src={resolveMediaUrl(item.image_url)}
                          alt={item.product_name_snapshot}
                          className="w-10 h-10 rounded-lg object-cover block"
                        />
                      )}
                      <div>
                        <p className="font-bold text-slate-900">{item.product_name_snapshot}</p>
                        <p className="text-[11px] text-slate-400">
                          {t('SKU: {sku} · Warranty: {months}M', {
                            sku: item.sku_snapshot,
                            months: item.warranty_months,
                          })}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-bold">
                    {formatQtyWithUnit(item.quantity, item.unit || item.unit_snapshot)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatUnitPrice(item.unit_selling_price, item.unit || item.unit_snapshot)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500">
                    {formatUnitPrice(item.historical_unit_cost, item.unit || item.unit_snapshot)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                    {formatTZS(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Repayments Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t('Warranties & Repayments Linked')}
            </h3>
            {warranties.map((w) => (
              <div key={w.id} className="text-xs p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                <span className="font-bold text-blue-800">{w.warranty_number}</span> — {t('Expires')}{' '}
                <strong>{formatDate(w.expiry_date)}</strong> ({w.serial_or_imei})
              </div>
            ))}
            {repayments.map((rp) => (
              <div key={rp.id} className="text-xs p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                {t('Repayment')} <strong>{rp.receipt_number}</strong>: +{formatTZS(rp.amount)} {t('on')}{' '}
                {formatDate(rp.payment_date, true)}
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{t('Subtotal:')}</span>
              <span className="font-bold">{formatTZS(sale.subtotal_amount)}</span>
            </div>
            {Number(sale.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>
                  {t('Discount ({reason}):', {
                    reason: sale.discount_reason || t(sale.discount_type),
                  })}
                </span>
                <span className="font-bold">-{formatTZS(sale.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>{t('Total Amount:')}</span>
              <span className="text-blue-600">{formatTZS(sale.total_amount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>{t('Initial Cash Received:')}</span>
              <span>{formatTZS(sale.cash_received)}</span>
            </div>
            <div className="flex justify-between text-red-600 font-extrabold">
              <span>{t('Remaining Outstanding Balance:')}</span>
              <span>{formatTZS(sale.outstanding_balance)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


