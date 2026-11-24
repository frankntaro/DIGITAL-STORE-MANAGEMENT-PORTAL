import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  Clock,
  Edit3,
  FolderKanban,
  Globe,
  Image,
  PackagePlus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
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
        {canManage && (
          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" /> {t('Add Product')}
          </button>
        )}
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
export function InventoryScreen({ user, onOpenAdjustment, onOrderFromSupplier, onOpenApproveOrders }) {
  const { t } = useLanguage();
  const isAdmin = (user?.role_slugs || []).includes('owner');
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [tab, setTab] = useState('levels');
  const canOrder = hasPermission(user, 'purchases.manage');

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
                  {canOrder && <th className="py-3 px-4 text-center font-bold">{t('Reorder')}</th>}
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
                    {canOrder && (
                      <td className="py-3 px-4 text-center">
                        {item.stock_status !== 'in_stock' && onOrderFromSupplier ? (
                          <button
                            type="button"
                            onClick={() => onOrderFromSupplier(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-sm transition"
                          >
                            <Truck className="w-3 h-3" /> {t('Order from Supplier')}
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
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


