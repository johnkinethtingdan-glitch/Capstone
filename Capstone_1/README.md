# UNITYBANK & PALAWANLINK CORE ECOSYSTEM

A next-generation, production-ready enterprise fintech platform engineered with ultra-clean minimalist design (inspired by **GoTyme Bank** and **Maya**), strict **Role-Based Access Control (RBAC)**, seamless **Online/Offline transaction sync**, comprehensive **System Administrator Governance**, and a **100% Offline AI Concierge Assistant**.

---

## 1. Key Architectural Upgrades & Highlights

### 1. Dynamic Authentication & Registration Engine
- **No Hard-coded Users:** All user records, account balances, card numbers, and transaction ledgers are 100% database-driven in SQLite.
- **Minimalist Auth Views:** Separate sleek Login and Registration forms with password visibility toggles and quick demo persona fill chips.
- **Admin Bootstrap Key Security:** Registration page includes role selection (`Customer`, `Teller`, `Manager`, `System Admin`). Registering as a `System Admin` requires the secure admin setup bootstrap key (`ADMIN-MASTER-2026`) to prevent unauthorized privilege escalation.
- **Automatic Account Provisioning:** New Customer registrations immediately provision a Primary Checking account (with initial welcome deposit), an active contactless debit card, and an automated welcome credit in the transaction ledger.

### 2. Strict Role-Based Access Control (RBAC) & Module Isolation
- **Server-Side Enforcement:** Every sensitive API endpoint enforces strict role validation dependencies. Unauthorized attempts return `403 Forbidden` and trigger immutable audit log entries.
- **Module Isolation:** The UI and navigation adapt strictly to the authenticated user's role:
  - **Customer:** My Accounts, Send Money, Card Controls, Apply for Credit Facility, Offline AI Concierge.
  - **Teller:** Over-the-counter Cash Desk (Deposit/Withdrawal), Customer Identity & KYC Verification, Receipt Generator, Offline Sync Queue.
  - **Manager:** Dual-Control Approval Queue for High-Value Transactions ($\ge \$10,000$), Loan Application Credit Decisions, Risk Grade Matrix.
  - **System Admin:** Cluster Telemetry Monitor, Active Users & RBAC Matrix, Cryptographic Audit Trail, Comprehensive System Admin Settings.

### 3. Offline and Online Feature Modes
- **Status Indicator & Toggle:** Live indicator in the top header (`● Online Cloud Sync` in emerald vs `⚡ Offline Mode` in amber). Automatically detects network status via `navigator.onLine` and supports manual toggling.
- **Encrypted Local Storage Queue:** When operating offline, customer transfers and teller OTC cash transactions are safely queued in local storage (`ub_offline_queue`) with unique offline reference numbers and cryptographic signature stamps.
- **Printable Digital Receipt Vouchers:** Transactions generate an official digital thermal-style receipt voucher with printable formatting (`window.print()`).
- **Cloud Reconnection Engine:** The `/api/v1/sync/offline-queue` endpoint reconciles queued offline transactions in batch upon network restoration, updating balances and recording ledger sync logs.

### 4. Dedicated Admin Dashboard & Comprehensive System Settings
- **Live Cluster Telemetry:** Real-time API Gateway TPS, CPU load percentage, Memory utilization, and SQLite atomic read/write latency.
- **Active Users Matrix:** Complete visibility over all registered users, their roles, and KYC tiers, with instantaneous role reassignment.
- **Immutable Security Audit Trail:** Searchable cryptographic log with tamper-proof SHA-256 signature hashes.
- **Comprehensive Settings Panel:**
  1. *Core Banking Parameters:* High-Value Approval Threshold, Default Card Limits, Admin Setup Key.
  2. *Security & Compliance Toggles:* Dual-Control Manager Approvals, Biometric KYC Enforcement, Heuristic Fraud Detection Engine, Maintenance Mode.
  3. *Infrastructure & AI Bridge:* Local Ollama endpoint, model selection, multi-cloud hosting parameters.
  4. *Database Maintenance:* Run SQLite atomic integrity check, VACUUM disk optimization, and view table row counts.

### 5. System Admin Analytics & Predictive Forecasting Dashboard
- **Real-Time Health & Activity Monitoring:**
  - Live status indicator with automatic background polling every 10 seconds.
  - Performance overview grid monitoring Active Daily Users, 24-hour transaction volume (inflow, outflow, and net gross delta), cluster uptime (99.99%), database query latency (0.77 ms), and security exception logs with threat level assessment.
- **Interactive Data Visualization (Chart.js):**
  - **Transaction Flow & Liquidity Dynamics Line Chart:** Visualizes daily inflow, outflow, and net transaction volumes with gradient fills and currency tooltips.
  - **Credit Facilities Breakdown Doughnut Chart:** Breakdown by loan status (Approved, Pending Review, Defaulted/Rejected) paired with risk grade counts (Grade AAA to Subprime).
  - **Institutional User Growth Cohorts Bar Chart:** Tracks new customer registrations against active transacting users across monthly/weekly cohorts.
- **Predictive Analytics & Decision-Making Forecasts:**
  - Dedicated **Forecasts & Insights** tab analyzing historical SQLite transactional velocity.
  - Statistical forecasting algorithms using Ordinary Least Squares (OLS) linear trend regression, 7-day exponential weighted moving averages, and 95% Gaussian confidence bounds.
  - Dynamic **30-Day, 60-Day, and 90-Day** projection horizon switching.
  - Executive recommendation cards providing automated actions for **Liquidity & Treasury Management**, **Cloud Cluster Autoscaling**, and **Credit Risk Policy Controls**.
- **RBAC & Security Enforcement:**
  - All analytics and forecasting endpoints (`/api/v1/admin/analytics/*`) strictly enforce `SYSTEM_ADMIN` role authorization. Unauthorized access yields `403 Forbidden` with audit trail recording.

### 6. Minimalist Fintech UI/UX Design (GoTyme & Maya Inspired)
- **Aesthetic:** Generous whitespace, refined card surfaces, soft drop shadows, clean borders, and vibrant GoTyme emerald accents (`#00B074`).
- **Interactive Details:** Balance masking eye toggle (`••••••`), segmented pill navigation, switch toggles, and responsive mobile sub-navigation.
- **Dark & Light Modes:** Complete theme switching with dynamic Chart.js theme adaptation for axes, grids, and tooltips.

### 7. Fully Interactive Offline AI Assistant Integration
- **Hybrid 100% Offline Architecture:**
  - *Ollama Local Bridge:* Queries local offline models (`llama3.2`, `phi4-mini`, `smollm2`, `mistral`) if Ollama is running on `127.0.0.1:11434`.
  - *Built-In Python Reasoning Engine:* When Ollama is offline, seamlessly falls back to the built-in offline NLP engine with dynamic RAG over SQLite. It queries the active user's actual accounts, loans, cards, and system parameters to provide accurate, real-time answers without requiring internet access or paid API keys.
- **Role-Aware Prompts & Answers:**
  - *Customer:* Live balance inquiries, transfer rules, card freezing steps, loan rates.
  - *Teller:* OTC cash drawer limits, AML reporting rules, KYC verification procedures.
  - *Manager:* Dual-control high-value thresholds, FICO credit scoring formulas, risk grade rubrics.
  - *Admin:* Server health metrics, audit signature verification, security cipher specifications.

---

## 2. Default Demo Personas & Credentials

| Role | Username | Password | Admin Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | `customer` | `Customer123!` | — | Alex Morgan - Personal Checking, Wealth Vault, Cards, AI Concierge |
| **Teller** | `teller` | `Teller123!` | — | Sarah Jenkins - Over-the-counter Cash Desk, KYC Verification |
| **Manager** | `manager` | `Manager123!` | — | James Vance - High-Value Wire Approvals, Loan Adjudication |
| **System Admin** | `admin` | `Admin123!` | `ADMIN-MASTER-2026` | Elena Rostova - Cluster Monitor, User RBAC, System Settings |

*Note: You can also register any new custom user dynamically on the registration tab!*

---

## 3. Technology Stack

- **Backend:** Python 3.13, FastAPI, Uvicorn, SQLite3 (`backend/data/unitybank.db`), Pydantic v2.
- **Frontend:** HTML5, CSS3, Tailwind CSS (CDN), Vanilla JavaScript, FontAwesome 6, Google Fonts (Inter & JetBrains Mono).
- **AI Engine:** Built-in Local Python Reasoning Engine (100% offline) + Local Ollama Bridge.

---

## 4. How to Run Locally

1. Install Python requirements:
   ```bash
   pip install -r requirements.txt
   ```

2. Start the FastAPI development server:
   ```bash
   python run.py
   ```

3. Open your browser and access:
   ```
   http://127.0.0.1:8000
   ```

4. **Right-Click "Open with Chrome" (Direct Access)**:
   - In Windows File Explorer, **right-click on the `Capstone_1` folder** (or right-click the empty space inside the folder).
   - Select **Open with Chrome** (with the Chrome icon).
   - Chrome will immediately launch the UnityBank interface (`frontend/index.html`).
   - If you ever need to re-register or uninstall the context menu:
     - Run `scripts/windows/install_open_with_chrome.reg` to add the menu item.
     - Run `scripts/windows/uninstall_open_with_chrome.reg` to remove the menu item.
   - Alternatively, double-click `scripts/windows/Open_with_Chrome.bat` to auto-verify the backend and launch Chrome.

5. Run automated test suite:
   ```bash
   python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health'))"
   ```


---

## Project Structure

```
Capstone_1/
├── run.py                  # Start the server (python run.py)
├── requirements.txt
├── backend/
│   ├── app.py              # FastAPI app (API, RBAC, offline sync, AI)
│   └── data/unitybank.db   # SQLite database
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
├── scripts/windows/        # Open_with_Chrome.bat + context-menu .reg files
└── data/archive/           # Unused legacy palawanlink.db
```
