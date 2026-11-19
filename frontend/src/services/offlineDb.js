/**
 * ESMS Offline-First IndexedDB Engine (SRS Section 5.5 & Section 8)
 * Stores:
 * - products: Cached product catalogue with inventory snapshot & provisional stock
 * - categories: Cached categories
 * - customers: Cached customer directory
 * - open_debts: Cached unpaid/partial invoices for offline debt repayments
 * - offline_queue: Pending offline transactions (sales, debt_repayment) with unique UUIDs
 */

const DB_NAME = 'esms_offline_db';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('open_debts')) {
        db.createObjectStore('open_debts', { keyPath: 'sale_id' });
      }
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'uuid' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function generateUuid(prefix = 'offline') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function getDeviceId() {
  let id = localStorage.getItem('esms_device_id');
  if (!id) {
    id = 'PWA-DEV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('esms_device_id', id);
  }
  return id;
}

export async function saveBootstrapCache(data) {
  const db = await openDb();
  const tx = db.transaction(['products', 'categories', 'customers', 'open_debts', 'meta'], 'readwrite');

  if (Array.isArray(data.products)) {
    const store = tx.objectStore('products');
    store.clear();
    data.products.forEach((p) => store.put({ ...p, provisional_reserved: 0 }));
  }
  if (Array.isArray(data.categories)) {
    const store = tx.objectStore('categories');
    store.clear();
    data.categories.forEach((c) => store.put(c));
  }
  if (Array.isArray(data.customers)) {
    const store = tx.objectStore('customers');
    store.clear();
    data.customers.forEach((c) => store.put(c));
  }
  if (Array.isArray(data.open_debts)) {
    const store = tx.objectStore('open_debts');
    store.clear();
    data.open_debts.forEach((d) => store.put(d));
  }

  tx.objectStore('meta').put({ key: 'last_synced_at', value: data.synced_at || new Date().toISOString() });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllFromStore(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Queue an offline transaction and reserve provisional stock locally (SRS 8.3)
 */
export async function enqueueOfflineTransaction(type, payload, user) {
  const db = await openDb();
  const uuid = payload.uuid || generateUuid(type === 'sale' ? 'sale' : 'cp');
  const deviceId = getDeviceId();
  const record = {
    uuid,
    type,
    payload: { ...payload, uuid, device_id: deviceId, synced_from_offline: 1 },
    user_id: user?.id || null,
    user_name: user?.full_name || 'Offline Staff',
    device_id: deviceId,
    client_timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    status: 'pending',
    error_message: null,
  };

  const tx = db.transaction(['offline_queue', 'products', 'open_debts'], 'readwrite');
  tx.objectStore('offline_queue').put(record);

  // Reserve provisional stock locally for offline sales (SRS 8.3)
  if (type === 'sale' && Array.isArray(payload.items)) {
    const prodStore = tx.objectStore('products');
    for (const item of payload.items) {
      const getReq = prodStore.get(Number(item.product_id));
      getReq.onsuccess = () => {
        const prod = getReq.result;
        if (prod) {
          const qty = Number(item.quantity) || 0;
          prod.available_quantity = Math.max(0, Number(prod.available_quantity) - qty);
          prod.provisional_reserved = (Number(prod.provisional_reserved) || 0) + qty;
          prodStore.put(prod);
        }
      };
    }
  }

  // Update cached debt balance locally for offline repayments
  if (type === 'debt_repayment' && payload.sale_id) {
    const debtStore = tx.objectStore('open_debts');
    const getReq = debtStore.get(Number(payload.sale_id));
    getReq.onsuccess = () => {
      const debt = getReq.result;
      if (debt) {
        debt.outstanding_balance = Math.max(0, Number(debt.outstanding_balance) - Number(payload.amount || 0));
        debtStore.put(debt);
      }
    };
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineQueue() {
  return getAllFromStore('offline_queue');
}

export async function updateQueueItemStatus(uuid, status, message = null, receiptNumber = null) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_queue', 'readwrite');
    const store = tx.objectStore('offline_queue');
    const req = store.get(uuid);
    req.onsuccess = () => {
      const rec = req.result;
      if (rec) {
        rec.status = status;
        rec.error_message = message;
        if (receiptNumber) rec.server_receipt_number = receiptNumber;
        rec.synced_at = new Date().toISOString();
        store.put(rec);
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearSyncedFromQueue() {
  const db = await openDb();
  const all = await getOfflineQueue();
  const tx = db.transaction('offline_queue', 'readwrite');
  const store = tx.objectStore('offline_queue');
  all.forEach((item) => {
    if (item.status === 'synced' || item.status === 'duplicate_ignored') {
      store.delete(item.uuid);
    }
  });
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
  });
}
