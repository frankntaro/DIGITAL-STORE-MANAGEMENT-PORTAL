import React, { useEffect, useState } from 'react';
import { useLanguage } from '../utils/i18n';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Monitor,
  Printer,
  RefreshCw,
  RotateCcw,
  Share2,
  Shield,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserCog,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { apiRequest, synchronizeOfflineQueue } from '../services/api';
import { clearSyncedFromQueue, getOfflineQueue } from '../services/offlineDb';
import { exportToCsv, formatDate, formatTZS, hasPermission, printHtmlDocument } from '../utils/format';
import Pagination, { usePagination } from '../components/Pagination';

// ============================================================================
// SCREEN 19: EXPENSES MANAGEMENT
// ============================================================================
const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity and water',
  'Internet',
  'Transportation',
  'Employee salaries',
  'Maintenance',
  'Cleaning',
  'Other expenses',
];

export function ExpensesScreen() {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState(null);

  const loadExpenses = async () => {
    const res = await apiRequest('/expenses');
    setExpenses(res.expenses || []);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          amount: Number(amount),
          expense_date: expenseDate,
          payment_method: paymentMethod,
          description,
        }),
      });
      setTitle('');
      setAmount('');
      setDescription('');
      setMessage({ type: 'success', text: res.message });
      loadExpenses();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const expensesPg = usePagination(expenses, 5);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Operating Expenses')}</h1>
          <p className="text-xs text-slate-500">
            {t('Track daily operating expenses (strictly separated from inventory purchases)')}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs font-bold text-amber-900">
          {t('Total Recorded Expenses: {amount}', { amount: formatTZS(totalExpenses) })}
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

      <form
        onSubmit={handleCreate}
        className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-sm"
      >
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">{t('Expense Title *')}</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('e.g. Monthly Shop Rent / LUKU Token')}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">{t('Category *')}</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
          >
            {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">{t('Amount (TZS) *')}</label>
          <input
            type="number"
            min="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">{t('Date')}</label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">{t('Description')}</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
          >
            {t('+ Add Expense')}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="table-region" role="region" aria-label={t('Operating expenses list')}>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Ref #')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Date')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Category')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Title & Description')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Amount (TZS)')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Recorded By')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expensesPg.pageItems.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-blue-600">{e.reference_number}</td>
                  <td className="py-3 px-4 text-slate-600">{formatDate(e.expense_date)}</td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
                      {t(e.category)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900">{e.title}</p>
                    <p className="text-[11px] text-slate-400">{e.description}</p>
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-amber-700">
                    {formatTZS(e.amount)}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{e.recorded_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...expensesPg.paginationProps} />
      </div>
    </div>
  );
}

// ============================================================================
// SCREEN 20: CASH REGISTER MANAGEMENT
// ============================================================================
export function CashRegisterScreen() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [openingBalance, setOpeningBalance] = useState('500000');
  const [countedBalance, setCountedBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState(null);

  const loadRegister = async () => {
    const res = await apiRequest('/cash-register');
    setData(res);
    if (res.active_session) {
      setCountedBalance(String(res.active_session.expected_closing_balance));
    }
  };

  useEffect(() => {
    loadRegister();
  }, []);

  const handleOpen = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/cash-register/open', {
        method: 'POST',
        body: JSON.stringify({ opening_balance: Number(openingBalance), opening_notes: notes }),
      });
      setMessage({ type: 'success', text: res.message });
      setNotes('');
      loadRegister();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/cash-register/close', {
        method: 'POST',
        body: JSON.stringify({ actual_counted_balance: Number(countedBalance), closing_notes: notes }),
      });
      setMessage({
        type: 'success',
        key: '{message} Expected: {expected}, Counted: {counted}, Difference: {diff}',
        params: {
          rawMessage: res.message,
          expected: formatTZS(res.expected_closing_balance),
          counted: formatTZS(res.actual_counted_balance),
          diff: formatTZS(res.cash_difference),
        },
      });
      setNotes('');
      loadRegister();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const active = data?.active_session;
  const movements = data?.movements || [];
  const history = data?.history || [];
  const movementsPg = usePagination(movements, 5);
  const historyPg = usePagination(history, 5);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">{t('Cash Register & Daily Reconciliation')}</h1>
        <p className="text-xs text-slate-500">
          {t('Expected Closing Cash = Opening Balance + Cash Inflows (Sales & Repayments) − Cash Outflows (Expenses, Supplier Payments & Refunds)')}
        </p>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold ${
            message.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {message.params?.rawMessage
            ? t(message.key, { ...message.params, message: t(message.params.rawMessage) })
            : t(message.key || message.text, message.params)}
        </div>
      )}

      {active ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Session Summary Card (Matches Screen 20 Mockup) */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  {t('ACTIVE SHIFT: {code}', { code: active.session_code })}
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  {t('Opened by {name} at {date}', {
                    name: active.cashier_name,
                    date: formatDate(active.opened_at, true),
                  })}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">{t('Opening Balance:')}</span>
                <span className="font-bold text-slate-900">{formatTZS(active.opening_balance)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">{t('Total Cash Inflows (Sales + Repayments):')}</span>
                <span className="font-bold text-emerald-600">+{formatTZS(active.cash_inflows)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">{t('Total Cash Outflows (Expenses + Suppliers):')}</span>
                <span className="font-bold text-red-600">-{formatTZS(active.cash_outflows)}</span>
              </div>
              <div className="flex justify-between py-3 bg-blue-50/70 rounded-xl px-4 text-base font-extrabold text-blue-900">
                <span>{t('Expected Closing Balance:')}</span>
                <span>{formatTZS(active.expected_closing_balance)}</span>
              </div>
            </div>

            <form onSubmit={handleClose} className="pt-3 border-t border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Physically Counted Cash in Drawer (TZS) *')}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={countedBalance}
                  onChange={(e) => setCountedBalance(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-extrabold"
                />
              </div>
              {countedBalance !== '' && (
                <div className="text-xs font-bold flex justify-between">
                  <span>{t('Calculated Cash Discrepancy / Difference:')}</span>
                  <span
                    className={
                      Number(countedBalance) - Number(active.expected_closing_balance) < 0
                        ? 'text-red-600'
                        : 'text-emerald-600'
                    }
                  >
                    {formatTZS(Number(countedBalance) - Number(active.expected_closing_balance))}
                  </span>
                </div>
              )}
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('Closing shift reconciliation notes...')}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold"
              >
                {t('Close & Reconcile Cash Session')}
              </button>
            </form>
          </div>

          {/* Live Cash Movements */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-5">
              <h2 className="text-sm font-extrabold text-slate-900 mb-3">
                {t('Shift Cash Movements ({count})', { count: movements.length })}
              </h2>
              <div className="space-y-2 pr-1">
                {movementsPg.pageItems.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{t(m.description)}</p>
                      <p className="text-[11px] text-slate-400">
                        {t(m.category)} · {formatDate(m.created_at, true)}
                      </p>
                    </div>
                    <span
                      className={`font-extrabold ${
                        m.direction === 'inflow' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {m.direction === 'inflow' ? '+' : '-'}
                      {formatTZS(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Pagination {...movementsPg.paginationProps} />
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleOpen}
          className="max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
        >
          <h2 className="text-base font-extrabold text-slate-900">{t('Open New Cash Register Shift')}</h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('Opening Cash Float Balance (TZS) *')}
            </label>
            <input
              type="number"
              min="0"
              required
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
            />
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('Opening shift notes...')}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold"
          >
            {t('Open Cash Register Session')}
          </button>
        </form>
      )}

      {/* Historical Sessions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-900">{t('Historical Cash Sessions')}</h3>
        </div>
        <div className="table-region" role="region" aria-label={t('Historical cash sessions')}>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Session')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Employee')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Opening')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Expected')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Counted')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Difference')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyPg.pageItems.map((h) => (
                <tr key={h.id}>
                  <td className="py-3 px-4 font-bold text-blue-600">{h.session_code}</td>
                  <td className="py-3 px-4">{h.cashier_name}</td>
                  <td className="py-3 px-4 text-right">{formatTZS(h.opening_balance)}</td>
                  <td className="py-3 px-4 text-right font-bold">
                    {formatTZS(h.expected_closing_balance)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {h.actual_counted_balance !== null ? formatTZS(h.actual_counted_balance) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-bold">
                    {h.cash_difference !== null ? formatTZS(h.cash_difference) : '—'}
                  </td>
                  <td className="py-3 px-4 text-center uppercase font-bold text-[11px]">
                    {t(h.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...historyPg.paginationProps} />
      </div>
    </div>
  );
}

// ============================================================================
// SCREEN 21: RETURNS & WARRANTY MANAGEMENT
// ============================================================================
export function ReturnsWarrantyScreen() {
  const { t } = useLanguage();
  const [data, setData] = useState({ returns: [], warranties: [], claims: [] });
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('returns');
  const [retForm, setRetForm] = useState(() => ({
    sale_id: '',
    product_id: '',
    quantity: 1,
    condition_status: 'resalable',
    resolution: 'exchange',
    reason: t('Defective / Customer exchange request'),
  }));
  const [warForm, setWarForm] = useState(() => ({
    sale_id: '',
    product_id: '',
    duration_months: 12,
    serial_or_imei: '',
    notes: t('12-Month Store & Manufacturer Warranty'),
  }));
  const [claimForm, setClaimForm] = useState({
    warranty_id: '',
    issue_description: '',
    resolution: 'repaired',
    resolution_notes: '',
  });
  const [message, setMessage] = useState(null);

  const loadAll = async () => {
    const [rwRes, sRes, pRes] = await Promise.all([
      apiRequest('/returns-warranties'),
      apiRequest('/sales'),
      apiRequest('/products?status=active'),
    ]);
    setData(rwRes);
    const sList = sRes.sales || [];
    const pList = pRes.products || [];
    setSales(sList);
    setProducts(pList);
    if (sList.length > 0 && pList.length > 0) {
      setRetForm((f) => ({
        ...f,
        sale_id: f.sale_id || sList[0].id,
        product_id: f.product_id || pList[0].id,
      }));
      setWarForm((f) => ({
        ...f,
        sale_id: f.sale_id || sList[0].id,
        product_id: f.product_id || pList[0].id,
      }));
    }
    if ((rwRes.warranties || []).length > 0) {
      setClaimForm((f) => ({ ...f, warranty_id: f.warranty_id || rwRes.warranties[0].id }));
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const returnsPg = usePagination(data.returns || [], 5);
  const warrantiesPg = usePagination(data.warranties || [], 5);
  const claimsPg = usePagination(data.claims || [], 5);

  const handleCreateReturn = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/returns', {
        method: 'POST',
        body: JSON.stringify(retForm),
      });
      setMessage({ type: 'success', text: res.message });
      loadAll();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleRegisterWarranty = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/warranties', {
        method: 'POST',
        body: JSON.stringify(warForm),
      });
      setMessage({ type: 'success', text: res.message });
      loadAll();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleCreateClaim = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/warranty-claims', {
        method: 'POST',
        body: JSON.stringify(claimForm),
      });
      setMessage({ type: 'success', text: res.message });
      setClaimForm((f) => ({ ...f, issue_description: '', resolution_notes: '' }));
      loadAll();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">{t('Product Returns & Warranty Claims')}</h1>
        <p className="text-xs text-slate-500">
          {t('Process sale-linked returns (resalable items restock automatically) and track product warranty expiry & claims')}
        </p>
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

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('returns')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
            tab === 'returns' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('Product Returns ({count})', { count: data.returns.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab('warranties')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
            tab === 'warranties'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500'
          }`}
        >
          {t('Active & Expired Warranties ({count})', { count: data.warranties.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab('claims')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
            tab === 'claims' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('Warranty Claims ({count})', { count: data.claims.length })}
        </button>
      </div>

      {tab === 'returns' && (
        <div className="space-y-4">
          <form
            onSubmit={handleCreateReturn}
            className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('Original Sale *')}</label>
              <select
                value={retForm.sale_id}
                onChange={(e) => setRetForm({ ...retForm, sale_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.receipt_number} — {t(s.customer_name)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('Returned Product *')}</label>
              <select
                value={retForm.product_id}
                onChange={(e) => setRetForm({ ...retForm, product_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('Product Condition *')}</label>
              <select
                value={retForm.condition_status}
                onChange={(e) => setRetForm({ ...retForm, condition_status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="resalable">{t('Resalable (Auto-Restock Inventory)')}</option>
                <option value="damaged">{t('Damaged (Do Not Restock)')}</option>
                <option value="under_inspection">{t('Under Inspection')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('Resolution *')}</label>
              <select
                value={retForm.resolution}
                onChange={(e) => setRetForm({ ...retForm, resolution: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="exchange">{t('Product Exchange')}</option>
                <option value="cash_refund">{t('Cash Refund (Cash Outflow)')}</option>
                <option value="store_credit">{t('Store Credit')}</option>
                <option value="no_refund_policy">{t('Return Without Refund (Approved Policy)')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('Reason *')}</label>
              <input
                type="text"
                required
                value={retForm.reason}
                onChange={(e) => setRetForm({ ...retForm, reason: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                {t('+ Process Return')}
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="table-region" tabIndex={0} role="region" aria-label={t('Product returns table')}>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4 text-left font-bold">{t('Return #')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Sale Ref')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Reason')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Resolution')}</th>
                  <th className="py-3 px-4 text-center font-bold">{t('Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returnsPg.pageItems.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 px-4 font-bold text-blue-600">{r.return_number}</td>
                    <td className="py-3 px-4 font-semibold">{r.sale_receipt_number}</td>
                    <td className="py-3 px-4">{t(r.reason)}</td>
                    <td className="py-3 px-4 capitalize">{t(r.resolution)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        {t(r.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Pagination {...returnsPg.paginationProps} />
          </div>
        </div>
      )}

      {tab === 'warranties' && (
        <div className="space-y-4">
          <form
            onSubmit={handleRegisterWarranty}
            className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-4 gap-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('Original Sale')}</label>
              <select
                value={warForm.sale_id}
                onChange={(e) => setWarForm({ ...warForm, sale_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.receipt_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('Product')}</label>
              <select
                value={warForm.product_id}
                onChange={(e) => setWarForm({ ...warForm, product_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('Duration (Months)')}
              </label>
              <input
                type="number"
                min="1"
                value={warForm.duration_months}
                onChange={(e) => setWarForm({ ...warForm, duration_months: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                {t('+ Register Warranty')}
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="table-region" tabIndex={0} role="region" aria-label={t('Warranties table')}>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4 text-left font-bold">{t('Warranty #')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Product')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Customer')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Sale Date')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Expiry Date')}</th>
                  <th className="py-3 px-4 text-center font-bold">{t('Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warrantiesPg.pageItems.map((w) => (
                  <tr key={w.id}>
                    <td className="py-3 px-4 font-bold text-blue-600">{w.warranty_number}</td>
                    <td className="py-3 px-4 font-bold">{w.product_name}</td>
                    <td className="py-3 px-4">{t(w.customer_name)}</td>
                    <td className="py-3 px-4">{formatDate(w.sale_date)}</td>
                    <td className="py-3 px-4 font-semibold">{formatDate(w.expiry_date)}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                          w.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {t(w.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Pagination {...warrantiesPg.paginationProps} />
          </div>
        </div>
      )}

      {tab === 'claims' && (
        <div className="space-y-4">
          <form
            onSubmit={handleCreateClaim}
            className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-4 gap-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('Warranty')}</label>
              <select
                value={claimForm.warranty_id}
                onChange={(e) => setClaimForm({ ...claimForm, warranty_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {data.warranties.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warranty_number} — {w.product_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('Issue *')}</label>
              <input
                type="text"
                required
                value={claimForm.issue_description}
                onChange={(e) => setClaimForm({ ...claimForm, issue_description: e.target.value })}
                placeholder={t('Describe fault...')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('Resolution')}</label>
              <select
                value={claimForm.resolution}
                onChange={(e) => setClaimForm({ ...claimForm, resolution: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="repaired">{t('Repaired')}</option>
                <option value="replaced">{t('Replaced')}</option>
                <option value="rejected">{t('Rejected')}</option>
                <option value="pending">{t('Pending Inspection')}</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                {t('+ Record Claim')}
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="table-region" tabIndex={0} role="region" aria-label={t('Warranty claims table')}>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4 text-left font-bold">{t('Claim #')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Warranty #')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Product')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Issue')}</th>
                  <th className="py-3 px-4 text-center font-bold">{t('Resolution')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claimsPg.pageItems.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 px-4 font-bold text-blue-600">{c.claim_number}</td>
                    <td className="py-3 px-4 font-semibold">{c.warranty_number}</td>
                    <td className="py-3 px-4">{c.product_name}</td>
                    <td className="py-3 px-4">{c.issue_description}</td>
                    <td className="py-3 px-4 text-center uppercase font-bold text-[11px]">
                      {t(c.resolution)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Pagination {...claimsPg.paginationProps} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCREEN 22: REPORTS & ANALYTICS (AT-19, AT-20)
// ============================================================================
function buildShareableReportText({
  settings,
  startDate,
  endDate,
  tab,
  summary,
  byProduct,
  byCategory,
  byEmployee,
  financialsPermitted,
  canSeeInventoryValuation,
  t,
}) {
  const shopName = settings?.shop_name || 'KAMPANGO PHONES AND ELECTRONICS';
  const tabLabels = {
    sales: t('Sales & Products'),
    inventory: t('Inventory & Valuation'),
    employees: t('Sales by Employee'),
    finance: t('Financial P&L Statement'),
  };
  const lines = [
    `${shopName}`,
    `${t('BUSINESS & FINANCIAL REPORT')} — ${tabLabels[tab] || t('Reports & Financial Analytics')}`,
    t('Period: {start} to {end}', { start: startDate, end: endDate }),
    '----------------------------------------',
    `${t('Net Sales Revenue')}: ${formatTZS(summary.sales_revenue)}`,
    `${t('Total Cash Collected')}: ${formatTZS(summary.cash_collected)}`,
    `${t('Accounts Receivable (AR)')}: ${formatTZS(summary.accounts_receivable)}`,
  ];

  if (canSeeInventoryValuation) {
    lines.push(`${t('Inventory Cost Value')}: ${formatTZS(summary.inventory_cost_value)}`);
  }

  lines.push(`${t('Accounts Payable (Supplier Balances)')}: ${formatTZS(summary.accounts_payable)}`);

  if (financialsPermitted) {
    lines.push(
      '----------------------------------------',
      t('Financial P&L Summary'),
      `${t('Gross Sales:')} ${formatTZS(summary.gross_sales)}`,
      `${t('Less: Authorized Discounts:')} -${formatTZS(summary.total_discounts)}`,
      `${t('Cost of Goods Sold (COGS)')}: -${formatTZS(summary.cogs)}`,
      `${t('Gross Profit')}: ${formatTZS(summary.gross_profit)}`,
      `${t('Operating Expenses')}: -${formatTZS(summary.operating_expenses)}`,
      `${t('Net Profit')}: ${formatTZS(summary.net_profit)}`
    );
  }

  if (tab === 'sales' && byProduct.length > 0) {
    lines.push('----------------------------------------', t('Top Products Sold'));
    byProduct.slice(0, 10).forEach((p, idx) => {
      const profitPart = financialsPermitted ? ` | ${t('Gross Profit')}: ${formatTZS(p.profit)}` : '';
      lines.push(`${idx + 1}. ${p.name} — ${p.units_sold} × | ${formatTZS(p.revenue)}${profitPart}`);
    });
    if (byProduct.length > 10) {
      lines.push(t('...and {count} more item(s)', { count: byProduct.length - 10 }));
    }
  } else if (tab === 'inventory' && canSeeInventoryValuation && byCategory.length > 0) {
    lines.push('----------------------------------------', t('Sales by Category'));
    byCategory.slice(0, 10).forEach((c, idx) => {
      lines.push(`${idx + 1}. ${t(c.category_name)} — ${c.units_sold} | ${formatTZS(c.revenue)}`);
    });
  } else if (tab === 'employees' && byEmployee.length > 0) {
    lines.push('----------------------------------------', t('Sales by Employee'));
    byEmployee.slice(0, 10).forEach((e, idx) => {
      lines.push(
        `${idx + 1}. ${e.full_name} (${e.employee_code}) — ${e.transactions_count} | ${formatTZS(e.revenue)} (${t('Cash Collected')}: ${formatTZS(e.cash_collected)})`
      );
    });
  }

  lines.push(
    '----------------------------------------',
    `${t('Generated on')}: ${formatDate(new Date().toISOString(), true)}`,
    'DIGITAL STORE MANAGEMENT PORTAL'
  );
  return lines.join('\n');
}

export function ReportsScreen({ user, settings }) {
  const { t } = useLanguage();
  const isAdmin = (user?.role_slugs || []).includes('owner');
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState('sales');
  const [error, setError] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);

  useEffect(() => {
    if (!isAdmin && tab === 'inventory') {
      setTab('sales');
    }
  }, [isAdmin, tab]);

  const loadReports = async (reportType = 'overview') => {
    setError(null);
    try {
      const res = await apiRequest(
        `/reports?type=${reportType}&start_date=${startDate}&end_date=${endDate}`
      );
      setData(res);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadReports(tab === 'finance' ? 'financial' : 'overview');
  }, [tab, startDate, endDate]);

  const summary = data?.summary || {};
  const canSeeInventoryValuation = isAdmin && data?.inventory_valuation_permitted !== false;
  const byCategory = canSeeInventoryValuation ? data?.sales_by_category || [] : [];
  const byProduct = data?.sales_by_product || [];
  const byEmployee = data?.sales_by_employee || [];
  const byProductPg = usePagination(byProduct, 5, `${startDate}|${endDate}`);
  const byCategoryPg = usePagination(byCategory, 5, `${startDate}|${endDate}`);
  const byEmployeePg = usePagination(byEmployee, 5, `${startDate}|${endDate}`);

  const shareReportTitle = t(
    'KAMPANGO PHONES AND ELECTRONICS — Financial & Operational Report ({start} to {end})',
    { start: startDate, end: endDate }
  );
  const shareReportText = buildShareableReportText({
    settings,
    startDate,
    endDate,
    tab: !canSeeInventoryValuation && tab === 'inventory' ? 'sales' : tab,
    summary,
    byProduct,
    byCategory,
    byEmployee,
    financialsPermitted: Boolean(data?.financials_permitted),
    canSeeInventoryValuation,
    t,
  });

  const handleCopyReportText = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareReportText);
      } else {
        const ta = document.createElement('textarea');
        ta.value = shareReportText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedReport(true);
      setShareFeedback(t('Report summary copied to clipboard!'));
      setTimeout(() => {
        setCopiedReport(false);
        setShareFeedback('');
      }, 3000);
    } catch {
      setShareFeedback(t('Could not copy report automatically. Please select and copy the text below.'));
    }
  };

  const handleNativeShareReport = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareReportTitle,
          text: shareReportText,
        });
        setShareFeedback(t('Report shared successfully!'));
        setTimeout(() => setShareFeedback(''), 3000);
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    await handleCopyReportText();
  };

  const handleWhatsAppShareReport = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareReportText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEmailShareReport = () => {
    const mailto = `mailto:?subject=${encodeURIComponent(shareReportTitle)}&body=${encodeURIComponent(shareReportText)}`;
    window.location.href = mailto;
  };

  const handleExportExcel = () => {
    const cols = [
      { label: t('SKU'), accessor: 'sku' },
      { label: t('Product Name'), accessor: 'name' },
      { label: t('Category'), accessor: (row) => t(row.category_name) },
      ...(canSeeInventoryValuation ? [{ label: t('Current Stock'), accessor: 'current_stock' }] : []),
      { label: t('Units Sold'), accessor: 'units_sold' },
      { label: t('Revenue (TZS)'), accessor: 'revenue' },
      ...(data?.financials_permitted
        ? [
            { label: t('COGS (TZS)'), accessor: 'cogs' },
            { label: t('Gross Profit (TZS)'), accessor: 'profit' },
          ]
        : []),
    ];
    exportToCsv(`KAMPANGO_Product_Sales_${startDate}_to_${endDate}.csv`, byProduct, cols);
  };

  const handleExportPdf = () => {
    printHtmlDocument(
      shareReportTitle,
      `
      <div class="header">
        <h2>${t('BUSINESS & FINANCIAL REPORT')}</h2>
        <p>${t('Period: {start} to {end}', { start: startDate, end: endDate })}</p>
      </div>
      <table>
        <tr><th>${t('Sales Revenue (Net of Discounts)')}</th><td class="text-right"><strong>${formatTZS(
          summary.sales_revenue
        )}</strong></td></tr>
        ${
          data?.financials_permitted
            ? `
        <tr><th>${t('Cost of Goods Sold (COGS)')}</th><td class="text-right">${formatTZS(summary.cogs)}</td></tr>
        <tr><th>${t('Gross Profit')}</th><td class="text-right"><strong>${formatTZS(
          summary.gross_profit
        )}</strong></td></tr>
        <tr><th>${t('Operating Expenses')}</th><td class="text-right">${formatTZS(
          summary.operating_expenses
        )}</td></tr>
        <tr><th>${t('Net Profit')}</th><td class="text-right"><strong>${formatTZS(
          summary.net_profit
        )}</strong></td></tr>`
            : ''
        }
        <tr><th>${t('Cash Collected (Sales + Debt Repayments)')}</th><td class="text-right">${formatTZS(
          summary.cash_collected
        )}</td></tr>
        <tr><th>${t('Accounts Receivable (Customer Debts)')}</th><td class="text-right">${formatTZS(
          summary.accounts_receivable
        )}</td></tr>
        ${
          canSeeInventoryValuation
            ? `<tr><th>${t('Inventory Cost Value')}</th><td class="text-right">${formatTZS(
                summary.inventory_cost_value
              )}</td></tr>`
            : ''
        }
        <tr><th>${t('Accounts Payable (Supplier Balances)')}</th><td class="text-right">${formatTZS(
          summary.accounts_payable
        )}</td></tr>
      </table>
      `
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Reports & Financial Analytics')}</h1>
          <p className="text-xs text-slate-500">
            {isAdmin
              ? t('Sales, Inventory, Customer, Supplier, and P&L statements with PDF, Excel & instant sharing')
              : t('Sales, Customer, and Employee operational reports with PDF, Excel & instant sharing')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label={t('From date')}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
          />
          <input
            type="date"
            aria-label={t('To date')}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
          />
          <button
            type="button"
            onClick={() => {
              setShareFeedback('');
              setShowShareModal(true);
            }}
            disabled={!data}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition"
          >
            <Share2 className="w-3.5 h-3.5" /> {t('Share Report')}
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold"
          >
            <Printer className="w-3.5 h-3.5" /> {t('Export PDF')}
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> {t('Export Excel (CSV)')}
          </button>
        </div>
      </div>

      {/* Share Report Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{t('Share Report')}</h3>
                  <p className="text-xs text-slate-500">
                    {t('Period: {start} to {end}', { start: startDate, end: endDate })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t('Close')}
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {shareFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                {shareFeedback}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                {t('Report Summary Preview')}
              </label>
              <textarea
                readOnly
                rows={10}
                value={shareReportText}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-800 resize-none focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handleWhatsAppShareReport}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" /> {t('WhatsApp')}
              </button>
              <button
                type="button"
                onClick={handleNativeShareReport}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" /> {t('Share')}
              </button>
              <button
                type="button"
                onClick={handleEmailShareReport}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition"
              >
                <Mail className="w-3.5 h-3.5 shrink-0" /> {t('Email')}
              </button>
              <button
                type="button"
                onClick={handleCopyReportText}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition"
              >
                {copiedReport ? (
                  <>
                    <Check className="w-3.5 h-3.5 shrink-0" /> {t('Copied!')}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 shrink-0" /> {t('Copy')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Tabs (Inventory & Valuation is strictly Admin-only) */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'sales', label: 'Sales & Products' },
          ...(isAdmin ? [{ id: 'inventory', label: 'Inventory & Valuation' }] : []),
          { id: 'employees', label: 'Sales by Employee' },
          { id: 'finance', label: 'Financial P&L Statement' },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap ${
              tab === tabItem.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            {t(tabItem.label)}
          </button>
        ))}
      </div>

      {error ? (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
          {t(error)}
        </div>
      ) : (
        <>
          {/* Summary KPI Row */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${canSeeInventoryValuation ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t('Net Sales Revenue')}</p>
              <p className="text-lg font-extrabold text-blue-600 mt-1">
                {formatTZS(summary.sales_revenue)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t('Total Cash Collected')}</p>
              <p className="text-lg font-extrabold text-emerald-600 mt-1">
                {formatTZS(summary.cash_collected)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t('Accounts Receivable (AR)')}</p>
              <p className="text-lg font-extrabold text-red-600 mt-1">
                {formatTZS(summary.accounts_receivable)}
              </p>
            </div>
            {canSeeInventoryValuation && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">{t('Inventory Cost Value')}</p>
                <p className="text-lg font-extrabold text-slate-900 mt-1">
                  {formatTZS(summary.inventory_cost_value)}
                </p>
              </div>
            )}
          </div>

          {tab === 'finance' && data?.financials_permitted && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3 text-sm">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                {t('Income & Profit Statement (SRS Section 6 Accounting Rules)')}
              </h2>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span>{t('Gross Sales:')}</span>
                <span className="font-bold">{formatTZS(summary.gross_sales)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 text-amber-700">
                <span>{t('Less: Authorized Discounts:')}</span>
                <span className="font-bold">-{formatTZS(summary.total_discounts)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 font-bold text-slate-900">
                <span>{t('Net Sales Revenue (Excludes Debt Repayments):')}</span>
                <span>{formatTZS(summary.sales_revenue)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 text-slate-600">
                <span>{t('Less: Cost of Goods Sold (COGS at Preserved Historical Unit Cost):')}</span>
                <span className="font-bold">-{formatTZS(summary.cogs)}</span>
              </div>
              <div className="flex justify-between py-2.5 bg-emerald-50/70 px-3 rounded-xl font-extrabold text-emerald-800">
                <span>{t('Gross Profit (Net Sales − COGS):')}</span>
                <span>{formatTZS(summary.gross_profit)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 text-amber-800">
                <span>{t('Less: Operating Expenses (Separated from Inventory Purchases):')}</span>
                <span className="font-bold">-{formatTZS(summary.operating_expenses)}</span>
              </div>
              <div className="flex justify-between py-3 bg-blue-600 text-white px-4 rounded-xl text-base font-extrabold">
                <span>{t('Net Profit (Gross Profit − Operating Expenses):')}</span>
                <span>{formatTZS(summary.net_profit)}</span>
              </div>
            </div>
          )}

          {tab === 'sales' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="table-region" tabIndex={0} role="region" aria-label={t('Product sales report')}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-3 px-4 text-left font-bold">{t('Product')}</th>
                    <th className="py-3 px-4 text-left font-bold">{t('Category')}</th>
                    <th className="py-3 px-4 text-center font-bold">{t('Units Sold')}</th>
                    <th className="py-3 px-4 text-right font-bold">{t('Revenue')}</th>
                    {data?.financials_permitted && (
                      <th className="py-3 px-4 text-right font-bold">{t('Gross Profit')}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byProductPg.pageItems.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                      <td className="py-3 px-4 text-slate-500">{t(p.category_name)}</td>
                      <td className="py-3 px-4 text-center font-bold">{p.units_sold}</td>
                      <td className="py-3 px-4 text-right font-bold">{formatTZS(p.revenue)}</td>
                      {data?.financials_permitted && (
                        <td className="py-3 px-4 text-right font-bold text-emerald-600">
                          {formatTZS(p.profit)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <Pagination {...byProductPg.paginationProps} />
            </div>
          )}

          {tab === 'inventory' && canSeeInventoryValuation && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="table-region" tabIndex={0} role="region" aria-label={t('Category sales report')}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-3 px-4 text-left font-bold">{t('Category')}</th>
                    <th className="py-3 px-4 text-center font-bold">{t('Units Sold')}</th>
                    <th className="py-3 px-4 text-right font-bold">{t('Category Revenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byCategoryPg.pageItems.map((c) => (
                    <tr key={c.category_name}>
                      <td className="py-3 px-4 font-bold text-slate-900">{t(c.category_name)}</td>
                      <td className="py-3 px-4 text-center font-bold">{c.units_sold}</td>
                      <td className="py-3 px-4 text-right font-bold">{formatTZS(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <Pagination {...byCategoryPg.paginationProps} />
            </div>
          )}

          {tab === 'employees' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="table-region" tabIndex={0} role="region" aria-label={t('Employee sales report')}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-3 px-4 text-left font-bold">{t('Employee')}</th>
                    <th className="py-3 px-4 text-center font-bold">{t('Completed Sales')}</th>
                    <th className="py-3 px-4 text-right font-bold">{t('Total Revenue')}</th>
                    <th className="py-3 px-4 text-right font-bold">{t('Cash Collected')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byEmployeePg.pageItems.map((e) => (
                    <tr key={e.id}>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {e.full_name} ({e.employee_code})
                      </td>
                      <td className="py-3 px-4 text-center font-bold">{e.transactions_count}</td>
                      <td className="py-3 px-4 text-right font-bold">{formatTZS(e.revenue)}</td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-bold">
                        {formatTZS(e.cash_collected)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <Pagination {...byEmployeePg.paginationProps} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// SCREEN 23: EMPLOYEES, GRANULAR PERMISSIONS & AUDIT LOGS
// ============================================================================
export function EmployeesPermissionsScreen({ currentUser, onUserUpdated }) {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [tab, setTab] = useState('employees');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [credentialsEmp, setCredentialsEmp] = useState(null);
  const [credUsernameInput, setCredUsernameInput] = useState('');
  const [credPasswordInput, setCredPasswordInput] = useState('');
  const [showCredPassword, setShowCredPassword] = useState(true);
  const [savingCreds, setSavingCreds] = useState(false);
  const [credError, setCredError] = useState('');
  const [newEmp, setNewEmp] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    password: 'staff123',
    role_ids: [],
    max_discount_percent: 5,
  });
  const [message, setMessage] = useState(null);

  const loadData = async () => {
    const [empRes, audRes] = await Promise.all([
      apiRequest('/employees'),
      apiRequest('/audit-logs'),
    ]);
    const empList = empRes.employees || [];
    const roleList = empRes.roles || [];
    setEmployees(empList);
    setRoles(roleList);
    setPermissions(empRes.permissions || []);
    setAuditLogs(audRes.audit_logs || []);

    // Default new employee role to unified 'employee' role
    if (roleList.length > 0 && newEmp.role_ids.length === 0) {
      const defaultRole = roleList.find((r) => r.slug === 'employee') || roleList[0];
      setNewEmp((prev) => ({ ...prev, role_ids: [defaultRole.id] }));
    }

    if (selectedEmp) {
      const updated = empList.find((e) => e.id === selectedEmp.id);
      if (updated) setSelectedEmp(updated);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const employeesPg = usePagination(employees, 5);
  const auditLogsPg = usePagination(auditLogs, 5);

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/employees', {
        method: 'POST',
        body: JSON.stringify(newEmp),
      });
      setMessage({ type: 'success', text: res.message });
      setShowAdd(false);
      const defaultRole = roles.find((r) => r.slug === 'employee') || roles[0];
      setNewEmp({
        full_name: '',
        username: '',
        email: '',
        phone: '',
        password: 'staff123',
        role_ids: defaultRole ? [defaultRole.id] : [],
        max_discount_percent: 5,
      });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteEmployee = async (emp) => {
    if (
      !window.confirm(
        t('Are you sure you want to delete employee @{username} ({fullName})?', {
          username: emp.username,
          fullName: emp.full_name,
        })
      )
    ) {
      return;
    }
    try {
      const res = await apiRequest(`/employees/${emp.id}`, {
        method: 'DELETE',
      });
      setMessage({ type: 'success', text: res.message });
      if (selectedEmp && selectedEmp.id === emp.id) {
        setSelectedEmp(null);
      }
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const openCredentialsModal = (emp) => {
    setCredentialsEmp(emp);
    setCredUsernameInput(emp.username || '');
    setCredPasswordInput('');
    setShowCredPassword(true);
    setCredError('');
  };

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    if (!credentialsEmp) return;
    setCredError('');

    const trimmedUsername = credUsernameInput.trim();
    const trimmedPassword = credPasswordInput.trim();
    const usernameChanged = trimmedUsername !== (credentialsEmp.username || '');
    const passwordChanged = trimmedPassword !== '';

    if (trimmedUsername.length < 3 || /\s/.test(trimmedUsername)) {
      setCredError(t('Username must be at least 3 characters with no spaces.'));
      return;
    }
    if (!usernameChanged && !passwordChanged) {
      setCredError(t('Please enter a new username or a new password (minimum 6 characters).'));
      return;
    }
    if (passwordChanged && trimmedPassword.length < 6) {
      setCredError(t('New password must be at least 6 characters long.'));
      return;
    }

    setSavingCreds(true);
    try {
      const res = await apiRequest(`/employees/${credentialsEmp.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
        }),
      });
      setMessage({ type: 'success', text: res.message });
      if (res.employee && currentUser && Number(res.employee.id) === Number(currentUser.id)) {
        onUserUpdated?.(res.employee);
      }
      setCredentialsEmp(null);
      setCredUsernameInput('');
      setCredPasswordInput('');
      loadData();
    } catch (err) {
      setCredError(t(err.message));
    } finally {
      setSavingCreds(false);
    }
  };

  const handleTogglePermissionOverride = async (emp, permSlug) => {
    const currentlyHas = (emp.permissions || []).includes(permSlug);
    const nextOverrides = { ...(emp.permission_overrides || {}), [permSlug]: !currentlyHas };
    try {
      const res = await apiRequest(`/employees/${emp.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          permission_overrides: nextOverrides,
          reason: `Toggled permission ${permSlug}`,
        }),
      });
      setMessage({ type: 'success', text: res.message });
      setSelectedEmp(res.employee);
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {t('Employees, Roles & Access Control (RBAC)')}
          </h1>
          <p className="text-xs text-slate-500">
            {t('Register new staff, edit usernames & reset passwords, delete accounts, and configure employee permissions')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
        >
          {showAdd ? t('Close Form') : t('+ Add Employee')}
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800 flex items-center justify-between">
          <span>{t(message.text)}</span>
          <button type="button" onClick={() => setMessage(null)} className="underline text-[11px]">
            {t('Dismiss')}
          </button>
        </div>
      )}

      {/* Edit Username & Reset Password Modal */}
      {credentialsEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {t('Edit Username & Reset Password')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    @{credentialsEmp.username} · {credentialsEmp.full_name} ({credentialsEmp.employee_code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t('Close')}
                onClick={() => setCredentialsEmp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {credError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {credError}
              </div>
            )}

            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div>
                <label htmlFor="emp-edit-username" className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('Login Username')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="emp-edit-username"
                  type="text"
                  required
                  minLength={3}
                  value={credUsernameInput}
                  onChange={(e) => setCredUsernameInput(e.target.value)}
                  placeholder={t('Enter login username')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
                />
              </div>

              <div>
                <label htmlFor="emp-edit-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('New Password (Optional — minimum 6 characters)')}
                </label>
                <div className="relative">
                  <input
                    id="emp-edit-password"
                    type={showCredPassword ? 'text' : 'password'}
                    value={credPasswordInput}
                    onChange={(e) => setCredPasswordInput(e.target.value)}
                    placeholder={t('Leave blank to keep current password')}
                    className="w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showCredPassword ? t('Hide password') : t('Show password')}
                    onClick={() => setShowCredPassword((v) => !v)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCredPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {t('Update username only, reset password only, or save both at once. Resetting the password signs out the account on other devices.')}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCredPasswordInput('Kampango' + Math.floor(1000 + Math.random() * 9000));
                    setShowCredPassword(true);
                  }}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  {t('Generate Password')}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCredentialsEmp(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={savingCreds}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold"
                  >
                    {savingCreds ? t('Saving...') : t('Save Credentials')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdd && (
        <form
          onSubmit={handleCreateEmployee}
          className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <input
            type="text"
            required
            placeholder={t('Full Name *')}
            value={newEmp.full_name}
            onChange={(e) => setNewEmp({ ...newEmp, full_name: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <input
            type="text"
            required
            placeholder={t('Unique Username *')}
            value={newEmp.username}
            onChange={(e) => setNewEmp({ ...newEmp, username: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <input
            type="password"
            required
            placeholder={t('Initial Password *')}
            value={newEmp.password}
            onChange={(e) => setNewEmp({ ...newEmp, password: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <input
            type="tel"
            placeholder={t('Phone (e.g. +255 7XX XXX XXX)')}
            value={newEmp.phone}
            onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <input
            type="email"
            placeholder={t('Email (optional)')}
            value={newEmp.email}
            onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <select
            value={newEmp.role_ids[0] || ''}
            onChange={(e) => setNewEmp({ ...newEmp, role_ids: [Number(e.target.value)] })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {t(r.name)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            max="100"
            placeholder={t('Max Discount % (e.g. 5)')}
            value={newEmp.max_discount_percent}
            onChange={(e) => setNewEmp({ ...newEmp, max_discount_percent: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
            >
              {t('Register Employee')}
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('employees')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
            tab === 'employees' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('Employees & Permissions ({count})', { count: employees.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab('audit')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
            tab === 'audit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('Security Audit Logs ({count})', { count: auditLogs.length })}
        </button>
      </div>

      {tab === 'employees' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="table-region" tabIndex={0} role="region" aria-label={t('Employees list')}>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4 text-left font-bold">{t('Employee')}</th>
                  <th className="py-3 px-4 text-left font-bold">{t('Role')}</th>
                  <th className="py-3 px-4 text-right font-bold">{t('Sales Total')}</th>
                  <th className="py-3 px-4 text-center font-bold">{t('Status')}</th>
                  <th className="py-3 px-4 text-center font-bold">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeesPg.pageItems.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{emp.full_name}</p>
                      <p className="text-[11px] text-slate-400">
                        @{emp.username} · {emp.employee_code}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-semibold text-blue-700">{t(emp.primary_role)}</td>
                    <td className="py-3 px-4 text-right font-bold">
                      {formatTZS(emp.sales_total)} ({emp.sales_count})
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t(emp.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedEmp(emp)}
                          title={t('Configure Permissions')}
                          className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px]"
                        >
                          {t('Perms ({count})', { count: emp.permissions.length })}
                        </button>
                        <button
                          type="button"
                          onClick={() => openCredentialsModal(emp)}
                          title={t('Edit Username & Reset Password')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[11px] transition"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('Credentials')}</span>
                        </button>
                        {!(emp.role_slugs || []).includes('owner') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp)}
                            title={t('Delete Employee')}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Pagination {...employeesPg.paginationProps} />
          </div>

          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5">
            {selectedEmp ? (
              <div className="space-y-3">
                <h2 className="text-sm font-extrabold text-slate-900">
                  {t('Granular Permissions: {name}', { name: selectedEmp.full_name })}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {t('Toggle individual permissions on or off for this employee (SRS Section 2.4).')}
                </p>
                <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
                  {permissions.map((p) => {
                    const granted = (selectedEmp.permissions || []).includes(p.slug);
                    const isOwner = (selectedEmp.role_slugs || []).includes('owner');
                    return (
                      <label
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50 text-xs cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{t(p.name)}</p>
                          <p className="text-[10px] text-slate-400">
                            {t(p.module)} · {p.slug}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          disabled={isOwner}
                          checked={granted}
                          onChange={() => handleTogglePermissionOverride(selectedEmp, p.slug)}
                          className="rounded text-blue-600 accent-blue-600"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                {t('Select an employee on the left to inspect or customize their individual permissions.')}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="table-region" tabIndex={0} role="region" aria-label={t('Security audit logs')}>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Timestamp')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Employee')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Action')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Entity')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Reason & Details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogsPg.pageItems.map((log) => (
                <tr key={log.id}>
                  <td className="py-3 px-4 text-slate-500">{formatDate(log.created_at, true)}</td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {log.user_name || t('System')}
                  </td>
                  <td className="py-3 px-4 font-bold text-blue-600">{t(log.action)}</td>
                  <td className="py-3 px-4">
                    {t(log.entity_type)} #{log.entity_id}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{t(log.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Pagination {...auditLogsPg.paginationProps} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCREEN 24: SYSTEM SETTINGS, ADMIN ACCOUNT, BACKUP & OFFLINE SYNC
// ============================================================================
export function SettingsScreen({
  user,
  settings: initialSettings,
  initialTab = 'general',
  onSettingsUpdated,
  onUserUpdated,
  onQueueUpdated,
}) {
  const { t } = useLanguage();
  const isAdmin = (user?.role_slugs || []).includes('owner');
  const canManageShopSettings = hasPermission(user, 'settings.manage');
  const normalizeTab = (requested) => {
    const normalized = requested === 'admin_account' ? 'account' : requested || 'general';
    return canManageShopSettings ? normalized : 'account';
  };
  const [form, setForm] = useState(initialSettings || {});
  const [tab, setTab] = useState(() => normalizeTab(initialTab));
  const [queue, setQueue] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Account Settings State (Admin & Employee)
  const [accountProfile, setAccountProfile] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [accountMeta, setAccountMeta] = useState(user || null);
  const [sessions, setSessions] = useState([]);
  const [savingAccount, setSavingAccount] = useState(false);
  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
    revoke_other_sessions: true,
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);

  useEffect(() => {
    setTab(normalizeTab(initialTab));
  }, [initialTab, canManageShopSettings]);

  const loadSettingsAndQueue = async () => {
    if (canManageShopSettings) {
      try {
        const res = await apiRequest('/settings');
        if (res.settings) setForm(res.settings);
      } catch {
        // offline fallback
      }
      const q = await getOfflineQueue();
      setQueue(q);
    }

    try {
      const accRes = await apiRequest('/auth/account');
      if (accRes.user) {
        setAccountMeta(accRes.user);
        setAccountProfile({
          full_name: accRes.user.full_name || '',
          username: accRes.user.username || '',
          email: accRes.user.email || '',
          phone: accRes.user.phone || '',
        });
      }
      setSessions(accRes.sessions || []);
    } catch {
      // offline fallback
    }
  };

  useEffect(() => {
    loadSettingsAndQueue();
  }, [user?.id, canManageShopSettings]);

  const queuePg = usePagination(queue, 5);
  const sessionsPg = usePagination(sessions, 5);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setForm(res.settings);
      onSettingsUpdated?.(res.settings);
      setMessage({ type: 'success', text: res.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdminProfile = async (e) => {
    e.preventDefault();
    setSavingAccount(true);
    setMessage(null);
    try {
      const res = await apiRequest('/auth/account', {
        method: 'PUT',
        body: JSON.stringify(accountProfile),
      });
      if (res.user) {
        setAccountMeta(res.user);
        setAccountProfile({
          full_name: res.user.full_name || '',
          username: res.user.username || '',
          email: res.user.email || '',
          phone: res.user.phone || '',
        });
        onUserUpdated?.(res.user);
      }
      setMessage({ type: 'success', text: res.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSavingAccount(false);
    }
  };

  const handleChangeAdminPassword = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (pwForm.new_password.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await apiRequest('/auth/account/password', {
        method: 'POST',
        body: JSON.stringify(pwForm),
      });
      setPwForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
        revoke_other_sessions: true,
      });
      setMessage({ type: 'success', text: res.message });
      loadSettingsAndQueue();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setRevokingSessions(true);
    setMessage(null);
    try {
      const res = await apiRequest('/auth/account/revoke-sessions', { method: 'POST' });
      setMessage({ type: 'success', text: res.message });
      loadSettingsAndQueue();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setRevokingSessions(false);
    }
  };

  const handleBackupExport = async () => {
    try {
      const res = await apiRequest('/settings/backup', { method: 'POST' });
      const blob = new Blob([JSON.stringify(res.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kampango_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: res.message });
      loadSettingsAndQueue();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleManualSync = async () => {
    try {
      const res = await synchronizeOfflineQueue();
      await loadSettingsAndQueue();
      onQueueUpdated?.();
      setMessage({
        type: 'success',
        key: 'Synchronized {count} pending offline transaction(s) with server.',
        params: { count: res.synced },
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">
          {canManageShopSettings && tab !== 'account'
            ? t('System Settings & Backup')
            : isAdmin
              ? t('Admin Account Settings')
              : t('My Account Settings')}
        </h1>
        <p className="text-xs text-slate-500">
          {canManageShopSettings && tab !== 'account'
            ? t('Shop profile, TZS currency, credit/discount policies, offline synchronization, and database backup')
            : t('Manage your login username, profile details, password, and active login sessions')}
        </p>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold ${
            message.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {t(message.key || message.text, message.params)}
        </div>
      )}

      {/* Vertical Tab Layout for Admin / Focused Account Card for Employee */}
      <div className={canManageShopSettings ? 'grid grid-cols-1 md:grid-cols-12 gap-6 items-start' : 'max-w-4xl'}>
        {canManageShopSettings && (
          <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200 p-2 space-y-1">
            {[
              { id: 'account', label: isAdmin ? t('Admin Account Settings') : t('My Account Settings') },
              { id: 'general', label: t('General & Shop Info') },
              { id: 'policies', label: t('Credit & Discount Rules') },
              { id: 'sync', label: t('Offline Sync Queue ({count})', { count: queue.length }) },
              { id: 'backup', label: t('Backup & Recovery') },
            ].map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => {
                  setTab(tabItem.id);
                  setMessage(null);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  tab === tabItem.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>
        )}

        <div className={`${canManageShopSettings ? 'md:col-span-9' : ''} bg-white rounded-2xl border border-slate-200 p-6 shadow-sm`}>
          {tab === 'account' && (
            <div className="space-y-6">
              {/* Profile Summary Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-base shadow-sm shrink-0">
                    {(accountProfile.full_name || 'US').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-extrabold text-slate-900">
                        {accountMeta?.full_name || accountProfile.full_name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700">
                        {t(accountMeta?.primary_role || user?.primary_role || (isAdmin ? 'Admin' : 'Employee'))}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      @{accountMeta?.username || accountProfile.username} · {accountMeta?.employee_code || user?.employee_code || 'EMP'}
                      {accountMeta?.last_login_at
                        ? ` · ${t('Last login:')} ${formatDate(accountMeta.last_login_at, true)}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <p className="text-slate-500">{t('Active Sessions')}</p>
                  <p className="font-extrabold text-slate-900">
                    {t('{count} device(s)', { count: sessions.length || 1 })}
                  </p>
                </div>
              </div>

              {/* Section 1: Profile & Login Username */}
              <form onSubmit={handleSaveAdminProfile} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <UserCog className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {isAdmin ? t('Admin Profile & Login Identity') : t('My Profile & Login Username')}
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="account-full-name" className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Full Name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="account-full-name"
                      type="text"
                      required
                      value={accountProfile.full_name}
                      onChange={(e) => setAccountProfile({ ...accountProfile, full_name: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="account-username" className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Login Username')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="account-username"
                      type="text"
                      required
                      minLength={3}
                      value={accountProfile.username}
                      onChange={(e) => setAccountProfile({ ...accountProfile, username: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label htmlFor="account-email" className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Email')}
                    </label>
                    <input
                      id="account-email"
                      type="email"
                      value={accountProfile.email}
                      onChange={(e) => setAccountProfile({ ...accountProfile, email: e.target.value })}
                      placeholder={t('admin@example.com')}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="account-phone" className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Phone')}
                    </label>
                    <input
                      id="account-phone"
                      type="tel"
                      value={accountProfile.phone}
                      onChange={(e) => setAccountProfile({ ...accountProfile, phone: e.target.value })}
                      placeholder="+255 7..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-sm"
                >
                  {savingAccount ? t('Saving...') : t('Save Account Profile')}
                </button>
              </form>

              {/* Section 2: Change Password */}
              <form onSubmit={handleChangeAdminPassword} className="space-y-4 pt-5 border-t border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {isAdmin ? t('Change Admin Password') : t('Change My Password')}
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="account-cur-pw" className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Current Password')} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="account-cur-pw"
                        type={showCurrentPw ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={pwForm.current_password}
                        onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                        placeholder={t('Enter current password')}
                        className="w-full pl-3.5 pr-9 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                      <button
                        type="button"
                        aria-label={showCurrentPw ? t('Hide password') : t('Show password')}
                        onClick={() => setShowCurrentPw((v) => !v)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      >
                        {showCurrentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="account-new-pw" className="block text-xs font-bold text-slate-700 mb-1">
                      {t('New Password')} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="account-new-pw"
                        type={showNewPw ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={pwForm.new_password}
                        onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                        placeholder={t('Minimum 6 characters')}
                        className="w-full pl-3.5 pr-9 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                      <button
                        type="button"
                        aria-label={showNewPw ? t('Hide password') : t('Show password')}
                        onClick={() => setShowNewPw((v) => !v)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="account-confirm-pw" className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Confirm New Password')} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="account-confirm-pw"
                        type={showConfirmPw ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={pwForm.confirm_password}
                        onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })}
                        placeholder={t('Re-enter new password')}
                        className="w-full pl-3.5 pr-9 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                      <button
                        type="button"
                        aria-label={showConfirmPw ? t('Hide password') : t('Show password')}
                        onClick={() => setShowConfirmPw((v) => !v)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pwForm.revoke_other_sessions}
                    onChange={(e) => setPwForm({ ...pwForm, revoke_other_sessions: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 accent-blue-600"
                  />
                  <span>{t('Sign out all other active devices after changing password')}</span>
                </label>
                <div>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-sm"
                  >
                    {savingPassword
                      ? t('Updating...')
                      : isAdmin
                        ? t('Update Admin Password')
                        : t('Update Password')}
                  </button>
                </div>
              </form>

              {/* Section 3: Active Login Sessions */}
              <div className="space-y-3 pt-5 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-slate-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {isAdmin
                        ? t('Active Admin Login Sessions ({count})', { count: sessions.length })
                        : t('Active Login Sessions ({count})', { count: sessions.length })}
                    </h3>
                  </div>
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      disabled={revokingSessions}
                      onClick={handleRevokeOtherSessions}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {revokingSessions ? t('Signing out...') : t('Sign Out Other Devices')}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {sessionsPg.pageItems.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {sess.device_id}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {t('Last active:')} {formatDate(sess.last_used_at || sess.created_at, true)}
                        </p>
                      </div>
                      {sess.is_current ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                          {t('Current Device')}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                          {t('Active Session')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <Pagination {...sessionsPg.paginationProps} standalone hideWhenSinglePage />
              </div>
            </div>
          )}

          {canManageShopSettings && (tab === 'general' || tab === 'policies') && (
            <form onSubmit={handleSave} className="space-y-4">
              {tab === 'general' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <img
                      src="/logo.png"
                      alt="KAMPANGO PHONES AND ELECTRONICS"
                      className="w-14 h-14 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
                    />
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">
                        {form.shop_name || 'KAMPANGO PHONES AND ELECTRONICS'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t('Main system logo active across login, sidebar, PWA icon, and all printed reports')}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t('Shop Name')}</label>
                    <input
                      type="text"
                      value={form.shop_name || ''}
                      onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t('Currency')}</label>
                    <input
                      type="text"
                      value={form.currency || 'TZS'}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t('Phone')}</label>
                    <input
                      type="text"
                      value={form.contact_phone || ''}
                      onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t('Email')}</label>
                    <input
                      type="email"
                      value={form.contact_email || ''}
                      onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Physical Shop Address')}
                    </label>
                    <input
                      type="text"
                      value={form.shop_address || ''}
                      onChange={(e) => setForm({ ...form, shop_address: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Receipt Footer Message')}
                    </label>
                    <input
                      type="text"
                      value={form.receipt_footer || ''}
                      onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Default Customer Credit Limit (TZS)')}
                    </label>
                    <input
                      type="number"
                      value={form.default_credit_limit || 2500000}
                      onChange={(e) => setForm({ ...form, default_credit_limit: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Max Cashier Discount Limit (%)')}
                    </label>
                    <input
                      type="number"
                      value={form.max_cashier_discount_percent || 5}
                      onChange={(e) =>
                        setForm({ ...form, max_cashier_discount_percent: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Default Warranty Duration (Months)')}
                    </label>
                    <input
                      type="number"
                      value={form.default_warranty_months || 12}
                      onChange={(e) =>
                        setForm({ ...form, default_warranty_months: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Default Low-Stock Alert Threshold')}
                    </label>
                    <input
                      type="number"
                      value={form.default_low_stock_threshold || 5}
                      onChange={(e) =>
                        setForm({ ...form, default_low_stock_threshold: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold"
              >
                {saving ? t('Saving...') : t('Save Settings')}
              </button>
            </form>
          )}

          {canManageShopSettings && tab === 'sync' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    {t('IndexedDB Offline Transaction Queue')}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {t('Local transactions are assigned unique UUIDs and verified server-side to prevent duplicates')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleManualSync}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    {t('Sync Now')}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await clearSyncedFromQueue();
                      loadSettingsAndQueue();
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    {t('Clear Synced')}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {queue.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    {t('All local transactions are synchronized with the central MySQL database.')}
                  </p>
                ) : (
                  queuePg.pageItems.map((item) => (
                    <div
                      key={item.uuid}
                      className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {t(item.type).toUpperCase()} — UUID: {item.uuid}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {t('Recorded:')} {item.client_timestamp} · {t('Device:')} {item.device_id}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                          item.status === 'synced'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'conflict'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t(item.status)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <Pagination {...queuePg.paginationProps} standalone />
            </div>
          )}

          {canManageShopSettings && tab === 'backup' && (
            <div className="space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900">
                {t('Database Backup & Recovery (SRS Section 10)')}
              </h2>
              <p className="text-xs text-slate-600">
                {t('Export a complete, verified JSON snapshot of all 29 relational database tables (products, inventory, sales, customer debts, supplier balances, cash sessions, warranties, and audit logs).')}
              </p>
              <p className="text-xs text-slate-500">
                {t('Last Backup Exported:')} <strong>{formatDate(form.last_backup_at, true)}</strong>
              </p>
              <button
                type="button"
                onClick={handleBackupExport}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold"
              >
                <Download className="w-4 h-4" /> {t('Export Full Database Backup')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


