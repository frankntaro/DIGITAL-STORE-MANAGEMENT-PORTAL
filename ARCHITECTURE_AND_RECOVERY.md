# ESMS Architectural Decisions, Accounting Rules & Recovery Guide

## 1. Database Architecture (`esms_db`)
The MySQL schema (`backend/database/schema.sql`) enforces third-normal-form (3NF) relational integrity with `InnoDB` transactions and `DECIMAL(15, 2)` precision for **Tanzanian Shillings (TZS)**:
- **Identity & RBAC:** `roles`, `permissions`, `role_permissions`, `users`, `user_roles`, `user_permissions`, `personal_access_tokens`
- **Catalogue & Inventory:** `categories` (10 default + custom), `products`, `inventories` (quantity-based stock per product), `stock_movements` (immutable ledger)
- **Procurement & Payables:** `suppliers`, `purchases`, `purchase_items`, `supplier_payments`
- **POS Sales & Receivables:** `customers`, `sales`, `sale_items` (preserves `historical_unit_cost` at time of sale), `customer_payments`
- **Cash & Expenses:** `cash_sessions`, `cash_movements`, `expenses`
- **After-Sales & Governance:** `returns`, `return_items`, `warranties`, `warranty_claims`, `audit_logs`, `shop_settings`, `sync_records`

## 2. Inventory Costing & Financial Formulas
- **Weighted Average Cost (WAC):**
  $$\text{New Unit Cost} = \frac{(\text{Current Qty} \times \text{Current Unit Cost}) + (\text{Received Qty} \times \text{Purchase Unit Price})}{\text{Current Qty} + \text{Received Qty}}$$
- **Sales Revenue:** Sum of completed sales net of authorized discounts (excludes cancelled sales and excludes customer debt repayments).
- **COGS:** Sum of $(\text{Quantity Sold} \times \text{Historical Unit Cost preserved on } \texttt{sale\_items})$.
- **Gross Profit:** $\text{Sales Revenue} - \text{COGS}$.
- **Net Profit:** $\text{Gross Profit} - \text{Operating Expenses}$ (operating expenses are strictly separated from inventory purchases).
- **Expected Closing Cash:** $\text{Opening Balance} + \text{Cash Inflows} - \text{Cash Outflows}$.

## 3. Offline-First Architecture & Conflict Resolution
- **IndexedDB Store (`esms_offline_db`):** Caches products, categories, customers, and open credit invoices locally.
- **Offline Queue & Provisional Stock:** Offline sales and debt repayments generate a unique client `UUID` (`sale-...` or `cp-...`), record `device_id` and `client_timestamp`, and deduct provisional stock locally.
- **Idempotent Server Sync (`/api/sync/push`):** When internet connectivity returns, pending transactions are pushed to the Laravel API. The server checks `sales.uuid`, `customer_payments.uuid`, and `sync_records.transaction_uuid` inside a database transaction (`FOR UPDATE` row lock) so retried synchronization requests never duplicate sales or double-deduct stock (`AT-18`).

## 4. Backup & Disaster Recovery Procedure
1. **Manual Snapshot Export:** Navigate to **Screen 24 (Settings -> Backup & Recovery)** and click **Export Full Database Backup** (`POST /api/settings/backup`). This downloads a timestamped JSON archive containing all 29 tables and updates `shop_settings.last_backup_at`.
2. **MySQL Dump Backup:**
   ```powershell
   C:\xampp\mysql\bin\mysqldump.exe -u root esms_db > esms_backup.sql
   ```
3. **Database Restoration:**
   ```powershell
   C:\xampp\mysql\bin\mysql.exe -u root esms_db < esms_backup.sql
   ```
