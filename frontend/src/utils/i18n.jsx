// ============================================================================
// COMPREHENSIVE BILINGUAL TRANSLATION ENGINE (English <-> Tanzanian Kiswahili)
// 100% React-native i18n covering all 24 screens, modals, forms, badges,
// dynamic alerts, backend messages, exports, and printable documents.
// ============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react';

// Canonical English display labels for snake_case keys & backend enum values
const EN_KEY_LABELS = {
  // Legacy App.jsx keys (kept for full compatibility)
  nav_dashboard: 'Dashboard',
  nav_pos: 'Point of Sale (POS)',
  nav_sales: 'Sales History',
  nav_products: 'Products',
  nav_categories: 'Categories',
  nav_purchases: 'Purchases',
  nav_inventory: 'Inventory',
  nav_stock_adjustments: 'Stock Adjustments',
  nav_customers: 'Customers',
  nav_debts: 'Customer Debts',
  nav_debt_repayment: 'Debt Repayment',
  nav_suppliers: 'Suppliers',
  nav_expenses: 'Expenses',
  nav_cash_register: 'Cash Register',
  nav_returns_warranty: 'Returns & Warranty',
  nav_reports: 'Reports & Analytics',
  nav_employees: 'Employees & RBAC',
  nav_settings: 'Settings',
  sign_out: 'Sign Out',
  screen: 'Screen:',
  add_product_title: 'Add / Edit Product',
  light_mode: 'Light Theme',
  dark_mode: 'Dark Theme',
  pending_sync: 'Pending Offline Sync',
  offline_tzs: 'Offline · TZS',
  online_tzs: 'Online · TZS',

  // Backend enum values -> clean English labels
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  full_cash: 'Full Cash',
  partial_credit: 'Partial Payment (Credit)',
  zero_deposit_credit: 'Zero-Deposit Credit',
  purchase_receipt: 'Purchase Receipt',
  return_resalable: 'Resalable Return',
  adjustment_increase: 'Stock Increase',
  adjustment_decrease: 'Stock Decrease',
  physical_count: 'Physical Stock Count',
  initial_stock: 'Initial Stock',
  partially_received: 'Partially Received',
  sale_payment: 'Sale Payment',
  debt_repayment: 'Debt Repayment',
  other_receipt: 'Other Receipt',
  supplier_payment: 'Supplier Payment',
  customer_refund: 'Customer Refund',
  cash_withdrawal: 'Cash Withdrawal',
  due_soon: 'Due Soon',
  cash_refund: 'Cash Refund',
  store_credit: 'Store Credit',
  no_refund_policy: 'Return Without Refund',
  under_inspection: 'Under Inspection',
  pending_inspection: 'Pending Inspection',
  duplicate_ignored: 'Duplicate Ignored',
  // Audit actions
  'auth.login': 'Employee Login',
  'auth.logout': 'Employee Logout',
  'backup.exported': 'Database Backup Exported',
  'cash_session.closed': 'Cash Session Closed',
  'cash_session.opened': 'Cash Session Opened',
  'category.created': 'Category Created',
  'category.updated': 'Category Updated',
  'customer.created': 'Customer Registered',
  'customer.updated': 'Customer Updated',
  'debt.repayment_recorded': 'Debt Repayment Recorded',
  'employee.created': 'Employee Registered',
  'employee.deleted': 'Employee Deleted',
  'employee.password_reset': 'Employee Password Reset',
  'employee.updated_permissions': 'Permissions Updated',
  'expense.created': 'Expense Recorded',
  'inventory.adjusted': 'Stock Adjusted',
  'product.created': 'Product Created',
  'product.updated': 'Product Updated',
  'purchase.created': 'Purchase Recorded',
  'purchase.missing_received': 'Missing Order Stock Received',
  'purchase.missing_resolved': 'Missing Order Item Resolved',
  'return.processed': 'Return Processed',
  'sale.credit_created': 'Credit Sale Created',
  'sale.discount_applied': 'Sale Discount Applied',
  'sale.reversed': 'Sale Reversed & Restocked',
  'settings.updated': 'Settings Updated',
  'supplier.created': 'Supplier Registered',
  'supplier.updated': 'Supplier Updated',
  'supplier_payment.recorded': 'Supplier Payment Recorded',
  'warranty.registered': 'Warranty Registered',
  'warranty_claim.recorded': 'Warranty Claim Recorded',
  // Audit entity types
  CashSession: 'Cash Session',
  CustomerPayment: 'Customer Payment',
  ShopSettings: 'Shop Settings',
  SupplierPayment: 'Supplier Payment',
  WarrantyClaim: 'Warranty Claim',
};

// Master English -> Tanzanian Kiswahili Dictionary
export const SW_DICTIONARY = {
  // ── Brand, Header & Global Controls ───────────────────────────────────────
  'ESMS': 'ESMS',
  'Electronics Shop Management System': 'Mfumo wa Usimamizi wa Duka la Vifaa vya Kielektroniki',
  'KAMPANGO PHONES AND ELECTRONICS': 'KAMPANGO PHONES AND ELECTRONICS',
  'KAMPANGO PHONES AND ACCESSORIES': 'KAMPANGO PHONES AND ELECTRONICS',
  'Phones, Accessories & Home Electronics POS': 'Mfumo wa Mauzo wa Simu, Vifaa vya Simu na Vifaa vya Nyumbani',
  'Retail Management System · TZS': 'Mfumo wa Usimamizi wa Duka la Rejareja · TZS',
  'Online · TZS': 'Mtandaoni · TZS',
  'Offline · TZS': 'Bila Mtandao · TZS',
  'Offline Mode (Click to Restore)': 'Hali Bila Mtandao (Bofya Kurejesha)',
  'Offline Mode (Click to Restore Internet)': 'Hali Bila Mtandao (Bofya Kurejesha Mtandao)',
  'Toggle between English and Kiswahili': 'Badili kati ya Kiingereza na Kiswahili',
  'Switch to Light Theme': 'Badili kwenda Mandhari ya Mwanga',
  'Switch to Dark Theme': 'Badili kwenda Mandhari ya Giza',
  'Toggle Offline Mode': 'Washa au Zima Hali Bila Mtandao',
  'Open menu': 'Fungua menyu',
  'Close menu': 'Funga menyu',
  'Pending Offline Sync': 'Zinasubiri Kusawazishwa',
  'Internet restored: {count} offline transaction(s) synchronized with MySQL.':
    'Mtandao umerejea: Miamala {count} ya nje ya mtandao imesawazishwa na kanzidata ya MySQL.',
  'Online restored: {count} pending offline transaction(s) synchronized!':
    'Mtandao umerejeshwa: Miamala {count} iliyokuwa inasubiri imesawazishwa kikamilifu!',
  'Language': 'Lugha',
  'Theme': 'Mandhari',
  'Light Theme': 'Mandhari ya Mwanga',
  'Dark Theme': 'Mandhari ya Giza',
  'Sign Out': 'Ondoka Kazini',
  'Screen:': 'Skrini:',
  'Screen': 'Skrini',
  'Dismiss': 'Funga',
  'Protected by RBAC': 'Imelindwa kwa Ruhusa za Wadhifa (RBAC)',
  'None': 'Hakuna',
  'Method': 'Njia',
  'Yes': 'Ndiyo',
  'No': 'Hapana',
  'Loading...': 'Inapakia...',
  'units': 'vipande',
  'Invoices': 'Ankara',
  'System': 'Mfumo',
  'Device': 'Kifaa',

  // ── Navigation Items & Screen Titles (Screens 1-24) ───────────────────────
  '1. Employee Portal': '1. Lango la Wafanyakazi',
  'Dashboard': 'Dashibodi',
  'Dashboard Overview': 'Muhtasari wa Dashibodi',
  'Point of Sale (POS)': 'Sehemu ya Mauzo (POS)',
  'Point of Sale Checkout': 'Sehemu ya Kukamilisha Mauzo (POS)',
  'Sales History': 'Historia ya Mauzo',
  'Sale Details & Receipt': 'Taarifa za Mauzo na Risiti',
  'Sale Details': 'Taarifa za Mauzo',
  'Products': 'Bidhaa',
  'Products Catalogue': 'Orodha ya Bidhaa',
  'Add / Edit Product': 'Ongeza / Hariri Bidhaa',
  'Add New Product': 'Ongeza Bidhaa Mpya',
  'Edit Product': 'Hariri Bidhaa',
  'Edit Product: {name}': 'Hariri Bidhaa: {name}',
  'Categories': 'Makundi ya Bidhaa',
  'Product Categories': 'Makundi ya Bidhaa',
  'Purchases': 'Manunuzi ya Bidhaa',
  'New Purchase (Receiving)': 'Manunuzi Mapya (Kupokea Mzigo)',
  'New Purchase': 'Manunuzi Mapya',
  'New Purchase & Stock Receiving': 'Manunuzi Mapya na Kupokea Hisa',
  'Purchases & Goods Receipt': 'Manunuzi na Mapokezi ya Bidhaa',
  'Inventory': 'Ghala la Bidhaa',
  'Inventory & Valuation': 'Ghala na Thamani ya Mzigo',
  'Inventory & Stock Control': 'Udhibiti wa Ghala na Hisa',
  'Stock Adjustments': 'Marekebisho ya Hisa',
  'Customers': 'Wateja',
  'Customers Directory': 'Orodha ya Wateja',
  'Customer Profile & Statement': 'Wasifu wa Mteja na Taarifa za Akaunti',
  'Customer Profile': 'Wasifu wa Mteja',
  'Customer Debts': 'Madeni ya Wateja',
  'Customer Debt Management': 'Usimamizi wa Madeni ya Wateja',
  'Customer Debts & Aging': 'Madeni ya Wateja na Ucheleweshaji',
  'Debt Repayment': 'Malipo ya Madeni',
  'Suppliers': 'Wasambazaji',
  'Suppliers Directory': 'Orodha ya Wasambazaji',
  'Supplier Profile & Payments': 'Wasifu wa Msambazaji na Malipo',
  'Supplier Profile': 'Wasifu wa Msambazaji',
  'Expenses': 'Matumizi',
  'Operating Expenses': 'Matumizi ya Uendeshaji',
  'Cash Register': 'Droo ya Fedha (Keshia)',
  'Cash Register Reconciliation': 'Upatanisho wa Droo ya Fedha',
  'Cash Register & Daily Reconciliation': 'Droo ya Fedha na Upatanisho wa Kila Siku',
  'Returns & Warranty': 'Marejesho na Dhamana',
  'Product Returns & Warranty Claims': 'Marejesho ya Bidhaa na Madai ya Dhamana',
  'Reports': 'Ripoti',
  'Reports & Analytics': 'Ripoti na Takwimu',
  'Reports & Financial Analytics': 'Ripoti na Takwimu za Fedha',
  'Employees': 'Wafanyakazi',
  'Employees & RBAC': 'Wafanyakazi na Ruhusa (RBAC)',
  'Employees & Permissions': 'Wafanyakazi na Ruhusa',
  'Employees & Permissions ({count})': 'Wafanyakazi na Ruhusa ({count})',
  'Employees, Roles & Access Control (RBAC)': 'Wafanyakazi, Wadhifa na Udhibiti wa Ruhusa (RBAC)',
  'Settings': 'Mipangilio',
  'System Settings & Backup': 'Mipangilio ya Mfumo na Nakala ya Dharura',
  'Security Audit Logs': 'Kumbukumbu za Usalama (Audit Logs)',
  'Security Audit Logs ({count})': 'Kumbukumbu za Usalama ({count})',

  // ── Login Screen (Screen 1) ───────────────────────────────────────────────
  'Welcome Back!': 'Karibu Tena!',
  'Sign in to your individual employee account': 'Ingia kwenye akaunti yako binafsi ya mfanyakazi',
  'Username or Email': 'Jina la Mtumiaji au Barua Pepe',
  'Password': 'Nenosiri',
  'Enter username': 'Weka jina la mtumiaji',
  'Enter password': 'Weka nenosiri',
  'Show password': 'Onyesha nenosiri',
  'Hide password': 'Ficha nenosiri',
  'Keep me signed in': 'Nikumbuke kwenye kifaa hiki',
  'Sign In': 'Ingia Kazini',
  'Signing in...': 'Inaingia...',
  'Quick-Fill Role Accounts (RBAC Verification)': 'Akaunti za Majaribio ya Haraka (Uhakiki wa RBAC)',
  'Sign-In Roles (Admin & Employee)': 'Aina za Kuingia (Msimamizi Mkuu & Mfanyakazi)',
  'Admin registers new employee accounts in Employees & RBAC so staff can sign in as Employee.':
    'Msimamizi Mkuu husajili akaunti mpya za wafanyakazi kwenye Wafanyakazi na Ruhusa ili waweze kuingia kama Mfanyakazi.',
  'Admin': 'Msimamizi Mkuu (Admin)',
  'Employee Account': 'Akaunti ya Mfanyakazi',
  'Owner': 'Mmiliki',
  'Cashier': 'Keshia',
  'Stock Mgr': 'Msimamizi Ghala',
  'Smart Management.': 'Usimamizi Mahiri.',
  'Better Retail Business.': 'Biashara Bora ya Rejareja.',
  'Centralized Progressive Web App for mobile phones, computers, and accessories retail in Tanzanian Shillings (TZS) with offline-first POS & inventory control.':
    'Mfumo mkuu wa kisasa wa kusimamia duka la simu, vifaa vya simu na vifaa vya nyumbani kwa Shilingi ya Kitanzania (TZS), unaofanya kazi hata bila mtandao.',
  'Centralized Progressive Web App for mobile phones, phone accessories, speakers, TVs, and home electronics retail in Tanzanian Shillings (TZS) with offline-first POS & inventory control.':
    'Mfumo mkuu wa kisasa wa kusimamia duka la simu, vifaa vya simu, spika, TV na vifaa vya nyumbani kwa Shilingi ya Kitanzania (TZS), unaofanya kazi hata bila mtandao.',
  'Smartphones': 'Simu Janja',
  'Speakers & Electronics': 'Spika na Vifaa vya Kielektroniki',
  'Phones & Accessories': 'Simu na Vifaa vya Simu',
  'Speakers, TVs & Solar': 'Spika, TV na Sola',
  'Laptops': 'Kompyuta Mpakato',
  'Phones & Tablets': 'Simu na Vishikwambi',
  'Weighted Avg Costing': 'Gharama ya Wastani wa Mzigo',
  'Laptops & Audio': 'Kompyuta na Vifaa vya Sauti',
  'Warranty & Claims': 'Dhamana na Madai',
  'Offline-First IndexedDB': 'Hifadhi Imara Bila Mtandao',
  'Role-Based Access Control': 'Udhibiti wa Ruhusa kwa Wadhifa',
  'Installable PWA': 'Inasakinishwa Kama App (PWA)',

  // ── Dashboard (Screen 2) ──────────────────────────────────────────────────
  'Loading real-time business dashboard...': 'Inapakia dashibodi ya biashara...',
  'Real-time retail performance, stock valuation, and cash flow in Tanzanian Shillings (TZS)':
    'Utendaji wa moja kwa moja wa mauzo, thamani ya ghala na mtiririko wa fedha kwa Shilingi ya Kitanzania (TZS)',
  'Refresh': 'Sasisha',
  'Open POS Checkout': 'Fungua Sehemu ya Mauzo (POS)',
  "Today's Total Sales": 'Jumla ya Mauzo ya Leo',
  'Cash Collected Today:': 'Fedha Zilizokusanywa Leo:',
  'Products & Stock': 'Bidhaa na Hisa',
  'Registered Products: {count}': 'Bidhaa Zilizosajiliwa: {count}',
  '{low} Low / {out} Out': '{low} Chache / {out} Zimeisha',
  'Customers & Staff': 'Wateja na Wafanyakazi',
  'Active Employees:': 'Wafanyakazi Walio Kazini:',
  '{count} Staff': 'Wafanyakazi {count}',
  'Customer Debts (AR)': 'Madeni ya Wateja (AR)',
  'Manage overdue accounts': 'Simamia madeni yaliyochelewa',
  "Today's Gross Profit": 'Faida Ghafi ya Leo',
  "Today's Operating Expenses": 'Matumizi ya Uendeshaji ya Leo',
  'Total Inventory Cost Value': 'Thamani ya Gharama ya Ghala',
  'Supplier Balances (AP)': 'Madeni ya Wasambazaji (AP)',
  'Sales Overview (Recent Trend)': 'Muhtasari wa Mauzo (Mwenendo wa Hivi Karibuni)',
  'Completed daily revenue excluding cancelled sales & repayments':
    'Mapato ya kila siku yaliyokamilika bila mauzo yaliyofutwa na malipo ya madeni',
  'All-Time: {amount}': 'Kipindi Chote: {amount}',
  'No sales trend data yet.': 'Bado hakuna takwimu za mwenendo wa mauzo.',
  'Top Selling Products': 'Bidhaa Zinazouzwa Zaidi',
  'View Catalogue': 'Tazama Orodha ya Bidhaa',
  '{count} units sold': 'Vipande {count} vimeuzwa',
  'Recent Sales Transactions': 'Miamala ya Mauzo ya Hivi Karibuni',
  'Recent sales transactions': 'Miamala ya mauzo ya hivi karibuni',
  'All Sales': 'Mauzo Yote',
  'Low & Out-of-Stock Alerts': 'Tahadhari ya Hisa Chache na Zilizokwisha',
  'Manage Stock': 'Simamia Hisa',
  'All active products are well stocked.': 'Bidhaa zote zinazofanya kazi zina hisa ya kutosha.',
  'SKU: {sku} · Min Level: {min}': 'SKU: {sku} · Kiwango cha Chini: {min}',
  'Out of Stock (0)': 'Imeisha Ghalani (0)',
  '{count} left': 'Zimebaki {count}',
  'Recent Debt Repayments': 'Malipo ya Madeni ya Hivi Karibuni',
  'New & Purchased Products': 'Bidhaa Mpya na Zilizonunuliwa',
  'Newly arrived and recently purchased stock available for sale':
    'Mzigo mpya uliowasili na bidhaa zilizonunuliwa hivi karibuni zinazopatikana kwa mauzo',
  'View All Purchased': 'Tazama Zote Zilizonunuliwa',
  'New': 'Mpya',
  '+{qty} received': '+{qty} zimepokelewa',
  'No recently purchased products yet.': 'Bado hakuna bidhaa zilizonunuliwa hivi karibuni.',
  'New Purchased Products': 'Bidhaa Mpya Zilizonunuliwa',
  'New Purchased': 'Imenunuliwa Hivi Karibuni',
  'Purchased: +{qty}': 'Zimenunuliwa: +{qty}',
  'Last received: {date}': 'Mara ya mwisho kupokelewa: {date}',
  '← Back to Categories': '← Rudi kwenye Makundi',
  'Show All Categories': 'Onyesha Makundi Yote',
  'Viewing Category: {name}': 'Unatazama Kundi: {name}',
  'View Category': 'Fungua Kundi',
  'Click any category card to view its products': 'Bofya kadi ya kundi lolote kuona bidhaa zake',
  'The Purchases module is strictly reserved for the Shop Admin. Employees can view newly purchased and restocked products in Products Catalogue and Dashboard.':
    'Moduli ya Manunuzi imehifadhiwa kwa Msimamizi Mkuu pekee. Wafanyakazi wanaweza kuona bidhaa mpya na zilizonunuliwa kwenye Orodha ya Bidhaa na Dashibodi.',
  'View Purchased Products': 'Tazama Bidhaa Zilizonunuliwa',

  // ── POS, Sales History & Sale Details (Screens 3, 4, 5) ───────────────────
  '"{name}" is out of stock.': '"{name}" imeisha ghalani.',
  'Cannot exceed available stock ({count}) for "{name}".':
    'Huwezi kuzidi hisa iliyopo ({count}) kwa "{name}".',
  'Only {count} units available in stock.': 'Ni vipande {count} pekee vilivyopo ghalani.',
  'Add at least one product to the cart before checkout.':
    'Ongeza angalau bidhaa moja kwenye kikapu kabla ya kukamilisha mauzo.',
  'Please select or register a customer for partial-payment or credit sales.':
    'Tafadhali chagua au sajili mteja kwa mauzo ya malipo ya sehemu au mkopo.',
  'Saved Offline ({id}). Provisional stock reserved in IndexedDB; will auto-sync when internet returns.':
    'Imehifadhiwa Bila Mtandao ({id}). Hisa ya muda imetengwa kwenye IndexedDB; itasawazishwa kiotomatiki mtandao ukirejea.',
  '{message} (Total: {total}, Paid: {paid}, Debt: {debt})':
    '{message} (Jumla: {total}, Imelipwa: {paid}, Deni: {debt})',
  'Offline POS Mode Active — Sales are stored locally in IndexedDB with provisional stock reservation. Note: stock across multiple offline devices is verified upon server synchronization.':
    'Hali ya POS Bila Mtandao Imewashwa — Mauzo yanahifadhiwa kwenye kifaa (IndexedDB) na hisa inatengwa kwa muda. Kumbuka: hisa ya vifaa vingi itathibitishwa seva itakaposawazishwa.',
  'View & Print Receipt': 'Tazama na Chapisha Risiti',
  'Search products by name, SKU, or barcode': 'Tafuta bidhaa kwa jina, SKU, au msimbo pau',
  'Search products by name, SKU, or scan barcode...': 'Tafuta bidhaa kwa jina, SKU, au soma msimbo pau...',
  'All Items ({count})': 'Bidhaa Zote ({count})',
  'Out': 'Imeisha',
  '{count} in stock': '{count} ghalani',
  'Current Sale': 'Mauzo ya Sasa',
  '{count} items': 'Vitu {count}',
  'Select or scan products on the left to add them to this sale.':
    'Chagua au soma msimbo pau wa bidhaa upande wa kushoto ili kuziongeza kwenye mauzo haya.',
  'Decrease quantity of {name}': 'Punguza idadi ya {name}',
  'Increase quantity of {name}': 'Ongeza idadi ya {name}',
  'Remove {name} from cart': 'Ondoa {name} kwenye kikapu',
  '* (Required for Credit)': '* (Lazima kwa Mkopo)',
  'New Customer': 'Mteja Mpya',
  'Walk-in Customer (Full Cash Only)': 'Mteja wa Papo kwa Papo (Pesa Taslimu Pekee)',
  '{name} ({phone}) — Debt: {debt}': '{name} ({phone}) — Deni: {debt}',
  'Quick Register Customer': 'Sajili Mteja Haraka',
  'Full Name *': 'Jina Kamili *',
  'Phone (+255...) *': 'Simu (+255...) *',
  'Save Customer': 'Hifadhi Mteja',
  'Authorized Discount': 'Punguzo Lililoidhinishwa',
  'Max limit: {pct}%': 'Kikomo cha juu: {pct}%',
  'No Discount': 'Hakuna Punguzo',
  'Percent (%)': 'Asilimia (%)',
  'Fixed (TZS)': 'Kiasi Halisi (TZS)',
  '% off': '% punguzo',
  'TZS off': 'Punguzo TZS',
  'Reason for discount (recorded in audit log)': 'Sababu ya punguzo (hurekodiwa kwenye kumbukumbu za ukaguzi)',
  'Payment Scenario': 'Aina ya Malipo',
  'Full Cash': 'Pesa Kamili',
  'Partial Pay': 'Malipo Kiasi',
  'Zero-Deposit': 'Mkopo Kamili',
  'Cash Received (TZS)': 'Pesa Zilizopokelewa (TZS)',
  'Payment Method': 'Njia ya Malipo',
  'Cash': 'Pesa Taslimu',
  'Mobile Money': 'Pesa ya Simu',
  'Mobile Money (M-Pesa / Tigo)': 'Pesa ya Simu (M-Pesa / Tigo)',
  'Bank Transfer': 'Uhamisho wa Benki',
  'Credit': 'Mkopo',
  'Credit Account': 'Akaunti ya Mkopo',
  'Credit Repayment Due Date': 'Tarehe ya Mwisho ya Kulipa Mkopo',
  'Subtotal:': 'Jumla Ndogo:',
  'Authorized Discount:': 'Punguzo Lililoidhinishwa:',
  'Total Payable:': 'Jumla Inayolipwa:',
  'Outstanding Customer Debt:': 'Deni la Mteja Lililobaki:',
  'Customer Change:': 'Chenji ya Mteja:',
  'Clear': 'Safisha',
  'Processing...': 'Inashughulikia...',
  'Pay {amount}': 'Lipa {amount}',
  'All completed POS sales, credit invoices, and digital receipts':
    'Mauzo yote ya POS yaliyokamilika, ankara za mikopo, na risiti za kidijitali',
  '+ New POS Sale': '+ Mauzo Mapya ya POS',
  'Search receipt #, customer name or phone...': 'Tafuta namba ya risiti, jina la mteja au simu...',
  'Filter by payment status': 'Chuja kwa hali ya malipo',
  'All Payment Statuses': 'Hali Zote za Malipo',
  'Paid (Full Cash)': 'Imelipwa (Pesa Taslimu Kamili)',
  'Partial Payment (Credit)': 'Malipo ya Sehemu (Mkopo)',
  'Unpaid (Zero-Deposit Credit)': 'Haijalipwa (Mkopo Bila Amana)',
  'From date': 'Kuanzia tarehe',
  'To date': 'Hadi tarehe',
  'Filter': 'Chuja',
  'Sales history table': 'Jedwali la historia ya mauzo',
  'Receipt #': 'Risiti #',
  'Date & Time': 'Tarehe na Muda',
  'Customer': 'Mteja',
  'Total (TZS)': 'Jumla (TZS)',
  'Cash Paid': 'Pesa Iliyolipwa',
  'Debt Balance': 'Baki ya Deni',
  'Payment': 'Malipo',
  'Action': 'Kitendo',
  'Loading sales transactions...': 'Inapakia miamala ya mauzo...',
  'No matching sales records found.': 'Hakuna kumbukumbu za mauzo zilizopatikana.',
  'View': 'Tazama',
  'Loading sale receipt details...': 'Inapakia taarifa za risiti ya mauzo...',
  '← Back to Sales History': '← Rudi kwenye Historia ya Mauzo',
  'Print Receipt': 'Chapisha Risiti',
  'Copied Digital Receipt!': 'Risiti ya Kidijitali Imenakiliwa!',
  'Share Digital Receipt': 'Shiriki Risiti ya Kidijitali',
  'New Sale': 'Mauzo Mapya',
  'Sale #{receipt}': 'Mauzo #{receipt}',
  'Date:': 'Tarehe:',
  'Cashier:': 'Keshia:',
  'Customer:': 'Mteja:',
  'Scenario:': 'Aina ya Malipo:',
  'Sold items breakdown': 'Orodha ya bidhaa zilizouzwa',
  'Product': 'Bidhaa',
  'Qty': 'Idadi',
  'Unit Price': 'Bei ya Kipande',
  'Preserved Cost': 'Gharama Iliyohifadhiwa',
  'Line Total': 'Jumla ya Mstari',
  'SKU: {sku} · Warranty: {months}M': 'SKU: {sku} · Dhamana: Miezi {months}',
  'Warranties & Repayments Linked': 'Dhamana na Malipo ya Madeni Yanayohusiana',
  'Expires': 'Inaisha',
  'Repayment': 'Malipo ya Deni',
  'on': 'tarehe',
  'Discount ({reason}):': 'Punguzo ({reason}):',
  'Total Amount:': 'Jumla Kuu:',
  'Initial Cash Received:': 'Pesa za Awali Zilizopokelewa:',
  'Remaining Outstanding Balance:': 'Baki ya Deni Iliyobaki:',
  // Printed receipt & share text
  'Receipt {receipt}': 'Risiti {receipt}',
  'RECEIPT: {receipt}': 'RISITI: {receipt}',
  'Tel:': 'Simu:',
  'Price': 'Bei',
  'Total': 'Jumla',
  'Discount:': 'Punguzo:',
  'Cash Received:': 'Pesa Zilizopokelewa:',
  'Outstanding Debt:': 'Deni Lililobaki:',
  'ESMS Digital Receipt {receipt}': 'Risiti ya Kidijitali ya ESMS {receipt}',
  'Balance Due:': 'Baki Inayodaiwa:',
  'Thank you for shopping at {shop}!': 'Asante kwa kununua katika {shop}!',

  // ── Products, Categories, Purchases & Inventory (Screens 6-12) ────────────
  'Quantity-based stock management with soft archiving to preserve historical sales':
    'Usimamizi wa hisa kwa idadi na uhifadhi salama unaolinda historia ya mauzo',
  'Add Product': 'Ongeza Bidhaa',
  'Search by product name, SKU, barcode, brand, or model...':
    'Tafuta kwa jina la bidhaa, SKU, msimbo pau, chapa, au muundo...',
  'Filter by category': 'Chuja kwa kundi la bidhaa',
  'All Categories': 'Makundi Yote',
  'Filter by product status': 'Chuja kwa hali ya bidhaa',
  'Active Products': 'Bidhaa Zinazofanya Kazi',
  'Archived Products': 'Bidhaa Zilizohifadhiwa',
  'All Products': 'Bidhaa Zote',
  'Search': 'Tafuta',
  'Products catalogue': 'Orodha ya bidhaa',
  'Category': 'Kundi',
  'Purchase Cost': 'Gharama ya Ununuzi',
  'Selling Price': 'Bei ya Kuuzia',
  'Stock': 'Hisa',
  'Status': 'Hali',
  'Actions': 'Vitendo',
  'Loading products...': 'Inapakia bidhaa...',
  'No products found matching your criteria.': 'Hakuna bidhaa zilizopatikana zinazolingana na utafutaji wako.',
  'Archived': 'Imehifadhiwa',
  'Out of Stock': 'Imeisha Ghalani',
  'Low Stock': 'Hisa Chache',
  'In Stock': 'Ipo Ghalani',
  'Archive Product': 'Hifadhi Bidhaa (Archive)',
  'Restore Product': 'Rejesha Bidhaa',
  'Register product specifications, SKU, barcode, pricing in TZS, and warranty rules':
    'Sajili sifa za bidhaa, SKU, msimbo pau, bei kwa TZS, na masharti ya dhamana',
  'Cancel': 'Ghairi',
  'Product Image': 'Picha ya Bidhaa',
  'Product preview': 'Uhakiki wa picha ya bidhaa',
  'No image selected': 'Hakuna picha iliyochaguliwa',
  'Remove Image': 'Ondoa Picha',
  'From Device': 'Kutoka Kwenye Kifaa',
  'HTTPS Link': 'Kiungo cha HTTPS',
  'Choose Image from Device': 'Chagua Picha Kutoka Kwenye Kifaa',
  'JPG, PNG, WebP supported': 'JPG, PNG, WebP zinakubalika',
  '✓ Selected: {file}': '✓ Imechaguliwa: {file}',
  'Direct Web Image URL (HTTPS)': 'Kiungo cha Moja kwa Moja cha Picha (HTTPS)',
  'https://example.com/product.jpg': 'https://mfano.com/bidhaa.jpg',
  'Product Name': 'Jina la Bidhaa',
  'e.g. iPhone 15 Pro 256GB': 'mf. iPhone 15 Pro 256GB',
  'SKU Code (Auto-generated if blank)': 'Namba ya SKU (Itatengenezwa kiotomatiki ikiwa tupu)',
  'e.g. PHN-IP15P-256': 'mf. PHN-IP15P-256',
  'Brand': 'Chapa (Brand)',
  'e.g. Apple, Samsung, Anker': 'mf. Apple, Samsung, Anker',
  'Model / Barcode': 'Muundo / Msimbo Pau',
  'e.g. A3102 / 8901001...': 'mf. A3102 / 8901001...',
  'Purchase Price (TZS)': 'Bei ya Kununulia (TZS)',
  'Selling Price (TZS)': 'Bei ya Kuuzia (TZS)',
  'Opening Stock Quantity': 'Kiasi cha Awali cha Hisa',
  'Minimum Stock Alert Level': 'Kiwango cha Chini cha Tahadhari ya Hisa',
  'Warranty Duration (Months)': 'Muda wa Dhamana (Miezi)',
  'Description & Specifications': 'Maelezo na Sifa za Bidhaa',
  'Saving...': 'Inahifadhi...',
  'Save Product': 'Hifadhi Bidhaa',
  'Category saved successfully.': 'Kundi la bidhaa limehifadhiwa kikamilifu.',
  'Shop product categories + custom category management':
    'Makundi ya bidhaa za duka + usimamizi wa makundi mapya',
  'Main system logo active across login, sidebar, PWA icon, and all printed reports':
    'Nembo kuu ya mfumo inatumika kwenye ukurasa wa kuingia, upau wa pembeni, aikoni ya PWA, na ripoti zote zinazochapishwa',
  '10 default retail categories + custom category management':
    'Makundi 10 ya msingi ya duka + usimamizi wa makundi mapya',
  'Edit Category: {name}': 'Hariri Kundi: {name}',
  'New Category Name': 'Jina la Kundi Jipya',
  'e.g. Gaming Consoles & VR': 'mf. Michezo ya Video na VR',
  'Description': 'Maelezo',
  'Category summary...': 'Muhtasari wa kundi...',
  'Update Category': 'Sasisha Kundi',
  '+ Add Category': '+ Ongeza Kundi',
  '{count} products': 'Bidhaa {count}',
  '{count} units in stock': 'Vipande {count} ghalani',
  'Edit': 'Hariri',
  'Track supplier stock purchases, weighted-average cost updates, and supplier credit balances':
    'Fuatilia manunuzi ya mzigo kutoka kwa wasambazaji, wastani wa gharama, na madeni ya wasambazaji',
  '+ New Purchase Order': '+ Agizo Jipya la Manunuzi',
  'Purchases list': 'Orodha ya manunuzi',
  'Ref #': 'Kumbukumbu #',
  'Date': 'Tarehe',
  'Supplier': 'Msambazaji',
  'Items': 'Bidhaa',
  'Paid': 'Imelipwa',
  'Supplier Balance': 'Baki ya Msambazaji',
  'Loading purchases...': 'Inapakia manunuzi...',
  'Confirmed received quantities automatically increase stock and recalculate weighted-average cost':
    'Idadi zilizopokelewa huongeza hisa kiotomatiki na kukokotoa upya wastani wa gharama',
  'Purchase Date': 'Tarehe ya Manunuzi',
  'Receiving Status': 'Hali ya Mapokezi',
  'Received (Increase Stock Now)': 'Imepokelewa (Ongeza Hisa Sasa)',
  'Partially Received': 'Imepokelewa Kiasi',
  'Draft Order (No Stock Impact Yet)': 'Agizo la Rasimu (Hisa Haijaongezwa Bado)',
  'Purchased Products': 'Bidhaa Zilizonunuliwa',
  '+ Add Product Row': '+ Ongeza Mstari wa Bidhaa',
  'Quantity': 'Idadi',
  'Unit Purchase Price': 'Bei ya Ununuzi kwa Kipande',
  'Unit Cost TZS': 'Gharama kwa Kipande TZS',
  'Amount Paid Now (TZS) — Leave blank for Full Payment, or 0 for Credit':
    'Kiasi Kilicholipwa Sasa (TZS) — Acha wazi kwa Malipo Kamili, au weka 0 kwa Mkopo',
  'Full: {amount}': 'Kamili: {amount}',
  'Additional Transport / Customs Cost (TZS)': 'Gharama za Ziada za Usafiri / Forodha (TZS)',
  'Purchase Grand Total': 'Jumla Kuu ya Manunuzi',
  'Saving Purchase...': 'Inahifadhi Manunuzi...',
  'Save Purchase': 'Hifadhi Manunuzi',
  'Weighted-average cost valuation, low-stock monitoring, and complete stock movement history':
    'Thamani ya wastani ya gharama ya ghala, ufuatiliaji wa hisa chache, na historia kamili ya mzunguko wa hisa',
  'Low Stock Only': 'Hisa Chache Pekee',
  '+ Record Stock Adjustment': '+ Rekodi Marekebisho ya Hisa',
  'Inventory Cost Value (Weighted Avg)': 'Thamani ya Gharama ya Ghala (Wastani)',
  'Estimated Retail Value': 'Makadirio ya Thamani ya Mauzo',
  'Expected Margin on Stock': 'Faida Inayotarajiwa Kwenye Hisa',
  'Current Stock Levels ({count})': 'Viwango vya Hisa vya Sasa ({count})',
  'Stock Movement Ledger ({count})': 'Leja ya Mzunguko wa Hisa ({count})',
  'Inventory levels': 'Viwango vya ghala',
  'Available Stock': 'Hisa Iliyopo',
  'Damaged': 'Zilizoharibika',
  'Weighted Unit Cost': 'Wastani wa Gharama ya Kipande',
  'Total Valuation': 'Thamani Jumla',
  'SKU: {sku} · Min: {min}': 'SKU: {sku} · Chini: {min}',
  'Stock movements history': 'Historia ya mzunguko wa hisa',
  'Type': 'Aina',
  'Prev → New': 'Kabla → Mpya',
  'Reason': 'Sababu',
  'User': 'Mtumiaji',
  'Access Restricted: Admin Only': 'Ruhusa Imezuiwa: Msimamizi Mkuu Pekee',
  'Stock adjustments (damaged, lost, missing, or physical count changes) can only be performed by the Shop Administrator. Regular registered employees are restricted from modifying stock directly.':
    'Marekebisho ya hisa (zilizoharibika, zilizopotea, zilizokosekana, au mabadiliko ya hesabu halisi) yanaweza kufanywa na Msimamizi Mkuu wa Duka pekee. Wafanyakazi wa kawaida hawaruhusiwi kubadilisha hisa moja kwa moja.',
  'Return to Inventory': 'Rudi Ghalani',
  'Record damaged, missing, lost, or physical stock count corrections with audit logging':
    'Rekodi bidhaa zilizoharibika, zilizokosekana, zilizopotea, au masahihisho ya hesabu halisi ya ghala',
  'Back to Inventory': 'Rudi Ghalani',
  '{name} (Current Stock: {qty})': '{name} (Hisa ya Sasa: {qty})',
  'Adjustment Type': 'Aina ya Marekebisho',
  'Increase (+ Stock Received Outside PO)': 'Ongeza (+ Hisa Iliyopokelewa Nje ya Agizo)',
  'Decrease (- Manual Correction)': 'Punguza (- Sahihisho la Mkono)',
  'Damaged Product (- Stock)': 'Bidhaa Iliyoharibika (- Hisa)',
  'Missing Product (- Stock)': 'Bidhaa Iliyokosekana (- Hisa)',
  'Lost Product (- Stock)': 'Bidhaa Iliyopotea (- Hisa)',
  'Physical Stock Count (Set Exact Stock)': 'Hesabu Halisi ya Ghala (Weka Idadi Kamili)',
  'e.g. Monthly Stock Count, Display Damage...': 'mf. Hesabu ya Mwezi ya Ghala, Kioo Kilichoharibika...',
  'Additional Notes (Optional)': 'Maelezo ya Ziada (Si Lazima)',
  'Save Adjustment': 'Hifadhi Marekebisho',

  // ── Customers, Debts & Suppliers (Screens 13-18) ──────────────────────────
  'Search customers by name or phone, view total purchases, and monitor credit limits':
    'Tafuta wateja kwa jina au simu, tazama jumla ya manunuzi, na fuatilia mipaka ya mikopo',
  '+ Add Customer': '+ Ongeza Mteja',
  'Customer registered successfully.': 'Mteja amesajiliwa kikamilifu.',
  'Phone Number *': 'Namba ya Simu *',
  'Customer Type': 'Aina ya Mteja',
  'Regular': 'Kawaida',
  'VIP': 'VIP',
  'Corporate': 'Kampuni',
  'Wholesale': 'Jumla',
  'Address': 'Anwani',
  'Credit Limit (TZS)': 'Kikomo cha Mkopo (TZS)',
  'Search customer by name or phone number...': 'Tafuta mteja kwa jina au namba ya simu...',
  'Customers directory': 'Orodha ya wateja',
  'Phone': 'Simu',
  'Total Spent': 'Jumla Aliyonunua',
  'Outstanding Debt': 'Deni Lililobaki',
  'Profile': 'Wasifu',
  'Loading customer profile...': 'Inapakia wasifu wa mteja...',
  'Customer Statement - {name}': 'Taarifa ya Akaunti ya Mteja - {name}',
  'CUSTOMER ACCOUNT STATEMENT': 'TAARIFA YA AKAUNTI YA MTEJA',
  'Phone:': 'Simu:',
  'Total Purchases:': 'Jumla ya Manunuzi:',
  'Total Paid:': 'Jumla Iliyolipwa:',
  '← Back to Customers': '← Rudi kwa Wateja',
  'Print Account Statement': 'Chapisha Taarifa ya Akaunti',
  'Record Debt Repayment': 'Rekodi Malipo ya Deni',
  'Total Spent:': 'Jumla Aliyonunua:',
  'Credit Limit:': 'Kikomo cha Mkopo:',
  'Transactions': 'Miamala',
  'Repayments': 'Malipo ya Madeni',
  'Details': 'Maelezo',
  'Receipt': 'Risiti',
  'Total Amount': 'Jumla ya Pesa',
  'Balance Due': 'Baki Inayodaiwa',
  'Repayment Receipt': 'Risiti ya Malipo ya Deni',
  'Invoice': 'Ankara',
  'Amount Paid': 'Kiasi Kilicholipwa',
  'Remaining Balance': 'Baki Iliyobaki',
  'Customer Code:': 'Namba ya Mteja:',
  'Account Status:': 'Hali ya Akaunti:',
  'Notes:': 'Maelezo:',
  'Track unpaid and partially paid credit sales, due dates, and overdue accounts':
    'Fuatilia mauzo ya mkopo yasiyolipwa na yaliyolipa kiasi, tarehe za mwisho, na akaunti zilizochelewa',
  '+ Record Customer Repayment': '+ Rekodi Malipo ya Deni la Mteja',
  'Total Outstanding Debt (AR)': 'Jumla ya Madeni Yanayodaiwa (AR)',
  'Overdue Balance': 'Deni Lililochelewa',
  'Open Credit Invoices': 'Ankara za Mkopo Zilizo Wazi',
  '{count} Invoices': 'Ankara {count}',
  'Customer debts table': 'Jedwali la madeni ya wateja',
  'Invoice #': 'Ankara #',
  'Due Date': 'Tarehe ya Mwisho',
  'Sale Total': 'Jumla ya Mauzo',
  'Outstanding Balance': 'Baki Inayodaiwa',
  'Aging Status': 'Hali ya Muda wa Deni',
  'Loading debt accounts...': 'Inapakia akaunti za madeni...',
  'No unpaid customer debts!': 'Hakuna madeni ya wateja yasiyolipwa!',
  'Record Payment': 'Rekodi Malipo',
  'Record Customer Repayment': 'Rekodi Malipo ya Mteja',
  'Reduces accounts receivable and increases cash collected without duplicating sales revenue':
    'Hupunguza madeni yanayodaiwa na kuongeza fedha zilizokusanywa bila kurudia mapato ya mauzo',
  'Back': 'Rudi Nyuma',
  'Offline repayment saved in IndexedDB and will sync automatically.':
    'Malipo ya deni ya nje ya mtandao yamehifadhiwa kwenye IndexedDB na yatasawazishwa kiotomatiki.',
  'Customer & Outstanding Invoice': 'Mteja na Ankara Inayodaiwa',
  '{name} — {receipt} (Balance Due: {balance})': '{name} — {receipt} (Baki Inayodaiwa: {balance})',
  'Remaining Balance on': 'Baki Iliyobaki kwenye',
  'Repayment Amount (TZS)': 'Kiasi cha Malipo ya Deni (TZS)',
  'Notes': 'Maelezo',
  'Recording...': 'Inarekodi...',
  'Manage electronics distributors, wholesale purchases, and accounts payable':
    'Simamia wasambazaji wa vifaa vya kielektroniki, manunuzi ya jumla, na madeni ya kulipa',
  '+ Add Supplier': '+ Ongeza Msambazaji',
  'Supplier Company Name *': 'Jina la Kampuni ya Msambazaji *',
  'Contact Person': 'Mtu wa Mawasiliano',
  'Email': 'Barua Pepe',
  'Save Supplier': 'Hifadhi Msambazaji',
  'Suppliers directory': 'Orodha ya wasambazaji',
  'Contact': 'Mawasiliano',
  'Total Purchases': 'Jumla ya Manunuzi',
  'Profile & Payments': 'Wasifu na Malipo',
  'Loading supplier profile...': 'Inapakia wasifu wa msambazaji...',
  '← Back to Suppliers': '← Rudi kwa Wasambazaji',
  'Paid:': 'Imelipwa:',
  'Supplier Balance Payable': 'Deni la Msambazaji la Kulipa',
  'Pay Supplier Balance (TZS)': 'Lipa Deni la Msambazaji (TZS)',
  'Supplier settlement note': 'Maelezo ya malipo ya msambazaji',
  'Record Supplier Payment': 'Rekodi Malipo ya Msambazaji',
  'Purchases ({count})': 'Manunuzi ({count})',
  'Payments ({count})': 'Malipo ({count})',
  'Balance': 'Baki',
  'Payment Ref': 'Rejeleo la Malipo',

  // ── Expenses, Cash Register, Returns & Warranty (Screens 19-21) ───────────
  'Track daily operating expenses (strictly separated from inventory purchases)':
    'Fuatilia matumizi ya kila siku ya uendeshaji (yametenganishwa kabisa na manunuzi ya mzigo)',
  'Total Recorded Expenses: {amount}': 'Jumla ya Matumizi Yaliyorekodiwa: {amount}',
  'Expense Title *': 'Kichwa cha Matumizi *',
  'e.g. Monthly Shop Rent / LUKU Token': 'mf. Kodi ya Duka ya Mwezi / LUKU',
  'Category *': 'Kundi *',
  'Amount (TZS) *': 'Kiasi (TZS) *',
  '+ Add Expense': '+ Ongeza Matumizi',
  'Operating expenses list': 'Orodha ya matumizi ya uendeshaji',
  'Title & Description': 'Kichwa na Maelezo',
  'Amount (TZS)': 'Kiasi (TZS)',
  'Recorded By': 'Imerekodiwa Na',
  // Default Expense Categories
  'Rent': 'Kodi ya Pango',
  'Electricity and water': 'Umeme na Maji',
  'Internet': 'Intaneti',
  'Transportation': 'Usafiri',
  'Employee salaries': 'Mishahara ya Wafanyakazi',
  'Maintenance': 'Matengenezo',
  'Cleaning': 'Usafi',
  'Other expenses': 'Matumizi Mengine',
  // Cash Register
  'Expected Closing Cash = Opening Balance + Cash Inflows (Sales & Repayments) − Cash Outflows (Expenses, Supplier Payments & Refunds)':
    'Fedha Inayotarajiwa Kufunga = Kianzio + Fedha Zinazoingia (Mauzo na Malipo ya Madeni) − Fedha Zinazotoka (Matumizi, Malipo ya Wasambazaji na Marejesho)',
  '{message} Expected: {expected}, Counted: {counted}, Difference: {diff}':
    '{message} Inayotarajiwa: {expected}, Iliyohesabiwa: {counted}, Tofauti: {diff}',
  'ACTIVE SHIFT: {code}': 'ZAMU INAYOENDELEA: {code}',
  'Opened by {name} at {date}': 'Imefunguliwa na {name} saa {date}',
  'Opening Balance:': 'Kianzio cha Kufungua:',
  'Total Cash Inflows (Sales + Repayments):': 'Jumla ya Fedha Zinazoingia (Mauzo + Madeni):',
  'Total Cash Outflows (Expenses + Suppliers):': 'Jumla ya Fedha Zinazotoka (Matumizi + Wasambazaji):',
  'Expected Closing Balance:': 'Baki Inayotarajiwa ya Kufunga:',
  'Physically Counted Cash in Drawer (TZS) *': 'Fedha Iliyohesabiwa Mkononi Kwenye Droo (TZS) *',
  'Calculated Cash Discrepancy / Difference:': 'Tofauti Iliyokokotolewa ya Fedha:',
  'Closing shift reconciliation notes...': 'Maelezo ya kufunga zamu na upatanisho...',
  'Close & Reconcile Cash Session': 'Funga na Upatanisha Zamu ya Fedha',
  'Shift Cash Movements ({count})': 'Mzunguko wa Fedha wa Zamu ({count})',
  'Open New Cash Register Shift': 'Fungua Zamu Mpya ya Droo ya Fedha',
  'Opening Cash Float Balance (TZS) *': 'Kianzio cha Fedha Taslimu (TZS) *',
  'Opening shift notes...': 'Maelezo ya kufungua zamu...',
  'Open Cash Register Session': 'Fungua Zamu ya Droo ya Fedha',
  'Historical Cash Sessions': 'Historia ya Zamu za Droo ya Fedha',
  'Historical cash sessions': 'Historia ya zamu za droo ya fedha',
  'Session': 'Zamu',
  'Employee': 'Mfanyakazi',
  'Opening': 'Kianzio',
  'Expected': 'Inayotarajiwa',
  'Counted': 'Iliyohesabiwa',
  'Difference': 'Tofauti',
  // Returns & Warranty
  'Process sale-linked returns (resalable items restock automatically) and track product warranty expiry & claims':
    'Shughulikia marejesho yanayohusiana na mauzo (bidhaa zinazouzika hurejea ghalani kiotomatiki) na fuatilia dhamana na madai',
  'Product Returns ({count})': 'Marejesho ya Bidhaa ({count})',
  'Active & Expired Warranties ({count})': 'Dhamana Hai na Zilizokwisha ({count})',
  'Warranty Claims ({count})': 'Madai ya Dhamana ({count})',
  'Original Sale *': 'Mauzo ya Awali *',
  'Returned Product *': 'Bidhaa Iliyorudishwa *',
  'Product Condition *': 'Hali ya Bidhaa *',
  'Resalable (Auto-Restock Inventory)': 'Inauzika Tena (Rejesha Ghalani Kiotomatiki)',
  'Damaged (Do Not Restock)': 'Imeharibika (Usirejeshe Ghalani)',
  'Under Inspection': 'Inakaguliwa',
  'Resolution *': 'Uamuzi / Suluhisho *',
  'Product Exchange': 'Kubadilisha Bidhaa',
  'Cash Refund (Cash Outflow)': 'Kurudisha Pesa Taslimu (Fedha Inatoka)',
  'Store Credit': 'Mkopo wa Dukani',
  'Return Without Refund (Approved Policy)': 'Marejesho Bila Kurudisha Pesa (Sera Iliyoidhinishwa)',
  'Reason *': 'Sababu *',
  '+ Process Return': '+ Shughulikia Marejesho',
  'Return #': 'Marejesho #',
  'Sale Ref': 'Rejeleo la Mauzo',
  'Resolution': 'Suluhisho',
  'Original Sale': 'Mauzo ya Awali',
  'Duration (Months)': 'Muda (Miezi)',
  '+ Register Warranty': '+ Sajili Dhamana',
  'Warranty #': 'Dhamana #',
  'Sale Date': 'Tarehe ya Mauzo',
  'Expiry Date': 'Tarehe ya Kumalizika',
  'Warranty': 'Dhamana',
  'Issue *': 'Tatizo *',
  'Describe fault...': 'Eleza hitilafu...',
  'Repaired': 'Imetengenezwa',
  'Replaced': 'Imebadilishwa',
  'Rejected': 'Imekataliwa',
  'Pending Inspection': 'Inasubiri Ukaguzi',
  '+ Record Claim': '+ Rekodi Dai la Dhamana',
  'Claim #': 'Dai #',
  'Issue': 'Tatizo',

  // ── Reports, Employees & Settings (Screens 22-24) ─────────────────────────
  'Sales, Inventory, Customer, Supplier, and P&L statements with PDF & Excel export':
    'Ripoti za Mauzo, Ghala, Wateja, Wasambazaji, na Faida na Hasara (P&L) pamoja na kupakua PDF na Excel',
  'Export PDF': 'Pakua PDF',
  'Export Excel (CSV)': 'Pakua Excel (CSV)',
  'Sales & Products': 'Mauzo na Bidhaa',
  'Sales by Employee': 'Mauzo kwa Mfanyakazi',
  'Financial P&L Statement': 'Taarifa ya Faida na Hasara (P&L)',
  'Net Sales Revenue': 'Mapato Halisi ya Mauzo',
  'Total Cash Collected': 'Jumla ya Fedha Zilizokusanywa',
  'Accounts Receivable (AR)': 'Madeni ya Wateja Yanayodaiwa (AR)',
  'Inventory Cost Value': 'Thamani ya Gharama ya Ghala',
  'Income & Profit Statement (SRS Section 6 Accounting Rules)':
    'Taarifa ya Mapato na Faida (Kanuni za Uhasibu za SRS Sehemu ya 6)',
  'Gross Sales:': 'Mauzo Ghafi:',
  'Less: Authorized Discounts:': 'Toa: Punguzo Zilizoidhinishwa:',
  'Net Sales Revenue (Excludes Debt Repayments):': 'Mapato Halisi ya Mauzo (Bila Malipo ya Madeni):',
  'Less: Cost of Goods Sold (COGS at Preserved Historical Unit Cost):':
    'Toa: Gharama ya Bidhaa Zilizouzwa (COGS kwa Gharama Halisi ya Kihistoria):',
  'Gross Profit (Net Sales − COGS):': 'Faida Ghafi (Mauzo Halisi − COGS):',
  'Less: Operating Expenses (Separated from Inventory Purchases):':
    'Toa: Matumizi ya Uendeshaji (Yametenganishwa na Manunuzi ya Mzigo):',
  'Net Profit (Gross Profit − Operating Expenses):': 'Faida Halisi (Faida Ghafi − Matumizi ya Uendeshaji):',
  'Units Sold': 'Vipande Vilivyouzwa',
  'Revenue': 'Mapato',
  'Gross Profit': 'Faida Ghafi',
  'Category Revenue': 'Mapato ya Kundi',
  'Completed Sales': 'Mauzo Yaliyokamilika',
  'Total Revenue': 'Jumla ya Mapato',
  'Cash Collected': 'Fedha Zilizokusanywa',
  // Reports PDF & CSV exports
  'ESMS Financial & Operational Report ({start} to {end})':
    'Ripoti ya Fedha na Uendeshaji ({start} hadi {end})',
  'KAMPANGO PHONES AND ELECTRONICS — Financial & Operational Report ({start} to {end})':
    'KAMPANGO PHONES AND ELECTRONICS — Ripoti ya Fedha na Uendeshaji ({start} hadi {end})',
  'ESMS BUSINESS & FINANCIAL REPORT': 'RIPOTI YA BIASHARA NA FEDHA',
  'BUSINESS & FINANCIAL REPORT': 'RIPOTI YA BIASHARA NA FEDHA',
  'Period: {start} to {end}': 'Kipindi: {start} hadi {end}',
  'Sales Revenue (Net of Discounts)': 'Mapato ya Mauzo (Baada ya Punguzo)',
  'Cost of Goods Sold (COGS)': 'Gharama ya Bidhaa Zilizouzwa (COGS)',
  'Net Profit': 'Faida Halisi',
  'Cash Collected (Sales + Debt Repayments)': 'Fedha Zilizokusanywa (Mauzo + Malipo ya Madeni)',
  'Accounts Receivable (Customer Debts)': 'Madeni ya Wateja (Akaunti Zinazodaiwa)',
  'Accounts Payable (Supplier Balances)': 'Madeni ya Wasambazaji (Akaunti za Kulipa)',
  'SKU': 'SKU',
  'Current Stock': 'Hisa ya Sasa',
  'Revenue (TZS)': 'Mapato (TZS)',
  'COGS (TZS)': 'Gharama za Bidhaa COGS (TZS)',
  'Gross Profit (TZS)': 'Faida Ghafi (TZS)',
  // Employees & RBAC
  'Register new staff, delete accounts, reset passwords, and configure unified employee permissions':
    'Sajili wafanyakazi wapya, futa akaunti, weka upya manenosiri, na sanidi ruhusa za wafanyakazi',
  'Close Form': 'Funga Fomu',
  '+ Add Employee': '+ Ongeza Mfanyakazi',
  'Are you sure you want to delete employee @{username} ({fullName})?':
    'Una uhakika unataka kumfuta mfanyakazi @{username} ({fullName})?',
  'Reset Employee Password': 'Weka Upya Nenosiri la Mfanyakazi',
  'New Password (minimum 6 characters)': 'Nenosiri Jipya (angalau herufi 6)',
  'Enter new password': 'Weka nenosiri jipya',
  'Generate Password': 'Tengeneza Nenosiri',
  'Save New Password': 'Hifadhi Nenosiri Jipya',
  'Unique Username *': 'Jina la Mtumiaji la Kipekee *',
  'Initial Password *': 'Nenosiri la Awali *',
  'Phone (e.g. +255 7XX XXX XXX)': 'Simu (mf. +255 7XX XXX XXX)',
  'Email (optional)': 'Barua Pepe (si lazima)',
  'Max Discount % (e.g. 5)': 'Kikomo cha Punguzo % (mf. 5)',
  'Register Employee': 'Sajili Mfanyakazi',
  'Role': 'Wadhifa',
  'Sales Total': 'Jumla ya Mauzo',
  'Configure Permissions': 'Sanidi Ruhusa',
  'Perms ({count})': 'Ruhusa ({count})',
  'Delete Employee': 'Futa Mfanyakazi',
  'Granular Permissions: {name}': 'Ruhusa za Kina: {name}',
  'Toggle individual permissions on or off for this employee (SRS Section 2.4).':
    'Washa au zima ruhusa moja moja kwa mfanyakazi huyu (SRS Sehemu ya 2.4).',
  'Select an employee on the left to inspect or customize their individual permissions.':
    'Chagua mfanyakazi upande wa kushoto ili kukagua au kurekebisha ruhusa zake binafsi.',
  'Timestamp': 'Muda',
  'Entity': 'Kipengele',
  'Reason & Details': 'Sababu na Maelezo',
  // Settings
  'Shop profile, TZS currency, credit/discount policies, offline synchronization, and database backup':
    'Taarifa za duka, sarafu ya TZS, sera za mikopo na punguzo, usawazishaji bila mtandao, na nakala ya dharura',
  'Synchronized {count} pending offline transaction(s) with server.':
    'Miamala {count} ya nje ya mtandao imesawazishwa na seva.',
  'General & Shop Info': 'Taarifa za Jumla za Duka',
  'Credit & Discount Rules': 'Kanuni za Mikopo na Punguzo',
  'Offline Sync Queue ({count})': 'Foleni ya Usawazishaji ({count})',
  'Backup & Recovery': 'Nakala ya Dharura na Urejeshaji',
  'Shop Name': 'Jina la Duka',
  'Currency': 'Sarafu',
  'Physical Shop Address': 'Anwani Halisi ya Duka',
  'Receipt Footer Message': 'Ujumbe wa Chini wa Risiti',
  'Default Customer Credit Limit (TZS)': 'Kikomo Chaguo-msingi cha Mkopo wa Mteja (TZS)',
  'Max Cashier Discount Limit (%)': 'Kikomo cha Juu cha Punguzo la Keshia (%)',
  'Default Warranty Duration (Months)': 'Muda Chaguo-msingi wa Dhamana (Miezi)',
  'Default Low-Stock Alert Threshold': 'Kiwango Chaguo-msingi cha Tahadhari ya Hisa Chache',
  'Save Settings': 'Hifadhi Mipangilio',
  'IndexedDB Offline Transaction Queue': 'Foleni ya Miamala Bila Mtandao (IndexedDB)',
  'Local transactions are assigned unique UUIDs and verified server-side to prevent duplicates':
    'Miamala ya kifaa hupewa namba za kipekee (UUID) na kuthibitishwa kwenye seva ili kuzuia kurudia',
  'Sync Now': 'Sawazisha Sasa',
  'Clear Synced': 'Ondoa Zilizosawazishwa',
  'All local transactions are synchronized with the central MySQL database.':
    'Miamala yote ya kifaa imesawazishwa na kanzidata kuu ya MySQL.',
  'Recorded:': 'Imerekodiwa:',
  'Device:': 'Kifaa:',
  'Database Backup & Recovery (SRS Section 10)':
    'Nakala ya Dharura na Urejeshaji wa Kanzidata (SRS Sehemu ya 10)',
  'Export a complete, verified JSON snapshot of all 29 relational database tables (products, inventory, sales, customer debts, supplier balances, cash sessions, warranties, and audit logs).':
    'Pakua nakala kamili na iliyothibitishwa ya JSON ya majedwali yote 29 ya kanzidata (bidhaa, ghala, mauzo, madeni ya wateja, baki za wasambazaji, zamu za fedha, dhamana, na kumbukumbu za ukaguzi).',
  'Last Backup Exported:': 'Nakala ya Mwisho Ilipakuliwa:',
  'Export Full Database Backup': 'Pakua Nakala Kamili ya Kanzidata',

  // ── Enums, Statuses & Snake-Case Values ───────────────────────────────────
  'active': 'Inafanya Kazi',
  'inactive': 'Haifanyi Kazi',
  'archived': 'Imehifadhiwa',
  'paid': 'Imelipwa',
  'partial': 'Imelipwa Kiasi',
  'unpaid': 'Haijalipwa',
  'completed': 'Imekamilika',
  'cancelled': 'Imefutwa',
  'returned': 'Imerudishwa',
  'reversed': 'Imebatilishwa',
  'pending': 'Inasubiri',
  'open': 'Wazi',
  'closed': 'Imefungwa',
  'approved': 'Imeidhinishwa',
  'rejected': 'Imekataliwa',
  'expired': 'Imeisha Muda',
  'claimed': 'Imedaiwa',
  'void': 'Batili',
  'suspended': 'Imesimamishwa',
  'draft': 'Rasimu',
  'received': 'Imepokelewa',
  'partially_received': 'Imepokelewa Kiasi',
  'in_stock': 'Ipo Ghalani',
  'low_stock': 'Hisa Chache',
  'out_of_stock': 'Imeisha Ghalani',
  'full_cash': 'Pesa Taslimu Kamili',
  'partial_credit': 'Malipo Kiasi (Mkopo)',
  'zero_deposit_credit': 'Mkopo Bila Amana',
  'purchase_receipt': 'Mapokezi ya Manunuzi',
  'sale': 'Mauzo',
  'return_resalable': 'Marejesho Yanayouzika',
  'adjustment_increase': 'Ongezeko la Hisa',
  'adjustment_decrease': 'Upunguzaji wa Hisa',
  'damaged': 'Imeharibika',
  'missing': 'Imepotea (Haipo)',
  'lost': 'Imepotea',
  'physical_count': 'Hesabu Halisi ya Ghala',
  'initial_stock': 'Hisa ya Awali',
  'sale_payment': 'Malipo ya Mauzo',
  'debt_repayment': 'Malipo ya Deni',
  'other_receipt': 'Mapato Mengine',
  'expense': 'Matumizi',
  'supplier_payment': 'Malipo ya Msambazaji',
  'customer_refund': 'Marejesho ya Pesa kwa Mteja',
  'cash_withdrawal': 'Kutoa Pesa Taslimu',
  'inflow': 'Fedha Inayoingia',
  'outflow': 'Fedha Inayotoka',
  'overdue': 'Imechelewa',
  'due_soon': 'Karibu Kuchelewa',
  'current': 'Ndani ya Muda',
  'exchange': 'Kubadilisha Bidhaa',
  'cash_refund': 'Kurudisha Pesa Taslimu',
  'store_credit': 'Mkopo wa Dukani',
  'no_refund_policy': 'Bila Kurudisha Pesa',
  'resalable': 'Inauzika Tena',
  'under_inspection': 'Inakaguliwa',
  'pending_inspection': 'Inasubiri Ukaguzi',
  'repaired': 'Imetengenezwa',
  'replaced': 'Imebadilishwa',
  'synced': 'Imesawazishwa',
  'conflict': 'Mgongano',
  'failed': 'Imeshindikana',
  'duplicate_ignored': 'Nakala Imepuuzwa',
  'regular': 'Kawaida',
  'vip': 'VIP',
  'corporate': 'Kampuni',
  'wholesale': 'Jumla',
  'fixed': 'Kiasi Halisi',
  'percentage': 'Asilimia',
  'none': 'Hakuna',
  'Walk-in Customer': 'Mteja wa Papo kwa Papo',

  // ── Seeded Default Product Categories & Descriptions ──────────────────────
  'Mobile Phones': 'Simu za Mkononi',
  'Smartphones and feature phones across all brands': 'Simu janja na simu za kawaida za chapa zote',
  'Smartphones, used phones, and feature phones (Itel, Samsung, Redmi, Philips, etc.)':
    'Simu janja, simu za mtumba, na simu ndogo (Itel, Samsung, Redmi, Philips n.k.)',
  'Phone Accessories': 'Vifaa vya Simu',
  'Cases, screen protectors, holders, and phone stands': 'Kava za simu, vilinda vioo, na vishikio vya simu',
  'Phone covers, tempered glass, casings, phone batteries, plus computer mouse & keyboard':
    'Kava za simu, vioo vya kulinda simu, bodi za simu, betri, pamoja na kipanya na kibodi ya kompyuta',
  'Chargers and Cables': 'Chaja na Nyaya',
  'Fast chargers, power adapters, Type-C and Lightning cables':
    'Chaja za haraka, adapta za umeme, nyaya za Type-C na Lightning',
  'Fast chargers, adapters (40W–75W), USB-C & Lightning cables, power cables, and tapes':
    'Chaja za haraka, adapta (40W–75W), nyaya za USB-C na Lightning, waya za umeme na tepu',
  'Earphones and Headphones': 'Spika za Masikioni (Earphones & Pods)',
  'Wireless earbuds, neckbands, and studio headphones':
    'Earbuds zisizo na waya, neckbands, na headphones za studio',
  'Wireless earbuds, pods (JBL, Oraimo, Awei, NT King), and wireless microphones':
    'Pods na earbuds zisizo na waya (JBL, Oraimo, Awei, NT King) na maikrofoni zisizo na waya',
  'Speakers': 'Spika na Redio',
  'Speakers & Radios': 'Spika na Redio',
  'Bluetooth portable speakers, soundbars, and home audio':
    'Spika za Bluetooth za kubebeka, soundbars, na mifumo ya sauti ya nyumbani',
  'Seapiano, Sundar, Skywood, Alitop speakers, subwoofers (bufa), and portable radios':
    'Spika za Seapiano, Sundar, Skywood, Alitop, sabufa (bufa), na redio za mkononi',
  'Laptops and Computers': 'Kompyuta Mpakato na Kompyuta',
  'Business laptops, ultrabooks, desktops, and monitors':
    'Kompyuta mpakato za biashara, ultrabooks, kompyuta za mezani na skrini',
  'Tablets': 'Vishikwambi (Tablets)',
  'iPads, Android tablets, and educational slates': 'iPad, vishikwambi vya Android, na vishikwambi vya masomo',
  'Smartwatches': 'Saa Janja (Smartwatches)',
  'Fitness trackers and smartwatches': 'Saa janja na vifaa vya kufuatilia mazoezi',
  'Memory Cards and Flash Drives': 'Kadi za Kumbukumbu na Flash',
  'SD cards, microSDXC, USB flash drives, and portable SSDs':
    'Kadi za SD, microSDXC, flash za USB, na SSD za kubebeka',
  'Memory cards (Nokia, SanDisk), USB flash drives, and pen drives':
    'Kadi za kumbukumbu (Nokia, SanDisk), flash za USB, na pen drives',
  'TVs & Remotes': 'Runinga (TV) na Rimoti',
  'Hisense, Vitron, Alitop, Sundar, and Solar Max TVs plus Azam & Universal remotes':
    'Runinga za Hisense, Vitron, Alitop, Sundar, na Solar Max pamoja na rimoti za Azam na Universal',
  'Fridges & Freezers': 'Friji na Friza',
  'Hisense, Tallman, Boss, ADH, and Solar Max fridges, freezers, and fridge guards':
    'Friji na friza za Hisense, Tallman, Boss, ADH, na Solar Max pamoja na vilinda friji',
  'Solar, Batteries & Power': 'Sola, Betri na Umeme',
  'Chloride, Sony & Samsung solar batteries, solar controllers (6A–30A), inverters, and regulators':
    'Betri za sola (Chloride, Sony, Samsung), solar controllers (6A–30A), inveta na regulators',
  'Home Appliances & Kitchen': 'Vifaa vya Nyumbani na Jikoni',
  'Rice cookers, water dispensers, deep fryers, gas cookers, fans, irons, kettles, and flasks':
    'Vijiko vya wali, water dispensers, deep fryers, majiko ya gesi, feni, pasi, birika na chupa za chai',
  'Lighting & Torches': 'Taa na Tochi',
  'Rechargeable torches, headlamps, LED bulbs, coil bulbs, and Valight lamps':
    'Tochi za kuchaji, tochi za kichwani, balbu za LED, balbu za coil na taa za Valight',
  'Grooming & Household': 'Vifaa vya Kunyolea na Usafi',
  'Hair clippers (VADER), hair dryers, barber brushes, brooms, and carpets':
    'Mashine za kunyolea (VADER), hair dryers, brashi za kunyolea, fagio na kapeti',
  'Other Electronics': 'Vifaa Vingine vya Kielektroniki',
  'Power banks, routers, inverters, and smart home gadgets':
    'Power banks, rota za intaneti, inveta, na vifaa janja vya nyumbani',

  // ── Seeded Roles, Permission Names & Modules ──────────────────────────────
  'Shop Owner / Super Administrator': 'Mmiliki wa Duka / Msimamizi Mkuu',
  'Shop Employee / Staff': 'Mfanyakazi wa Duka',
  'Sales Attendant / Cashier': 'Muhudumu wa Mauzo / Keshia',
  'Inventory / Stock Manager': 'Msimamizi wa Ghala na Hisa',
  'View Operational Dashboard': 'Tazama Dashibodi ya Uendeshaji',
  'View Financial KPIs & Profit': 'Tazama Takwimu za Fedha na Faida',
  'View Products': 'Tazama Bidhaa',
  'Manage Products': 'Simamia Bidhaa',
  'Modify Product Purchase Cost': 'Badili Bei ya Ununuzi ya Bidhaa',
  'Manage Categories': 'Simamia Makundi ya Bidhaa',
  'View Purchases': 'Tazama Manunuzi',
  'Record & Receive Purchases': 'Rekodi na Pokea Manunuzi',
  'View Suppliers': 'Tazama Wasambazaji',
  'Manage Suppliers': 'Simamia Wasambazaji',
  'Record Supplier Payments': 'Rekodi Malipo ya Wasambazaji',
  'View Inventory': 'Tazama Ghala',
  'Record Stock Adjustments': 'Rekodi Marekebisho ya Hisa',
  'Create POS Sales': 'Fanya Mauzo ya POS',
  'Apply Authorized Discounts': 'Toa Punguzo Zilizoidhinishwa',
  'Override Discount Limits': 'Vuka Kikomo cha Punguzo',
  'View Sales History': 'Tazama Historia ya Mauzo',
  'Reverse / Cancel Sales': 'Batilisha / Futa Mauzo',
  'View Customers': 'Tazama Wateja',
  'Manage Customers': 'Simamia Wateja',
  'View Customer Debts': 'Tazama Madeni ya Wateja',
  'Record Debt Repayments': 'Rekodi Malipo ya Madeni',
  'Approve Credit & Debt Adjustments': 'Idhinisha Mikopo na Marekebisho ya Madeni',
  'Operate Cash Register': 'Endesha Droo ya Fedha',
  'Review & Audit Cash Sessions': 'Kagua Zamu za Droo ya Fedha',
  'View Expenses': 'Tazama Matumizi',
  'Record & Manage Expenses': 'Rekodi na Simamia Matumizi',
  'Process Returns & Refunds': 'Shughulikia Marejesho na Kurudisha Pesa',
  'Manage Warranties & Claims': 'Simamia Dhamana na Madai',
  'View Operational Reports': 'Tazama Ripoti za Uendeshaji',
  'View Restricted Financial Reports': 'Tazama Ripoti Maalum za Fedha',
  'Manage Employees & Permissions': 'Simamia Wafanyakazi na Ruhusa',
  'Access Audit Logs': 'Fikia Kumbukumbu za Ukaguzi',
  'Configure System Settings & Backups': 'Sanidi Mipangilio ya Mfumo na Nakala za Dharura',
  // Permission modules
  'POS': 'POS',
  'Sales': 'Mauzo',
  'Returns': 'Marejesho',
  'Audit': 'Ukaguzi',

  // ── Audit Log Actions, Entities & Default Reasons ─────────────────────────
  'auth.login': 'Kuingia Mfumoni',
  'auth.logout': 'Kuondoka Mfumoni',
  'backup.exported': 'Nakala ya Kanzidata Imepakuliwa',
  'cash_session.closed': 'Zamu ya Fedha Imefungwa',
  'cash_session.opened': 'Zamu ya Fedha Imefunguliwa',
  'category.created': 'Kundi Limeundwa',
  'category.updated': 'Kundi Limesasishwa',
  'customer.created': 'Mteja Amesajiliwa',
  'customer.updated': 'Taarifa za Mteja Zimesasishwa',
  'debt.repayment_recorded': 'Malipo ya Deni Yamerekodiwa',
  'employee.created': 'Mfanyakazi Amesajiliwa',
  'employee.deleted': 'Mfanyakazi Amefutwa',
  'employee.password_reset': 'Nenosiri la Mfanyakazi Limewekwa Upya',
  'employee.updated_permissions': 'Ruhusa za Mfanyakazi Zimesasishwa',
  'expense.created': 'Matumizi Yamerekodiwa',
  'inventory.adjusted': 'Hisa Imerekebishwa',
  'product.created': 'Bidhaa Imesajiliwa',
  'product.updated': 'Bidhaa Imesasishwa',
  'purchase.created': 'Manunuzi Yamerekodiwa',
  'return.processed': 'Marejesho Yameshughulikiwa',
  'sale.credit_created': 'Mauzo ya Mkopo Yamefanyika',
  'sale.discount_applied': 'Punguzo la Mauzo Limetolewa',
  'settings.updated': 'Mipangilio Imesasishwa',
  'supplier.created': 'Msambazaji Amesajiliwa',
  'supplier.updated': 'Msambazaji Amesasishwa',
  'supplier_payment.recorded': 'Malipo ya Msambazaji Yamerekodiwa',
  'warranty.registered': 'Dhamana Imesajiliwa',
  'warranty_claim.recorded': 'Dai la Dhamana Limerekodiwa',
  'CashSession': 'Zamu ya Fedha',
  'CustomerPayment': 'Malipo ya Mteja',
  'ShopSettings': 'Mipangilio ya Duka',
  'SupplierPayment': 'Malipo ya Msambazaji',
  'WarrantyClaim': 'Dai la Dhamana',
  'Confirmed purchase goods receipt': 'Mapokezi ya mzigo wa manunuzi yaliyothibitishwa',
  'Stock Count Verification': 'Uhakiki wa Hesabu ya Hisa',
  'Updated product catalogue details': 'Taarifa za orodha ya bidhaa zimesasishwa',
  'Customer debt repayment': 'Malipo ya deni la mteja',
  'Defective / Customer exchange request': 'Hitilafu / Ombi la mteja la kubadilisha bidhaa',
  '12-Month Store & Manufacturer Warranty': 'Dhamana ya Miezi 12 ya Duka na Mtengenezaji',

  // ── Backend API Success & Error Messages ──────────────────────────────────
  'Logged out successfully.': 'Umeondoka kazini kikamilifu.',
  'Username and password are required.': 'Jina la mtumiaji na nenosiri vinahitajika.',
  'Invalid username or password.': 'Jina la mtumiaji au nenosiri si sahihi.',
  'This employee account has been deactivated. Contact the Shop Owner.':
    'Akaunti hii ya mfanyakazi imesimamishwa. Wasiliana na Mmiliki wa Duka.',
  'Category created successfully.': 'Kundi la bidhaa limeundwa kikamilifu.',
  'Category updated successfully.': 'Kundi la bidhaa limesasishwa kikamilifu.',
  'Category name is required.': 'Jina la kundi linahitajika.',
  'Product registered successfully.': 'Bidhaa imesajiliwa kikamilifu.',
  'Product updated successfully.': 'Bidhaa imesasishwa kikamilifu.',
  'Product not found.': 'Bidhaa haikupatikana.',
  'Product name, category, and selling price (> 0 TZS) are required.':
    'Jina la bidhaa, kundi, na bei ya kuuzia (> 0 TZS) vinahitajika.',
  'Access denied: You are not authorized to change product purchase prices.':
    'Ufikiaji umezuiwa: Huna ruhusa ya kubadilisha bei za ununuzi za bidhaa.',
  'Supplier registered successfully.': 'Msambazaji amesajiliwa kikamilifu.',
  'Supplier updated successfully.': 'Taarifa za msambazaji zimesasishwa kikamilifu.',
  'Supplier not found.': 'Msambazaji hakupatikana.',
  'Supplier name and phone number are required.': 'Jina la msambazaji na namba ya simu vinahitajika.',
  'Supplier and valid payment amount (> 0 TZS) are required.':
    'Msambazaji na kiasi sahihi cha malipo (> 0 TZS) vinahitajika.',
  'Selected purchase order not found for this supplier.':
    'Agizo la manunuzi lililochaguliwa halikupatikana kwa msambazaji huyu.',
  'Supplier and at least one product line item are required.':
    'Msambazaji na angalau bidhaa moja vinahitajika.',
  'Every purchase item must specify a valid product and unit purchase price (> 0 TZS).':
    'Kila bidhaa ya manunuzi lazima iwe na bidhaa sahihi na bei ya ununuzi (> 0 TZS).',
  'Invalid stock adjustment type.': 'Aina ya marekebisho ya hisa si sahihi.',
  'Product, positive quantity, and adjustment reason are mandatory.':
    'Bidhaa, idadi chanya, na sababu ya marekebisho ni lazima.',
  'Product inventory record not found.': 'Kumbukumbu ya ghala la bidhaa haikupatikana.',
  'Employee registered successfully.': 'Mfanyakazi amesajiliwa kikamilifu.',
  'Employee and permissions updated successfully.': 'Mfanyakazi na ruhusa zimesasishwa kikamilifu.',
  'Employee full name and username are required.': 'Jina kamili na jina la mtumiaji vinahitajika.',
  'Username is already taken. Every employee must have a unique account.':
    'Jina la mtumiaji tayari linatumika. Kila mfanyakazi lazima awe na akaunti ya kipekee.',
  'Employee not found.': 'Mfanyakazi hakupatikana.',
  'You cannot delete your own account while logged in.':
    'Huwezi kufuta akaunti yako mwenyewe ukiwa umeingia mfumoni.',
  'Super Administrator / Shop Owner cannot be deleted.':
    'Msimamizi Mkuu / Mmiliki wa Duka hawezi kufutwa.',
  'New password must be at least 6 characters long.': 'Nenosiri jipya lazima liwe na angalau herufi 6.',
  'Failed to move uploaded file.': 'Imeshindikana kuhifadhi faili iliyopakiwa.',
  'No valid image file or data provided.': 'Hakuna faili au data sahihi ya picha iliyotolewa.',
  'Shop settings updated successfully.': 'Mipangilio ya duka imesasishwa kikamilifu.',
  'Backup generated and verified successfully.': 'Nakala ya dharura imetengenezwa na kuthibitishwa kikamilifu.',
  'A cash register session is already open. Please close the current shift first.':
    'Zamu ya droo ya fedha tayari ipo wazi. Tafadhali funga zamu ya sasa kwanza.',
  'No open cash register session found to close.': 'Hakuna zamu ya droo ya fedha iliyo wazi ya kufunga.',
  'Physically counted cash balance is required to close the register.':
    'Kiasi cha fedha kilichohesabiwa mkononi kinahitajika ili kufunga droo.',
  'Expense title and valid amount (> 0 TZS) are required.':
    'Kichwa cha matumizi na kiasi sahihi (> 0 TZS) vinahitajika.',
  'Original sale reference, returned product, and return reason are required.':
    'Rejeleo la mauzo ya awali, bidhaa iliyorudishwa, na sababu ya marejesho vinahitajika.',
  'Referenced original sale transaction not found.': 'Muamala wa mauzo ya awali haukupatikana.',
  'The selected product was not part of the referenced original sale.':
    'Bidhaa iliyochaguliwa haikuwa sehemu ya mauzo ya awali yaliyorejelewa.',
  'Original sale and product are required to register a warranty.':
    'Mauzo ya awali na bidhaa vinahitajika ili kusajili dhamana.',
  'Original sale not found.': 'Mauzo ya awali hayakupatikana.',
  'Warranty record and issue description are required.':
    'Kumbukumbu ya dhamana na maelezo ya tatizo vinahitajika.',
  'Invalid offline transactions payload.': 'Data ya miamala ya nje ya mtandao si sahihi.',
  'Transaction already synchronized; duplicate prevented.':
    'Muamala tayari umesawazishwa; nakala imezuiwa.',
  'Sale transaction not found.': 'Muamala wa mauzo haukupatikana.',
  'Access denied: You do not have permission to create sales.':
    'Ufikiaji umezuiwa: Huna ruhusa ya kufanya mauzo.',
  'At least one product is required in the shopping cart.':
    'Angalau bidhaa moja inahitajika kwenye kikapu.',
  'Invalid product or quantity in cart.': 'Bidhaa au idadi kwenye kikapu si sahihi.',
  'Access denied: You are not authorized to issue discounts.':
    'Ufikiaji umezuiwa: Huna ruhusa ya kutoa punguzo.',
  'A registered customer must be selected for partial-payment or zero-deposit credit sales.':
    'Mteja aliyesajiliwa lazima achaguliwe kwa mauzo ya malipo ya sehemu au mkopo bila amana.',
  'Credit sales are currently disabled in shop settings.':
    'Mauzo ya mkopo yamezimwa kwa sasa katika mipangilio ya duka.',
  'Selected customer account is not active.': 'Akaunti ya mteja aliyechaguliwa haifanyi kazi.',
  'Customer not found.': 'Mteja hakupatikana.',
  'Customer full name and phone number are required.': 'Jina kamili la mteja na namba ya simu vinahitajika.',
  'Customer updated successfully.': 'Taarifa za mteja zimesasishwa kikamilifu.',
  'Access denied: You are not authorized to record customer debt repayments.':
    'Ufikiaji umezuiwa: Huna ruhusa ya kurekodi malipo ya madeni ya wateja.',
  'An outstanding sale/invoice and a payment amount (> 0 TZS) are required.':
    'Ankara yenye deni na kiasi cha malipo (> 0 TZS) vinahitajika.',
  'Selected sale invoice was not found or is not active.':
    'Ankara ya mauzo iliyochaguliwa haikupatikana au haifanyi kazi.',
  'Failed to fetch': 'Imeshindikana kuwasiliana na seva. Hakikisha seva inafanya kazi.',
  // ── Pending Orders, Reorder Alerts & Approve Orders Module ────────────────
  'Approve Orders': 'Idhinisha Maagizo',
  'Approve Supplier Orders': 'Idhinisha Maagizo ya Wasambazaji',
  'Open Approve Orders': 'Fungua Idhinisho la Maagizo',
  '{count} Pending Supplier Order(s) Awaiting Approval':
    'Maagizo {count} ya Wasambazaji Yanasubiri Kuidhinishwa',
  'Once ordered stock arrives, approve the order to automatically update stock across the entire system.':
    'Mzigo ulioagizwa ukifika, idhinisha agizo ili mfumo usasishe hisa za bidhaa kiotomatiki kote.',
  'Pending Order (+{qty})': 'Agizo Linasubiri (+{qty})',
  'Order': 'Agiza',
  'Order from Supplier': 'Agiza kwa Msambazaji',
  'Reorder': 'Agiza Tena',
  'New Purchased & Old Products': 'Bidhaa Mpya Zilizonunuliwa na Bidhaa za Zamani',
  'Products approved by Admin appear immediately under New Purchased Products alongside existing old stock':
    'Bidhaa zinazoidhinishwa na Msimamizi huonekana mara moja kwenye Bidhaa Mpya Zilizonunuliwa pamoja na hisa ya zamani',
  'Old Products': 'Bidhaa za Zamani',
  'Old Stock': 'Hisa ya Zamani',
  'Purchased': 'Imenunuliwa',
  'Total Payable': 'Jumla ya Kulipa',
  'View Full Catalogue': 'Tazama Orodha Kamili',
  'No newly approved purchased products yet.': 'Bado hakuna bidhaa mpya zilizoidhinishwa.',
  '+{qty} approved': '+{qty} zimeidhinishwa',
  'No old stock products found.': 'Hakuna bidhaa za hisa ya zamani zilizopatikana.',
  'Track supplier stock orders, pending deliveries, weighted-average cost updates, and supplier balances':
    'Fuatilia maagizo ya mzigo, mizigo inayosubiri kufika, wastani wa gharama, na madeni ya wasambazaji',
  'ordered': 'zimeagizwa',
  'Pending Approval': 'Inasubiri Idhini',
  'Order Low / Out-of-Stock Product from Supplier': 'Agiza Bidhaa Iliyoisha au Chache kwa Msambazaji',
  'Place Supplier Purchase Order': 'Weka Agizo la Manunuzi kwa Msambazaji',
  'Admin-only ordering: orders stay Pending until goods arrive and are approved in Approve Orders':
    'Uagizaji ni wa Msimamizi pekee: maagizo hubaki Yanasubiri hadi mzigo ufike na kuidhinishwa',
  'Reordering Alert Item: {name} ({sku})': 'Kuagiza Bidhaa ya Tahadhari: {name} ({sku})',
  'Current Stock: {qty} · Minimum Level: {min}': 'Hisa ya Sasa: {qty} · Kiwango cha Chini: {min}',
  'Pending Approval Workflow': 'Mfumo wa Kusubiri Idhini',
  'Order Date': 'Tarehe ya Agizo',
  'Order Status': 'Hali ya Agizo',
  'Pending Order (Approve When Stock Arrives)': 'Agizo Linalosubiri (Idhinisha Mzigo Ukifika)',
  'Received Immediately (Increase Stock Now)': 'Imepokelewa Mara Moja (Ongeza Hisa Sasa)',
  'This order will be saved as Pending. Inventory stock will NOT change until the stock arrives and you approve it in the Approve Orders module.':
    'Agizo hili litahifadhiwa kama Linasubiri. Hisa hazitabadilika hadi mzigo ufike na ulithibitishe kwenye sehemu ya Idhinisha Maagizo.',
  'Ordered Products': 'Bidhaa Zilizowekwa Kwenye Agizo',
  'Remove row': 'Ondoa mstari',
  'Preferred Payment Method': 'Njia Inayopendelewa ya Malipo',
  'Order Grand Total': 'Jumla Kuu ya Agizo',
  'Order Notes / Supplier Instructions': 'Maelezo ya Agizo / Maagizo kwa Msambazaji',
  'e.g. Urgent restock delivery from Kariakoo supplier...':
    'mf. Mzigo wa haraka kutoka kwa msambazaji Kariakoo...',
  'Saving Order...': 'Inahifadhi Agizo...',
  'Place Pending Order': 'Weka Agizo Linalosubiri',
  'Only the Shop Admin can approve pending supplier orders and receive arrived stock.':
    'Msimamizi wa Duka pekee ndiye anayeweza kuidhinisha maagizo yanayosubiri na kupokea mzigo uliowasili.',
  'Review pending stock orders once delivered and approve them to automatically update stock across the entire app':
    'Kagua maagizo yanayosubiri mara tu mzigo unapowasili na uyathibitishe ili kusasisha hisa kiotomatiki kwenye mfumo mzima',
  'Pending Orders ({count})': 'Maagizo Yanayosubiri ({count})',
  'Approved Orders ({count})': 'Maagizo Yaliyoidhinishwa ({count})',
  'Loading supplier orders...': 'Inapakia maagizo ya wasambazaji...',
  'No Pending Supplier Orders': 'Hakuna Maagizo Yanayosubiri',
  'All placed supplier orders have been approved. You can place a new order from Low Stock Alerts or Purchases.':
    'Maagizo yote ya wasambazaji yameshaidhinishwa. Unaweza kuweka agizo jipya kutoka Tahadhari za Hisa au Manunuzi.',
  'Order {ref}': 'Agizo {ref}',
  'Supplier:': 'Msambazaji:',
  'Ordered:': 'Tarehe ya Agizo:',
  'By:': 'Na:',
  'Ordered products to approve': 'Bidhaa za agizo za kuidhinisha',
  'Ordered Qty': 'Kiasi Kilichoagizwa',
  'Arrived Qty': 'Kiasi Kilichofika',
  'New Stock After Approval': 'Hisa Mpya Baada ya Idhini',
  'unit': 'kipande',
  'Amount Paid on Arrival (TZS)': 'Kiasi Kilicholipwa Mzigo Ukifika (TZS)',
  'Approval Notes': 'Maelezo ya Idhini',
  'e.g. Stock verified & received': 'mf. Mzigo umekaguliwa na kupokelewa',
  'Approving...': 'Inaidhinisha...',
  'Approve & Update Stock': 'Idhinisha na Sasisha Hisa',
  'Approved orders history': 'Historia ya maagizo yaliyoidhinishwa',
  'Approved Items': 'Bidhaa Zilizoidhinishwa',
  'Approved By': 'Imeidhinishwa Na',
  'Approved Date': 'Tarehe ya Idhini',
  'Purchase order not found.': 'Agizo la manunuzi halikupatikana.',
  'This order has already been processed and cannot be approved again.':
    'Agizo hili tayari limeshashughulikiwa na haliwezi kuidhinishwa tena.',
  'This purchase order has no product items to approve.':
    'Agizo hili halina bidhaa za kuidhinisha.',
  'At least one product must have received quantity greater than 0 to approve this order.':
    'Angalau bidhaa moja lazima iwe na kiasi kilichopokelewa zaidi ya 0 ili kuidhinisha agizo hili.',
  'Only pending or draft orders can be cancelled.':
    'Maagizo yanayosubiri au rasimu pekee ndiyo yanaweza kufutwa.',
  'purchase.order_placed': 'Agizo la Msambazaji Limewekwa (Linasubiri)',
  'purchase.approved': 'Agizo la Manunuzi Limeidhinishwa',
  'purchase.cancelled': 'Agizo la Manunuzi Limefutwa',
  // ── Image Upload Feedback ─────────────────────────────────────────────────
  'Uploading image...': 'Inapakia picha...',
  'Please choose a valid image file (JPG, PNG, WebP, GIF, or SVG).':
    'Tafadhali chagua faili sahihi ya picha (JPG, PNG, WebP, GIF, au SVG).',
  'Image is too large (max 20MB).': 'Picha ni kubwa sana (kiwango cha juu ni 20MB).',
  '✓ Uploaded: {file}': '✓ Imepakiwa: {file}',
  'Saved offline preview (will upload when online)':
    'Picha imehifadhiwa nje ya mtandao (itapakiwa mtandao ukirejea)',
  'Failed to upload image. Please try again.':
    'Imeshindikana kupakia picha. Tafadhali jaribu tena.',
  'Failed to read selected image file.': 'Imeshindikana kusoma faili ya picha iliyochaguliwa.',
  'Image exceeds server upload size limit.': 'Picha imezidi kiwango cha ukubwa cha seva.',
  'Image exceeds maximum allowed form size.': 'Picha imezidi ukubwa unaoruhusiwa wa fomu.',
  'Image upload was interrupted. Please try again.': 'Upakiaji wa picha ulikatika. Tafadhali jaribu tena.',
  'No image file was received.': 'Hakuna faili ya picha iliyopokelewa.',
  'Failed to save uploaded image on server.': 'Imeshindikana kuhifadhi picha kwenye seva.',
  'Failed to write image file on server.': 'Imeshindikana kuandika faili ya picha kwenye seva.',
  'Failed to prepare uploads directory on server.': 'Imeshindikana kuandaa folda ya picha kwenye seva.',
  'Uploaded file not found.': 'Faili iliyopakiwa haikupatikana.',
  // ── Optional Digital & Printed Payment Receipt (POS) ──────────────────────
  'DIGITAL PAYMENT RECEIPT': 'RISITI YA MALIPO YA KIDIJITALI',
  'Digital Payment Receipt': 'Risiti ya Malipo ya Kidijitali',
  'Payment Receipt {receipt}': 'Risiti ya Malipo {receipt}',
  'CUSTOMER INFORMATION': 'TAARIFA ZA MTEJA',
  'ITEMS PURCHASED': 'BIDHAA ZILIZONUNULIWA',
  'WARRANTY DETAILS': 'MAELEZO YA DHAMANA',
  '{months}M Warranty': 'Dhamana Miezi {months}',
  'Email:': 'Barua Pepe:',
  'Address:': 'Anwani:',
  'Payment Method:': 'Njia ya Malipo:',
  'Payment Status:': 'Hali ya Malipo:',
  'Amount Paid:': 'Kiasi Kilicholipwa:',
  'Change Given:': 'Chenji Iliyorudishwa:',
  'Due Date:': 'Tarehe ya Mwisho wa Malipo:',
  'Expires:': 'Inaisha:',
  'Digital receipt shared!': 'Risiti ya kidijitali imeshirikiwa!',
  'WhatsApp': 'WhatsApp',
  'Digital Receipt': 'Risiti ya Kidijitali',
  'View Sale Details': 'Tazama Maelezo ya Mauzo',
  'Customer needs a payment receipt (Optional)': 'Mteja anahitaji risiti ya malipo (Hiari)',
  'Enabled': 'Imewashwa',
  'Skip': 'Ruka',
  'Receipt Customer:': 'Mteja wa Risiti:',
  'Walk-in Customer Info for Receipt (Optional)': 'Taarifa za Mteja wa Kawaida za Risiti (Hiari)',
  'Customer name': 'Jina la mteja',
  'Phone (+255...)': 'Simu (+255...)',
  'Show Print & Share Options': 'Onyesha Chaguo za Kuchapisha na Kushiriki',
  'Auto-Print After Pay': 'Chapisha Kiotomatiki Baada ya Malipo',
  'Share / Copy': 'Shiriki / Nakili',
  'Done': 'Maliza',
  'Close': 'Funga',
  // ── Meter-Based Selling (Carpets & Length Products) ───────────────────────
  'Selling Unit': 'Kipimo cha Mauzo',
  'Piece (pcs)': 'Kipande (pcs)',
  'Meter (m)': 'Mita (m)',
  'Meter (m) — e.g. Carpets': 'Mita (m) — mf. Mazulia (Carpets)',
  'Sold per Meter': 'Inauzwa kwa Mita',
  '{count} m in stock': 'Mita {count} ghalani',
  'Meters for {name}': 'Mita za {name}',
  'Quick Meters:': 'Mita za Haraka:',
  'Purchase Price per Meter (TZS)': 'Bei ya Kununulia kwa Mita (TZS)',
  'Selling Price per Meter (TZS)': 'Bei ya Kuuzia kwa Mita (TZS)',
  'Opening Stock (Meters)': 'Kiasi cha Awali (Mita)',
  'Minimum Stock Alert (Meters)': 'Tahadhari ya Chini ya Hisa (Mita)',
  'Quantity (Meters)': 'Kiasi (Mita)',

  // Pagination & Admin-Only Product Edit/Archive Guards
  'Pagination': 'Kurasa',
  'Showing {start}–{end} of {total}': 'Inaonyesha {start}–{end} kati ya {total}',
  'Per page:': 'Kwa ukurasa:',
  'Items per page': 'Vipengele kwa ukurasa',
  'Previous': 'Iliyopita',
  'Next': 'Inayofuata',
  'Previous page': 'Ukurasa uliopita',
  'Next page': 'Ukurasa unaofuata',
  'Page {page}': 'Ukurasa {page}',
  'Back to Products': 'Rudi kwenye Bidhaa',
  'Only the Shop Admin can edit or archive products.': 'Msimamizi wa Duka pekee ndiye anayeweza kuhariri au kuhifadhi bidhaa.',
  'Access denied: Only the Shop Admin can edit or archive products.': 'Ufikiaji umezuiwa: Msimamizi wa Duka pekee ndiye anayeweza kuhariri au kuhifadhi bidhaa.',

  // Login Portal Branding & Admin Account Settings
  'DIGITAL STORE MANAGEMENT PORTAL': 'MFUMO WA KIDIJITALI WA USIMAMIZI WA DUKA',
  'Sign in to your account': 'Ingia kwenye akaunti yako',
  'Developed by SOFT-LINK Africa Team': 'Imetengenezwa na SOFT-LINK Africa Team',
  '© {year} All rights reserved.': '© {year} Haki zote zimehifadhiwa.',
  'Admin Account': 'Akaunti ya Msimamizi',
  'Admin Account Settings': 'Mipangilio ya Akaunti ya Msimamizi',
  'Admin Profile & Login Identity': 'Wasifu wa Msimamizi na Taarifa za Kuingia',
  'Full Name': 'Jina Kamili',
  'Login Username': 'Jina la Mtumiaji (Username)',
  'admin@example.com': 'admin@mfano.com',
  'Save Account Profile': 'Hifadhi Wasifu wa Akaunti',
  'Change Admin Password': 'Badilisha Nenosiri la Msimamizi',
  'Current Password': 'Nenosiri la Sasa',
  'New Password': 'Nenosiri Jipya',
  'Confirm New Password': 'Thibitisha Nenosiri Jipya',
  'Enter current password': 'Weka nenosiri la sasa',
  'Minimum 6 characters': 'Angalau herufi 6',
  'Re-enter new password': 'Andika tena nenosiri jipya',
  'Sign out all other active devices after changing password': 'Ondoa vifaa vingine vyote vilivyoingia baada ya kubadilisha nenosiri',
  'Updating...': 'Inasasisha...',
  'Update Admin Password': 'Sasisha Nenosiri la Msimamizi',
  'Active Sessions': 'Vipindi Vinavyofanya Kazi',
  '{count} device(s)': 'Vifaa {count}',
  'Last login:': 'Kuingia kwa mwisho:',
  'Active Admin Login Sessions ({count})': 'Vipindi vya Kuingia vya Msimamizi ({count})',
  'Signing out...': 'Inatoka...',
  'Sign Out Other Devices': 'Ondoa Vifaa Vingine',
  'Last active:': 'Ilitumika mwisho:',
  'Current Device': 'Kifaa cha Sasa',
  'Active Session': 'Kipindi Kinachofanya Kazi',
  'Access denied: Admin account settings are reserved for the Shop Admin.': 'Ufikiaji umezuiwa: Mipangilio ya akaunti ya msimamizi ni ya Msimamizi wa Duka pekee.',
  'Admin full name and username are required.': 'Jina kamili la msimamizi na jina la mtumiaji vinahitajika.',
  'Username must be at least 3 characters with no spaces.': 'Jina la mtumiaji lazima liwe na angalau herufi 3 bila nafasi.',
  'Please enter a valid email address.': 'Tafadhali weka anwani sahihi ya barua pepe.',
  'This username is already used by another account.': 'Jina hili la mtumiaji tayari linatumika na akaunti nyingine.',
  'This email address is already used by another account.': 'Barua pepe hii tayari inatumika na akaunti nyingine.',
  'Admin account profile updated successfully.': 'Wasifu wa akaunti ya msimamizi umesasishwa kikamilifu.',
  'Current password and new password are required.': 'Nenosiri la sasa na nenosiri jipya vinahitajika.',
  'New password and confirmation do not match.': 'Nenosiri jipya na uthibitisho wake havilingani.',
  'Current password is incorrect.': 'Nenosiri la sasa si sahihi.',
  'Admin password updated successfully.': 'Nenosiri la msimamizi limesasishwa kikamilifu.',
  'Signed out all other active devices successfully.': 'Vifaa vingine vyote vimeondolewa kikamilifu.',

  // Responsive Navigation, Loading & Accessibility Labels
  'Loading workspace...': 'Inapakia nafasi ya kazi...',
  'Quick mobile navigation': 'Urambazaji wa haraka wa simu',
  'Menu': 'Menyu',
  'View Cart ({count}) · {total}': 'Tazama Kikapu ({count}) · {total}',
  'Request timed out. Please check your connection and try again.': 'Muda wa ombi umekwisha. Tafadhali kagua mtandao wako na ujaribu tena.',
  'Customer transactions': 'Miamala ya mteja',
  'Customer repayments': 'Malipo ya madeni ya mteja',
  'Supplier purchases': 'Manunuzi ya msambazaji',
  'Supplier payments': 'Malipo ya msambazaji',
  'Product returns table': 'Jedwali la marejesho ya bidhaa',
  'Warranties table': 'Jedwali la dhamana',
  'Warranty claims table': 'Jedwali la madai ya dhamana',
  'Product sales report': 'Ripoti ya mauzo ya bidhaa',
  'Category sales report': 'Ripoti ya mauzo kwa kundi',
  'Employee sales report': 'Ripoti ya mauzo kwa mfanyakazi',
  'Employees list': 'Orodha ya wafanyakazi',
  'Security audit logs': 'Kumbukumbu za ukaguzi wa usalama',
  'Offline mode detected automatically — transactions will sync once connection returns': 'Hali ya nje ya mtandao imegunduliwa kiotomatiki — miamala itasawazishwa mtandao ukirejea',
  'Connected to server — online status detected automatically': 'Imeunganishwa na seva — hali ya mtandaoni imegunduliwa kiotomatiki',

  // Employee Account Settings, Admin Username/Password Reset & Report Sharing
  'My Account': 'Akaunti Yangu',
  'My Account Settings': 'Mipangilio ya Akaunti Yangu',
  'Manage your login username, profile details, password, and active login sessions': 'Dhibiti jina lako la mtumiaji, taarifa za wasifu, nenosiri, na vifaa vilivyoingia',
  'My Profile & Login Username': 'Wasifu Wangu na Jina la Mtumiaji',
  'Change My Password': 'Badilisha Nenosiri Langu',
  'Update Password': 'Sasisha Nenosiri',
  'Active Login Sessions ({count})': 'Vipindi vya Kuingia ({count})',
  'Full name and username are required.': 'Jina kamili na jina la mtumiaji vinahitajika.',
  'Account profile updated successfully.': 'Wasifu wa akaunti umesasishwa kikamilifu.',
  'Password updated successfully.': 'Nenosiri limesasishwa kikamilifu.',
  'admin.account_updated': 'Wasifu wa Msimamizi Umesasishwa',
  'admin.password_changed': 'Nenosiri la Msimamizi Limebadilishwa',
  'admin.sessions_revoked': 'Vifaa Vingine vya Msimamizi Vimeondolewa',
  'user.account_updated': 'Wasifu wa Mfanyakazi Umesasishwa',
  'user.password_changed': 'Nenosiri la Mfanyakazi Limebadilishwa',
  'user.sessions_revoked': 'Vifaa Vingine vya Mfanyakazi Vimeondolewa',
  'employee.credentials_updated': 'Taarifa za Kuingia za Mfanyakazi Zimesasishwa',
  'Register new staff, edit usernames & reset passwords, delete accounts, and configure employee permissions': 'Sajili wafanyakazi wapya, hariri majina ya watumiaji na weka upya manenosiri, futa akaunti, na sanidi ruhusa',
  'Edit Username & Reset Password': 'Hariri Jina la Mtumiaji na Weka Upya Nenosiri',
  'Enter login username': 'Weka jina la mtumiaji',
  'New Password (Optional — minimum 6 characters)': 'Nenosiri Jipya (Hiari — angalau herufi 6)',
  'Leave blank to keep current password': 'Acha wazi ili kubaki na nenosiri la sasa',
  'Update username only, reset password only, or save both at once. Resetting the password signs out the account on other devices.': 'Sasisha jina la mtumiaji pekee, weka upya nenosiri pekee, au hifadhi vyote kwa pamoja. Kuweka upya nenosiri huondoa akaunti kwenye vifaa vingine.',
  'Save Credentials': 'Hifadhi Taarifa za Kuingia',
  'Credentials': 'Akaunti',
  'Please enter a new username or a new password (minimum 6 characters).': 'Tafadhali weka jina jipya la mtumiaji au nenosiri jipya (angalau herufi 6).',
  'Sales, Inventory, Customer, Supplier, and P&L statements with PDF, Excel & instant sharing': 'Taarifa za Mauzo, Hisa, Wateja, Wasambazaji na Faida & Hasara zenye PDF, Excel na kushiriki papo hapo',
  'Share Report': 'Shiriki Ripoti',
  'Report Summary Preview': 'Hakiki ya Muhtasari wa Ripoti',
  'Financial P&L Summary': 'Muhtasari wa Faida na Hasara (P&L)',
  'Top Products Sold': 'Bidhaa Zilizoongoza Kwa Mauzo',
  'Sales by Category': 'Mauzo kwa Kundi',
  '...and {count} more item(s)': '...na bidhaa nyingine {count}',
  'Generated on': 'Imetolewa tarehe',
  'Share': 'Shiriki',
  'Copy': 'Nakili',
  'Copied!': 'Imenakiliwa!',
  'Report summary copied to clipboard!': 'Muhtasari wa ripoti umenakiliwa!',
  'Could not copy report automatically. Please select and copy the text below.': 'Imeshindikana kunakili kiotomatiki. Tafadhali chagua na unakili maandishi hapa chini.',
  'Report shared successfully!': 'Ripoti imeshirikiwa kikamilifu!',
  'Sales, Customer, and Employee operational reports with PDF, Excel & instant sharing': 'Ripoti za uendeshaji za Mauzo, Wateja na Wafanyakazi zenye PDF, Excel na kushiriki papo hapo',
  'Access denied: Inventory & valuation reports are reserved for the Shop Admin.': 'Ufikiaji umezuiwa: Ripoti za ghala na thamani ya hisa ni za Msimamizi wa Duka pekee.',

  // Inter-Shop Product / Stock Transfers (Kuhamisha Bidhaa Kwenda Duka Lingine)
  'Transfer Products': 'Hamisha Bidhaa',
  'Transfer Product': 'Hamisha Bidhaa',
  'Transfer': 'Hamisha',
  'Transfer Product to Another Shop': 'Hamisha Bidhaa Kwenda Duka Lingine',
  'Transfer Products to Another Shop': 'Hamisha Bidhaa Kwenda Duka Lingine',
  'Dispatch products from {shop} to another shop/branch with receiver, carrier, IMEI/serial & printable delivery note': 'Tuma bidhaa kutoka {shop} kwenda duka au tawi lingine pamoja na taarifa za mpokeaji, mchukuzi, IMEI/serial na hati ya uhamisho',
  '+ New Product Transfer': '+ Hamisha Bidhaa Mpya',
  'Close Transfer Form': 'Funga Fomu ya Uhamisho',
  'New Inter-Shop Stock Transfer': 'Uhamisho Mpya wa Bidhaa Kwenda Duka Lingine',
  'From: {shop} — Stock is deducted automatically upon confirmation': 'Kutoka: {shop} — Hisa itapunguzwa kiotomatiki mara tu unapothibitisha',
  '1. Destination Shop & Receiver Information': '1. Taarifa za Duka Lengwa na Mpokeaji',
  '2. Dispatch, Reason & Transport Details': '2. Taarifa za Utoaji, Sababu na Usafirishaji',
  '3. Products to Transfer': '3. Bidhaa za Kuhamisha',
  'Destination Shop / Branch Name': 'Jina la Duka / Tawi Lengwa',
  'Destination Shop': 'Duka Lengwa',
  'Destination Shop & Receiver': 'Duka Lengwa na Mpokeaji',
  'Destination Location': 'Mahali Lilipo Duka Lengwa',
  'Destination Location / Address': 'Mahali / Anwani ya Duka Lengwa',
  'e.g. Kampango Branch 2 — Kariakoo': 'mf. Kampango Tawi la 2 — Kariakoo',
  'e.g. Aggrey Street / Mwanza / Arusha': 'mf. Mtaa wa Aggrey / Mwanza / Arusha',
  'Receiver': 'Mpokeaji',
  'Receiver Name': 'Jina la Mpokeaji',
  'Person receiving the goods': 'Mtu anayepokea bidhaa',
  'Receiver Phone': 'Namba ya Simu ya Mpokeaji',
  'Transfer Date': 'Tarehe ya Uhamisho',
  'Transfer Reason': 'Sababu ya Kuhamisha',
  'Delivery Status': 'Hali ya Uwasilishaji',
  'In Transit': 'Njiani (Haijafika)',
  'in_transit': 'Njiani',
  'In Transit (Confirm Upon Arrival)': 'Njiani (Thibitisha Mzigo Ukifika)',
  'Delivered / Received Immediately': 'Imefika / Imepokelewa Mara Moja',
  'Carrier / Driver': 'Mchukuzi / Dereva',
  'Carrier / Driver / Staff Name': 'Jina la Mchukuzi / Dereva / Mfanyakazi',
  'e.g. Bodaboda / Bus Courier / Staff name': 'mf. Bodaboda / Basi / Jina la Mfanyakazi',
  'Carrier Phone': 'Simu ya Mchukuzi',
  'Vehicle / Bus / Waybill #': 'Namba ya Gari / Basi / Risiti ya Mzigo',
  'Vehicle / Waybill #': 'Gari / Risiti ya Mzigo #',
  'e.g. T 123 ABC / Waybill #442': 'mf. T 123 ABC / Risiti #442',
  'Carrier & Reason': 'Mchukuzi na Sababu',
  'Add Another Product': 'Ongeza Bidhaa Nyingine',
  '-- Select Product --': '-- Chagua Bidhaa --',
  'Serial / IMEI (Optional)': 'Namba ya Serial / IMEI (Hiari)',
  'e.g. IMEI / S/N': 'mf. IMEI / S/N',
  'No in-stock products available to transfer right now.': 'Hakuna bidhaa zenye hisa za kuhamisha kwa sasa.',
  'No inter-shop product transfers recorded yet.': 'Bado hakuna uhamisho wa bidhaa uliorekodiwa.',
  'Loading transfers...': 'Inapakia orodha ya uhamisho...',
  'Additional Transfer Notes (Optional)': 'Maelezo ya Ziada ya Uhamisho (Hiari)',
  'e.g. Includes sealed boxes, warranty cards, charger cables...': 'mf. Ina maboksi yaliyofungwa, kadi za dhamana, nyaya za chaja...',
  'Confirm & Transfer Products': 'Thibitisha na Hamisha Bidhaa',
  'Transferring...': 'Inahamisha...',
  'All Transfers': 'Uhamisho Wote',
  'Total Transfers': 'Jumla ya Uhamisho',
  'Total Cost Transferred': 'Jumla ya Gharama Iliyohamishwa',
  'Total Retail Value Transferred': 'Jumla ya Thamani ya Mauzo Iliyohamishwa',
  'Total Units to Transfer': 'Jumla ya Idadi ya Kuhamisha',
  'Total Units': 'Jumla ya Idadi',
  'Total Items / Units': 'Jumla ya Aina / Idadi',
  'Total Cost Value': 'Jumla ya Thamani ya Gharama',
  'Total Retail Value': 'Jumla ya Thamani ya Mauzo',
  'Total Value': 'Jumla ya Thamani',
  'Retail Value': 'Thamani ya Mauzo',
  'Cost Total': 'Jumla ya Gharama',
  'Unit Cost': 'Gharama kwa Moja',
  'Cost': 'Gharama',
  'From Shop': 'Kutoka Duka',
  'Transfer #': 'Namba ya Uhamisho',
  'Transfer # & Date': 'Uhamisho # na Tarehe',
  'Products Transferred': 'Bidhaa Zilizohamishwa',
  'Transferred Products': 'Bidhaa Zilizohamishwa',
  'Transfer Recorded: {ref}': 'Uhamisho Umerekodiwa: {ref}',
  'STOCK TRANSFER DELIVERY NOTE': 'HATI YA UHAMISHO WA BIDHAA',
  'Verified Inter-Shop Stock Transfer Document': 'Hati Rasmi Iliyothibitishwa ya Uhamisho wa Bidhaa',
  'Dispatched By': 'Imetumwa Na',
  'Received By': 'Imepokelewa Na',
  'Print Note': 'Chapisha Hati',
  'Mark as Received': 'Thibitisha Imepokelewa',
  'Cancel & Restock': 'Ghairi na Rudisha Hisa',
  'Cancel transfer {ref} and return all transferred items back into your shop stock?': 'Ghairi uhamisho {ref} na urudishe bidhaa zote kwenye hisa za duka lako?',
  'Stock transfers history': 'Historia ya uhamisho wa bidhaa',
  'Transferring products to another shop can only be performed by the Shop Administrator.': 'Kuhamisha bidhaa kwenda duka lingine kunaweza kufanywa na Msimamizi wa Duka pekee.',
  'Branch Restock': 'Kuongeza Hisa Tawi Lingine',
  'Stock Balancing': 'Kusawazisha Hisa Kati ya Maduka',
  'Customer Order Transfer': 'Uhamisho wa Agizo la Mteja',
  'Showroom / Display Transfer': 'Uhamisho wa Maonyesho Dukani',
  'Emergency Shop Request': 'Ombi la Dharura la Duka Lingine',
  'Other': 'Nyingine',
  'transfer_out': 'Uhamisho Kwenda Duka Lingine',
  'transfer_cancel_return': 'Marejesho ya Uhamisho Uliofutwa',
  'StockTransfer': 'Uhamisho wa Bidhaa',
  'stock.transferred_out': 'Bidhaa Zimehamishwa Kwenda Duka Lingine',
  'stock.transfer_received': 'Uhamisho wa Bidhaa Umethibitishwa Kupokelewa',
  'stock.transfer_cancelled': 'Uhamisho wa Bidhaa Umeghairiwa (Hisa Imerudishwa)',
  'Destination shop name and receiver name are required.': 'Jina la duka lengwa na jina la mpokeaji vinahitajika.',
  'At least one product item is required to complete a transfer.': 'Angalau bidhaa moja inahitajika kukamilisha uhamisho.',
  'Every transferred product must have a valid product selection and positive quantity.': 'Kila bidhaa inayohamishwa lazima iwe sahihi na idadi zaidi ya sifuri.',
  'One of the selected products was not found or is archived.': 'Moja ya bidhaa zilizochaguliwa haikupatikana au imehifadhiwa.',
  'Stock transfer record not found.': 'Kumbukumbu ya uhamisho wa bidhaa haikupatikana.',
  'Only in-transit transfers can be marked as received.': 'Uhamisho ulio njiani pekee ndio unaoweza kuthibitishwa kupokelewa.',
  'Only in-transit transfers can be cancelled and restocked.': 'Uhamisho ulio njiani pekee ndio unaoweza kughairiwa na kurudishwa hisa.',

  // Admin Real-Time Top-of-App Notifications (Employee Sales, Sold-Out & Expenses)
  'Admin Notifications': 'Arifa za Msimamizi',
  'Admin Notifications ({count})': 'Arifa za Msimamizi ({count})',
  'Click a notification to view details and clear it': 'Bofya arifa ili kuona maelezo na kuiondoa',
  'Clear All': 'Futa Zote',
  'No new notifications — all caught up!': 'Hakuna arifa mpya — umeshakagua zote!',
  'Product Sold Out': 'Bidhaa Imeisha Hisa',
  'Product Sold Out: {product}': 'Bidhaa Imeisha Hisa: {product}',
  'Employee Expense': 'Matumizi ya Mfanyakazi',
  'Employee Sale': 'Mauzo ya Mfanyakazi',
  'Expense {ref}: {title}': 'Matumizi {ref}: {title}',
  'Sale {ref}': 'Mauzo {ref}',
  '{actor} sold out {product} (0 remaining)': '{actor} ameisha hisa ya {product} (zimebaki 0)',
  '{actor} recorded expense {title} ({amount})': '{actor} amerekodi matumizi {title} ({amount})',
  '{actor} completed sale {ref} ({amount})': '{actor} amekamilisha mauzo {ref} ({amount})',
  '{count} New Alert(s)': 'Arifa Mpya {count}',
  'Open & View': 'Fungua na Tazama',
  'View All ({count})': 'Tazama Zote ({count})',
  'Time': 'Muda',
  'Amount': 'Kiasi',
  'Notification opened and cleared from your alert bar.': 'Arifa imefunguliwa na kuondolewa kwenye mstari wa arifa.',
  'Open Inventory': 'Fungua Ghala',
  'Open Expenses': 'Fungua Matumizi',
  'View Sale Receipt': 'Tazama Risiti ya Mauzo',
  'Access denied: Admin notifications are reserved for the Shop Admin.': 'Ufikiaji umezuiwa: Arifa za msimamizi ni za Msimamizi wa Duka pekee.',

  // 3 Split Phone Categories, Product Specs (RAM/ROM/Storage GB), Box Packaging & Editable Stock
  'Used Phones (Simu Used)': 'Simu Used (Used Phones)',
  'Full Box Phones (Boxed)': 'Simu za Full Box (Boxed)',
  'Feature Phones (Simu Ndogo)': 'Simu Ndogo (Feature Phones)',
  'Pre-owned and refurbished smartphones with RAM and storage specifications': 'Simu janja zilizotumika (used) zenye taarifa za RAM na ukubwa wa hifadhi',
  'Brand-new sealed full-box smartphones with RAM and storage specifications': 'Simu janja mpya za full box (boxed) zenye taarifa za RAM na ukubwa wa hifadhi',
  'Compact keypad feature phones (simu ndogo)': 'Simu ndogo za vibonyezo (simu ndogo)',
  'Memory cards, USB flash drives, and pen drives with storage capacity and box packaging': 'Kadi za kumbukumbu (memory cards) na flash drives zenye ukubwa wa GB na maelezo ya maboksi',
  'Smartphone Specifications (RAM & ROM / Storage)': 'Vipimo vya Simu Janja (RAM na ROM / Hifadhi)',
  'RAM (GB)': 'RAM (GB)',
  'ROM / Storage (GB)': 'ROM / Hifadhi (GB)',
  'e.g. 4GB, 6GB, 8GB, 12GB': 'mf. 4GB, 6GB, 8GB, 12GB',
  'e.g. 64GB, 128GB, 256GB, 512GB': 'mf. 64GB, 128GB, 256GB, 512GB',
  'Flash Drive & Memory Card Specifications (Boxes & Storage GB)': 'Vipimo vya Flash Drive na Memory Card (Maboksi na Ukubwa wa GB)',
  'Device Storage (GB)': 'Ukubwa wa Hifadhi (GB)',
  'e.g. 16GB, 32GB, 64GB, 128GB': 'mf. 16GB, 32GB, 64GB, 128GB',
  'Number of Boxes': 'Idadi ya Maboksi',
  'Number of Boxes (Optional)': 'Idadi ya Maboksi (Hiari)',
  'Flash / Memory Cards per Box': 'Flash / Memory Card Kwenye Kila Boksi',
  'Items per Box (Optional)': 'Idadi ya Bidhaa Kwenye Kila Boksi (Hiari)',
  'This product is packaged in boxes (Optional)': 'Bidhaa hii iko kwenye mfumo wa maboksi (Hiari)',
  'Tip: Entering Number of Boxes and items per box automatically calculates the total stock quantity below (you can still adjust stock manually).': 'Dokezo: Kujaza idadi ya maboksi na idadi kwenye kila boksi hukokotoa jumla ya hisa kiotomatiki hapa chini (bado unaweza kurekebisha kiasi cha hisa mwenyewe).',
  'e.g. 4': 'mf. 4',
  'e.g. 5': 'mf. 5',
  'e.g. 12': 'mf. 12',
  'e.g. 20': 'mf. 20',
  '{boxes} box × {perBox} = {total} pcs': 'Maboksi {boxes} × {perBox} = vipande {total}',
  '{boxes} box × {perBox}/box': 'Maboksi {boxes} × {perBox}/boksi',
  '{boxes} boxes': 'Maboksi {boxes}',
  '{perBox} / box': '{perBox} / boksi',
  'Current Stock Quantity': 'Kiasi cha Hisa Kilichopo Sasa',
  'Current Stock Quantity (Meters)': 'Kiasi cha Hisa Kilichopo (Mita)',
  'Stock will update: {from} → {to} (recorded in Stock Movements)': 'Hisa itasasishwa: {from} → {to} (itarekodiwa kwenye Mzunguko wa Hisa)',
  'Stock quantity edited from Product Management': 'Kiasi cha hisa kimehaririwa kwenye Usimamizi wa Bidhaa',

  // Partial Order Arrival, Missing Ordered Products & PDF Export / Download / Share
  'Review pending stock orders once delivered, approve arrived quantities, and track or export missing ordered products as PDF': 'Kagua maagizo yanayosubiri mara yanapofika, idhinisha bidhaa zilizofika, na fuatilia au pakua ripoti ya PDF ya bidhaa zilizokosekana',
  'Missing Ordered Products': 'Bidhaa Zilizokosekana Kwenye Maagizo',
  'Missing ordered products': 'Bidhaa zilizokosekana kwenye maagizo',
  'Missing Ordered Products Report': 'Ripoti ya Bidhaa Zilizokosekana Kwenye Maagizo',
  'MISSING ORDERED PRODUCTS REPORT': 'RIPOTI YA BIDHAA ZILIZOKOSEKANA KWENYE MAAGIZO',
  'MISSING ORDERED PRODUCTS ({ref})': 'BIDHAA ZILIZOKOSEKANA KWENYE AGIZO ({ref})',
  'Missing Ordered Products ({ref})': 'Bidhaa Zilizokosekana Kwenye Agizo ({ref})',
  'Missing Qty': 'Zilizokosekana',
  'Missing Value': 'Thamani Iliyokosekana',
  'Total Payable (Arrived)': 'Jumla ya Kulipa (Zilizofika)',
  'Approve Arrived & Log Missing': 'Idhinisha Zilizofika & Rekodi Zilizokosekana',
  'Moved to Missing Ordered Products:': 'Zimehamishiwa Kwenye Bidhaa Zilizokosekana:',
  'View Missing Products': 'Tazama Bidhaa Zilizokosekana',
  'Partial delivery detected: {units} unit(s) across {lines} product(s) did not arrive and will automatically move to Missing Ordered Products after approval.': 'Mzigo umefika pungufu: vipande {units} katika bidhaa {lines} havijafika na vitahamishiwa kiotomatiki kwenye Bidhaa Zilizokosekana baada ya kuidhinisha.',
  'e.g. Some items missing from delivery': 'mf. Baadhi ya bidhaa hazikufika kwenye mzigo',
  'Unresolved Missing Lines': 'Bidhaa Zinazokosekana (Hazijatatuliwa)',
  'Missing Product Lines': 'Mistari ya Bidhaa Zilizokosekana',
  'Total Missing Units': 'Jumla ya Vipande Vilivyokosekana',
  'Total Missing Value (TZS)': 'Jumla ya Thamani Iliyokosekana (TZS)',
  'Search product, order ref, supplier...': 'Tafuta bidhaa, namba ya agizo, msambazaji...',
  'Filter missing status': 'Chuja kwa hali ya ukosefu',
  'Filter by supplier': 'Chuja kwa msambazaji',
  'Missing Only': 'Zilizokosekana Pekee',
  'Resolved Only': 'Zilizotatuliwa Pekee',
  'All Statuses': 'Hali Zote',
  'All Suppliers': 'Wasambazaji Wote',
  'Download PDF': 'Pakua PDF',
  'Share PDF': 'Shiriki PDF',
  'Export / Print PDF': 'Hamisha / Chapisha PDF',
  'Download Order Missing PDF': 'Pakua PDF ya Zilizokosekana za Agizo Hili',
  'Share Order Missing PDF': 'Shiriki PDF ya Zilizokosekana za Agizo Hili',
  'Order / Date': 'Agizo / Tarehe',
  'Product & SKU': 'Bidhaa na SKU',
  'Arrived': 'Zilizofika',
  'Resolved': 'Imetatuliwa',
  'Unresolved': 'Haijatatuliwa',
  'Receive': 'Pokea',
  'Receive Missing Stock': 'Pokea Hisa Zilizokosekana',
  'Receive Missing Ordered Stock': 'Pokea Bidhaa Zilizokuwa Zimekosekana',
  'Currently Missing:': 'Zilizokosekana Kwa Sasa:',
  'Quantity Arrived Now': 'Idadi Iliyofika Sasa',
  'Delivery Notes (Optional)': 'Maelezo ya Uwasilishaji (Hiari)',
  'e.g. Supplier delivered remaining balance': 'mf. Msambazaji ameleta mzigo uliobaki',
  'Confirm & Add to Stock': 'Thibitisha na Ongeza Kwenye Hisa',
  'Mark as Resolved': 'Weka Kama Imetatuliwa',
  'Open WhatsApp': 'Fungua WhatsApp',
  'No missing ordered products recorded for this filter.': 'Hakuna bidhaa zilizokosekana zilizorekodiwa kwa kichujio hiki.',
  'PDF downloaded successfully: {file}': 'Faili la PDF limepakuliwa kikamilifu: {file}',
  'Missing products PDF shared successfully!': 'Ripoti ya PDF ya bidhaa zilizokosekana imeshirikiwa kikamilifu!',
  'PDF downloaded ({file}) and summary copied. Attach the downloaded PDF to WhatsApp or Email to share.': 'Faili la PDF limepakuliwa ({file}) na muhtasari umenakiliwa. Ambatisha faili hilo la PDF kwenye WhatsApp au Barua Pepe ili kushiriki.',
  'There are no missing ordered products to export.': 'Hakuna bidhaa zilizokosekana za kuhamisha kwenye PDF.',
  'There are no missing ordered products to share.': 'Hakuna bidhaa zilizokosekana za kushiriki.',
  '{count} Missing →': 'Zilizokosekana {count} →',
  '{units} Missing': 'Zimekosekana {units}',
  'GRAND TOTAL (MISSING ORDERED PRODUCTS)': 'JUMLA KUU (BIDHAA ZILIZOKOSEKANA KWENYE MAAGIZO)',
  'Prepared / Verified By (Shop Admin)': 'Imeandaliwa / Imethibitishwa Na (Msimamizi wa Duka)',
  'Supplier Acknowledgement & Signature': 'Uthibitisho na Saini ya Msambazaji',
  'Digital Store Management Portal': 'Mfumo wa Kidijitali wa Usimamizi wa Duka',
  'Page': 'Ukurasa',
  'Filter:': 'Kichujio:',
  'Order:': 'Agizo:',
  'Arrived:': 'Zilizofika:',
  'Missing:': 'Zilizokosekana:',
  'Missing Line Items:': 'Bidhaa Zilizokosekana:',
  'Total Missing Units:': 'Jumla ya Vipande Vilivyokosekana:',
  'Total Missing Value:': 'Jumla ya Thamani Iliyokosekana:',
  'Missing Order Stock Received': 'Hisa Iliyokosekana Imepokelewa',
  'Missing Order Item Resolved': 'Bidhaa Iliyokosekana Imetatuliwa',
  'Missing order item record not found.': 'Kumbukumbu ya bidhaa iliyokosekana haikupatikana.',
  'This missing item has already been resolved.': 'Bidhaa hii iliyokosekana tayari imeshatatuliwa.',
  'At least one product must have received or missing quantity to process this order.': 'Angalau bidhaa moja lazima iwe na kiasi kilichofika au kilichokosekana ili kushughulikia agizo hili.',

  // TV Category & Screen Size (Inches)
  'TV': 'TV (Runinga)',
  'TV Remotes': 'Rimoti za TV',
  'Smart TVs, LED TVs, Solar TVs, and Digital Televisions with screen size (inches)': 'Smart TV, LED TV, Solar TV na runinga za kidijitali zenye ukubwa wa inchi',
  'Television remotes, decoders, and TV mounting accessories': 'Rimoti za TV, ving\'amuzi na vifaa vya kufungia TV',
  'TV Specifications (Screen Size / Inches)': 'Vipimo vya TV (Ukubwa wa Inchi)',
  'TV Screen Size (Inches)': 'TV Inchi Ngapi? (Ukubwa wa Skrini)',
  'e.g. 24", 32", 43", 55", 65"': 'mf. Inchi 24", 32", 43", 55", 65"',
  'TV {size}': 'TV {size}',

  // Extension Cables Category & Socket Count (Matundu)
  'Extension Cables': 'Extension Cables (Waya za Kuongeza Soketi)',
  'Power extension cables, surge protectors, and multi-socket power strips': 'Extension cables za umeme, surge protectors na soketi za matundu mengi',
  'Extension Cable Specifications (Number of Sockets)': 'Vipimo vya Extension Cable (Idadi ya Matundu)',
  'Number of Sockets / Outlets': 'Ina Matundu Mangapi? (Idadi ya Soketi)',
  'e.g. 3, 4, 6, 8': 'mf. 3, 4, 6, 8',
  '{count} Sockets': 'Matundu {count}',
  '{count}-Way': 'Matundu {count}',
  'Image is too large after compression (max 8MB).': 'Picha ni kubwa mno hata baada ya kupunguzwa ukubwa (kiwango cha juu ni 8MB).',

  // Sale Reversal & Stock Restoration (Admin)
  'Sale Reversed & Restocked': 'Mauzo Yamefutwa na Hisa Kurudishwa',
  'Reverse': 'Futa / Rudisha',
  'Reversing...': 'Inarudisha...',
  'Reverse Sale & Return Stock': 'Futa Mauzo & Rudisha Bidhaa',
  'Confirm Reverse & Return Stock': 'Thibitisha Kufuta & Kurudisha Hisa',
  'Receipt {ref} · {amount}': 'Risiti {ref} · {amount}',
  'This will permanently delete this sale record, return all sold product quantities back into inventory stock, and adjust cash/debt balances back to before the sale.': 'Hatua hii itafuta kumbukumbu ya mauzo haya, kurudisha bidhaa zote zilizouzwa kwenye hisa ya ghala, na kurekebisha hesabu za fedha na madeni kurudi kama kabla ya mauzo.',
  'Reason (Optional)': 'Sababu (Hiari)',
  'e.g. Test sale or cashier mistake': 'mf. Mauzo ya majaribio au kosa la mauzo',
  'Access denied: Only the Shop Admin can reverse sales and restore stock.': 'Ufikiaji umezuiwa: Msimamizi wa Duka pekee ndiye anayeweza kufuta mauzo na kurudisha hisa.',

  // Direct Camera Photo Capture for Products
  'Take Photo': 'Piga Picha',
  'Open Live Camera': 'Washa Kamera Moja Kwa Moja',
  'Starting camera...': 'Inawasha kamera...',
  'Capture Photo': 'Piga Picha Sasa',
  'Switch Camera': 'Badili Kamera',
  'Flip': 'Geuza',
  'Close Camera': 'Funga Kamera',
  'Use Phone Camera App': 'Tumia Kamera ya Simu',
  'Snap directly with rear camera & flash': 'Piga picha moja kwa moja kwa kamera ya nyuma na flash',
  'Live browser camera is not available here. Please use "Use Phone Camera App" below.': 'Kamera ya moja kwa moja ya kivinjari haipatikani hapa. Tafadhali tumia "Tumia Kamera ya Simu" hapa chini.',
  'Camera permission was denied. Allow camera access in your browser or use "Use Phone Camera App" below.': 'Ruhusa ya kamera imekataliwa. Ruhusu kamera kwenye kivinjari chako au tumia "Tumia Kamera ya Simu" hapa chini.',
  'No camera was detected on this device.': 'Hakuna kamera iliyopatikana kwenye kifaa hiki.',
  'Could not start live camera. Try "Use Phone Camera App" below.': 'Imeshindikana kuwasha kamera moja kwa moja. Jaribu "Tumia Kamera ya Simu" hapa chini.',
  'Camera is still focusing. Please try capturing again.': 'Kamera bado inajipanga. Tafadhali jaribu kupiga picha tena.',
  'Failed to capture photo from camera. Please try again.': 'Imeshindikana kupiga picha kutoka kwenye kamera. Tafadhali jaribu tena.',
};

// Build case-insensitive lookup map for SW_DICTIONARY
const LOWER_SW_MAP = {};
for (const [k, v] of Object.entries(SW_DICTIONARY)) {
  LOWER_SW_MAP[k.toLowerCase()] = v;
}

function interpolate(str, params) {
  if (!params || typeof params !== 'object') return str;
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined && params[k] !== null ? String(params[k]) : `{${k}}`
  );
}

/**
 * Translates dynamic backend-generated messages into Kiswahili using patterns.
 */
function translateDynamicSw(text) {
  let m;

  if ((m = text.match(/^Sale\s+(.+?)\s+completed successfully\.?$/i))) {
    return `Mauzo ${m[1]} yamekamilika kikamilifu.`;
  }
  if ((m = text.match(/^Sale\s+(.+?)\s+reversed and product stock restored successfully\.?$/i))) {
    return `Mauzo ${m[1]} yamefutwa na bidhaa zimerudishwa kwenye hisa kikamilifu.`;
  }
  if ((m = text.match(/^Sale\s+(.+?)\s+is already fully paid\.?$/i))) {
    return `Mauzo ${m[1]} tayari yamelipwa kikamilifu.`;
  }
  if ((m = text.match(/^Purchase\s+(.+?)\s+saved successfully\.?$/i))) {
    return `Manunuzi ${m[1]} yamehifadhiwa kikamilifu.`;
  }
  if ((m = text.match(/^Purchase\s+(.+?)\s+saved and stock updated successfully\.?$/i))) {
    return `Manunuzi ${m[1]} yamehifadhiwa na hisa zimesasishwa kikamilifu.`;
  }
  if ((m = text.match(/^Order\s+(.+?)\s+placed with Pending status\./i))) {
    return `Agizo ${m[1]} limewekwa katika hali ya Kusubiri. Liidhinishe kwenye sehemu ya Idhinisha Maagizo mara mzigo utakapowasili.`;
  }
  if ((m = text.match(/^Order\s+(.+?)\s+approved!\s*Stock automatically updated/i))) {
    return `Agizo ${m[1]} limeidhinishwa! Hisa za bidhaa zimesasishwa kiotomatiki kwenye mfumo mzima.`;
  }
  if ((m = text.match(/^Order\s+(.+?)\s+approved for arrived items!\s*(\d+)\s+missing item\(s\) moved to Missing Ordered Products\.?$/i))) {
    return `Agizo ${m[1]} limeidhinishwa kwa bidhaa zilizofika! Bidhaa ${m[2]} zilizokosekana zimehamishiwa kwenye Bidhaa Zilizokosekana Kwenye Maagizo.`;
  }
  if ((m = text.match(/^Received\s+(.+?)\s+missing unit\(s\) of\s+(.+?)\.\s*Stock updated and missing item resolved!?$/i))) {
    return `Vipande ${m[1]} vilivyokuwa vimekosekana vya ${m[2]} vimepokelewa. Hisa imesasishwa na ukosefu umetatuliwa!`;
  }
  if ((m = text.match(/^Received\s+(.+?)\s+unit\(s\) of\s+(.+?)\.\s*(.+?)\s+still missing\.?$/i))) {
    return `Vipande ${m[1]} vya ${m[2]} vimepokelewa. Vipande ${m[3]} bado vinakosekana.`;
  }
  if ((m = text.match(/^Missing item\s+'(.+?)'\s+marked as resolved\.?$/i))) {
    return `Bidhaa iliyokosekana '${m[1]}' imewekwa kama imetatuliwa.`;
  }
  if ((m = text.match(/^Pending order\s+(.+?)\s+has been cancelled\.?$/i))) {
    return `Agizo linalosubiri ${m[1]} limefutwa.`;
  }
  if ((m = text.match(/^Approved & received order\s+(.+)$/i))) {
    return `Agizo ${m[1]} limeidhinishwa na kupokelewa`;
  }
  if ((m = text.match(/^Goods received on Purchase\s+(.+)$/i))) {
    return `Mzigo umepokelewa kwenye Manunuzi ${m[1]}`;
  }
  if ((m = text.match(/^Supplier payment\s+(.+?)\s+recorded and supplier liability reduced\.?$/i))) {
    return `Malipo ya msambazaji ${m[1]} yamerekodiwa na deni la msambazaji limepunguzwa.`;
  }
  if ((m = text.match(/^Stock adjustment recorded\.\s*Stock changed from\s+(.+?)\s+to\s+(.+?)\.?$/i))) {
    return `Marekebisho ya hisa yamerekodiwa. Hisa imebadilika kutoka ${m[1]} kwenda ${m[2]}.`;
  }
  if ((m = text.match(/^Password for\s+(@\S+)\s+was reset successfully\.?$/i))) {
    return `Nenosiri la ${m[1]} limewekwa upya kikamilifu.`;
  }
  if ((m = text.match(/^Username\s+\((@\S+)\)\s+and password were updated successfully\.?$/i))) {
    return `Jina la mtumiaji (${m[1]}) na nenosiri vimesasishwa kikamilifu.`;
  }
  if ((m = text.match(/^Username updated from\s+(@\S+)\s+to\s+(@\S+)\s+successfully\.?$/i))) {
    return `Jina la mtumiaji limebadilishwa kutoka ${m[1]} kwenda ${m[2]} kikamilifu.`;
  }
  if ((m = text.match(/^Transfer\s+(.+?)\s+recorded successfully and shop stock updated\.?$/i))) {
    return `Uhamisho ${m[1]} umerekodiwa kikamilifu na hisa ya duka imesasishwa.`;
  }
  if ((m = text.match(/^Transfer\s+(.+?)\s+marked as received\.?$/i))) {
    return `Uhamisho ${m[1]} umethibitishwa kuwa umepokelewa.`;
  }
  if ((m = text.match(/^Transfer\s+(.+?)\s+cancelled and stock restored to inventory\.?$/i))) {
    return `Uhamisho ${m[1]} umeghairiwa na hisa imerudishwa ghalani.`;
  }
  if ((m = text.match(/^Transferred to\s+(.+?)\s*\((.+?)\)$/i))) {
    const rsn = SW_DICTIONARY[m[2]] || LOWER_SW_MAP[m[2].toLowerCase()] || m[2];
    return `Imehamishwa kwenda ${m[1]} (${rsn})`;
  }
  if ((m = text.match(/^Cancelled transfer\s+(.+?)\s+—\s+stock returned to shop$/i))) {
    return `Uhamisho ${m[1]} umeghairiwa — hisa imerudishwa dukani`;
  }
  if ((m = text.match(/^Cash session\s+(.+?)\s+opened with TZS\s+(.+?)\.?$/i))) {
    return `Zamu ya fedha ${m[1]} imefunguliwa kwa kianzio cha TZS ${m[2]}.`;
  }
  if ((m = text.match(/^Cash session\s+(.+?)\s+closed and reconciled\.?$/i))) {
    return `Zamu ya fedha ${m[1]} imefungwa na kupatanishwa.`;
  }
  if ((m = text.match(/^Expense\s+(.+?)\s+recorded and reflected in cash register\.?$/i))) {
    return `Matumizi ${m[1]} yamerekodiwa na kuingizwa kwenye droo ya fedha.`;
  }
  if ((m = text.match(/^Return\s+(.+?)\s+processed\s*\((.+?)\)\.?$/i))) {
    const cond = SW_DICTIONARY[m[2]] || LOWER_SW_MAP[m[2].toLowerCase()] || m[2];
    return `Marejesho ${m[1]} yameshughulikiwa (${cond}).`;
  }
  if ((m = text.match(/^Warranty\s+(.+?)\s+registered\.\s*Expiry date:\s*(.+?)\.?$/i))) {
    return `Dhamana ${m[1]} imesajiliwa. Tarehe ya kumalizika: ${m[2]}.`;
  }
  if ((m = text.match(/^Warranty claim\s+(.+?)\s+saved\s*\((.+?)\)\.?$/i))) {
    const res = SW_DICTIONARY[m[2]] || LOWER_SW_MAP[m[2].toLowerCase()] || m[2];
    return `Dai la dhamana ${m[1]} limehifadhiwa (${res}).`;
  }
  if ((m = text.match(/^Repayment\s+(.+?)\s+recorded\.\s*Remaining balance:\s*TZS\s+(.+?)\.?$/i))) {
    return `Malipo ya deni ${m[1]} yamerekodiwa. Baki iliyobaki: TZS ${m[2]}.`;
  }
  if ((m = text.match(/^Repayment\s+(.+?)\s+was already recorded\.?$/i))) {
    return `Malipo ya deni ${m[1]} tayari yalikuwa yamerekodiwa.`;
  }
  if ((m = text.match(/^Transaction\s+(.+?)\s+was already processed\s*\(duplicate prevented\)\.?$/i))) {
    return `Muamala ${m[1]} tayari ulishashughulikiwa (nakala imezuiwa).`;
  }
  if ((m = text.match(/^Product\s+(.+?)\s+(archived|restored|activated)/i))) {
    const verb = m[2].toLowerCase() === 'archived' ? 'imehifadhiwa' : 'imerejeshwa';
    return `Bidhaa ${m[1]} ${verb} kikamilifu.`;
  }
  if ((m = text.match(/^Employee\s+(.+?)\s+deleted/i))) {
    return `Mfanyakazi ${m[1]} amefutwa kikamilifu.`;
  }
  if ((m = text.match(/^A product with SKU\s+'(.+?)'\s+already exists\.?$/i))) {
    return `Bidhaa yenye SKU '${m[1]}' tayari ipo.`;
  }
  if ((m = text.match(/^Insufficient stock for\s+'(.+?)'\.\s*Available:\s*(\d+),\s*Requested:\s*(\d+)\.?$/i))) {
    return `Hisa haitoshi kwa '${m[1]}'. Iliyopo: ${m[2]}, Iliyoombwa: ${m[3]}.`;
  }
  if ((m = text.match(/^Unauthorized discount:\s*Requested discount\s*\((.+?)%\)\s*exceeds your maximum authorized limit of\s*(.+?)%\.?$/i))) {
    return `Punguzo halijaidhinishwa: Punguzo lililoombwa (${m[1]}%) linazidi kikomo chako cha juu cha ${m[2]}%.`;
  }
  if ((m = text.match(/^Access denied:\s*You do not have permission\s*\((.+?)\)/i))) {
    return `Ufikiaji umezuiwa: Huna ruhusa (${m[1]}).`;
  }
  if ((m = text.match(/^Cannot complete stock adjustment:\s*resulting stock\s*\((.+?)\)\s*would be negative\.\s*Available stock is\s*(.+?)\.?$/i))) {
    return `Imeshindikana kurekebisha hisa: hisa inayotokea (${m[1]}) itakuwa hasi. Hisa iliyopo ni ${m[2]}.`;
  }
  if ((m = text.match(/^Return quantity\s*\((\d+)\)\s*exceeds remaining sold quantity\s*\((\d+)\)\s*on\s+(.+?)\.?$/i))) {
    return `Idadi ya marejesho (${m[1]}) inazidi idadi iliyouzwa iliyobaki (${m[2]}) kwenye ${m[3]}.`;
  }
  if ((m = text.match(/^Product ID\s+(\d+)\s+is unavailable or archived\.?$/i))) {
    return `Bidhaa namba ${m[1]} haipatikani au imehifadhiwa.`;
  }
  if ((m = text.match(/^Payment amount cannot exceed the purchase outstanding balance of TZS\s+(.+?)\.?$/i))) {
    return `Kiasi cha malipo hakiwezi kuzidi baki ya deni la manunuzi ya TZS ${m[1]}.`;
  }
  if ((m = text.match(/^Payment exceeds total supplier outstanding liability of TZS\s+(.+?)\.?$/i))) {
    return `Malipo yanazidi jumla ya deni la msambazaji la TZS ${m[1]}.`;
  }
  if ((m = text.match(/^Customer credit limit exceeded:\s*(.+)$/i))) {
    return `Kikomo cha mkopo cha mteja kimepitwa: ${m[1]}`;
  }
  if ((m = text.match(/^Repayment amount\s*\(TZS\s+(.+?)\)\s*exceeds/i))) {
    return `Kiasi cha malipo ya deni (TZS ${m[1]}) kinazidi baki inayodaiwa.`;
  }
  if ((m = text.match(/^Request failed with status\s+(\d+)$/i))) {
    return `Ombi limeshindikana (msimbo wa hitilafu ${m[1]}).`;
  }
  if ((m = text.match(/^Toggled permission\s+(.+)$/i))) {
    return `Ruhusa ${m[1]} imebadilishwa`;
  }
  if ((m = text.match(/^POS Sale\s+(.+)$/i))) {
    return `Mauzo ya POS ${m[1]}`;
  }
  if ((m = text.match(/^Debt Repayment\s+(.+)$/i))) {
    return `Malipo ya Deni ${m[1]}`;
  }
  if ((m = text.match(/^Expense:\s*(.+)$/i))) {
    return `Matumizi: ${m[1]}`;
  }
  if ((m = text.match(/^Supplier Payment\s+(.+)$/i))) {
    return `Malipo ya Msambazaji ${m[1]}`;
  }
  if ((m = text.match(/^Return Refund\s+(.+)$/i))) {
    return `Marejesho ya Pesa ${m[1]}`;
  }

  return null;
}

export function getStoredLanguage() {
  return localStorage.getItem('esms_lang') || 'en';
}

export function setStoredLanguage(lang) {
  localStorage.setItem('esms_lang', lang);
}

/**
 * Translates an English string, key, enum, or backend message into the active language.
 * Supports interpolation: t('Only {count} units available.', { count: 3 })
 * Also remains backward-compatible if 2nd argument is 'en' | 'sw'.
 */
export function t(keyOrText, paramsOrLang, explicitLang) {
  if (keyOrText === null || keyOrText === undefined) return '';
  const raw = String(keyOrText);
  if (!raw) return raw;

  let params = null;
  let currentLang = explicitLang;
  if (typeof paramsOrLang === 'string' && (paramsOrLang === 'en' || paramsOrLang === 'sw')) {
    currentLang = paramsOrLang;
  } else if (paramsOrLang && typeof paramsOrLang === 'object') {
    params = paramsOrLang;
  }
  if (!currentLang) {
    currentLang = getStoredLanguage();
  }

  // English mode: resolve canonical key/enum display labels if present, then interpolate
  if (currentLang !== 'sw') {
    const enBase = EN_KEY_LABELS[raw] || raw;
    return interpolate(enBase, params);
  }

  // Kiswahili mode:
  // 1. Direct lookup on raw key (covers snake_case enums & exact strings)
  if (SW_DICTIONARY[raw]) {
    return interpolate(SW_DICTIONARY[raw], params);
  }

  // 2. If raw is a legacy key in EN_KEY_LABELS, look up its English text in SW_DICTIONARY
  if (EN_KEY_LABELS[raw]) {
    const mappedEn = EN_KEY_LABELS[raw];
    if (SW_DICTIONARY[mappedEn]) {
      return interpolate(SW_DICTIONARY[mappedEn], params);
    }
    if (LOWER_SW_MAP[mappedEn.toLowerCase()]) {
      return interpolate(LOWER_SW_MAP[mappedEn.toLowerCase()], params);
    }
  }

  // 3. Trimmed & case-insensitive exact match
  const trimmed = raw.trim();
  if (SW_DICTIONARY[trimmed]) {
    return interpolate(raw.replace(trimmed, SW_DICTIONARY[trimmed]), params);
  }
  const lowerTrimmed = trimmed.toLowerCase();
  if (LOWER_SW_MAP[lowerTrimmed]) {
    return interpolate(raw.replace(trimmed, LOWER_SW_MAP[lowerTrimmed]), params);
  }

  // 4. Dynamic backend messages & patterns
  const dynamicSw = translateDynamicSw(trimmed);
  if (dynamicSw) {
    return interpolate(dynamicSw, params);
  }

  // Fallback: return original string with interpolated params
  return interpolate(raw, params);
}

// React Context for Global Language Management
export const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  toggleLanguage: () => {},
  t: (str, params) => t(str, params, 'en'),
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getStoredLanguage());

  const setLang = (newLang) => {
    const valid = newLang === 'sw' ? 'sw' : 'en';
    setStoredLanguage(valid);
    setLangState(valid);
  };

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'sw' : 'en');
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title =
      lang === 'sw'
        ? 'KAMPANGO PHONES AND ELECTRONICS — Mfumo wa Usimamizi'
        : 'KAMPANGO PHONES AND ELECTRONICS';
  }, [lang]);

  const translate = (str, paramsOrLang) => {
    if (typeof paramsOrLang === 'string' && (paramsOrLang === 'en' || paramsOrLang === 'sw')) {
      return t(str, null, paramsOrLang);
    }
    return t(str, paramsOrLang, lang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLanguage, t: translate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
