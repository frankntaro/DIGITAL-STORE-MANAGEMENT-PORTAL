import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FolderKanban,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Receipt,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sun,
  Truck,
  UserCog,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import LoginScreen from './screens/LoginScreen';

const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const PosScreen = lazy(() =>
  import('./screens/PosSalesScreens').then((m) => ({ default: m.PosScreen }))
);
const SalesHistoryScreen = lazy(() =>
  import('./screens/PosSalesScreens').then((m) => ({ default: m.SalesHistoryScreen }))
);
const SaleDetailsScreen = lazy(() =>
  import('./screens/PosSalesScreens').then((m) => ({ default: m.SaleDetailsScreen }))
);
const ProductsScreen = lazy(() =>
  import('./screens/ProductInventoryScreens').then((m) => ({ default: m.ProductsScreen }))
);
const AddEditProductScreen = lazy(() =>
  import('./screens/ProductInventoryScreens').then((m) => ({ default: m.AddEditProductScreen }))
);
const CategoriesScreen = lazy(() =>
  import('./screens/ProductInventoryScreens').then((m) => ({ default: m.CategoriesScreen }))
);
const PurchasesScreen = lazy(() =>
  import('./screens/ProductInventoryScreens').then((m) => ({ default: m.PurchasesScreen }))
);
const ApproveOrdersScreen = lazy(() =>
  import('./screens/ProductInventoryScreens').then((m) => ({ default: m.ApproveOrdersScreen }))
);
const NewPurchaseScreen = lazy(() =>
  import('./screens/ProductInventoryScreens').then((m) => ({ default: m.NewPurchaseScreen }))
);
const InventoryScreen = lazy(() =>
  import('./screens/ProductInventoryScreens').then((m) => ({ default: m.InventoryScreen }))
);
const StockAdjustmentsScreen = lazy(() =>
  import('./screens/ProductInventoryScreens').then((m) => ({ default: m.StockAdjustmentsScreen }))
);
const CustomersScreen = lazy(() =>
  import('./screens/CustomerSupplierScreens').then((m) => ({ default: m.CustomersScreen }))
);
const CustomerProfileScreen = lazy(() =>
  import('./screens/CustomerSupplierScreens').then((m) => ({ default: m.CustomerProfileScreen }))
);
const DebtManagementScreen = lazy(() =>
  import('./screens/CustomerSupplierScreens').then((m) => ({ default: m.DebtManagementScreen }))
);
const DebtRepaymentScreen = lazy(() =>
  import('./screens/CustomerSupplierScreens').then((m) => ({ default: m.DebtRepaymentScreen }))
);
const SuppliersScreen = lazy(() =>
  import('./screens/CustomerSupplierScreens').then((m) => ({ default: m.SuppliersScreen }))
);
const SupplierProfileScreen = lazy(() =>
  import('./screens/CustomerSupplierScreens').then((m) => ({ default: m.SupplierProfileScreen }))
);
const ExpensesScreen = lazy(() =>
  import('./screens/FinanceOperationsScreens').then((m) => ({ default: m.ExpensesScreen }))
);
const CashRegisterScreen = lazy(() =>
  import('./screens/FinanceOperationsScreens').then((m) => ({ default: m.CashRegisterScreen }))
);
const ReturnsWarrantyScreen = lazy(() =>
  import('./screens/FinanceOperationsScreens').then((m) => ({ default: m.ReturnsWarrantyScreen }))
);
const ReportsScreen = lazy(() =>
  import('./screens/FinanceOperationsScreens').then((m) => ({ default: m.ReportsScreen }))
);
const EmployeesPermissionsScreen = lazy(() =>
  import('./screens/FinanceOperationsScreens').then((m) => ({ default: m.EmployeesPermissionsScreen }))
);
const SettingsScreen = lazy(() =>
  import('./screens/FinanceOperationsScreens').then((m) => ({ default: m.SettingsScreen }))
);
import {
  apiRequest,
  checkServerConnectivity,
  getAuthToken,
  getOfflineQueue,
  refreshOfflineBootstrap,
  setAuthToken,
  synchronizeOfflineQueue,
} from './services/api';
import { hasPermission } from './utils/format';
import { useLanguage } from './utils/i18n';

const NAV_ITEMS = [
  { id: 'dashboard', screenNo: 2, label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
  { id: 'pos', screenNo: 3, label: 'Point of Sale (POS)', icon: ShoppingCart, perm: 'pos.sell' },
  { id: 'sales', screenNo: 4, label: 'Sales History', icon: Receipt, perm: ['sales.view', 'pos.sell'] },
  { id: 'products', screenNo: 6, label: 'Products', icon: Package, perm: 'products.view' },
  { id: 'categories', screenNo: 8, label: 'Categories', icon: FolderKanban, perm: 'products.view' },
  { id: 'purchases', screenNo: 9, label: 'Purchases', icon: Truck, perm: 'purchases.view' },
  { id: 'approve_orders', screenNo: 10, label: 'Approve Orders', icon: CheckCircle2, perm: 'purchases.manage' },
  { id: 'inventory', screenNo: 11, label: 'Inventory', icon: Boxes, perm: ['inventory.view', 'products.view'] },
  { id: 'stock_adjustments', screenNo: 12, label: 'Stock Adjustments', icon: SlidersHorizontal, perm: 'inventory.adjust' },
  { id: 'customers', screenNo: 13, label: 'Customers', icon: Users, perm: ['customers.view', 'pos.sell'] },
  { id: 'debts', screenNo: 15, label: 'Customer Debts', icon: CreditCard, perm: ['debts.view', 'customers.view'] },
  { id: 'debt_repayment', screenNo: 16, label: 'Debt Repayment', icon: Wallet, perm: 'debts.repay' },
  { id: 'suppliers', screenNo: 17, label: 'Suppliers', icon: Building2, perm: ['suppliers.view', 'purchases.view'] },
  { id: 'expenses', screenNo: 19, label: 'Expenses', icon: ClipboardList, perm: ['expenses.view', 'expenses.manage'] },
  { id: 'cash_register', screenNo: 20, label: 'Cash Register', icon: ShoppingBag, perm: ['cash_register.operate', 'cash_register.review'] },
  { id: 'returns_warranty', screenNo: 21, label: 'Returns & Warranty', icon: RotateCcw, perm: ['returns.manage', 'warranties.manage'] },
  { id: 'reports', screenNo: 22, label: 'Reports & Analytics', icon: BarChart3, perm: ['reports.operational', 'reports.financial'] },
  { id: 'employees', screenNo: 23, label: 'Employees & RBAC', icon: ShieldCheck, perm: 'employees.manage' },
  { id: 'account_settings', screenNo: 24, label: 'My Account', icon: UserCog, perm: null },
  { id: 'settings', screenNo: 25, label: 'Settings', icon: Settings, perm: 'settings.manage' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState(null);

  // Internationalization (Swahili & English) and Theme State (Dark & White)
  const { lang, setLang, toggleLanguage, t } = useLanguage();
  const [theme, setTheme] = useState(localStorage.getItem('esms_theme') || 'light');

  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [selectedSaleId, setSelectedSaleId] = useState(1);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [productPurchaseFilter, setProductPurchaseFilter] = useState('all');
  const [orderPrefillProduct, setOrderPrefillProduct] = useState(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState(1);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Apply dark mode theme class to <html>
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('esms_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('esms_theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Automatic Offline / Online Detection State
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [syncBanner, setSyncBanner] = useState(null);
  const wasOfflineRef = useRef(!navigator.onLine);
  const syncingRef = useRef(false);

  const refreshQueueCount = async () => {
    const q = await getOfflineQueue();
    const pending = q.filter((i) => i.status === 'pending' || i.status === 'conflict');
    setPendingQueueCount(pending.length);
  };

  const refreshPendingOrdersCount = async (activeUser = user) => {
    if (!activeUser || !hasPermission(activeUser, 'purchases.manage')) {
      setPendingOrdersCount(0);
      return;
    }
    try {
      const res = await apiRequest('/purchases?status=pending');
      setPendingOrdersCount(Number(res.pending_count ?? (res.purchases || []).length));
    } catch {
      // ignore offline error
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    apiRequest('/auth/me')
      .then((res) => {
        setUser(res.user);
        setSettings(res.settings);
        try {
          localStorage.setItem('esms_cached_user', JSON.stringify(res.user));
          localStorage.setItem('esms_cached_settings', JSON.stringify(res.settings));
        } catch {}
        refreshOfflineBootstrap();
        refreshQueueCount();
        refreshPendingOrdersCount(res.user);
      })
      .catch((err) => {
        if (err?.status === 401 || err?.status === 403) {
          setAuthToken(null);
          try {
            localStorage.removeItem('esms_cached_user');
          } catch {}
          return;
        }
        // Offline reload fallback: keep cached session active so POS works offline
        try {
          const cachedUser = JSON.parse(localStorage.getItem('esms_cached_user') || 'null');
          const cachedSettings = JSON.parse(localStorage.getItem('esms_cached_settings') || 'null');
          if (cachedUser) {
            setUser(cachedUser);
            setSettings(cachedSettings);
            setIsOffline(true);
            wasOfflineRef.current = true;
            refreshQueueCount();
          }
        } catch {}
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // Fully automatic online/offline detection (browser events + API network monitor + real server heartbeat)
  useEffect(() => {
    let active = true;

    const handleReconnectSync = async () => {
      if (!user || syncingRef.current) return;
      syncingRef.current = true;
      try {
        const res = await synchronizeOfflineQueue();
        await refreshQueueCount();
        await refreshPendingOrdersCount(user);
        if (active && res.synced > 0) {
          setSyncBanner({
            key: 'Internet restored: {count} offline transaction(s) synchronized with MySQL.',
            params: { count: res.synced },
          });
          setTimeout(() => setSyncBanner(null), 6000);
        }
      } catch {
        // will retry automatically on next connectivity confirmation
      } finally {
        syncingRef.current = false;
      }
    };

    const applyStatus = (online) => {
      if (!active) return;
      const nextOffline = !online;
      const recovered = wasOfflineRef.current && !nextOffline;
      wasOfflineRef.current = nextOffline;
      setIsOffline(nextOffline);
      if (recovered) {
        handleReconnectSync();
      }
    };

    const probeConnectivity = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const reachable = await checkServerConnectivity();
      applyStatus(reachable);
    };

    const onBrowserOnline = () => {
      probeConnectivity();
    };
    const onBrowserOffline = () => {
      applyStatus(false);
    };
    const onApiConnectivity = (event) => {
      applyStatus(Boolean(event?.detail?.online));
    };
    const onVisibilityOrFocus = () => {
      if (!document.hidden) {
        probeConnectivity();
      }
    };

    window.addEventListener('online', onBrowserOnline);
    window.addEventListener('offline', onBrowserOffline);
    window.addEventListener('esms:connectivity', onApiConnectivity);
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    // Initial real connectivity probe + adaptive heartbeat (15s when offline, 45s when online)
    probeConnectivity();
    const intervalMs = isOffline ? 15000 : 45000;
    const heartbeat = setInterval(probeConnectivity, intervalMs);

    return () => {
      active = false;
      clearInterval(heartbeat);
      window.removeEventListener('online', onBrowserOnline);
      window.removeEventListener('offline', onBrowserOffline);
      window.removeEventListener('esms:connectivity', onApiConnectivity);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [user, isOffline]);

  // Preload high-frequency chunks (POS & Products) in idle time right after login for instant navigation
  useEffect(() => {
    if (!user) return;
    const prefetch = () => {
      import('./screens/PosSalesScreens').catch(() => {});
      import('./screens/ProductInventoryScreens').catch(() => {});
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(prefetch, 800);
    return () => clearTimeout(timer);
  }, [user]);

  // Close mobile sidebar on Escape and prevent background scroll while drawer is open
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleLogin = async (username, password) => {
    setAuthLoading(true);
    setLoginError(null);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setAuthToken(res.token);
      setUser(res.user);
      setSettings(res.settings);
      try {
        localStorage.setItem('esms_cached_user', JSON.stringify(res.user));
        localStorage.setItem('esms_cached_settings', JSON.stringify(res.settings));
      } catch {}
      setActiveScreen('dashboard');
      await refreshOfflineBootstrap();
      await refreshQueueCount();
      await refreshPendingOrdersCount(res.user);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore offline logout error
    }
    setAuthToken(null);
    try {
      localStorage.removeItem('esms_cached_user');
    } catch {}
    setUser(null);
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} loading={authLoading} error={loginError} />;
  }

  const isAdmin = (user?.role_slugs || []).includes('owner');
  const permittedNavItems = NAV_ITEMS.filter(
    (item) => (!item.ownerOnly || isAdmin) && (!item.perm || hasPermission(user, item.perm))
  );

  const handleUserUpdated = (nextUser) => {
    if (!nextUser) return;
    setUser(nextUser);
    try {
      localStorage.setItem('esms_cached_user', JSON.stringify(nextUser));
    } catch {}
  };

  const handleOrderFromSupplier = (product) => {
    if (!hasPermission(user, 'purchases.manage')) return;
    setOrderPrefillProduct(product || null);
    setActiveScreen('new_purchase');
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return (
          <DashboardScreen
            user={user}
            onNavigate={(screen) => {
              if (screen === 'products') {
                setSelectedCategoryId('');
                setProductPurchaseFilter('all');
              }
              setActiveScreen(screen);
            }}
            onViewPurchasedProducts={(filter = 'new') => {
              setSelectedCategoryId('');
              setProductPurchaseFilter(filter);
              setActiveScreen('products');
            }}
            onOrderFromSupplier={handleOrderFromSupplier}
            onOpenApproveOrders={() => setActiveScreen('approve_orders')}
          />
        );
      case 'pos':
        return (
          <PosScreen
            user={user}
            settings={settings}
            isOffline={isOffline}
            onQueueUpdated={refreshQueueCount}
            onViewSale={(id) => {
              setSelectedSaleId(id);
              setActiveScreen('sale_details');
            }}
          />
        );
      case 'sales':
        return (
          <SalesHistoryScreen
            onNavigate={setActiveScreen}
            onSelectSale={(id) => {
              setSelectedSaleId(id);
              setActiveScreen('sale_details');
            }}
          />
        );
      case 'sale_details':
        return (
          <SaleDetailsScreen
            saleId={selectedSaleId}
            onBack={() => setActiveScreen('sales')}
            onNewSale={() => setActiveScreen('pos')}
          />
        );
      case 'products':
        return (
          <ProductsScreen
            user={user}
            initialCategoryId={selectedCategoryId}
            initialPurchaseFilter={productPurchaseFilter}
            onClearCategory={() => setSelectedCategoryId('')}
            onBackToCategories={() => setActiveScreen('categories')}
            onAddProduct={() => {
              setEditingProduct(null);
              setActiveScreen('add_edit_product');
            }}
            onEditProduct={(prod) => {
              if (!(user?.role_slugs || []).includes('owner')) return;
              setEditingProduct(prod);
              setActiveScreen('add_edit_product');
            }}
            onOrderFromSupplier={handleOrderFromSupplier}
          />
        );
      case 'add_edit_product':
        return (
          <AddEditProductScreen
            user={user}
            editingProduct={editingProduct}
            defaultCategoryId={selectedCategoryId}
            onSaved={() => setActiveScreen('products')}
            onCancel={() => setActiveScreen('products')}
          />
        );
      case 'categories':
        return (
          <CategoriesScreen
            user={user}
            onSelectCategory={(catId) => {
              setSelectedCategoryId(String(catId));
              setProductPurchaseFilter('all');
              setActiveScreen('products');
            }}
          />
        );
      case 'purchases':
        return (
          <PurchasesScreen
            user={user}
            onNewPurchase={() => {
              setOrderPrefillProduct(null);
              setActiveScreen('new_purchase');
            }}
            onOpenApproveOrders={() => setActiveScreen('approve_orders')}
            onViewPurchasedProducts={() => {
              setSelectedCategoryId('');
              setProductPurchaseFilter('new');
              setActiveScreen('products');
            }}
          />
        );
      case 'approve_orders':
        return (
          <ApproveOrdersScreen
            user={user}
            onOrdersUpdated={() => {
              refreshPendingOrdersCount(user);
            }}
            onNewPurchase={() => {
              setOrderPrefillProduct(null);
              setActiveScreen('new_purchase');
            }}
            onViewPurchasedProducts={() => {
              setSelectedCategoryId('');
              setProductPurchaseFilter('new');
              setActiveScreen('products');
            }}
          />
        );
      case 'new_purchase':
        return (
          <NewPurchaseScreen
            user={user}
            prefillProduct={orderPrefillProduct}
            onSaved={(res) => {
              setOrderPrefillProduct(null);
              refreshPendingOrdersCount(user);
              if (res?.status === 'pending' || res?.status === 'draft') {
                setActiveScreen('approve_orders');
              } else {
                setActiveScreen('purchases');
              }
            }}
            onCancel={() => {
              setOrderPrefillProduct(null);
              setActiveScreen(hasPermission(user, 'purchases.view') ? 'purchases' : 'products');
            }}
          />
        );
      case 'inventory':
        return (
          <InventoryScreen
            user={user}
            onOpenAdjustment={() => setActiveScreen('stock_adjustments')}
            onOrderFromSupplier={handleOrderFromSupplier}
            onOpenApproveOrders={() => setActiveScreen('approve_orders')}
          />
        );
      case 'stock_adjustments':
        return (
          <StockAdjustmentsScreen
            user={user}
            onSaved={() => setActiveScreen('inventory')}
            onCancel={() => setActiveScreen('inventory')}
          />
        );
      case 'customers':
        return (
          <CustomersScreen
            onViewProfile={(id) => {
              setSelectedCustomerId(id);
              setActiveScreen('customer_profile');
            }}
          />
        );
      case 'customer_profile':
        return (
          <CustomerProfileScreen
            customerId={selectedCustomerId}
            onBack={() => setActiveScreen('customers')}
            onRecordRepayment={() => setActiveScreen('debt_repayment')}
          />
        );
      case 'debts':
        return (
          <DebtManagementScreen
            onOpenRepayment={(debt) => {
              setSelectedDebt(debt);
              setActiveScreen('debt_repayment');
            }}
          />
        );
      case 'debt_repayment':
        return (
          <DebtRepaymentScreen
            user={user}
            selectedDebt={selectedDebt}
            isOffline={isOffline}
            onSaved={() => {
              refreshQueueCount();
              setActiveScreen('debts');
            }}
            onCancel={() => setActiveScreen('debts')}
          />
        );
      case 'suppliers':
        return (
          <SuppliersScreen
            onViewSupplier={(id) => {
              setSelectedSupplierId(id);
              setActiveScreen('supplier_profile');
            }}
          />
        );
      case 'supplier_profile':
        return (
          <SupplierProfileScreen
            supplierId={selectedSupplierId}
            onBack={() => setActiveScreen('suppliers')}
          />
        );
      case 'expenses':
        return <ExpensesScreen />;
      case 'cash_register':
        return <CashRegisterScreen />;
      case 'returns_warranty':
        return <ReturnsWarrantyScreen />;
      case 'reports':
        return <ReportsScreen user={user} settings={settings} />;
      case 'employees':
        return (
          <EmployeesPermissionsScreen
            currentUser={user}
            onUserUpdated={handleUserUpdated}
          />
        );
      case 'account_settings':
      case 'admin_account':
        return (
          <SettingsScreen
            user={user}
            settings={settings}
            initialTab="account"
            onSettingsUpdated={setSettings}
            onUserUpdated={handleUserUpdated}
            onQueueUpdated={refreshQueueCount}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            user={user}
            settings={settings}
            initialTab="general"
            onSettingsUpdated={setSettings}
            onUserUpdated={handleUserUpdated}
            onQueueUpdated={refreshQueueCount}
          />
        );
      default:
        return <DashboardScreen onNavigate={setActiveScreen} />;
    }
  };

  const mobileQuickNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
    { id: 'pos', label: 'POS', icon: ShoppingCart, perm: 'pos.sell' },
    { id: 'products', label: 'Products', icon: Package, perm: 'products.view' },
    { id: 'sales', label: 'Sales', icon: Receipt, perm: ['sales.view', 'pos.sell'] },
  ].filter((item) => hasPermission(user, item.perm));

  return (
    <div className="min-h-dvh bg-slate-50 flex">
      {/* Mobile / Tablet Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-[1px] lg:hidden no-print"
        />
      )}

      {/* Deep Navy Sidebar (#0F172A) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[82vw] max-w-[272px] lg:w-64 bg-navy-900 text-slate-200 flex flex-col transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:shrink-0 no-print shadow-2xl lg:shadow-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between safe-area-top">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.png"
              alt="KAMPANGO PHONES AND ELECTRONICS"
              width="40"
              height="40"
              decoding="async"
              fetchPriority="high"
              className="w-10 h-10 rounded-full object-cover shadow-md border-2 border-white/25 shrink-0"
            />
            <div className="min-w-0">
              <span className="text-sm font-extrabold text-white tracking-tight block truncate">
                KAMPANGO
              </span>
              <p className="text-[10px] text-slate-300 font-medium leading-tight truncate max-w-[155px]">
                {settings?.shop_name || 'KAMPANGO PHONES AND ELECTRONICS'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('Close menu')}
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {permittedNavItems.map((item) => {
            const Icon = item.icon;
            const active =
              activeScreen === item.id ||
              (item.id === 'account_settings' && activeScreen === 'admin_account');
            const label =
              item.id === 'account_settings'
                ? isAdmin
                  ? t('Admin Account')
                  : t('My Account')
                : t(item.label);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'products') {
                    setSelectedCategoryId('');
                    setProductPurchaseFilter('all');
                  }
                  setActiveScreen(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </span>
                {item.id === 'approve_orders' && pendingOrdersCount > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold">
                    {pendingOrdersCount}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-60">#{item.screenNo}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="text-xs">
            <p className="font-bold text-white truncate">{user.full_name}</p>
            <p className="text-[11px] text-blue-400 font-medium">{t(user.primary_role)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveScreen('account_settings');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition ${
              activeScreen === 'account_settings' || activeScreen === 'admin_account'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/80 hover:bg-blue-600 text-slate-200 hover:text-white'
            }`}
          >
            <UserCog className="w-3.5 h-3.5" />{' '}
            {isAdmin ? t('Admin Account Settings') : t('My Account Settings')}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-red-600/90 text-xs font-bold text-slate-200 hover:text-white transition"
          >
            <LogOut className="w-3.5 h-3.5" /> {t('Sign Out')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3 sticky top-0 z-30 no-print safe-area-top">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              aria-label={t('Open menu')}
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Screen Jumper */}
            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="screen-jumper" className="text-xs font-bold text-slate-500 hidden md:inline shrink-0">
                {t('Screen:')}
              </label>
              <select
                id="screen-jumper"
                value={activeScreen}
                onChange={(e) => {
                  if (e.target.value === 'products') {
                    setSelectedCategoryId('');
                    setProductPurchaseFilter('all');
                  }
                  if (e.target.value === 'add_edit_product' && !(user?.role_slugs || []).includes('owner')) {
                    setEditingProduct(null);
                  }
                  setActiveScreen(e.target.value);
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 max-w-[165px] sm:max-w-[240px] md:max-w-[270px] truncate"
              >
                <option value="dashboard">2. {t('Dashboard')}</option>
                <option value="pos">3. {t('Point of Sale (POS)')}</option>
                <option value="sales">4. {t('Sales History')}</option>
                <option value="sale_details">5. {t('Sale Details & Receipt')}</option>
                <option value="products">6. {t('Products')}</option>
                <option value="add_edit_product">7. {t('Add / Edit Product')}</option>
                <option value="categories">8. {t('Categories')}</option>
                {hasPermission(user, 'purchases.view') && (
                  <option value="purchases">9. {t('Purchases')}</option>
                )}
                {hasPermission(user, 'purchases.manage') && (
                  <option value="new_purchase">10. {t('New Purchase (Receiving)')}</option>
                )}
                <option value="inventory">11. {t('Inventory')}</option>
                {hasPermission(user, 'inventory.adjust') && (
                  <option value="stock_adjustments">12. {t('Stock Adjustments')}</option>
                )}
                <option value="customers">13. {t('Customers')}</option>
                <option value="customer_profile">14. {t('Customer Profile & Statement')}</option>
                <option value="debts">15. {t('Customer Debts')}</option>
                <option value="debt_repayment">16. {t('Debt Repayment')}</option>
                <option value="suppliers">17. {t('Suppliers')}</option>
                <option value="supplier_profile">18. {t('Supplier Profile & Payments')}</option>
                <option value="expenses">19. {t('Expenses')}</option>
                <option value="cash_register">20. {t('Cash Register')}</option>
                <option value="returns_warranty">21. {t('Returns & Warranty')}</option>
                <option value="reports">22. {t('Reports & Analytics')}</option>
                {hasPermission(user, 'employees.manage') && (
                  <option value="employees">23. {t('Employees & RBAC')}</option>
                )}
                <option value="account_settings">
                  24. {isAdmin ? t('Admin Account Settings') : t('My Account Settings')}
                </option>
                {hasPermission(user, 'settings.manage') && (
                  <option value="settings">25. {t('Settings')}</option>
                )}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Language Switcher Button (Swahili & English) */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 transition"
              title={t('Toggle between English and Kiswahili')}
            >
              <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="hidden sm:inline">{lang === 'en' ? '🇺🇸 English' : '🇹🇿 Kiswahili'}</span>
              <span className="sm:hidden">{lang === 'en' ? 'EN' : 'SW'}</span>
            </button>

            {/* Dark Mode & White/Light Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 transition"
              title={theme === 'dark' ? t('Switch to Light Theme') : t('Switch to Dark Theme')}
              aria-label={theme === 'dark' ? t('Switch to Light Theme') : t('Switch to Dark Theme')}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="hidden md:inline">{t('Light Theme')}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="hidden md:inline">{t('Dark Theme')}</span>
                </>
              )}
            </button>

            {pendingQueueCount > 0 && (
              <span className="px-2 sm:px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] sm:text-xs font-extrabold">
                {pendingQueueCount}{' '}
                <span className="hidden sm:inline">{t('Pending Offline Sync')}</span>
              </span>
            )}

            <span
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border select-none ${
                isOffline
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
              title={
                isOffline
                  ? t('Offline mode detected automatically — transactions will sync once connection returns')
                  : t('Connected to server — online status detected automatically')
              }
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isOffline ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
                }`}
                aria-hidden="true"
              />
              {isOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{t('Offline · TZS')}</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{t('Online · TZS')}</span>
                </>
              )}
            </span>
          </div>
        </header>

        {syncBanner && (
          <div className="bg-emerald-600 text-white px-4 sm:px-6 py-2.5 text-xs font-bold flex items-center justify-between gap-2">
            <span>{t(syncBanner.key, syncBanner.params)}</span>
            <button type="button" onClick={() => setSyncBanner(null)} className="underline shrink-0">
              {t('Dismiss')}
            </button>
          </div>
        )}

        <main className="flex-1 p-3 sm:p-4 md:p-6 xl:p-7 pb-24 md:pb-8 max-w-[1600px] w-full mx-auto min-w-0">
          <Suspense
            fallback={
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                <div className="w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                <p className="text-xs font-semibold">{t('Loading workspace...')}</p>
              </div>
            }
          >
            {renderScreen()}
          </Suspense>
        </main>

        {/* Smartphone Quick Bottom Navigation Bar (< md) */}
        <nav
          aria-label={t('Quick mobile navigation')}
          className="mobile-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pt-1.5 safe-area-bottom shadow-[0_-4px_16px_rgba(15,23,42,0.08)] no-print"
        >
          <div className="grid grid-cols-5 gap-1">
            {mobileQuickNav.map((item) => {
              const Icon = item.icon;
              const active = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'products') {
                      setSelectedCategoryId('');
                      setProductPurchaseFilter('all');
                    }
                    setActiveScreen(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-bold transition ${
                    active
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate max-w-full">{t(item.label)}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              <Menu className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">{t('Menu')}</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
