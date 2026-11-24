import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  Boxes,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  FolderKanban,
  Globe,
  Image,
  MessageCircle,
  PackagePlus,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Trash2,
  Truck,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import { apiRequest, refreshOfflineBootstrap, resolveMediaUrl, uploadImageFile } from '../services/api';
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
// SCREEN 6: PRODUCTS CATALOGUE & MANAGEMENT
// ============================================================================
export function ProductsScreen({
  user,
  initialCategoryId = '',
  initialPurchaseFilter = 'all',
  onClearCategory,
  onBackToCategories,
  onAddProduct,
  onEditProduct,
  onOrderFromSupplier,
  onTransferProduct,
}) {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(initialCategoryId || '');
  const [statusFilter, setStatusFilter] = useState('active');
  const [purchaseFilter, setPurchaseFilter] = useState(initialPurchaseFilter || 'all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setCategoryId(initialCategoryId || '');
  }, [initialCategoryId]);

  useEffect(() => {
    setPurchaseFilter(initialPurchaseFilter || 'all');
  }, [initialPurchaseFilter]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (categoryId) params.set('category_id', categoryId);
      if (purchaseFilter && purchaseFilter !== 'all') params.set('purchase_filter', purchaseFilter);
      if (search) params.set('search', search);

      const [prodRes, catRes] = await Promise.all([
        apiRequest(`/products?${params.toString()}`),
        apiRequest('/categories'),
      ]);
      setProducts(prodRes.products || []);
      setCategories(catRes.categories || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [categoryId, statusFilter, purchaseFilter]);

  const activeCategory = categories.find((c) => String(c.id) === String(categoryId));

  const handleToggleArchive = async (product) => {
    try {
      const nextStatus = product.status === 'active' ? 'archived' : 'active';
      const res = await apiRequest(`/products/${product.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setMessage({ type: 'success', text: res.message });
      loadProducts();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const isAdmin = (user?.role_slugs || []).includes('owner');
  const canManage = hasPermission(user, 'products.manage');
  const canOrder = hasPermission(user, 'purchases.manage');
  const canTransfer = hasPermission(user, 'inventory.adjust');
  const productsPg = usePagination(
    products,
    5,
    `${search}|${categoryId}|${statusFilter}|${purchaseFilter}`
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Products Catalogue')}</h1>
          <p className="text-xs text-slate-500">
            {t('Quantity-based stock management with soft archiving to preserve historical sales')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canTransfer && onTransferProduct && (
            <button
              type="button"
              onClick={() => onTransferProduct(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
            >
              <ArrowRightLeft className="w-4 h-4" /> {t('Transfer Product')}
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={onAddProduct}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> {t('Add Product')}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold ${
            message.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {t(message.text)}
        </div>
      )}

      {activeCategory && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-blue-900">
              {t('Viewing Category: {name}', { name: t(activeCategory.name) })}
            </p>
            {activeCategory.description && (
              <p className="text-xs text-blue-700 mt-0.5">{t(activeCategory.description)}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onBackToCategories && (
              <button
                type="button"
                onClick={onBackToCategories}
                className="px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-xs font-bold text-blue-700 hover:bg-blue-100"
              >
                {t('← Back to Categories')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setCategoryId('');
                onClearCategory?.();
              }}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              {t('Show All Categories')}
            </button>
          </div>
        </div>
      )}

      {/* Stock Arrival & Purchased Products Filter Tabs (Visible to Admin & Employees) */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {[
          { id: 'all', label: 'All Products' },
          { id: 'new', label: 'New Purchased Products' },
          { id: 'old', label: 'Old Products' },
          { id: 'purchased', label: 'Purchased Products' },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setPurchaseFilter(tabItem.id)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              purchaseFilter === tabItem.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(tabItem.label)}
          </button>
        ))}
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <search className="flex-1 min-w-[220px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadProducts();
            }}
            className="relative"
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search by product name, SKU, barcode, brand, or model...')}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </form>
        </search>

        <select
          aria-label={t('Filter by category')}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
        >
          <option value="">{t('All Categories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {t(c.name)}
            </option>
          ))}
        </select>

        <select
          aria-label={t('Filter by product status')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
        >
          <option value="active">{t('Active Products')}</option>
          <option value="archived">{t('Archived Products')}</option>
          <option value="all">{t('All Products')}</option>
        </select>

        <button
          type="button"
          onClick={loadProducts}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
        >
          {t('Search')}
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="table-region" role="region" aria-label={t('Products catalogue')}>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Product')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Category')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Purchase Cost')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Selling Price')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Stock')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Status')}</th>
                {isAdmin && <th className="py-3 px-4 text-center font-bold">{t('Actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-slate-400">
                    {t('Loading products...')}
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-slate-400">
                    {t('No products found matching your criteria.')}
                  </td>
                </tr>
              ) : (
                productsPg.pageItems.map((p) => {
                  const avail = Number(p.available_quantity || 0);
                  const isOut = avail <= 0;
                  const isLow = !isOut && avail <= Number(p.min_stock_level || 5);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              resolveMediaUrl(p.image_url) ||
                              'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=120&q=80'
                            }
                            alt={p.name}
                            width="44"
                            height="44"
                            loading="lazy"
                            decoding="async"
                            className="w-11 h-11 rounded-xl object-cover border border-slate-200 block shrink-0"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-bold text-slate-900">{p.name}</p>
                              {isMeterUnit(p.unit) && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
                                  {t('Sold per Meter')}
                                </span>
                              )}
                              {Number(p.is_newly_purchased) === 1 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700">
                                  {t('New Purchased')}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                  {t('Old Stock')}
                                </span>
                              )}
                              {canOrder && Number(p.pending_order_qty || 0) > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  {t('Pending Order (+{qty})', { qty: p.pending_order_qty })}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              SKU: {p.sku} {p.brand ? `· ${p.brand}` : ''} {p.model ? p.model : ''}
                            </p>
                            {Number(p.total_purchased_qty) > 0 && (
                              <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                                {t('Purchased: +{qty}', { qty: p.total_purchased_qty })}
                                {p.last_purchased_at
                                  ? ` · ${t('Last received: {date}', { date: formatDate(p.last_purchased_at) })}`
                                  : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{t(p.category_name)}</td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {formatUnitPrice(p.purchase_price, p.unit)}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                        {formatUnitPrice(p.selling_price, p.unit)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {formatQtyWithUnit(avail, p.unit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.status === 'archived' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                            {t('Archived')}
                          </span>
                        ) : isOut ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                            {t('Out of Stock')}
                          </span>
                        ) : isLow ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            {t('Low Stock')}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            {t('In Stock')}
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            {canOrder && onOrderFromSupplier && (isOut || isLow) && p.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => onOrderFromSupplier(p)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold"
                                title={t('Order from Supplier')}
                              >
                                <Truck className="w-3 h-3" /> {t('Order')}
                              </button>
                            )}
                            {canTransfer && onTransferProduct && p.status === 'active' && avail > 0 && (
                              <button
                                type="button"
                                onClick={() => onTransferProduct(p)}
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                                title={t('Transfer Product to Another Shop')}
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditProduct(p)}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600"
                              title={t('Edit Product')}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleArchive(p)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                              title={p.status === 'active' ? t('Archive Product') : t('Restore Product')}
                            >
                              {p.status === 'active' ? (
                                <Archive className="w-3.5 h-3.5" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && <Pagination {...productsPg.paginationProps} />}
      </div>
    </div>
  );
}

// ============================================================================
// SCREEN 7: ADD / EDIT PRODUCT FORM
// ============================================================================
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });
}

async function prepareDeviceImageForUpload(file) {
  const rawDataUrl = await readFileAsDataUrl(file);
  const type = (file.type || '').toLowerCase();

  // Keep SVG & animated GIF unmodified
  if (type === 'image/svg+xml' || type === 'image/gif') {
    return { uploadFile: file, previewDataUrl: rawDataUrl };
  }

  // Resize large camera photos via offscreen canvas for fast, reliable upload (max 1200px)
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const maxDim = 1200;
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim && file.size <= 1.5 * 1024 * 1024) {
          resolve({ uploadFile: file, previewDataUrl: rawDataUrl });
          return;
        }
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ uploadFile: file, previewDataUrl: rawDataUrl });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const outMime = type === 'image/png' ? 'image/png' : 'image/jpeg';
        const outExt = outMime === 'image/png' ? 'png' : 'jpg';
        const compressedDataUrl = canvas.toDataURL(outMime, 0.86);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({ uploadFile: file, previewDataUrl: compressedDataUrl });
              return;
            }
            const baseName = (file.name || 'product').replace(/\.[^.]+$/, '');
            const compressedFile = new File([blob], `${baseName}.${outExt}`, { type: outMime });
            resolve({ uploadFile: compressedFile, previewDataUrl: compressedDataUrl });
          },
          outMime,
          0.86
        );
      } catch {
        resolve({ uploadFile: file, previewDataUrl: rawDataUrl });
      }
    };
    img.onerror = () => resolve({ uploadFile: file, previewDataUrl: rawDataUrl });
    img.src = rawDataUrl;
  });
}

export function AddEditProductScreen({ user, editingProduct, defaultCategoryId = '', onSaved, onCancel }) {
  const { t } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [imageSource, setImageSource] = useState('device');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const [form, setForm] = useState({
    name: editingProduct?.name || '',
    category_id: editingProduct?.category_id || defaultCategoryId || '',
    brand: editingProduct?.brand || '',
    model: editingProduct?.model || '',
    sku: editingProduct?.sku || '',
    barcode: editingProduct?.barcode || '',
    purchase_price: editingProduct?.purchase_price || '',
    selling_price: editingProduct?.selling_price || '',
    unit: editingProduct?.unit || 'piece',
    initial_quantity: editingProduct ? editingProduct.available_quantity : '10',
    min_stock_level: editingProduct?.min_stock_level || '5',
    warranty_months: editingProduct?.warranty_months ?? '12',
    image_url:
      editingProduct?.image_url ||
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&q=80',
    description: editingProduct?.description || '',
    status: editingProduct?.status || 'active',
    reason: 'Updated product catalogue details',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm({
      name: editingProduct?.name || '',
      category_id: editingProduct?.category_id || defaultCategoryId || '',
      brand: editingProduct?.brand || '',
      model: editingProduct?.model || '',
      sku: editingProduct?.sku || '',
      barcode: editingProduct?.barcode || '',
      purchase_price: editingProduct?.purchase_price || '',
      selling_price: editingProduct?.selling_price || '',
      unit: editingProduct?.unit || 'piece',
      initial_quantity: editingProduct ? editingProduct.available_quantity : '10',
      min_stock_level: editingProduct?.min_stock_level || '5',
      warranty_months: editingProduct?.warranty_months ?? '12',
      image_url:
        editingProduct?.image_url ||
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&q=80',
      description: editingProduct?.description || '',
      status: editingProduct?.status || 'active',
      reason: 'Updated product catalogue details',
    });
    setLocalPreviewUrl('');
    setSelectedFileName('');
    setUploadStatus(null);
    setError(null);
  }, [editingProduct, defaultCategoryId]);

  useEffect(() => {
    apiRequest('/categories').then((res) => {
      const list = res.categories || [];
      setCategories(list);
      setForm((f) => (!f.category_id && list.length > 0 ? { ...f, category_id: list[0].id } : f));
    });
  }, []);

  const handleDeviceImageUpload = async (e) => {
    const file = e.target.files?.[0];
    // Reset input value so selecting the same file again still triggers onChange
    e.target.value = '';
    if (!file) return;

    const validExt = /\.(jpe?g|png|webp|gif|svg|bmp|avif)$/i.test(file.name || '');
    if (!file.type.startsWith('image/') && !validExt) {
      setUploadStatus({
        type: 'error',
        text: t('Please choose a valid image file (JPG, PNG, WebP, GIF, or SVG).'),
      });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadStatus({
        type: 'error',
        text: t('Image is too large (max 20MB).'),
      });
      return;
    }

    setSelectedFileName(file.name);
    setUploadingImage(true);
    setUploadStatus(null);
    setError(null);

    try {
      const { uploadFile, previewDataUrl } = await prepareDeviceImageForUpload(file);
      // Show instant local preview immediately
      setLocalPreviewUrl(previewDataUrl);

      // Upload via multipart FormData first (fast, binary-safe), fallback to base64 JSON if needed
      let uploadRes = null;
      try {
        uploadRes = await uploadImageFile(uploadFile);
      } catch (multipartErr) {
        if (!navigator.onLine) {
          setForm((prev) => ({ ...prev, image_url: previewDataUrl }));
          setUploadStatus({
            type: 'success',
            text: t('Saved offline preview (will upload when online)'),
          });
          return;
        }
        try {
          uploadRes = await apiRequest('/upload', {
            method: 'POST',
            body: JSON.stringify({ base64: previewDataUrl }),
          });
        } catch {
          throw multipartErr;
        }
      }

      if (uploadRes?.url) {
        setForm((prev) => ({ ...prev, image_url: uploadRes.url }));
        setUploadStatus({
          type: 'success',
          text: t('✓ Uploaded: {file}', { file: file.name }),
        });
      } else {
        setForm((prev) => ({ ...prev, image_url: previewDataUrl }));
        setUploadStatus({
          type: 'success',
          text: t('✓ Selected: {file}', { file: file.name }),
        });
      }
    } catch (err) {
      setUploadStatus({
        type: 'error',
        text: t(err.message || 'Failed to upload image. Please try again.'),
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const isAdmin = (user?.role_slugs || []).includes('owner');
  const canEditCost = hasPermission(user, 'products.edit_cost');

  if (editingProduct && !isAdmin) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl border border-red-200 text-center space-y-4 my-8 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-extrabold text-slate-900">{t('Access Restricted: Admin Only')}</h2>
        <p className="text-xs text-slate-600">
          {t('Only the Shop Admin can edit or archive products.')}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
        >
          {t('Back to Products')}
        </button>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploadingImage) return;
    setSaving(true);
    setError(null);
    try {
      if (editingProduct) {
        await apiRequest(`/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        await apiRequest('/products', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      await refreshOfflineBootstrap().catch(() => {});
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = localPreviewUrl || resolveMediaUrl(form.image_url);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {editingProduct ? t('Edit Product: {name}', { name: editingProduct.name }) : t('Add New Product')}
          </h1>
          <p className="text-xs text-slate-500">
            {t('Register product specifications, SKU, barcode, pricing in TZS, and warranty rules')}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          {t('Cancel')}
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
          {t(error)}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6"
      >
        {/* Left Image Column: Dual Mode (From Device & HTTPS URL) */}
        <div className="md:col-span-4 space-y-3">
          <label className="block text-xs font-bold text-slate-700">{t('Product Image')}</label>
          <div className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center p-2 relative group">
            {previewSrc ? (
              <img
                key={previewSrc}
                src={previewSrc}
                alt={t('Product preview')}
                className="w-full h-full object-cover rounded-xl block"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&q=80';
                }}
              />
            ) : (
              <div className="text-center p-4 text-slate-400">
                <Image className="w-8 h-8 mx-auto mb-1 opacity-40" />
                <span className="text-[11px]">{t('No image selected')}</span>
              </div>
            )}
            {uploadingImage && (
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                <span className="px-3 py-1.5 rounded-full bg-white text-slate-900 text-xs font-bold shadow">
                  {t('Uploading image...')}
                </span>
              </div>
            )}
            {previewSrc && !uploadingImage && (
              <button
                type="button"
                onClick={() => {
                  setForm({ ...form, image_url: '' });
                  setLocalPreviewUrl('');
                  setSelectedFileName('');
                  setUploadStatus(null);
                }}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700"
                title={t('Remove Image')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle between Upload from Device and HTTPS URL */}
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setImageSource('device')}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                imageSource === 'device'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" /> {t('From Device')}
            </button>
            <button
              type="button"
              onClick={() => setImageSource('url')}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                imageSource === 'url'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> {t('HTTPS Link')}
            </button>
          </div>

          {imageSource === 'device' ? (
            <div className="space-y-1.5">
              <label
                htmlFor="device-file-upload"
                className={`w-full border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 rounded-xl p-3.5 flex flex-col items-center justify-center cursor-pointer transition text-center ${
                  uploadingImage ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <UploadCloud className="w-5 h-5 text-blue-600 mb-1" />
                <span className="text-xs font-bold text-blue-700">
                  {uploadingImage ? t('Uploading image...') : t('Choose Image from Device')}
                </span>
                <span className="text-[10px] text-slate-500">{t('JPG, PNG, WebP supported')}</span>
                <input
                  id="device-file-upload"
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage}
                  onChange={handleDeviceImageUpload}
                  className="hidden"
                />
              </label>
              {uploadStatus ? (
                <p
                  className={`text-[11px] font-semibold break-words ${
                    uploadStatus.type === 'error' ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {uploadStatus.text}
                </p>
              ) : (
                selectedFileName && (
                  <p className="text-[10px] text-emerald-600 font-semibold truncate">
                    {t('✓ Selected: {file}', { file: selectedFileName })}
                  </p>
                )
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="prod-img" className="block text-[11px] font-semibold text-slate-600 mb-1">
                {t('Direct Web Image URL (HTTPS)')}
              </label>
              <input
                id="prod-img"
                type="text"
                inputMode="url"
                placeholder={t('https://example.com/product.jpg')}
                value={form.image_url}
                onChange={(e) => {
                  setLocalPreviewUrl('');
                  setUploadStatus(null);
                  setForm({ ...form, image_url: e.target.value });
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          )}
        </div>

        {/* Right Details Column */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="prod-name" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Product Name')} <span className="text-red-500">*</span>
            </label>
            <input
              id="prod-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => {
                const nextName = e.target.value;
                const autoMeter =
                  !editingProduct &&
                  /carpet|zulia/i.test(nextName) &&
                  form.unit !== 'meter';
                setForm({
                  ...form,
                  name: nextName,
                  ...(autoMeter ? { unit: 'meter' } : {}),
                });
              }}
              placeholder={t('e.g. iPhone 15 Pro 256GB')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label htmlFor="prod-cat" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Category')} <span className="text-red-500">*</span>
            </label>
            <select
              id="prod-cat"
              required
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.name)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prod-unit" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Selling Unit')} <span className="text-red-500">*</span>
            </label>
            <select
              id="prod-unit"
              value={form.unit || 'piece'}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value="piece">{t('Piece (pcs)')}</option>
              <option value="meter">{t('Meter (m) — e.g. Carpets')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="prod-sku" className="block text-xs font-bold text-slate-700 mb-1">
              {t('SKU Code (Auto-generated if blank)')}
            </label>
            <input
              id="prod-sku"
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder={t('e.g. PHN-IP15P-256')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label htmlFor="prod-brand" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Brand')}
            </label>
            <input
              id="prod-brand"
              type="text"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              placeholder={t('e.g. Apple, Samsung, Anker')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label htmlFor="prod-model" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Model / Barcode')}
            </label>
            <input
              id="prod-model"
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder={t('e.g. A3102 / 8901001...')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label htmlFor="prod-cost" className="block text-xs font-bold text-slate-700 mb-1">
              {isMeterUnit(form.unit) ? t('Purchase Price per Meter (TZS)') : t('Purchase Price (TZS)')}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              id="prod-cost"
              type="number"
              min="0"
              required
              disabled={editingProduct && !canEditCost}
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs disabled:bg-slate-100"
            />
          </div>

          <div>
            <label htmlFor="prod-price" className="block text-xs font-bold text-slate-700 mb-1">
              {isMeterUnit(form.unit) ? t('Selling Price per Meter (TZS)') : t('Selling Price (TZS)')}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              id="prod-price"
              type="number"
              min="1"
              required
              value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          {!editingProduct && (
            <div>
              <label htmlFor="prod-init-qty" className="block text-xs font-bold text-slate-700 mb-1">
                {isMeterUnit(form.unit) ? t('Opening Stock (Meters)') : t('Opening Stock Quantity')}
              </label>
              <input
                id="prod-init-qty"
                type="number"
                min="0"
                step={isMeterUnit(form.unit) ? '0.01' : '1'}
                value={form.initial_quantity}
                onChange={(e) => setForm({ ...form, initial_quantity: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          )}

          <div>
            <label htmlFor="prod-min-stock" className="block text-xs font-bold text-slate-700 mb-1">
              {isMeterUnit(form.unit) ? t('Minimum Stock Alert (Meters)') : t('Minimum Stock Alert Level')}
            </label>
            <input
              id="prod-min-stock"
              type="number"
              min="0"
              step={isMeterUnit(form.unit) ? '0.01' : '1'}
              value={form.min_stock_level}
              onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label htmlFor="prod-warranty" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Warranty Duration (Months)')}
            </label>
            <input
              id="prod-warranty"
              type="number"
              min="0"
              value={form.warranty_months}
              onChange={(e) => setForm({ ...form, warranty_months: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="prod-desc" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Description & Specifications')}
            </label>
            <textarea
              id="prod-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-sm"
            >
              {uploadingImage ? t('Uploading image...') : saving ? t('Saving...') : t('Save Product')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
            >
              {t('Cancel')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// SCREEN 8: CATEGORIES MANAGEMENT
// ============================================================================
export function CategoriesScreen({ user, onSelectCategory }) {
  const { t } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [message, setMessage] = useState(null);

  const loadCategories = async () => {
    const res = await apiRequest('/categories');
    setCategories(res.categories || []);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const categoriesPg = usePagination(categories, 8);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (editingCat) {
        await apiRequest(`/categories/${editingCat.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, description, status: editingCat.status }),
        });
      } else {
        await apiRequest('/categories', {
          method: 'POST',
          body: JSON.stringify({ name, description }),
        });
      }
      setName('');
      setDescription('');
      setEditingCat(null);
      setMessage({ type: 'success', text: 'Category saved successfully.' });
      loadCategories();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Product Categories')}</h1>
          <p className="text-xs text-slate-500">
            {t('Shop product categories + custom category management')} · {t('Click any category card to view its products')}
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
          {t(message.text)}
        </div>
      )}

      {/* Add / Edit Category Bar */}
      {hasPermission(user, 'categories.manage') && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-3 shadow-sm"
        >
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="cat-name" className="block text-xs font-bold text-slate-700 mb-1">
              {editingCat ? t('Edit Category: {name}', { name: t(editingCat.name) }) : t('New Category Name')}
            </label>
            <input
              id="cat-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('e.g. Gaming Consoles & VR')}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="cat-desc" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Description')}
            </label>
            <input
              id="cat-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('Category summary...')}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
          >
            {editingCat ? t('Update Category') : t('+ Add Category')}
          </button>
          {editingCat && (
            <button
              type="button"
              onClick={() => {
                setEditingCat(null);
                setName('');
                setDescription('');
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
            >
              {t('Cancel')}
            </button>
          )}
        </form>
      )}

      {/* Visual Grid of Categories (Clickable to navigate directly into that category) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categoriesPg.pageItems.map((cat) => (
          <div
            key={cat.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectCategory?.(cat.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectCategory?.(cat.id);
              }
            }}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-blue-500 hover:shadow-md cursor-pointer transition flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition flex items-center justify-center">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                  {t('{count} products', { count: cat.active_products_count })}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition">
                {t(cat.name)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t(cat.description)}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                {t('{count} units in stock', { count: cat.total_stock })}
              </span>
              <div className="flex items-center gap-2.5">
                {hasPermission(user, 'categories.manage') && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCat(cat);
                      setName(cat.name);
                      setDescription(cat.description || '');
                    }}
                    className="text-slate-500 font-bold hover:text-blue-600 hover:underline"
                  >
                    {t('Edit')}
                  </button>
                )}
                <span className="text-blue-600 font-extrabold">{t('View Category')} →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination
        {...categoriesPg.paginationProps}
        pageSizeOptions={[5, 8, 12, 16, 24]}
        standalone
      />
    </div>
  );
}

// ============================================================================
// SCREEN 9 & 10: PURCHASES, PENDING ORDERS & APPROVE ORDERS (ADMIN ONLY)
// ============================================================================
export function PurchasesScreen({
  user,
  onNewPurchase,
  onOpenApproveOrders,
  onViewPurchasedProducts,
}) {
  const { t } = useLanguage();
  const [purchases, setPurchases] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const canViewPurchases = !user || hasPermission(user, 'purchases.view');

  useEffect(() => {
    if (!canViewPurchases) {
      setLoading(false);
      return;
    }
    apiRequest('/purchases')
      .then((res) => {
        setPurchases(res.purchases || []);
        setPendingCount(Number(res.pending_count || 0));
      })
      .finally(() => setLoading(false));
  }, [canViewPurchases]);

  const purchasesPg = usePagination(purchases, 5);

  if (!canViewPurchases) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl border border-red-200 text-center space-y-4 my-8 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-extrabold text-slate-900">{t('Access Restricted: Admin Only')}</h2>
        <p className="text-xs text-slate-600">
          {t('The Purchases module is strictly reserved for the Shop Admin. Employees can view newly purchased and restocked products in Products Catalogue and Dashboard.')}
        </p>
        {onViewPurchasedProducts && (
          <button
            type="button"
            onClick={onViewPurchasedProducts}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
          >
            {t('View Purchased Products')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Purchases & Goods Receipt')}</h1>
          <p className="text-xs text-slate-500">
            {t('Track supplier stock orders, pending deliveries, weighted-average cost updates, and supplier balances')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenApproveOrders && (
            <button
              type="button"
              onClick={onOpenApproveOrders}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm border transition ${
                pendingCount > 0
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('Approve Orders')}
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white text-amber-700 text-[10px] font-extrabold">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onNewPurchase}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
          >
            {t('+ New Purchase Order')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="table-region" role="region" aria-label={t('Purchases list')}>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Ref #')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Date')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Supplier')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Items')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Total (TZS)')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Paid')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Supplier Balance')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {t('Loading purchases...')}
                  </td>
                </tr>
              ) : (
                purchasesPg.pageItems.map((p) => {
                  const isPending = p.status === 'pending' || p.status === 'draft';
                  const isCancelled = p.status === 'cancelled';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-extrabold text-blue-600">{p.reference_number}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(p.purchase_date)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{p.supplier_name}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {(p.items || [])
                          .map((i) =>
                            isPending
                              ? `${i.product_name} (${i.ordered_quantity} ${t('ordered')})`
                              : `${i.product_name} (${i.received_quantity})`
                          )
                          .join(', ')}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                        {formatTZS(p.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-semibold">
                        {formatTZS(p.amount_paid)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-red-600">
                        {!isPending && !isCancelled && Number(p.outstanding_balance) > 0
                          ? formatTZS(p.outstanding_balance)
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                            isPending
                              ? 'bg-amber-100 text-amber-800'
                              : isCancelled
                              ? 'bg-red-100 text-red-700'
                              : p.payment_status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isPending
                            ? t('Pending Approval')
                            : isCancelled
                            ? t('cancelled')
                            : `${t(p.status)} · ${t(p.payment_status)}`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && <Pagination {...purchasesPg.paginationProps} />}
      </div>
    </div>
  );
}

export function NewPurchaseScreen({ user, prefillProduct = null, onSaved, onCancel }) {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('pending');
  const [additionalCosts, setAdditionalCosts] = useState('0');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([
    { product_id: '', ordered_quantity: 10, received_quantity: 0, unit_purchase_price: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const canManagePurchases = !user || hasPermission(user, 'purchases.manage');

  useEffect(() => {
    if (!canManagePurchases) return;
    Promise.all([apiRequest('/suppliers'), apiRequest('/products?status=active')]).then(
      ([sRes, pRes]) => {
        const sups = sRes.suppliers || [];
        const prods = pRes.products || [];
        setSuppliers(sups);
        setProducts(prods);
        if (sups.length > 0) setSupplierId(String(sups[0].id));

        if (prefillProduct) {
          const matched = prods.find((p) => String(p.id) === String(prefillProduct.id)) || prefillProduct;
          const avail = Number(matched.available_quantity || 0);
          const minLvl = Number(matched.min_stock_level || 5);
          const suggestedQty = Math.max(10, minLvl * 2 - avail);
          setLines([
            {
              product_id: String(matched.id),
              ordered_quantity: suggestedQty,
              received_quantity: 0,
              unit_purchase_price: String(matched.purchase_price || 10000),
            },
          ]);
          setStatus('pending');
          setNotes(
            avail <= 0
              ? `Out-of-stock reorder for ${matched.name} (${matched.sku})`
              : `Minimum stock reorder for ${matched.name} (${matched.sku})`
          );
        } else if (prods.length > 0) {
          setLines([
            {
              product_id: String(prods[0].id),
              ordered_quantity: 10,
              received_quantity: 0,
              unit_purchase_price: String(prods[0].purchase_price),
            },
          ]);
        }
      }
    );
  }, [canManagePurchases, prefillProduct]);

  if (!canManagePurchases) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl border border-red-200 text-center space-y-4 my-8 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-extrabold text-slate-900">{t('Access Restricted: Admin Only')}</h2>
        <p className="text-xs text-slate-600">
          {t('The Purchases module is strictly reserved for the Shop Admin. Employees can view newly purchased and restocked products in Products Catalogue and Dashboard.')}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
        >
          {t('View Purchased Products')}
        </button>
      </div>
    );
  }

  const isPendingOrder = status === 'pending' || status === 'draft';

  const subtotal = lines.reduce(
    (sum, l) => sum + Number(l.ordered_quantity || 0) * Number(l.unit_purchase_price || 0),
    0
  );
  const grandTotal = subtotal + Number(additionalCosts || 0);

  const handleProductChange = (idx, pid) => {
    const prod = products.find((p) => String(p.id) === String(pid));
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              product_id: pid,
              unit_purchase_price: prod ? String(prod.purchase_price) : l.unit_purchase_price,
            }
          : l
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await apiRequest('/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          purchase_date: purchaseDate,
          status,
          additional_costs: Number(additionalCosts || 0),
          amount_paid: isPendingOrder ? 0 : amountPaid === '' ? grandTotal : Number(amountPaid),
          payment_method: paymentMethod,
          notes,
          items: lines,
        }),
      });
      if (!isPendingOrder) {
        await refreshOfflineBootstrap().catch(() => {});
      }
      onSaved(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {prefillProduct ? t('Order Low / Out-of-Stock Product from Supplier') : t('Place Supplier Purchase Order')}
          </h1>
          <p className="text-xs text-slate-500">
            {t('Admin-only ordering: orders stay Pending until goods arrive and are approved in Approve Orders')}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold"
        >
          {t('Cancel')}
        </button>
      </div>

      {prefillProduct && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold text-amber-900">
              {t('Reordering Alert Item: {name} ({sku})', {
                name: prefillProduct.name,
                sku: prefillProduct.sku,
              })}
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              {t('Current Stock: {qty} · Minimum Level: {min}', {
                qty: prefillProduct.available_quantity ?? 0,
                min: prefillProduct.min_stock_level ?? 5,
              })}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-600 text-white text-[11px] font-extrabold">
            {t('Pending Approval Workflow')}
          </span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
          {t(error)}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="pur-supplier" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Supplier')} <span className="text-red-500">*</span>
            </label>
            <select
              id="pur-supplier"
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pur-date" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Order Date')}
            </label>
            <input
              id="pur-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label htmlFor="pur-status" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Order Status')}
            </label>
            <select
              id="pur-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="pending">{t('Pending Order (Approve When Stock Arrives)')}</option>
              <option value="received">{t('Received Immediately (Increase Stock Now)')}</option>
              <option value="partially_received">{t('Partially Received')}</option>
            </select>
          </div>
        </div>

        {isPendingOrder && (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              {t('This order will be saved as Pending. Inventory stock will NOT change until the stock arrives and you approve it in the Approve Orders module.')}
            </span>
          </div>
        )}

        {/* Line Items Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">{t('Ordered Products')}</label>
            <button
              type="button"
              onClick={() =>
                setLines([
                  ...lines,
                  {
                    product_id: products[0]?.id ? String(products[0].id) : '',
                    ordered_quantity: 5,
                    received_quantity: 0,
                    unit_purchase_price: products[0]?.purchase_price || '',
                  },
                ])
              }
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              {t('+ Add Product Row')}
            </button>
          </div>

          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl">
              <div className="sm:col-span-5">
                <select
                  aria-label={t('Product')}
                  value={line.product_id}
                  onChange={(e) => handleProductChange(idx, e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <input
                  type="number"
                  min="1"
                  aria-label={t('Quantity')}
                  value={line.ordered_quantity}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx
                          ? { ...l, ordered_quantity: e.target.value, received_quantity: e.target.value }
                          : l
                      )
                    )
                  }
                  placeholder={t('Qty')}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <input
                  type="number"
                  min="1"
                  aria-label={t('Unit Purchase Price')}
                  value={line.unit_purchase_price}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, unit_purchase_price: e.target.value } : l))
                    )
                  }
                  placeholder={t('Unit Cost TZS')}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-1.5 font-bold text-xs text-slate-900">
                <span>
                  {formatTZS(Number(line.ordered_quantity || 0) * Number(line.unit_purchase_price || 0))}
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1 text-slate-400 hover:text-red-600"
                    title={t('Remove row')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          {!isPendingOrder ? (
            <div>
              <label htmlFor="pur-paid" className="block text-xs font-bold text-slate-700 mb-1">
                {t('Amount Paid Now (TZS) — Leave blank for Full Payment, or 0 for Credit')}
              </label>
              <input
                id="pur-paid"
                type="number"
                min="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={t('Full: {amount}', { amount: grandTotal })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="pur-method" className="block text-xs font-bold text-slate-700 mb-1">
                {t('Preferred Payment Method')}
              </label>
              <select
                id="pur-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="Cash">{t('Cash')}</option>
                <option value="Bank Transfer">{t('Bank Transfer')}</option>
                <option value="Mobile Money">{t('Mobile Money')}</option>
                <option value="Credit">{t('Credit')}</option>
              </select>
            </div>
          )}
          <div>
            <label htmlFor="pur-extra" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Additional Transport / Customs Cost (TZS)')}
            </label>
            <input
              id="pur-extra"
              type="number"
              min="0"
              value={additionalCosts}
              onChange={(e) => setAdditionalCosts(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div className="bg-blue-50/70 rounded-xl p-3 flex flex-col justify-center text-right">
            <span className="text-[11px] text-slate-500 font-semibold">{t('Order Grand Total')}</span>
            <span className="text-lg font-extrabold text-blue-700">{formatTZS(grandTotal)}</span>
          </div>
        </div>

        <div>
          <label htmlFor="pur-notes" className="block text-xs font-bold text-slate-700 mb-1">
            {t('Order Notes / Supplier Instructions')}
          </label>
          <input
            id="pur-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('e.g. Urgent restock delivery from Kariakoo supplier...')}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm"
          >
            {saving
              ? t('Saving Order...')
              : isPendingOrder
              ? t('Place Pending Order')
              : t('Save Purchase')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
          >
            {t('Cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// SCREEN 10B: APPROVE ORDERS MODULE (ADMIN ONLY)
// ============================================================================
export function ApproveOrdersScreen({
  user,
  onOrdersUpdated,
  onNewPurchase,
  onViewPurchasedProducts,
}) {
  const { t } = useLanguage();
  const [purchases, setPurchases] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [approvalDrafts, setApprovalDrafts] = useState({});
  const canManagePurchases = !user || hasPermission(user, 'purchases.manage');

  const loadOrders = async () => {
    if (!canManagePurchases) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('/purchases');
      const list = res.purchases || [];
      setPurchases(list);

      const drafts = {};
      list
        .filter((p) => p.status === 'pending' || p.status === 'draft')
        .forEach((p) => {
          const itemQtys = {};
          (p.items || []).forEach((it) => {
            itemQtys[it.id] = Number(it.ordered_quantity || 1);
          });
          drafts[p.id] = {
            itemQtys,
            amount_paid: '',
            payment_method: p.payment_method || 'Cash',
            approval_notes: '',
          };
        });
      setApprovalDrafts(drafts);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [canManagePurchases]);

  const pendingOrders = purchases.filter((p) => p.status === 'pending' || p.status === 'draft');
  const approvedOrders = purchases.filter((p) => p.status === 'received' || p.status === 'partially_received');
  const pendingPg = usePagination(pendingOrders, 5);
  const approvedPg = usePagination(approvedOrders, 5);

  if (!canManagePurchases) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl border border-red-200 text-center space-y-4 my-8 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-extrabold text-slate-900">{t('Access Restricted: Admin Only')}</h2>
        <p className="text-xs text-slate-600">
          {t('Only the Shop Admin can approve pending supplier orders and receive arrived stock.')}
        </p>
        {onViewPurchasedProducts && (
          <button
            type="button"
            onClick={onViewPurchasedProducts}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
          >
            {t('View Purchased Products')}
          </button>
        )}
      </div>
    );
  }

  const updateDraftItemQty = (orderId, itemId, qty) => {
    setApprovalDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        itemQtys: {
          ...(prev[orderId]?.itemQtys || {}),
          [itemId]: Math.max(0, Number(qty || 0)),
        },
      },
    }));
  };

  const updateDraftField = (orderId, field, value) => {
    setApprovalDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [field]: value,
      },
    }));
  };

  const handleApproveOrder = async (order) => {
    setProcessingId(order.id);
    setFeedback(null);
    const draft = approvalDrafts[order.id] || {};
    const itemsPayload = (order.items || []).map((it) => ({
      id: it.id,
      received_quantity:
        draft.itemQtys && draft.itemQtys[it.id] !== undefined
          ? Number(draft.itemQtys[it.id])
          : Number(it.ordered_quantity),
    }));

    try {
      const res = await apiRequest(`/purchases/${order.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          items: itemsPayload,
          amount_paid: draft.amount_paid === '' ? null : Number(draft.amount_paid),
          payment_method: draft.payment_method || 'Cash',
          approval_notes: draft.approval_notes || '',
        }),
      });
      await refreshOfflineBootstrap().catch(() => {});
      setFeedback({
        type: 'success',
        text: res.message,
        updates: res.stock_updates || [],
      });
      await loadOrders();
      onOrdersUpdated?.();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelOrder = async (order) => {
    setProcessingId(order.id);
    setFeedback(null);
    try {
      const res = await apiRequest(`/purchases/${order.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by Admin before delivery' }),
      });
      setFeedback({ type: 'success', text: res.message });
      await loadOrders();
      onOrdersUpdated?.();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Approve Supplier Orders')}</h1>
          <p className="text-xs text-slate-500">
            {t('Review pending stock orders once delivered and approve them to automatically update stock across the entire app')}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadOrders}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('Refresh')}
          </button>
          {onNewPurchase && (
            <button
              type="button"
              onClick={onNewPurchase}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
            >
              {t('+ New Purchase Order')}
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold space-y-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <p>{t(feedback.text)}</p>
          {Array.isArray(feedback.updates) && feedback.updates.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {feedback.updates.map((u) => (
                <span
                  key={u.product_id}
                  className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-bold text-emerald-800"
                >
                  {u.product_name}: {u.previous_quantity} → {u.new_quantity} (+{u.received_quantity})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending vs Approved History Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            tab === 'pending' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500'
          }`}
        >
          {t('Pending Orders ({count})', { count: pendingOrders.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab('approved')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            tab === 'approved' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'
          }`}
        >
          {t('Approved Orders ({count})', { count: approvedOrders.length })}
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs">{t('Loading supplier orders...')}</div>
      ) : tab === 'pending' ? (
        pendingOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2 shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-extrabold text-slate-900">{t('No Pending Supplier Orders')}</p>
            <p className="text-xs text-slate-500">
              {t('All placed supplier orders have been approved. You can place a new order from Low Stock Alerts or Purchases.')}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {pendingPg.pageItems.map((order) => {
              const draft = approvalDrafts[order.id] || {};
              const computedSubtotal = (order.items || []).reduce((sum, it) => {
                const qty =
                  draft.itemQtys && draft.itemQtys[it.id] !== undefined
                    ? Number(draft.itemQtys[it.id])
                    : Number(it.ordered_quantity);
                return sum + qty * Number(it.unit_purchase_price || 0);
              }, 0);
              const computedTotal = computedSubtotal + Number(order.additional_costs || 0);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden"
                >
                  {/* Order Header */}
                  <div className="px-5 py-4 bg-amber-50/70 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          {t('Order {ref}', { ref: order.reference_number })}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white uppercase">
                          {t('Pending Approval')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {t('Supplier:')} <strong>{order.supplier_name}</strong>
                        {order.supplier_phone ? ` (${order.supplier_phone})` : ''} · {t('Ordered:')}{' '}
                        {formatDate(order.purchase_date)}
                        {order.recorded_by_name ? ` · ${t('By:')} ${order.recorded_by_name}` : ''}
                      </p>
                      {order.notes && (
                        <p className="text-[11px] text-amber-900 mt-1 italic">{order.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500 font-semibold">{t('Total Payable')}</p>
                      <p className="text-lg font-extrabold text-blue-700">{formatTZS(computedTotal)}</p>
                    </div>
                  </div>

                  {/* Ordered Items Confirmation Table */}
                  <div className="table-region" role="region" aria-label={t('Ordered products to approve')}>
                    <table className="text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-4 text-left font-bold">{t('Product')}</th>
                          <th className="py-2.5 px-3 text-center font-bold">{t('Current Stock')}</th>
                          <th className="py-2.5 px-3 text-center font-bold">{t('Ordered Qty')}</th>
                          <th className="py-2.5 px-3 text-center font-bold">{t('Arrived Qty')}</th>
                          <th className="py-2.5 px-3 text-center font-bold">{t('New Stock After Approval')}</th>
                          <th className="py-2.5 px-4 text-right font-bold">{t('Line Total')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(order.items || []).map((it) => {
                          const arrivedQty =
                            draft.itemQtys && draft.itemQtys[it.id] !== undefined
                              ? Number(draft.itemQtys[it.id])
                              : Number(it.ordered_quantity);
                          const currentStock = Number(it.current_stock || 0);
                          return (
                            <tr key={it.id}>
                              <td className="py-3 px-4">
                                <p className="font-bold text-slate-900">{it.product_name}</p>
                                <p className="text-[10px] text-slate-400">
                                  SKU: {it.sku} · {formatTZS(it.unit_purchase_price)} / {t('unit')}
                                </p>
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-600">
                                {currentStock}
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-900">
                                {it.ordered_quantity}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  aria-label={t('Arrived Qty')}
                                  value={arrivedQty}
                                  onChange={(e) => updateDraftItemQty(order.id, it.id, e.target.value)}
                                  className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold text-center"
                                />
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold">
                                  {currentStock} → {currentStock + arrivedQty}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-900">
                                {formatTZS(arrivedQty * Number(it.unit_purchase_price || 0))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Delivery Payment & Approve Action Row */}
                  <div className="p-4 bg-slate-50/70 border-t border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('Payment Method')}
                      </label>
                      <select
                        value={draft.payment_method || 'Cash'}
                        onChange={(e) => updateDraftField(order.id, 'payment_method', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      >
                        <option value="Cash">{t('Cash')}</option>
                        <option value="Bank Transfer">{t('Bank Transfer')}</option>
                        <option value="Mobile Money">{t('Mobile Money')}</option>
                        <option value="Credit">{t('Credit')}</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('Amount Paid on Arrival (TZS)')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={draft.amount_paid ?? ''}
                        onChange={(e) => updateDraftField(order.id, 'amount_paid', e.target.value)}
                        placeholder={t('Full: {amount}', { amount: computedTotal })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('Approval Notes')}
                      </label>
                      <input
                        type="text"
                        value={draft.approval_notes || ''}
                        onChange={(e) => updateDraftField(order.id, 'approval_notes', e.target.value)}
                        placeholder={t('e.g. Stock verified & received')}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div className="md:col-span-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={processingId === order.id}
                        onClick={() => handleCancelOrder(order)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-bold"
                      >
                        <XCircle className="w-3.5 h-3.5" /> {t('Cancel')}
                      </button>
                      <button
                        type="button"
                        disabled={processingId === order.id}
                        onClick={() => handleApproveOrder(order)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {processingId === order.id
                          ? t('Approving...')
                          : t('Approve & Update Stock')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Pagination {...pendingPg.paginationProps} standalone />
          </div>
        )
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="table-region" role="region" aria-label={t('Approved orders history')}>
            <table className="text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4 text-left font-bold">{t('Ref #')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Supplier')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Approved Items')}</th>
                  <th className="py-3 px-4 text-right font-bold">{t('Total (TZS)')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Approved By')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Approved Date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedPg.pageItems.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-extrabold text-emerald-700">{p.reference_number}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{p.supplier_name}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {(p.items || []).map((i) => `${i.product_name} (+${i.received_quantity})`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {formatTZS(p.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {p.approved_by_name || p.recorded_by_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {formatDate(p.approved_at || p.received_at || p.purchase_date, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...approvedPg.paginationProps} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCREEN 11 & 12: INVENTORY MONITORING & STOCK ADJUSTMENTS
// ============================================================================
export function InventoryScreen({
  user,
  onOpenAdjustment,
  onOrderFromSupplier,
  onOpenApproveOrders,
  onOpenTransfer,
}) {
  const { t } = useLanguage();
  const isAdmin = (user?.role_slugs || []).includes('owner');
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [tab, setTab] = useState('levels');
  const canOrder = hasPermission(user, 'purchases.manage');
  const canTransfer = hasPermission(user, 'inventory.adjust');

  const loadInventory = async () => {
    const res = await apiRequest('/inventory');
    setInventory(res.inventory || []);
    setMovements(res.movements || []);
    setPendingOrdersCount(Number(res.pending_orders_count || 0));
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const displayed = isAdmin && lowStockOnly
    ? inventory.filter((i) => i.stock_status !== 'in_stock')
    : inventory;

  const levelsPg = usePagination(displayed, 5, String(isAdmin && lowStockOnly));
  const movementsPg = usePagination(movements, 5);

  const totalCostVal = isAdmin
    ? inventory.reduce((s, i) => s + Number(i.stock_cost_valuation || 0), 0)
    : 0;
  const totalRetailVal = isAdmin
    ? inventory.reduce((s, i) => s + Number(i.stock_retail_valuation || 0), 0)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Inventory & Stock Control')}</h1>
          {isAdmin && (
            <p className="text-xs text-slate-500">
              {t('Weighted-average cost valuation, low-stock monitoring, and complete stock movement history')}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setLowStockOnly((v) => !v)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                lowStockOnly
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {t('Low Stock Only')}
            </button>
            {canOrder && pendingOrdersCount > 0 && onOpenApproveOrders && (
              <button
                type="button"
                onClick={onOpenApproveOrders}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('Approve Orders')} ({pendingOrdersCount})
              </button>
            )}
            {canTransfer && onOpenTransfer && (
              <button
                type="button"
                onClick={() => onOpenTransfer(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" /> {t('Transfer Product')}
              </button>
            )}
            {hasPermission(user, 'inventory.adjust') && (
              <button
                type="button"
                onClick={onOpenAdjustment}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
              >
                {t('+ Record Stock Adjustment')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Valuation Summary Strip (Admin Only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{t('Inventory Cost Value (Weighted Avg)')}</p>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{formatTZS(totalCostVal)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{t('Estimated Retail Value')}</p>
            <p className="text-xl font-extrabold text-blue-600 mt-1">{formatTZS(totalRetailVal)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{t('Expected Margin on Stock')}</p>
            <p className="text-xl font-extrabold text-emerald-600 mt-1">
              {formatTZS(totalRetailVal - totalCostVal)}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('levels')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
            tab === 'levels' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('Current Stock Levels ({count})', { count: displayed.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab('movements')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
            tab === 'movements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('Stock Movement Ledger ({count})', { count: movements.length })}
        </button>
      </div>

      {tab === 'levels' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="table-region" role="region" aria-label={t('Inventory levels')}>
            <table className="text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4 text-left font-bold">{t('Product')}</th>
                  <th className="py-3 px-4 text-center font-bold">{t('Available Stock')}</th>
                  <th className="py-3 px-4 text-center font-bold">{t('Damaged')}</th>
                  {isAdmin && (
                    <>
                      <th className="py-3 px-4 text-right font-bold">{t('Weighted Unit Cost')}</th>
                      <th className="py-3 px-4 text-right font-bold">{t('Total Valuation')}</th>
                    </>
                  )}
                  <th className="py-3 px-4 text-center font-bold">{t('Status')}</th>
                  {(canOrder || canTransfer) && (
                    <th className="py-3 px-4 text-center font-bold">{t('Actions')}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {levelsPg.pageItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-bold text-slate-900">{item.name}</p>
                        {isMeterUnit(item.unit) && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-100 text-indigo-700">
                            {t('Meter (m)')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {t('SKU: {sku} · Min: {min}', {
                          sku: item.sku,
                          min: formatQtyWithUnit(item.min_stock_level, item.unit),
                        })}
                      </p>
                      {canOrder && Number(item.pending_order_qty || 0) > 0 && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                          <Clock className="w-2.5 h-2.5" />
                          {t('Pending Order (+{qty})', {
                            qty: formatQtyWithUnit(item.pending_order_qty, item.unit),
                          })}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-extrabold text-sm text-slate-900">
                      {formatQtyWithUnit(item.available_quantity, item.unit)}
                    </td>
                    <td className="py-3 px-4 text-center text-red-600 font-semibold">
                      {formatQtyWithUnit(item.damaged_quantity, item.unit)}
                    </td>
                    {isAdmin && (
                      <>
                        <td className="py-3 px-4 text-right">{formatUnitPrice(item.unit_cost, item.unit)}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatTZS(item.stock_cost_valuation)}
                        </td>
                      </>
                    )}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.stock_status === 'out_of_stock'
                            ? 'bg-red-100 text-red-700'
                            : item.stock_status === 'low_stock'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {t(item.stock_status)}
                      </span>
                    </td>
                    {(canOrder || canTransfer) && (
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-wrap items-center justify-center gap-1.5">
                          {canTransfer && onOpenTransfer && Number(item.available_quantity || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => onOpenTransfer(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition"
                              title={t('Transfer Product to Another Shop')}
                            >
                              <ArrowRightLeft className="w-3 h-3" /> {t('Transfer')}
                            </button>
                          )}
                          {canOrder && item.stock_status !== 'in_stock' && onOrderFromSupplier && (
                            <button
                              type="button"
                              onClick={() => onOrderFromSupplier(item)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-sm transition"
                            >
                              <Truck className="w-3 h-3" /> {t('Order from Supplier')}
                            </button>
                          )}
                          {!(canTransfer && onOpenTransfer && Number(item.available_quantity || 0) > 0) &&
                            !(canOrder && item.stock_status !== 'in_stock' && onOrderFromSupplier) && (
                              <span className="text-slate-300">—</span>
                            )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...levelsPg.paginationProps} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="table-region" role="region" aria-label={t('Stock movements history')}>
            <table className="text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4 text-left font-bold">{t('Date')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Product')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Type')}</th>
                  <th className="py-3 px-4 text-center font-bold">{t('Prev → New')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Reason')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('User')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movementsPg.pageItems.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 px-4 text-slate-500">{formatDate(m.created_at, true)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{m.product_name}</td>
                    <td className="py-3 px-4 capitalize font-semibold">
                      {t(m.movement_type)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      {m.previous_quantity} → {m.new_quantity} (
                      <span className={m.change_quantity >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {m.change_quantity >= 0 ? `+${m.change_quantity}` : m.change_quantity}
                      </span>
                      )
                    </td>
                    <td className="py-3 px-4 text-slate-700">{t(m.reason)}</td>
                    <td className="py-3 px-4 text-slate-500">{m.user_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...movementsPg.paginationProps} />
        </div>
      )}
    </div>
  );
}

export function StockAdjustmentsScreen({ user, onSaved, onCancel }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('adjustment_increase');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState(() => t('Stock Count Verification'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const canAdjustStock = !user || hasPermission(user, 'inventory.adjust');

  useEffect(() => {
    if (!canAdjustStock) return;
    apiRequest('/products?status=active').then((res) => {
      const list = res.products || [];
      setProducts(list);
      if (list.length > 0) setProductId(String(list[0].id));
    });
  }, [canAdjustStock]);

  if (!canAdjustStock) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl border border-red-200 text-center space-y-4 my-8 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-extrabold text-slate-900">{t('Access Restricted: Admin Only')}</h2>
        <p className="text-xs text-slate-600">
          {t('Stock adjustments (damaged, lost, missing, or physical count changes) can only be performed by the Shop Administrator. Regular registered employees are restricted from modifying stock directly.')}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
        >
          {t('Return to Inventory')}
        </button>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiRequest('/stock-adjustments', {
        method: 'POST',
        body: JSON.stringify({
          product_id: Number(productId),
          adjustment_type: adjustmentType,
          quantity: Number(quantity),
          reason,
          notes,
        }),
      });
      setFeedback({ type: 'success', text: res.message });
      setTimeout(() => onSaved(), 900);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Stock Adjustments')}</h1>
          <p className="text-xs text-slate-500">
            {t('Record damaged, missing, lost, or physical stock count corrections with audit logging')}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold"
        >
          {t('Back to Inventory')}
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {t(feedback.text)}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
      >
        <div>
          <label htmlFor="adj-prod" className="block text-xs font-bold text-slate-700 mb-1">
            {t('Product')} <span className="text-red-500">*</span>
          </label>
          <select
            id="adj-prod"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {t('{name} (Current Stock: {qty})', {
                  name: p.name,
                  qty: formatQtyWithUnit(p.available_quantity, p.unit),
                })}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="adj-type" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Adjustment Type')} <span className="text-red-500">*</span>
            </label>
            <select
              id="adj-type"
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="adjustment_increase">{t('Increase (+ Stock Received Outside PO)')}</option>
              <option value="adjustment_decrease">{t('Decrease (- Manual Correction)')}</option>
              <option value="damaged">{t('Damaged Product (- Stock)')}</option>
              <option value="missing">{t('Missing Product (- Stock)')}</option>
              <option value="lost">{t('Lost Product (- Stock)')}</option>
              <option value="physical_count">{t('Physical Stock Count (Set Exact Stock)')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="adj-qty" className="block text-xs font-bold text-slate-700 mb-1">
              {isMeterUnit(products.find((p) => String(p.id) === String(productId))?.unit)
                ? t('Quantity (Meters)')
                : t('Quantity')}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              id="adj-qty"
              type="number"
              min={isMeterUnit(products.find((p) => String(p.id) === String(productId))?.unit) ? '0.01' : '1'}
              step={isMeterUnit(products.find((p) => String(p.id) === String(productId))?.unit) ? '0.01' : '1'}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
        </div>

        <div>
          <label htmlFor="adj-reason" className="block text-xs font-bold text-slate-700 mb-1">
            {t('Reason')} <span className="text-red-500">*</span>
          </label>
          <input
            id="adj-reason"
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('e.g. Monthly Stock Count, Display Damage...')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
          />
        </div>

        <div>
          <label htmlFor="adj-notes" className="block text-xs font-bold text-slate-700 mb-1">
            {t('Additional Notes (Optional)')}
          </label>
          <textarea
            id="adj-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm"
          >
            {saving ? t('Saving...') : t('Save Adjustment')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
          >
            {t('Cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// SCREEN 12B: INTER-SHOP PRODUCT TRANSFERS (TRANSFER TO ANOTHER SHOP / BRANCH)
// ============================================================================
const TRANSFER_REASONS = [
  'Branch Restock',
  'Stock Balancing',
  'Customer Order Transfer',
  'Showroom / Display Transfer',
  'Emergency Shop Request',
  'Other',
];

function normalizeTransferWhatsAppPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length >= 9) {
    return `255${digits.slice(1)}`;
  }
  return digits;
}

function buildTransferSlipText(tr, t) {
  const items = tr.items || [];
  const lines = [
    `${tr.from_shop || 'KAMPANGO PHONES AND ELECTRONICS'}`,
    t('STOCK TRANSFER DELIVERY NOTE'),
    `${t('Transfer #')}: ${tr.transfer_number}`,
    `${t('Transfer Date')}: ${formatDate(tr.transfer_date)}`,
    `${t('Status')}: ${t(tr.status)}`,
    '----------------------------------------',
    `${t('From Shop')}: ${tr.from_shop || 'KAMPANGO PHONES AND ELECTRONICS'}`,
    `${t('Destination Shop')}: ${tr.destination_shop_name}`,
  ];
  if (tr.destination_location) {
    lines.push(`${t('Destination Location')}: ${tr.destination_location}`);
  }
  lines.push(`${t('Receiver Name')}: ${tr.receiver_name}`);
  if (tr.receiver_phone) {
    lines.push(`${t('Receiver Phone')}: ${tr.receiver_phone}`);
  }
  lines.push(`${t('Transfer Reason')}: ${t(tr.transfer_reason)}`);
  if (tr.carrier_name) {
    lines.push(
      `${t('Carrier / Driver')}: ${tr.carrier_name}${tr.carrier_phone ? ` (${tr.carrier_phone})` : ''}`
    );
  }
  if (tr.vehicle_or_waybill) {
    lines.push(`${t('Vehicle / Waybill #')}: ${tr.vehicle_or_waybill}`);
  }
  lines.push('----------------------------------------', t('Transferred Products'));
  items.forEach((it, idx) => {
    const qtyStr = formatQtyWithUnit(it.quantity, it.unit_snapshot);
    const imeiStr = it.serial_or_imei ? ` | IMEI/SN: ${it.serial_or_imei}` : '';
    lines.push(
      `${idx + 1}. ${it.product_name_snapshot} (${it.sku_snapshot}) — ${qtyStr}${imeiStr} | ${formatTZS(it.line_retail_total)}`
    );
  });
  lines.push(
    '----------------------------------------',
    `${t('Total Units')}: ${formatQtyNumber(tr.total_quantity)}`,
    `${t('Total Cost Value')}: ${formatTZS(tr.total_cost_value)}`,
    `${t('Total Retail Value')}: ${formatTZS(tr.total_retail_value)}`
  );
  if (tr.notes) {
    lines.push(`${t('Notes')}: ${tr.notes}`);
  }
  if (tr.transferred_by_name) {
    lines.push(`${t('Dispatched By')}: ${tr.transferred_by_name}`);
  }
  return lines.join('\n');
}

function printTransferDeliveryNote(tr, t) {
  const items = tr.items || [];
  const itemRowsHtml = items
    .map(
      (it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${it.product_name_snapshot}</strong><br/><span style="font-size:11px;color:#64748b;">SKU: ${it.sku_snapshot}${it.serial_or_imei ? ` · IMEI/SN: ${it.serial_or_imei}` : ''}</span></td>
        <td class="text-right"><strong>${formatQtyWithUnit(it.quantity, it.unit_snapshot)}</strong></td>
        <td class="text-right">${formatUnitPrice(it.unit_cost, it.unit_snapshot)}</td>
        <td class="text-right">${formatTZS(it.line_cost_total)}</td>
        <td class="text-right"><strong>${formatTZS(it.line_retail_total)}</strong></td>
      </tr>
    `
    )
    .join('');

  printHtmlDocument(
    `${t('STOCK TRANSFER DELIVERY NOTE')} — ${tr.transfer_number}`,
    `
      <div class="header">
        <h2>${t('STOCK TRANSFER DELIVERY NOTE')}</h2>
        <p><strong>${tr.transfer_number}</strong> · ${t('Transfer Date')}: ${formatDate(tr.transfer_date)} · <span class="badge">${t(tr.status).toUpperCase()}</span></p>
      </div>
      <table>
        <tr>
          <th style="width:24%;">${t('From Shop')}</th>
          <td><strong>${tr.from_shop || 'KAMPANGO PHONES AND ELECTRONICS'}</strong></td>
          <th style="width:24%;">${t('Destination Shop')}</th>
          <td><strong>${tr.destination_shop_name}</strong>${tr.destination_location ? `<br/><span style="font-size:11px;color:#475569;">${tr.destination_location}</span>` : ''}</td>
        </tr>
        <tr>
          <th>${t('Dispatched By')}</th>
          <td>${tr.transferred_by_name || '—'}</td>
          <th>${t('Receiver Name')}</th>
          <td>${tr.receiver_name}${tr.receiver_phone ? ` (${tr.receiver_phone})` : ''}</td>
        </tr>
        <tr>
          <th>${t('Transfer Reason')}</th>
          <td>${t(tr.transfer_reason)}</td>
          <th>${t('Carrier / Driver')}</th>
          <td>${tr.carrier_name || '—'}${tr.carrier_phone ? ` (${tr.carrier_phone})` : ''}${tr.vehicle_or_waybill ? `<br/><span style="font-size:11px;color:#475569;">${tr.vehicle_or_waybill}</span>` : ''}</td>
        </tr>
      </table>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>${t('Product')}</th>
            <th class="text-right">${t('Quantity')}</th>
            <th class="text-right">${t('Unit Cost')}</th>
            <th class="text-right">${t('Cost Total')}</th>
            <th class="text-right">${t('Retail Value')}</th>
          </tr>
        </thead>
        <tbody>${itemRowsHtml}</tbody>
      </table>

      <div class="totals">
        <table>
          <tr><th>${t('Total Items / Units')}</th><td class="text-right"><strong>${tr.total_items} (${formatQtyNumber(tr.total_quantity)})</strong></td></tr>
          <tr><th>${t('Total Cost Value')}</th><td class="text-right"><strong>${formatTZS(tr.total_cost_value)}</strong></td></tr>
          <tr><th>${t('Total Retail Value')}</th><td class="text-right"><strong>${formatTZS(tr.total_retail_value)}</strong></td></tr>
        </table>
      </div>
      ${tr.notes ? `<p style="margin-top:10px;"><strong>${t('Notes')}:</strong> ${tr.notes}</p>` : ''}

      <table style="margin-top:28px;">
        <tr>
          <td style="width:33%;border:none;padding-top:24px;">_______________________<br/><strong>${t('Dispatched By')}</strong></td>
          <td style="width:33%;border:none;padding-top:24px;">_______________________<br/><strong>${t('Carrier / Driver')}</strong></td>
          <td style="width:33%;border:none;padding-top:24px;">_______________________<br/><strong>${t('Received By')}</strong></td>
        </tr>
      </table>
      <div class="footer">${t('Verified Inter-Shop Stock Transfer Document')} — ${tr.from_shop || 'KAMPANGO PHONES AND ELECTRONICS'}</div>
    `
  );
}

export function StockTransfersScreen({
  user,
  settings,
  prefillProduct = null,
  onClearPrefill,
  onBackToInventory,
}) {
  const { t } = useLanguage();
  const canTransfer = hasPermission(user, 'inventory.adjust');

  const [products, setProducts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [summary, setSummary] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(Boolean(prefillProduct));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [completedTransfer, setCompletedTransfer] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [form, setForm] = useState({
    destination_shop_name: '',
    destination_location: '',
    receiver_name: '',
    receiver_phone: '',
    transfer_date: new Date().toISOString().slice(0, 10),
    transfer_reason: TRANSFER_REASONS[0],
    status: 'in_transit',
    carrier_name: '',
    carrier_phone: '',
    vehicle_or_waybill: '',
    notes: '',
  });

  const [lines, setLines] = useState([
    { product_id: prefillProduct ? String(prefillProduct.id) : '', quantity: '1', serial_or_imei: '' },
  ]);

  const loadData = async () => {
    if (!canTransfer) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [prodRes, trRes] = await Promise.all([
        apiRequest('/products?status=active'),
        apiRequest('/stock-transfers'),
      ]);
      const prodList = (prodRes.products || []).filter((p) => Number(p.available_quantity || 0) > 0);
      setProducts(prodList);
      setTransfers(trRes.transfers || []);
      setSummary(trRes.summary || {});

      setLines((prev) =>
        prev.map((row, i) => {
          if (i === 0 && prefillProduct) {
            return { ...row, product_id: String(prefillProduct.id) };
          }
          if (!row.product_id && prodList.length > 0) {
            return { ...row, product_id: String(prodList[0].id) };
          }
          return row;
        })
      );
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [canTransfer]);

  useEffect(() => {
    if (prefillProduct) {
      setShowForm(true);
      setLines([{ product_id: String(prefillProduct.id), quantity: '1', serial_or_imei: '' }]);
    }
  }, [prefillProduct]);

  const filteredTransfers =
    statusFilter === 'all' ? transfers : transfers.filter((tr) => tr.status === statusFilter);
  const transfersPg = usePagination(filteredTransfers, 5, statusFilter);

  if (!canTransfer) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl border border-red-200 text-center space-y-4 my-8 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-extrabold text-slate-900">{t('Access Restricted: Admin Only')}</h2>
        <p className="text-xs text-slate-600">
          {t('Transferring products to another shop can only be performed by the Shop Administrator.')}
        </p>
        {onBackToInventory && (
          <button
            type="button"
            onClick={onBackToInventory}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
          >
            {t('Return to Inventory')}
          </button>
        )}
      </div>
    );
  }

  const productById = (id) => products.find((p) => String(p.id) === String(id));

  const addLine = () => {
    const firstAvail = products.find((p) => !lines.some((l) => String(l.product_id) === String(p.id))) || products[0];
    setLines((prev) => [
      ...prev,
      { product_id: firstAvail ? String(firstAvail.id) : '', quantity: '1', serial_or_imei: '' },
    ]);
  };

  const updateLine = (idx, field, value) => {
    setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const removeLine = (idx) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const totals = lines.reduce(
    (acc, line) => {
      const p = productById(line.product_id);
      const q = Math.max(0, Number(line.quantity || 0));
      if (!p || q <= 0) return acc;
      const unitCost = Number(p.weighted_avg_cost || p.purchase_price || 0);
      const unitSell = Number(p.selling_price || 0);
      return {
        qty: acc.qty + q,
        cost: acc.cost + q * unitCost,
        retail: acc.retail + q * unitSell,
      };
    },
    { qty: 0, cost: 0, retail: 0 }
  );

  const handleSubmitTransfer = async (e) => {
    e.preventDefault();
    setMessage(null);

    const payloadItems = lines
      .filter((l) => l.product_id && Number(l.quantity) > 0)
      .map((l) => ({
        product_id: Number(l.product_id),
        quantity: Number(l.quantity),
        serial_or_imei: l.serial_or_imei.trim(),
      }));

    if (payloadItems.length === 0) {
      setMessage({ type: 'error', text: 'At least one product item is required to complete a transfer.' });
      return;
    }

    setSaving(true);
    try {
      const res = await apiRequest('/stock-transfers', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          items: payloadItems,
        }),
      });
      setMessage({ type: 'success', text: res.message });
      if (res.transfer) {
        setCompletedTransfer(res.transfer);
      }
      setShowForm(false);
      onClearPrefill?.();
      setForm({
        destination_shop_name: '',
        destination_location: '',
        receiver_name: '',
        receiver_phone: '',
        transfer_date: new Date().toISOString().slice(0, 10),
        transfer_reason: TRANSFER_REASONS[0],
        status: 'in_transit',
        carrier_name: '',
        carrier_phone: '',
        vehicle_or_waybill: '',
        notes: '',
      });
      setLines([{ product_id: products[0] ? String(products[0].id) : '', quantity: '1', serial_or_imei: '' }]);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReceived = async (tr) => {
    try {
      const res = await apiRequest(`/stock-transfers/${tr.id}/receive`, { method: 'POST' });
      setMessage({ type: 'success', text: res.message });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleCancelTransfer = async (tr) => {
    if (
      !window.confirm(
        t('Cancel transfer {ref} and return all transferred items back into your shop stock?', {
          ref: tr.transfer_number,
        })
      )
    ) {
      return;
    }
    try {
      const res = await apiRequest(`/stock-transfers/${tr.id}/cancel`, { method: 'POST' });
      setMessage({ type: 'success', text: res.message });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleWhatsAppTransfer = (tr) => {
    const text = buildTransferSlipText(tr, t);
    const phone = normalizeTransferWhatsAppPhone(tr.receiver_phone);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareTransfer = async (tr) => {
    const text = buildTransferSlipText(tr, t);
    const title = `${t('STOCK TRANSFER DELIVERY NOTE')} — ${tr.transfer_number}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(tr.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // ignore clipboard fallback
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {t('Transfer Products to Another Shop')}
          </h1>
          <p className="text-xs text-slate-500">
            {t('Dispatch products from {shop} to another shop/branch with receiver, carrier, IMEI/serial & printable delivery note', {
              shop: settings?.shop_name || 'KAMPANGO PHONES AND ELECTRONICS',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onBackToInventory && (
            <button
              type="button"
              onClick={onBackToInventory}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
            >
              {t('Back to Inventory')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {showForm ? t('Close Transfer Form') : t('+ New Product Transfer')}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            message.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{t(message.text)}</span>
          <button type="button" onClick={() => setMessage(null)} className="underline text-[11px] shrink-0">
            {t('Dismiss')}
          </button>
        </div>
      )}

      {/* Completed Transfer Quick Slip Modal */}
      {completedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {t('Transfer Recorded: {ref}', { ref: completedTransfer.transfer_number })}
                  </h3>
                  <p className="text-xs text-slate-500">
                    → {completedTransfer.destination_shop_name} ({completedTransfer.receiver_name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t('Close')}
                onClick={() => setCompletedTransfer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('Total Items / Units')}:</span>
                <span className="font-extrabold text-slate-900">
                  {completedTransfer.total_items} ({formatQtyNumber(completedTransfer.total_quantity)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('Total Cost Value')}:</span>
                <span className="font-bold text-slate-900">{formatTZS(completedTransfer.total_cost_value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('Total Retail Value')}:</span>
                <span className="font-extrabold text-blue-600">{formatTZS(completedTransfer.total_retail_value)}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => printTransferDeliveryNote(completedTransfer, t)}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5" /> {t('Print Note')}
              </button>
              <button
                type="button"
                onClick={() => handleWhatsAppTransfer(completedTransfer)}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                <MessageCircle className="w-3.5 h-3.5" /> {t('WhatsApp')}
              </button>
              <button
                type="button"
                onClick={() => handleShareTransfer(completedTransfer)}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                {copiedId === completedTransfer.id ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> {t('Copied!')}
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" /> {t('Share')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{t('Total Transfers')}</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{summary.total_transfers || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{t('In Transit')}</p>
          <p className="text-xl font-extrabold text-amber-600 mt-1">{summary.in_transit_count || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{t('Total Cost Transferred')}</p>
          <p className="text-lg font-extrabold text-slate-900 mt-1">
            {formatTZS(summary.total_cost_transferred)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{t('Total Retail Value Transferred')}</p>
          <p className="text-lg font-extrabold text-blue-600 mt-1">
            {formatTZS(summary.total_retail_transferred)}
          </p>
        </div>
      </div>

      {/* New Transfer Form */}
      {showForm && (
        <form
          onSubmit={handleSubmitTransfer}
          className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  {t('New Inter-Shop Stock Transfer')}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {t('From: {shop} — Stock is deducted automatically upon confirmation', {
                    shop: settings?.shop_name || 'KAMPANGO PHONES AND ELECTRONICS',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Destination Shop & Receiver */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">
              {t('1. Destination Shop & Receiver Information')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="tr-dest-shop" className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Destination Shop / Branch Name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="tr-dest-shop"
                  type="text"
                  required
                  value={form.destination_shop_name}
                  onChange={(e) => setForm({ ...form, destination_shop_name: e.target.value })}
                  placeholder={t('e.g. Kampango Branch 2 — Kariakoo')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label htmlFor="tr-dest-loc" className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Destination Location / Address')}
                </label>
                <input
                  id="tr-dest-loc"
                  type="text"
                  value={form.destination_location}
                  onChange={(e) => setForm({ ...form, destination_location: e.target.value })}
                  placeholder={t('e.g. Aggrey Street / Mwanza / Arusha')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label htmlFor="tr-receiver" className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Receiver Name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="tr-receiver"
                  type="text"
                  required
                  value={form.receiver_name}
                  onChange={(e) => setForm({ ...form, receiver_name: e.target.value })}
                  placeholder={t('Person receiving the goods')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label htmlFor="tr-rec-phone" className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Receiver Phone')}
                </label>
                <input
                  id="tr-rec-phone"
                  type="tel"
                  value={form.receiver_phone}
                  onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })}
                  placeholder="+255 7..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Dispatch & Transport Details */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">
              {t('2. Dispatch, Reason & Transport Details')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="tr-date" className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Transfer Date')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="tr-date"
                  type="date"
                  required
                  value={form.transfer_date}
                  onChange={(e) => setForm({ ...form, transfer_date: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label htmlFor="tr-reason" className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Transfer Reason')}
                </label>
                <select
                  id="tr-reason"
                  value={form.transfer_reason}
                  onChange={(e) => setForm({ ...form, transfer_reason: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  {TRANSFER_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {t(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tr-status" className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Delivery Status')}
                </label>
                <select
                  id="tr-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="in_transit">{t('In Transit (Confirm Upon Arrival)')}</option>
                  <option value="received">{t('Delivered / Received Immediately')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="tr-carrier" className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Carrier / Driver / Staff Name')}
                </label>
                <input
                  id="tr-carrier"
                  type="text"
                  value={form.carrier_name}
                  onChange={(e) => setForm({ ...form, carrier_name: e.target.value })}
                  placeholder={t('e.g. Bodaboda / Bus Courier / Staff name')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label htmlFor="tr-carrier-phone" className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Carrier Phone')}
                </label>
                <input
                  id="tr-carrier-phone"
                  type="tel"
                  value={form.carrier_phone}
                  onChange={(e) => setForm({ ...form, carrier_phone: e.target.value })}
                  placeholder="+255 7..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label htmlFor="tr-waybill" className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Vehicle / Bus / Waybill #')}
                </label>
                <input
                  id="tr-waybill"
                  type="text"
                  value={form.vehicle_or_waybill}
                  onChange={(e) => setForm({ ...form, vehicle_or_waybill: e.target.value })}
                  placeholder={t('e.g. T 123 ABC / Waybill #442')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Transferred Products (Multi-Item) */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">
                {t('3. Products to Transfer')}
              </h3>
              <button
                type="button"
                onClick={addLine}
                disabled={products.length === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" /> {t('Add Another Product')}
              </button>
            </div>

            {products.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                {t('No in-stock products available to transfer right now.')}
              </div>
            ) : (
              <div className="space-y-2.5">
                {lines.map((line, idx) => {
                  const selected = productById(line.product_id);
                  const meter = isMeterUnit(selected?.unit);
                  const maxQty = Number(selected?.available_quantity || 0);
                  const lineRetail =
                    Number(line.quantity || 0) * Number(selected?.selling_price || 0);
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end p-3 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <div className="md:col-span-5">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          {t('Product')} <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={line.product_id}
                          onChange={(e) => updateLine(idx, 'product_id', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                        >
                          <option value="">{t('-- Select Product --')}</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) — {t('Stock')}: {formatQtyWithUnit(p.available_quantity, p.unit)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          {meter ? t('Quantity (Meters)') : t('Quantity')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min={meter ? '0.01' : '1'}
                          step={meter ? '0.01' : '1'}
                          max={maxQty > 0 ? maxQty : undefined}
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          {t('Serial / IMEI (Optional)')}
                        </label>
                        <input
                          type="text"
                          value={line.serial_or_imei}
                          onChange={(e) => updateLine(idx, 'serial_or_imei', e.target.value)}
                          placeholder={t('e.g. IMEI / S/N')}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between gap-2 pb-1">
                        <div className="text-right flex-1">
                          <p className="text-[10px] text-slate-400">{t('Retail Value')}</p>
                          <p className="text-xs font-extrabold text-blue-700">{formatTZS(lineRetail)}</p>
                        </div>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            aria-label={t('Remove row')}
                            onClick={() => removeLine(idx)}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Live Transfer Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs">
              <div>
                <p className="text-indigo-700 font-semibold">{t('Total Units to Transfer')}</p>
                <p className="text-base font-extrabold text-indigo-950">{formatQtyNumber(totals.qty)}</p>
              </div>
              <div>
                <p className="text-indigo-700 font-semibold">{t('Total Cost Value')}</p>
                <p className="text-base font-extrabold text-indigo-950">{formatTZS(totals.cost)}</p>
              </div>
              <div>
                <p className="text-indigo-700 font-semibold">{t('Total Retail Value')}</p>
                <p className="text-base font-extrabold text-blue-700">{formatTZS(totals.retail)}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="tr-notes" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Additional Transfer Notes (Optional)')}
            </label>
            <textarea
              id="tr-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t('e.g. Includes sealed boxes, warranty cards, charger cables...')}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || products.length === 0}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm"
            >
              <ArrowRightLeft className="w-4 h-4" />
              {saving ? t('Transferring...') : t('Confirm & Transfer Products')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                onClearPrefill?.();
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {t('Cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Transfer Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {[
          { id: 'all', label: 'All Transfers', count: transfers.length },
          {
            id: 'in_transit',
            label: 'In Transit',
            count: transfers.filter((x) => x.status === 'in_transit').length,
          },
          {
            id: 'received',
            label: 'Received',
            count: transfers.filter((x) => x.status === 'received').length,
          },
          {
            id: 'cancelled',
            label: 'Cancelled',
            count: transfers.filter((x) => x.status === 'cancelled').length,
          },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
              statusFilter === f.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500'
            }`}
          >
            {t(f.label)} ({f.count})
          </button>
        ))}
      </div>

      {/* Transfer History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="table-region" role="region" aria-label={t('Stock transfers history')}>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Transfer # & Date')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Destination Shop & Receiver')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Products Transferred')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Carrier & Reason')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Total Value')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Status')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    {t('Loading transfers...')}
                  </td>
                </tr>
              ) : transfersPg.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    {t('No inter-shop product transfers recorded yet.')}
                  </td>
                </tr>
              ) : (
                transfersPg.pageItems.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-extrabold text-indigo-700">{tr.transfer_number}</p>
                      <p className="text-[11px] text-slate-500">{formatDate(tr.transfer_date)}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{tr.destination_shop_name}</p>
                      {tr.destination_location && (
                        <p className="text-[11px] text-slate-500">{tr.destination_location}</p>
                      )}
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {t('Receiver')}: <strong>{tr.receiver_name}</strong>
                        {tr.receiver_phone ? ` · ${tr.receiver_phone}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {(tr.items || []).map((it) => (
                          <p key={it.id} className="text-[11px] text-slate-700">
                            <span className="font-bold text-slate-900">{it.product_name_snapshot}</span>{' '}
                            <span className="text-indigo-700 font-extrabold">
                              × {formatQtyWithUnit(it.quantity, it.unit_snapshot)}
                            </span>
                            {it.serial_or_imei ? (
                              <span className="text-slate-400"> ({it.serial_or_imei})</span>
                            ) : null}
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{t(tr.transfer_reason)}</p>
                      {tr.carrier_name && (
                        <p className="text-[11px] text-slate-500">
                          {tr.carrier_name}
                          {tr.carrier_phone ? ` · ${tr.carrier_phone}` : ''}
                        </p>
                      )}
                      {tr.vehicle_or_waybill && (
                        <p className="text-[10px] text-slate-400">{tr.vehicle_or_waybill}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <p className="font-extrabold text-slate-900">{formatTZS(tr.total_retail_value)}</p>
                      <p className="text-[10px] text-slate-500">
                        {t('Cost')}: {formatTZS(tr.total_cost_value)}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                          tr.status === 'received'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tr.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t(tr.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {tr.status === 'in_transit' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleMarkReceived(tr)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold"
                              title={t('Mark as Received')}
                            >
                              <CheckCircle2 className="w-3 h-3" /> {t('Received')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelTransfer(tr)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold"
                              title={t('Cancel & Restock')}
                            >
                              <XCircle className="w-3 h-3" /> {t('Cancel')}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => printTransferDeliveryNote(tr, t)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          title={t('Print Note')}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleWhatsAppTransfer(tr)}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                          title={t('WhatsApp')}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareTransfer(tr)}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700"
                          title={t('Share / Copy')}
                        >
                          {copiedId === tr.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...transfersPg.paginationProps} />
      </div>
    </div>
  );
}


