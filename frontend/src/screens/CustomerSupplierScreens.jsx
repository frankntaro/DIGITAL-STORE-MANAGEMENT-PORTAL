import React, { useEffect, useState } from 'react';
import {
  Building2,
  CreditCard,
  Eye,
  Phone,
  Plus,
  Printer,
  Search,
  User,
  Wallet,
} from 'lucide-react';
import { apiRequest, enqueueOfflineTransaction, getAllFromStore } from '../services/api';
import { formatDate, formatTZS, printHtmlDocument } from '../utils/format';
import { useLanguage } from '../utils/i18n';
import Pagination, { usePagination } from '../components/Pagination';

// ============================================================================
// SCREEN 13 & 14: CUSTOMERS & CUSTOMER PROFILE
// ============================================================================
export function CustomersScreen({ onViewProfile }) {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    customer_type: 'regular',
    credit_limit: '2500000',
    notes: '',
  });
  const [message, setMessage] = useState(null);

  const loadCustomers = async () => {
    const res = await apiRequest(`/customers?search=${encodeURIComponent(search)}`);
    setCustomers(res.customers || []);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const customersPg = usePagination(customers, 5, search);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({
        full_name: '',
        phone: '',
        email: '',
        address: '',
        customer_type: 'regular',
        credit_limit: '2500000',
        notes: '',
      });
      setShowAdd(false);
      setMessage('Customer registered successfully.');
      loadCustomers();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Customers Directory')}</h1>
          <p className="text-xs text-slate-500">
            {t('Search customers by name or phone, view total purchases, and monitor credit limits')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
        >
          {t('+ Add Customer')}
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
          {t(message)}
        </div>
      )}

      {showAdd && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-sm"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('Full Name *')}</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('Phone Number *')}</label>
            <input
              type="text"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+255 7..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('Customer Type')}</label>
            <select
              value={form.customer_type}
              onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="regular">{t('Regular')}</option>
              <option value="vip">{t('VIP')}</option>
              <option value="corporate">{t('Corporate')}</option>
              <option value="wholesale">{t('Wholesale')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('Address')}</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('Credit Limit (TZS)')}</label>
            <input
              type="number"
              value={form.credit_limit}
              onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
            >
              {t('Save Customer')}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold"
            >
              {t('Cancel')}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <search>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadCustomers();
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Search customer by name or phone number...')}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              {t('Search')}
            </button>
          </form>
        </search>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="table-region" role="region" aria-label={t('Customers directory')}>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Customer')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Phone')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Type')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Total Spent')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Outstanding Debt')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customersPg.pageItems.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900">{c.full_name}</p>
                    <p className="text-[11px] text-slate-400">
                      {c.customer_code} {c.address ? `· ${c.address}` : ''}
                    </p>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700">{c.phone}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700">
                      {t(c.customer_type)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatTZS(c.total_purchases)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-red-600">
                    {Number(c.outstanding_debt) > 0 ? formatTZS(c.outstanding_debt) : 'TZS 0'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onViewProfile(c.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> {t('Profile')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...customersPg.paginationProps} />
      </div>
    </div>
  );
}

export function CustomerProfileScreen({ customerId, onBack, onRecordRepayment }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('transactions');

  useEffect(() => {
    if (!customerId) return;
    apiRequest(`/customers/${customerId}`).then((res) => setData(res));
  }, [customerId]);

  const customerSalesPg = usePagination(data?.sales || [], 5, String(customerId));
  const customerPaymentsPg = usePagination(data?.payments || [], 5, String(customerId));

  if (!data) {
    return <div className="p-8 text-center text-xs text-slate-400">{t('Loading customer profile...')}</div>;
  }

  const { customer, sales = [], payments = [] } = data;

  const handlePrintStatement = () => {
    const salesHtml = sales
      .map(
        (s) => `
      <tr>
        <td>${s.receipt_number}</td>
        <td>${formatDate(s.sale_date)}</td>
        <td class="text-right">${formatTZS(s.total_amount)}</td>
        <td class="text-right">${formatTZS(s.total_amount - s.outstanding_balance)}</td>
        <td class="text-right"><strong>${formatTZS(s.outstanding_balance)}</strong></td>
      </tr>`
      )
      .join('');

    printHtmlDocument(
      t('Customer Statement - {name}', { name: customer.full_name }),
      `
      <div class="header">
        <h2>${t('CUSTOMER ACCOUNT STATEMENT')}</h2>
        <p><strong>${customer.full_name}</strong> (${customer.customer_code}) | ${t('Phone:')} ${customer.phone}</p>
        <p>${t('Total Purchases:')} ${formatTZS(customer.total_purchases)} | ${t('Total Paid:')} ${formatTZS(
        customer.total_paid
      )} | ${t('Outstanding Debt:')} <strong>${formatTZS(customer.outstanding_debt)}</strong></p>
      </div>
      <table>
        <thead>
          <tr><th>${t('Receipt #')}</th><th>${t('Date')}</th><th class="text-right">${t('Total')}</th><th class="text-right">${t('Paid')}</th><th class="text-right">${t('Balance Due')}</th></tr>
        </thead>
        <tbody>${salesHtml}</tbody>
      </table>
      `
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700"
        >
          {t('← Back to Customers')}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintStatement}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold"
          >
            <Printer className="w-3.5 h-3.5" /> {t('Print Account Statement')}
          </button>
          {Number(customer.outstanding_debt) > 0 && (
            <button
              type="button"
              onClick={onRecordRepayment}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
            >
              {t('Record Debt Repayment')}
            </button>
          )}
        </div>
      </div>

      {/* Customer Header Card (Matches Screen 14 Mockup) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-xl">
            {customer.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{customer.full_name}</h1>
            <p className="text-xs text-slate-500">
              {customer.phone} {customer.email ? `· ${customer.email}` : ''} · {customer.address}
            </p>
            <p className="text-xs font-bold text-blue-600 mt-1">
              {t('Total Spent:')} {formatTZS(customer.total_purchases)} · {t('Credit Limit:')}{' '}
              {formatTZS(customer.credit_limit)}
            </p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 text-right">
          <p className="text-[11px] font-bold uppercase text-red-700">{t('Outstanding Debt')}</p>
          <p className="text-xl font-extrabold text-red-600">{formatTZS(customer.outstanding_debt)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'transactions', label: 'Transactions' },
          { id: 'repayments', label: 'Repayments' },
          { id: 'details', label: 'Details' },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
              tab === tabItem.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            {t(tabItem.label)}
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="table-region" tabIndex={0} role="region" aria-label={t('Customer transactions')}>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Receipt')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Date')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Total Amount')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Balance Due')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customerSalesPg.pageItems.map((s) => (
                <tr key={s.id}>
                  <td className="py-3 px-4 font-bold text-blue-600">{s.receipt_number}</td>
                  <td className="py-3 px-4 text-slate-600">{formatDate(s.sale_date, true)}</td>
                  <td className="py-3 px-4 text-right font-bold">{formatTZS(s.total_amount)}</td>
                  <td className="py-3 px-4 text-right font-bold text-red-600">
                    {formatTZS(s.outstanding_balance)}
                  </td>
                  <td className="py-3 px-4 text-center capitalize font-semibold">
                    {t(s.payment_status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Pagination {...customerSalesPg.paginationProps} />
        </div>
      )}

      {tab === 'repayments' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="table-region" tabIndex={0} role="region" aria-label={t('Customer repayments')}>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Repayment Receipt')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Invoice')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Date')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Amount Paid')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Remaining Balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customerPaymentsPg.pageItems.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4 font-bold text-emerald-700">{p.receipt_number}</td>
                  <td className="py-3 px-4 font-semibold">{p.sale_receipt_number}</td>
                  <td className="py-3 px-4 text-slate-500">{formatDate(p.payment_date, true)}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-700">
                    +{formatTZS(p.amount)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold">{formatTZS(p.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Pagination {...customerPaymentsPg.paginationProps} />
        </div>
      )}

      {tab === 'details' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-xs space-y-2">
          <p>
            <strong>{t('Customer Code:')}</strong> {customer.customer_code}
          </p>
          <p>
            <strong>{t('Account Status:')}</strong> {t(customer.account_status)}
          </p>
          <p>
            <strong>{t('Notes:')}</strong> {customer.notes || t('None')}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCREEN 15 & 16: CUSTOMER DEBT MANAGEMENT & DEBT REPAYMENT
// ============================================================================
export function DebtManagementScreen({ onOpenRepayment }) {
  const { t } = useLanguage();
  const [debts, setDebts] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/debts')
      .then((res) => {
        setDebts(res.debts || []);
        setRepayments(res.repayments || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalDebt = debts.reduce((s, d) => s + Number(d.outstanding_balance || 0), 0);
  const overdueDebt = debts
    .filter((d) => d.aging_status === 'overdue')
    .reduce((s, d) => s + Number(d.outstanding_balance || 0), 0);
  const debtsPg = usePagination(debts, 5);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Customer Debts & Aging')}</h1>
          <p className="text-xs text-slate-500">
            {t('Track unpaid and partially paid credit sales, due dates, and overdue accounts')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenRepayment(null)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
        >
          {t('+ Record Customer Repayment')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{t('Total Outstanding Debt (AR)')}</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{formatTZS(totalDebt)}</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
          <p className="text-xs text-red-700 font-bold">{t('Overdue Balance')}</p>
          <p className="text-xl font-extrabold text-red-600 mt-1">{formatTZS(overdueDebt)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{t('Open Credit Invoices')}</p>
          <p className="text-xl font-extrabold text-blue-600 mt-1">
            {t('{count} Invoices', { count: debts.length })}
          </p>
        </div>
      </div>

      {/* Customer Debts Table (Matches Screen 15 Mockup) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="table-region" role="region" aria-label={t('Customer debts table')}>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Customer')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Invoice #')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Due Date')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Sale Total')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Outstanding Balance')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Aging Status')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {t('Loading debt accounts...')}
                  </td>
                </tr>
              ) : debts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {t('No unpaid customer debts!')}
                  </td>
                </tr>
              ) : (
                debtsPg.pageItems.map((d) => (
                  <tr key={d.sale_id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{d.customer_name}</p>
                      <p className="text-[11px] text-slate-400">{d.customer_phone}</p>
                    </td>
                    <td className="py-3 px-4 font-bold text-blue-600">{d.receipt_number}</td>
                    <td className="py-3 px-4 text-slate-600">{formatDate(d.due_date)}</td>
                    <td className="py-3 px-4 text-right">{formatTZS(d.total_amount)}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-red-600">
                      {formatTZS(d.outstanding_balance)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                          d.aging_status === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : d.aging_status === 'due_soon'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {t(d.aging_status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => onOpenRepayment(d)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                      >
                        {t('Record Payment')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && <Pagination {...debtsPg.paginationProps} />}
      </div>
    </div>
  );
}

export function DebtRepaymentScreen({ user, selectedDebt, isOffline, onSaved, onCancel }) {
  const { t } = useLanguage();
  const [debts, setDebts] = useState([]);
  const [saleId, setSaleId] = useState(selectedDebt?.sale_id ? String(selectedDebt.sale_id) : '');
  const [amount, setAmount] = useState(
    selectedDebt?.outstanding_balance ? String(selectedDebt.outstanding_balance) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState(() => t('Customer debt repayment'));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!isOffline) {
      apiRequest('/debts').then((res) => {
        const list = res.debts || [];
        setDebts(list);
        if (!saleId && list.length > 0) {
          setSaleId(String(list[0].sale_id));
          setAmount(String(list[0].outstanding_balance));
        }
      });
    } else {
      getAllFromStore('open_debts').then((list) => {
        setDebts(list);
        if (!saleId && list.length > 0) {
          setSaleId(String(list[0].sale_id));
          setAmount(String(list[0].outstanding_balance));
        }
      });
    }
  }, [isOffline]);

  const currentInvoice = debts.find((d) => String(d.sale_id) === String(saleId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        sale_id: Number(saleId),
        amount: Number(amount),
        payment_method: paymentMethod,
        notes,
      };
      if (isOffline) {
        await enqueueOfflineTransaction('debt_repayment', payload, user);
        setFeedback({
          type: 'success',
          text: 'Offline repayment saved in IndexedDB and will sync automatically.',
        });
      } else {
        const res = await apiRequest('/debt-repayments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: res.message });
      }
      setTimeout(() => onSaved(), 900);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Record Customer Repayment')}</h1>
          <p className="text-xs text-slate-500">
            {t('Reduces accounts receivable and increases cash collected without duplicating sales revenue')}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold"
        >
          {t('Back')}
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
          <label htmlFor="rep-invoice" className="block text-xs font-bold text-slate-700 mb-1">
            {t('Customer & Outstanding Invoice')} <span className="text-red-500">*</span>
          </label>
          <select
            id="rep-invoice"
            required
            value={saleId}
            onChange={(e) => {
              const id = e.target.value;
              setSaleId(id);
              const inv = debts.find((d) => String(d.sale_id) === String(id));
              if (inv) setAmount(String(inv.outstanding_balance));
            }}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
          >
            {debts.map((d) => (
              <option key={d.sale_id} value={d.sale_id}>
                {t('{name} — {receipt} (Balance Due: {balance})', {
                  name: d.customer_name,
                  receipt: d.receipt_number,
                  balance: formatTZS(d.outstanding_balance),
                })}
              </option>
            ))}
          </select>
        </div>

        {currentInvoice && (
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs">
            <span className="text-slate-700">
              {t('Remaining Balance on')} <strong>{currentInvoice.receipt_number}</strong>:
            </span>
            <span className="font-extrabold text-red-600">
              {formatTZS(currentInvoice.outstanding_balance)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="rep-amount" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Repayment Amount (TZS)')} <span className="text-red-500">*</span>
            </label>
            <input
              id="rep-amount"
              type="number"
              min="1"
              max={currentInvoice ? currentInvoice.outstanding_balance : undefined}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold"
            />
          </div>
          <div>
            <label htmlFor="rep-method" className="block text-xs font-bold text-slate-700 mb-1">
              {t('Payment Method')}
            </label>
            <select
              id="rep-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="Cash">{t('Cash')}</option>
              <option value="Mobile Money">{t('Mobile Money')}</option>
              <option value="Bank Transfer">{t('Bank Transfer')}</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="rep-notes" className="block text-xs font-bold text-slate-700 mb-1">
            {t('Notes')}
          </label>
          <input
            id="rep-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !saleId}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm"
          >
            {saving ? t('Recording...') : t('Record Payment')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold"
          >
            {t('Cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// SCREEN 17 & 18: SUPPLIERS & SUPPLIER PROFILE
// ============================================================================
export function SuppliersScreen({ onViewSupplier }) {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  const loadSuppliers = async () => {
    const res = await apiRequest('/suppliers');
    setSuppliers(res.suppliers || []);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const suppliersPg = usePagination(suppliers, 5);

  const handleSave = async (e) => {
    e.preventDefault();
    await apiRequest('/suppliers', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    setShowAdd(false);
    setForm({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '' });
    loadSuppliers();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('Suppliers Directory')}</h1>
          <p className="text-xs text-slate-500">
            {t('Manage electronics distributors, wholesale purchases, and accounts payable')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
        >
          {t('+ Add Supplier')}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <input
            type="text"
            required
            placeholder={t('Supplier Company Name *')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <input
            type="text"
            placeholder={t('Contact Person')}
            value={form.contact_person}
            onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <input
            type="text"
            required
            placeholder={t('Phone (+255...) *')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <input
            type="email"
            placeholder={t('Email')}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <input
            type="text"
            placeholder={t('Address')}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
          >
            {t('Save Supplier')}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="table-region" role="region" aria-label={t('Suppliers directory')}>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Supplier')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Contact')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Phone')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Total Purchases')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Outstanding Balance')}</th>
                <th className="py-3 px-4 text-center font-bold">{t('Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliersPg.pageItems.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                  <td className="py-3 px-4 text-slate-600">{s.contact_person || '—'}</td>
                  <td className="py-3 px-4 text-slate-700">{s.phone}</td>
                  <td className="py-3 px-4 text-right font-bold">{formatTZS(s.total_purchases)}</td>
                  <td className="py-3 px-4 text-right font-extrabold text-red-600">
                    {formatTZS(s.outstanding_balance)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onViewSupplier(s.id)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs"
                    >
                      {t('Profile & Payments')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...suppliersPg.paginationProps} />
      </div>
    </div>
  );
}

export function SupplierProfileScreen({ supplierId, onBack }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('purchases');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');
  const [message, setMessage] = useState(null);

  const loadProfile = async () => {
    if (!supplierId) return;
    const res = await apiRequest(`/suppliers/${supplierId}`);
    setData(res);
    if (Number(res.supplier?.outstanding_balance) > 0) {
      setPayAmount(String(res.supplier.outstanding_balance));
    }
  };

  useEffect(() => {
    loadProfile();
  }, [supplierId]);

  const supplierPurchasesPg = usePagination(data?.purchases || [], 5, String(supplierId));
  const supplierPaymentsPg = usePagination(data?.payments || [], 5, String(supplierId));

  if (!data) {
    return <div className="p-8 text-center text-xs text-slate-400">{t('Loading supplier profile...')}</div>;
  }

  const { supplier, purchases = [], payments = [] } = data;

  const handlePaySupplier = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/supplier-payments', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: supplier.id,
          amount: Number(payAmount),
          payment_method: payMethod,
          notes: payNotes,
        }),
      });
      setMessage({ type: 'success', text: res.message });
      loadProfile();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700"
      >
        {t('← Back to Suppliers')}
      </button>

      {/* Supplier Header (Matches Screen 18 Mockup) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{supplier.name}</h1>
            <p className="text-xs text-slate-500">
              {supplier.contact_person} · {supplier.phone} · {supplier.address}
            </p>
            <p className="text-xs font-bold text-slate-700 mt-1">
              {t('Total Purchases:')} {formatTZS(supplier.total_purchases)} · {t('Paid:')}{' '}
              {formatTZS(supplier.total_paid)}
            </p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-right">
          <p className="text-[11px] font-bold uppercase text-amber-800">{t('Supplier Balance Payable')}</p>
          <p className="text-xl font-extrabold text-red-600">
            {formatTZS(supplier.outstanding_balance)}
          </p>
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

      {Number(supplier.outstanding_balance) > 0 && (
        <form
          onSubmit={handlePaySupplier}
          className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('Pay Supplier Balance (TZS)')}
            </label>
            <input
              type="number"
              min="1"
              max={supplier.outstanding_balance}
              required
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('Method')}</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="Cash">{t('Cash')}</option>
              <option value="Bank Transfer">{t('Bank Transfer')}</option>
              <option value="Mobile Money">{t('Mobile Money')}</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('Notes')}</label>
            <input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder={t('Supplier settlement note')}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
          >
            {t('Record Supplier Payment')}
          </button>
        </form>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('purchases')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
            tab === 'purchases' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('Purchases ({count})', { count: purchases.length })}
        </button>
        <button
          type="button"
          onClick={() => setTab('payments')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 ${
            tab === 'payments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('Payments ({count})', { count: payments.length })}
        </button>
      </div>

      {tab === 'purchases' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="table-region" tabIndex={0} role="region" aria-label={t('Supplier purchases')}>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Ref #')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Date')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Total')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Paid')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supplierPurchasesPg.pageItems.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4 font-bold text-blue-600">{p.reference_number}</td>
                  <td className="py-3 px-4">{formatDate(p.purchase_date)}</td>
                  <td className="py-3 px-4 text-right font-bold">{formatTZS(p.total_amount)}</td>
                  <td className="py-3 px-4 text-right text-emerald-700">{formatTZS(p.amount_paid)}</td>
                  <td className="py-3 px-4 text-right font-bold text-red-600">
                    {formatTZS(p.outstanding_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Pagination {...supplierPurchasesPg.paginationProps} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="table-region" tabIndex={0} role="region" aria-label={t('Supplier payments')}>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 text-left font-bold">{t('Payment Ref')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Date')}</th>
                <th className="py-3 px-4 text-left font-bold">{t('Method')}</th>
                <th className="py-3 px-4 text-right font-bold">{t('Amount Paid')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supplierPaymentsPg.pageItems.map((sp) => (
                <tr key={sp.id}>
                  <td className="py-3 px-4 font-bold text-emerald-700">{sp.reference_number}</td>
                  <td className="py-3 px-4">{formatDate(sp.payment_date)}</td>
                  <td className="py-3 px-4">{t(sp.payment_method)}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-700">
                    {formatTZS(sp.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Pagination {...supplierPaymentsPg.paginationProps} />
        </div>
      )}
    </div>
  );
}


