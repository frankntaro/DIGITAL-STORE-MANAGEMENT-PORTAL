# Electronics Shop Management System (ESMS)

**Document Version:** 1.0 · **System Type:** Progressive Web Application (PWA) · **Currency:** Tanzanian Shillings (`TZS`)

A complete, offline-capable retail management system for mobile phones, electronics, and accessories shops built with **React + Laravel + MySQL**.

---

## 1. Quick Start & Running the Application

### Prerequisites (Already Installed on Your Machine)
- **XAMPP (PHP 8.2 & MySQL / MariaDB 10.4):** `C:\xampp`
- **Node.js & npm:** v25.4+

### Step 1 — Ensure MySQL is Running
Start MySQL from the **XAMPP Control Panel** (or run `C:\xampp\mysql_start.bat`).

### Step 2 — Migrate & Seed the MySQL Database (`esms_db`)
```powershell
cd C:\Users\NTARO\Desktop\esms\backend
C:\xampp\php\php.exe artisan migrate
```

### Step 3 — Start the Laravel Backend API (`http://127.0.0.1:8000`)
```powershell
cd C:\Users\NTARO\Desktop\esms\backend
C:\xampp\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

### Step 4 — Start the React PWA Frontend (`http://127.0.0.1:5173`)
```powershell
cd C:\Users\NTARO\Desktop\esms\frontend
npm install
npm run dev
```

---

## 2. Default Employee Accounts (RBAC Verification)

| Role | Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Shop Owner / Super Admin** | `admin` | `admin123` | Full system access, financial P&L reports, approvals, employee & settings management |
| **Sales Attendant / Cashier** | `amina` | `cashier123` | POS sales, customer registration, cash receipts, debt repayments (max 5% discount limit) |
| **Inventory / Stock Manager** | `baraka` | `stock123` | Product registration, goods receipt, stock monitoring, and stock adjustments |

---

## 3. Running the Automated 20-Scenario Acceptance Suite (`AT-01` to `AT-20`)
```powershell
C:\xampp\php\php.exe C:\Users\NTARO\Desktop\esms\backend\tests\AcceptanceTestSuite.php
```
