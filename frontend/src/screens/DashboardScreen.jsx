import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { apiRequest, resolveMediaUrl } from '../services/api';
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

export default function DashboardScreen({
  user,
  onNavigate,
  onViewPurchasedProducts,
  onOrderFromSupplier,
  onOpenApproveOrders,
}) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stockFeedTab, setStockFeedTab] = useState('new');
  const canOrder = hasPermission(user, 'purchases.manage');

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/dashboard');
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const kpis = data?.kpis || {};
  const trend = data?.sales_trend || [];
  const topProducts = data?.top_products || [];
  const lowStock = data?.low_stock || [];
  const recentSales = data?.recent_sales || [];
  const recentPurchases = data?.recent_purchases || [];
  const purchasedProducts = data?.purchased_products || [];
  const oldProducts = data?.old_products || [];
  const recentRepayments = data?.recent_repayments || [];
  const recentExpenses = data?.recent_expenses || [];

  const recentSalesPg = usePagination(recentSales, 5);
  const lowStockPg = usePagination(lowStock, 5);
  const purchasedProductsPg = usePagination(purchasedProducts, 5);
  const oldProductsPg = usePagination(oldProducts, 5);

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        {t('Loading real-time business dashboard...')}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
        {t(error)}
      </div>
    );
  }

  const maxTrendRev = Math.max(...trend.map((point) => Number(point.revenue || 0)), 1);
  const maxProdRev = Math.max(...topProducts.map((p) => Number(p.revenue || 0)), 1);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">{t('Dashboard Overview')}</h1>
          <p className="text-xs text-slate-500">
            {t('Real-time retail performance, stock valuation, and cash flow in Tanzanian Shillings (TZS)')}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadDashboard}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('Refresh')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-sm"
          >
            <ShoppingBag className="w-3.5 h-3.5" /> {t('Open POS Checkout')}
          </button>
        </div>
      </div>

      {/* Admin-Only Pending Supplier Orders Approval Alert */}
      {canOrder && Number(kpis.pending_orders_count || 0) > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-amber-950">
                {t('{count} Pending Supplier Order(s) Awaiting Approval', {
                  count: kpis.pending_orders_count,
                })}
              </p>
              <p className="text-[11px] text-amber-800">
                {t('Once ordered stock arrives, approve the order to automatically update stock across the entire system.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => (onOpenApproveOrders ? onOpenApproveOrders() : onNavigate('approve_orders'))}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> {t('Open Approve Orders')}
          </button>
        </div>
      )}

      {/* Primary 4 Mockup KPI Cards (Green Sales, Orange Products/Stock, Blue Customers, Red Debt) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t("Today's Total Sales")}</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700">{formatTZS(kpis.today_sales)}</p>
          <p className="text-xs text-emerald-800 mt-1.5 flex items-center justify-between">
            <span>{t('Cash Collected Today:')}</span>
            <span className="font-bold">{formatTZS(kpis.today_cash_collected)}</span>
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100/60 border border-amber-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900">{t('Products & Stock')}</span>
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-800">
            {kpis.total_available_stock} <span className="text-sm font-semibold">{t('units')}</span>
          </p>
          <p className="text-xs text-amber-900 mt-1.5 flex items-center justify-between">
            <span>{t('Registered Products: {count}', { count: kpis.total_products })}</span>
            <span className="font-bold text-red-600">
              {t('{low} Low / {out} Out', { low: kpis.low_stock_count, out: kpis.out_of_stock_count })}
            </span>
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100/60 border border-blue-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900">{t('Customers & Staff')}</span>
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-blue-700">{kpis.total_customers}</p>
          <p className="text-xs text-blue-800 mt-1.5 flex items-center justify-between">
            <span>{t('Active Employees:')}</span>
            <span className="font-bold">{t('{count} Staff', { count: kpis.active_employees })}</span>
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-red-50 to-rose-100/60 border border-red-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-red-900">{t('Customer Debts (AR)')}</span>
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-red-700">{formatTZS(kpis.outstanding_customer_debt)}</p>
          <button
            type="button"
            onClick={() => onNavigate('debts')}
            className="text-xs font-bold text-red-800 hover:underline mt-1.5 inline-flex items-center gap-1"
          >
            {t('Manage overdue accounts')} <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Role-Permitted Financial KPI Strip (SRS 3.1: Respects user permissions) */}
      {kpis.financials_permitted && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{t("Today's Gross Profit")}</p>
            <p className="text-lg font-extrabold text-emerald-600 mt-1">{formatTZS(kpis.today_gross_profit)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{t("Today's Operating Expenses")}</p>
            <p className="text-lg font-extrabold text-amber-600 mt-1">{formatTZS(kpis.today_expenses)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{t('Total Inventory Cost Value')}</p>
            <p className="text-lg font-extrabold text-slate-900 mt-1">{formatTZS(kpis.inventory_cost_value)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{t('Supplier Balances (AP)')}</p>
            <p className="text-lg font-extrabold text-rose-600 mt-1">{formatTZS(kpis.outstanding_supplier_debt)}</p>
          </div>
        </div>
      )}

      {/* Charts & Top Products Row (Matches Screen 2 Mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales Overview Chart */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('Sales Overview (Recent Trend)')}</h2>
              <p className="text-xs text-slate-500">{t('Completed daily revenue excluding cancelled sales & repayments')}</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
              {t('All-Time: {amount}', { amount: formatTZS(kpis.all_time_sales) })}
            </span>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="h-56 min-w-[300px] flex items-end gap-2 sm:gap-3 pt-6 px-2 border-b border-slate-100">
              {trend.length === 0 ? (
                <p className="text-xs text-slate-400 m-auto">{t('No sales trend data yet.')}</p>
              ) : (
                trend.map((item) => {
                  const heightPct = Math.max(12, Math.round((Number(item.revenue) / maxTrendRev) * 100));
                  return (
                    <div key={item.day} className="flex-1 flex flex-col items-center gap-2 group">
                      <span className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition">
                        {formatTZS(item.revenue, false)}
                      </span>
                      <div className="w-full max-w-[44px] bg-blue-50 rounded-t-xl flex items-end h-40 overflow-hidden">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-xl transition-all"
                        />
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">{formatDate(item.day)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">{t('Top Selling Products')}</h2>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              {t('View Catalogue')}
            </button>
          </div>
          <div className="space-y-3.5">
            {topProducts.map((prod) => {
              const pct = Math.max(8, Math.round((Number(prod.revenue || 0) / maxProdRev) * 100));
              return (
                <div key={prod.id} className="flex items-center gap-3">
                  <img
                    src={resolveMediaUrl(prod.image_url) || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=120&q=80'}
                    alt={prod.name}
                    width="44"
                    height="44"
                    loading="lazy"
                    decoding="async"
                    className="w-11 h-11 rounded-xl object-cover border border-slate-200 block shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <p className="font-bold text-slate-800 truncate">{prod.name}</p>
                      <span className="font-bold text-slate-900 shrink-0 ml-2">{formatTZS(prod.revenue)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full mt-1.5 overflow-hidden">
                      <div style={{ width: `${pct}%` }} className="bg-blue-600 h-full rounded-full" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{t('{count} units sold', { count: prod.units_sold })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Operational Feeds: Recent Sales, Low Stock Alerts, Repayments & Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Sales */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">{t('Recent Sales Transactions')}</h2>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              {t('All Sales')}
            </button>
          </div>
          <div className="table-region" role="region" aria-label={t('Recent sales transactions')}>
            <table className="text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3 text-left font-bold">{t('Receipt #')}</th>
                  <th className="py-2.5 px-3 text-left font-bold">{t('Customer')}</th>
                  <th className="py-2.5 px-3 text-left font-bold">{t('Date')}</th>
                  <th className="py-2.5 px-3 text-right font-bold">{t('Total')}</th>
                  <th className="py-2.5 px-3 text-center font-bold">{t('Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSalesPg.pageItems.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-blue-600">{s.receipt_number}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{t(s.customer_name)}</td>
                    <td className="py-2.5 px-3 text-slate-500">{formatDate(s.sale_date, true)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatTZS(s.total_amount)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                          s.payment_status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.payment_status === 'partial'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {t(s.payment_status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Pagination {...recentSalesPg.paginationProps} hideWhenSinglePage />
          </div>
        </div>

        {/* Low Stock & Critical Inventory Alerts */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> {t('Low & Out-of-Stock Alerts')}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              {t('Manage Stock')}
            </button>
          </div>
          <div className="space-y-2.5">
            {lowStock.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">{t('All active products are well stocked.')}</p>
            ) : (
              lowStockPg.pageItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-100 bg-slate-50/70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {t('SKU: {sku} · Min Level: {min}', { sku: item.sku, min: item.min_stock_level })}
                    </p>
                    {canOrder && Number(item.pending_order_qty || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                        <Clock className="w-2.5 h-2.5" />
                        {t('Pending Order (+{qty})', { qty: item.pending_order_qty })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        Number(item.available_quantity) <= 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {Number(item.available_quantity) <= 0
                        ? t('Out of Stock (0)')
                        : t('{count} left', { count: formatQtyWithUnit(item.available_quantity, item.unit) })}
                    </span>
                    {canOrder && onOrderFromSupplier && (
                      <button
                        type="button"
                        onClick={() => onOrderFromSupplier(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-sm transition"
                        title={t('Order from Supplier')}
                      >
                        <Truck className="w-3 h-3" /> {t('Order')}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-3">
            <Pagination {...lowStockPg.paginationProps} hideWhenSinglePage />
          </div>

          {/* Recent Customer Repayments mini-feed */}
          {recentRepayments.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                {t('Recent Debt Repayments')}
              </h3>
              <div className="space-y-2">
                {recentRepayments.slice(0, 3).map((rp) => (
                  <div key={rp.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">
                      {t(rp.customer_name)} <span className="text-slate-400">({rp.sale_receipt})</span>
                    </span>
                    <span className="font-bold text-emerald-600">+{formatTZS(rp.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Purchased Products & Old Products Feed (Visible to Employees & Admin Immediately Upon Approval) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" /> {t('New Purchased & Old Products')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('Products approved by Admin appear immediately under New Purchased Products alongside existing old stock')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStockFeedTab('new')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                stockFeedTab === 'new'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t('New Purchased Products')} ({purchasedProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setStockFeedTab('old')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                stockFeedTab === 'old'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t('Old Products')} ({oldProducts.length})
            </button>
            <button
              type="button"
              onClick={() => onViewPurchasedProducts?.(stockFeedTab === 'old' ? 'old' : 'new')}
              className="text-xs font-semibold text-blue-600 hover:underline ml-1"
            >
              {t('View Full Catalogue')} →
            </button>
          </div>
        </div>

        {stockFeedTab === 'new' ? (
          purchasedProducts.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              {t('No newly approved purchased products yet.')}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {purchasedProductsPg.pageItems.map((item) => (
                <div
                  key={item.item_id}
                  className="p-3 rounded-2xl border border-blue-200/70 bg-blue-50/30 flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={
                        resolveMediaUrl(item.image_url) ||
                        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=120&q=80'
                      }
                      alt={item.product_name}
                      width="48"
                      height="48"
                      loading="lazy"
                      decoding="async"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 block"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-blue-600 text-white shrink-0">
                          {Number(item.is_new) === 1 ? t('New Purchased') : t('Purchased')}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate">
                          {t(item.category_name)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 line-clamp-2 mt-0.5">
                        {item.product_name}
                      </p>
                      <p className="text-[10px] text-slate-400">{item.sku}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      {t('+{qty} approved', { qty: item.received_quantity })}
                    </span>
                    <span className="font-extrabold text-blue-700">
                      {formatUnitPrice(item.selling_price, item.unit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{formatDate(item.received_at, true)}</span>
                    <span className="font-bold text-slate-700">
                      {isMeterUnit(item.unit)
                        ? t('{count} m in stock', { count: formatQtyNumber(item.available_quantity) })
                        : t('{count} in stock', { count: formatQtyNumber(item.available_quantity) })}
                    </span>
                  </div>
                </div>
                ))}
              </div>
              <Pagination
                {...purchasedProductsPg.paginationProps}
                standalone
                hideWhenSinglePage
              />
            </div>
          )
        ) : oldProducts.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            {t('No old stock products found.')}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {oldProductsPg.pageItems.map((item) => (
              <div
                key={item.product_id}
                className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={
                      resolveMediaUrl(item.image_url) ||
                      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=120&q=80'
                    }
                    alt={item.product_name}
                    width="48"
                    height="48"
                    loading="lazy"
                    decoding="async"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 block"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-200 text-slate-700 shrink-0">
                        {t('Old Stock')}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate">
                        {t(item.category_name)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 line-clamp-2 mt-0.5">
                      {item.product_name}
                    </p>
                    <p className="text-[10px] text-slate-400">{item.sku}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700">
                    {isMeterUnit(item.unit)
                      ? t('{count} m in stock', { count: formatQtyNumber(item.available_quantity) })
                      : t('{count} in stock', { count: formatQtyNumber(item.available_quantity) })}
                  </span>
                  <span className="font-extrabold text-blue-700">
                    {formatUnitPrice(item.selling_price, item.unit)}
                  </span>
                </div>
              </div>
              ))}
            </div>
            <Pagination
              {...oldProductsPg.paginationProps}
              standalone
              hideWhenSinglePage
            />
          </div>
        )}
      </div>
    </div>
  );
}

