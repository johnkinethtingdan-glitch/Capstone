/**
 * UnityBank - Modern Digital Banking Controller
 * Minimalist, ultra-clean UI/UX inspired by GoTyme Bank and Maya
 * Fully RBAC-enabled, Offline/Online sync capable, Offline AI integrated
 */

const API_BASE = (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null')
  ? 'http://127.0.0.1:8000/api/v1'
  : '/api/v1';

function loadOfflineQueue() {
  const storageKey = 'ub_offline_queue';
  try {
    const queue = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(queue)) return queue;
  } catch {}

  try {
    localStorage.removeItem(storageKey);
  } catch {}
  return [];
}

// Global Application State
const state = {
  token: localStorage.getItem('ub_auth_token') || null,
  currentUser: null,
  activeModule: null, // 'customer', 'teller', 'manager', 'admin'
  accounts: [],
  cards: [],
  loans: [],
  transactions: [],
  pendingApprovals: { transactions: [], loans: [] },
  adminStats: {},
  adminUsers: [],
  auditLogs: [],
  charts: {
    trend: null,
    loan: null,
    userGrowth: null,
    forecast: null
  },
  adminAnalytics: null,
  adminForecast: null,
  forecastHorizonDays: 30,
  analyticsPollTimer: null,
  isBalanceHidden: localStorage.getItem('ub_hide_balance') === 'true',
  isChatOpen: false,
  isOfflineMode: localStorage.getItem('ub_offline_mode') === 'true' || !navigator.onLine,
  offlineQueue: loadOfflineQueue(),
  activeAdminTab: 'analytics'
};

// Currency & Date Formatters
function formatUSD(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
  if (state.isBalanceHidden) return '••••••';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

// Minimal Toast Notifications
function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const iconClass = type === 'success' ? 'fa-check-circle text-[#00B074]' :
                    type === 'warning' ? 'fa-exclamation-circle text-amber-500' :
                    type === 'error' ? 'fa-times-circle text-rose-500' :
                    'fa-info-circle text-sky-500';

  toast.className = 'toast';
  toast.innerHTML = `
    <i class="fas ${iconClass} text-base"></i>
    <div class="flex-1">
      ${title ? `<div class="font-bold text-xs text-slate-900 dark:text-white mb-0.5">${title}</div>` : ''}
      <div class="text-xs text-slate-600 dark:text-slate-300 leading-snug">${message}</div>
    </div>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs ml-2">
      <i class="fas fa-times"></i>
    </button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }
  }, 4000);
}

// -----------------------------------------------------------------------------
// THEME (LIGHT / DARK) TOGGLE
// -----------------------------------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem('ub_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ub_theme', next);
  if (typeof updateChartsTheme === 'function') {
    updateChartsTheme();
  }
}

// -----------------------------------------------------------------------------
// AUTHENTICATION & REGISTRATION LOGIC
// -----------------------------------------------------------------------------
function setAuthTab(tab) {
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');
  const tabLogin = document.getElementById('tab-btn-login');
  const tabReg = document.getElementById('tab-btn-register');
  const alertBox = document.getElementById('auth-alert');
  if (alertBox) alertBox.classList.add('hidden');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabReg.classList.add('active');
  }
}

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (input && icon) {
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fas fa-eye-slash text-xs';
    } else {
      input.type = 'password';
      icon.className = 'fas fa-eye text-xs';
    }
  }
}

function fillDemoCredentials(username, password) {
  setAuthTab('login');
  const uInput = document.getElementById('login-username');
  const pInput = document.getElementById('login-password');
  if (uInput && pInput) {
    uInput.value = username;
    pInput.value = password;
  }
}

function handleRoleSelectChange(role) {
  const adminFields = document.getElementById('reg-admin-fields');
  const custFields = document.getElementById('reg-customer-fields');
  if (adminFields) {
    if (role === 'SYSTEM_ADMIN') {
      adminFields.classList.remove('hidden');
    } else {
      adminFields.classList.add('hidden');
    }
  }
  if (custFields) {
    if (role === 'CUSTOMER') {
      custFields.classList.remove('hidden');
    } else {
      custFields.classList.add('hidden');
    }
  }
}

function showAuthAlert(message, isError = true) {
  const box = document.getElementById('auth-alert');
  const icon = document.getElementById('auth-alert-icon');
  const msg = document.getElementById('auth-alert-msg');
  if (!box || !icon || !msg) return;

  box.className = isError 
    ? 'p-3 rounded-xl text-xs mb-4 flex items-start gap-2.5 bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
    : 'p-3 rounded-xl text-xs mb-4 flex items-start gap-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900';
  
  icon.className = isError ? 'fas fa-circle-exclamation mt-0.5' : 'fas fa-check-circle mt-0.5';
  msg.innerText = message;
  box.classList.remove('hidden');
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const btn = document.getElementById('btn-login-submit');

  if (!username || !password) {
    showAuthAlert('Please enter both username and password.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Authenticating...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok || data.status !== 'success') {
      throw new Error(data.detail || 'Login authentication failed.');
    }

    state.token = data.token;
    state.currentUser = data.user;
    localStorage.setItem('ub_auth_token', data.token);

    showToast(`Welcome back, ${data.user.full_name}`, 'success', `${data.user.role} Session Active`);
    enterAppWorkspace();
  } catch (err) {
    // If backend connection fails (e.g., opened via file:/// without server running), fallback to offline demo authentication
    if (err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('fetch'))) {
      const demoUsers = {
        'admin': { id: 4, username: 'admin', full_name: 'Elena Rostova', role: 'SYSTEM_ADMIN', email: 'elena.admin@unitybank.io', phone: '+1 (555) 010-0001', avatar: 'ER', kyc_tier: 'SYSTEM_SUPERADMIN' },
        'customer': { id: 1, username: 'customer', full_name: 'Alex Morgan', role: 'CUSTOMER', email: 'alex.morgan@unitybank.io', phone: '+1 (555) 019-4821', avatar: 'AM', kyc_tier: 'TIER_3_VERIFIED' },
        'teller': { id: 2, username: 'teller', full_name: 'Sarah Jenkins', role: 'TELLER', email: 'sarah.teller@unitybank.io', phone: '+1 (555) 018-9922', avatar: 'SJ', kyc_tier: 'STAFF_AUTHORIZED' },
        'manager': { id: 3, username: 'manager', full_name: 'James Vance', role: 'MANAGER', email: 'james.manager@unitybank.io', phone: '+1 (555) 017-3311', avatar: 'JV', kyc_tier: 'STAFF_AUTHORIZED' }
      };
      const passwords = {
        'admin': 'Admin123!',
        'customer': 'Customer123!',
        'teller': 'Teller123!',
        'manager': 'Manager123!'
      };
      if (demoUsers[username] && password === passwords[username]) {
        state.token = 'OFFLINE_DEMO_TOKEN_' + Date.now();
        state.currentUser = demoUsers[username];
        state.isOfflineMode = true;
        localStorage.setItem('ub_auth_token', state.token);
        localStorage.setItem('ub_offline_mode', 'true');
        showToast(`Local offline session active for ${demoUsers[username].full_name}`, 'warning', 'Offline Mode Activated');
        enterAppWorkspace();
        return;
      }
    }
    showAuthAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Sign In to Core Banking</span> <i class="fas fa-arrow-right text-xs"></i>';
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const full_name = document.getElementById('reg-fullname').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  
  const roleRadios = document.getElementsByName('reg-role');
  let role = 'CUSTOMER';
  for (const r of roleRadios) {
    if (r.checked) {
      role = r.value;
      break;
    }
  }

  const admin_security_key = document.getElementById('reg-admin-key')?.value.trim();
  const initial_deposit = parseFloat(document.getElementById('reg-initial-deposit')?.value || '1000.0');
  const btn = document.getElementById('btn-register-submit');

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Provisioning Profile...';

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name,
        username,
        password,
        email,
        phone,
        role,
        admin_security_key,
        initial_deposit
      })
    });
    const data = await res.json();

    if (!res.ok || data.status !== 'success') {
      throw new Error(data.detail || 'Registration failed.');
    }

    state.token = data.token;
    state.currentUser = data.user;
    localStorage.setItem('ub_auth_token', data.token);

    showToast(data.message, 'success', 'Account Registered');
    enterAppWorkspace();
  } catch (err) {
    showAuthAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Create Account & Provision Profile</span> <i class="fas fa-check text-xs"></i>';
  }
}

async function checkAuthSession() {
  if (!state.token) {
    showAuthScreen();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      state.currentUser = data.user;
      enterAppWorkspace();
    } else {
      logout();
    }
  } catch {
    // If offline, check if we have cached profile
    if (state.currentUser) {
      enterAppWorkspace();
    } else {
      showAuthScreen();
    }
  }
}

function showAuthScreen() {
  document.getElementById('auth-screen')?.classList.remove('hidden');
  document.getElementById('app-shell')?.classList.add('hidden');
}

function enterAppWorkspace() {
  document.getElementById('auth-screen')?.classList.add('hidden');
  document.getElementById('app-shell')?.classList.remove('hidden');

  updateUserProfileUI();
  setupRoleBasedNavigation();
  updateNetworkStatusUI();
  setupChatQuickChips();
  fetchAllData();
}

function logout() {
  if (state.token) {
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    }).catch(() => {});
  }
  state.token = null;
  state.currentUser = null;
  localStorage.removeItem('ub_auth_token');
  showAuthScreen();
  showToast('You have been signed out safely.', 'info', 'Session Ended');
}

function toggleUserDropdown() {
  const menu = document.getElementById('user-menu-dropdown');
  if (menu) menu.classList.toggle('hidden');
}

// Close user menu on outside click
document.addEventListener('click', (e) => {
  const menu = document.getElementById('user-menu-dropdown');
  if (menu && !menu.classList.contains('hidden')) {
    if (!e.target.closest('#user-menu-dropdown') && !e.target.closest('[onclick="toggleUserDropdown()"]')) {
      menu.classList.add('hidden');
    }
  }
});

function updateUserProfileUI() {
  if (!state.currentUser) return;
  const u = state.currentUser;

  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-role-label');
  const avatarEl = document.getElementById('user-avatar-badge');
  const dropName = document.getElementById('dropdown-user-name');
  const dropEmail = document.getElementById('dropdown-user-email');
  const dropKyc = document.getElementById('dropdown-user-kyc');
  const custKycBadge = document.getElementById('cust-kyc-badge');

  if (nameEl) nameEl.innerText = u.full_name;
  if (roleEl) roleEl.innerText = u.role.replace('_', ' ');
  if (avatarEl) avatarEl.innerText = u.avatar || u.full_name.substring(0, 2).toUpperCase();
  if (dropName) dropName.innerText = u.full_name;
  if (dropEmail) dropEmail.innerText = u.email || `${u.username}@unitybank.io`;
  if (dropKyc) dropKyc.innerText = u.kyc_tier || 'VERIFIED';
  if (custKycBadge) custKycBadge.innerText = (u.kyc_tier || 'VERIFIED').replace('_', ' ');
}

// -----------------------------------------------------------------------------
// RBAC MODULE ISOLATION & NAVIGATION
// -----------------------------------------------------------------------------
function setupRoleBasedNavigation() {
  if (!state.currentUser) return;
  const role = state.currentUser.role;

  if (role === 'CUSTOMER') {
    state.activeModule = 'customer';
  } else if (role === 'TELLER') {
    state.activeModule = 'teller';
  } else if (role === 'MANAGER') {
    state.activeModule = 'manager';
  } else if (role === 'SYSTEM_ADMIN') {
    state.activeModule = 'admin';
  } else {
    state.activeModule = 'customer';
  }

  switchWorkspaceModule(state.activeModule);
}

function switchWorkspaceModule(moduleId) {
  state.activeModule = moduleId;
  
  // Hide all modules
  document.getElementById('module-customer')?.classList.add('hidden');
  document.getElementById('module-teller')?.classList.add('hidden');
  document.getElementById('module-manager')?.classList.add('hidden');
  document.getElementById('module-admin')?.classList.add('hidden');

  // Enforce server-side matching client RBAC view display
  const target = document.getElementById(`module-${moduleId}`);
  if (target) {
    target.classList.remove('hidden');
    if (moduleId === 'admin') {
      setAdminTab(state.activeAdminTab || 'analytics');
    }
  } else {
    document.getElementById('module-customer')?.classList.remove('hidden');
  }
}

// -----------------------------------------------------------------------------
// OFFLINE & ONLINE FEATURE ENGINE
// -----------------------------------------------------------------------------
function toggleNetworkMode() {
  state.isOfflineMode = !state.isOfflineMode;
  localStorage.setItem('ub_offline_mode', state.isOfflineMode);
  updateNetworkStatusUI();

  if (state.isOfflineMode) {
    showToast('Operating in local encrypted offline mode. Transactions will queue locally.', 'warning', 'Offline Mode Engaged');
  } else {
    showToast('Online cloud synchronization restored.', 'success', 'Cloud Connected');
    if (state.offlineQueue.length > 0) {
      triggerOfflineSync();
    }
  }
}

window.addEventListener('online', () => {
  if (state.isOfflineMode) {
    state.isOfflineMode = false;
    localStorage.setItem('ub_offline_mode', 'false');
    updateNetworkStatusUI();
    showToast('Network connection detected. Synced with cloud.', 'success', 'Online');
    if (state.offlineQueue.length > 0) triggerOfflineSync();
  }
});

window.addEventListener('offline', () => {
  state.isOfflineMode = true;
  localStorage.setItem('ub_offline_mode', 'true');
  updateNetworkStatusUI();
  showToast('Network loss detected. Switched to offline transaction mode.', 'warning', 'Offline Fallback');
});

function updateNetworkStatusUI() {
  const badge = document.getElementById('network-status-badge');
  const dot = document.getElementById('network-pulse-dot');
  const text = document.getElementById('network-status-text');
  const queueCount = document.getElementById('offline-queue-count');
  const banner = document.getElementById('offline-sync-banner');
  const bannerCount = document.getElementById('offline-banner-count');

  const pending = state.offlineQueue.length;

  if (state.isOfflineMode) {
    badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 transition';
    dot.className = 'w-2 h-2 rounded-full bg-amber-500 pulse-offline';
    text.innerText = 'Offline Mode';
  } else {
    badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 transition';
    dot.className = 'w-2 h-2 rounded-full bg-emerald-500 pulse-online';
    text.innerText = 'Online Sync';
  }

  if (pending > 0) {
    queueCount.classList.remove('hidden');
    queueCount.innerText = `${pending} Queued`;
    if (banner) banner.classList.remove('hidden');
    if (bannerCount) bannerCount.innerText = pending;
  } else {
    queueCount.classList.add('hidden');
    if (banner) banner.classList.add('hidden');
  }
}

async function triggerOfflineSync() {
  if (state.offlineQueue.length === 0) {
    showToast('Offline queue is already clean.', 'info', 'Nothing to Sync');
    return;
  }

  showToast(`Synchronizing ${state.offlineQueue.length} offline transactions...`, 'info', 'Cloud Syncing');

  try {
    const res = await fetch(`${API_BASE}/sync/offline-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ transactions: state.offlineQueue })
    });
    const data = await res.json();

    if (data.status === 'success') {
      state.offlineQueue = [];
      localStorage.setItem('ub_offline_queue', '[]');
      updateNetworkStatusUI();
      closeOfflineQueueModal();
      showToast(data.message, 'success', 'Sync Successful');
      fetchAllData();
    }
  } catch (err) {
    showToast('Failed to reach cloud endpoint. Transactions remain queued locally.', 'error', 'Sync Postponed');
  }
}

function openOfflineSyncModal() {
  const modal = document.getElementById('offline-queue-modal');
  const list = document.getElementById('offline-queue-list');
  if (!modal || !list) return;

  if (state.offlineQueue.length === 0) {
    list.innerHTML = '<div class="text-center py-6 text-slate-400">No offline transactions queued in local storage.</div>';
  } else {
    list.innerHTML = state.offlineQueue.map((item, idx) => `
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <div class="font-mono font-bold text-slate-800 dark:text-slate-200">${item.offline_ref}</div>
          <div class="text-[10px] text-slate-400">${item.operation_type} • ${formatDate(item.timestamp)}</div>
        </div>
        <div class="text-right">
          <div class="font-mono font-bold text-emerald-600">${formatUSD(item.amount)}</div>
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Pending Cloud Sync</span>
        </div>
      </div>
    `).join('');
  }

  modal.classList.add('active');
}

function closeOfflineQueueModal() {
  document.getElementById('offline-queue-modal')?.classList.remove('active');
}

function clearOfflineQueue() {
  if (confirm('Are you sure you want to discard all queued offline transactions?')) {
    state.offlineQueue = [];
    localStorage.setItem('ub_offline_queue', '[]');
    updateNetworkStatusUI();
    closeOfflineQueueModal();
    showToast('Offline transaction queue cleared.', 'info');
  }
}

// -----------------------------------------------------------------------------
// DATA FETCHING & UI RENDERING
// -----------------------------------------------------------------------------
async function fetchAllData() {
  if (!state.token || !state.currentUser) return;

  const role = state.currentUser.role;

  try {
    // 1. Fetch Accounts
    const accRes = await fetch(`${API_BASE}/accounts`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (accRes.ok) {
      const accData = await accRes.json();
      state.accounts = accData.accounts || [];
      state.transactions = accData.recent_transactions || [];
      renderCustomerWorkspace(accData);
    }

    // 2. Fetch Cards
    const cardRes = await fetch(`${API_BASE}/cards`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (cardRes.ok) {
      const cardData = await cardRes.json();
      state.cards = cardData.cards || [];
      renderCardsList();
    }

    // 3. If Manager or Admin, fetch pending approvals
    if (role === 'MANAGER' || role === 'SYSTEM_ADMIN') {
      const appRes = await fetch(`${API_BASE}/manager/pending-approvals`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      if (appRes.ok) {
        const appData = await appRes.json();
        state.pendingApprovals = appData;
        renderManagerWorkspace(appData);
      }
    }

    // 4. If Admin, fetch dashboard telemetry & configs
    if (role === 'SYSTEM_ADMIN') {
      fetchAdminData();
    }

  } catch (err) {
    console.warn('Data fetch error (offline fallback in effect):', err);
  }
}

function renderCustomerWorkspace(data) {
  const totalBalanceEl = document.getElementById('hero-total-balance');
  const accCountEl = document.getElementById('hero-account-count');
  const grid = document.getElementById('customer-accounts-grid');
  const txnsTbody = document.getElementById('customer-txns-tbody');

  if (totalBalanceEl) {
    totalBalanceEl.innerText = formatUSD(data.total_liquidity);
  }
  if (accCountEl) {
    accCountEl.innerText = `${state.accounts.length} Active Accounts`;
  }

  // Populate Accounts Grid
  if (grid) {
    if (state.accounts.length === 0) {
      grid.innerHTML = '<div class="col-span-3 text-center py-6 text-slate-400">No deposit accounts found. Click "Add Account" to open one.</div>';
    } else {
      grid.innerHTML = state.accounts.map(acc => `
        <div class="clean-card p-5 flex flex-col justify-between clean-card-hover">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${acc.account_type}</span>
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div class="font-bold text-sm text-slate-800 dark:text-slate-100">${acc.account_name}</div>
            <div class="font-mono text-xs text-slate-400 mt-0.5">${acc.account_number}</div>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
            <div class="text-xl font-bold font-mono text-slate-900 dark:text-white">${formatUSD(acc.balance)}</div>
            <div class="text-[10px] font-bold text-emerald-600">${acc.interest_rate}% APY</div>
          </div>
        </div>
      `).join('');
    }
  }

  // Populate Transfer Source Account Dropdown
  const srcSelect = document.getElementById('transfer-source-acc');
  if (srcSelect) {
    srcSelect.innerHTML = state.accounts.map(a => `
      <option value="${a.account_number}">${a.account_name} (${a.account_number}) - ${formatUSD(a.balance)}</option>
    `).join('');
  }

  // Populate Transactions Table
  if (txnsTbody) {
    if (state.transactions.length === 0) {
      txnsTbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">No ledger transactions recorded yet.</td></tr>';
    } else {
      txnsTbody.innerHTML = state.transactions.map(t => {
        const isPending = t.status === 'PENDING_MANAGER_APPROVAL';
        const isCompleted = t.status === 'COMPLETED';
        const statusBadge = isPending 
          ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">Pending Approval</span>'
          : isCompleted
          ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">Completed</span>'
          : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Rejected</span>';

        return `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
            <td class="py-3 px-3 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">${t.ref_no}</td>
            <td class="py-3 px-3 text-slate-400">${formatDate(t.created_at)}</td>
            <td class="py-3 px-3">
              <div class="font-semibold text-slate-800 dark:text-slate-200">${t.recipient_name || 'N/A'}</div>
              <div class="text-[10px] text-slate-400">${t.description || 'Fund Transfer'}</div>
            </td>
            <td class="py-3 px-3">
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${t.transfer_channel}</span>
            </td>
            <td class="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">${formatUSD(t.amount)}</td>
            <td class="py-3 px-3 text-center">${statusBadge}</td>
            <td class="py-3 px-3 text-right">
              <button onclick='viewTransactionReceipt(${JSON.stringify(t)})' class="text-emerald-600 hover:text-emerald-700 text-xs font-semibold p-1" title="View Digital Receipt">
                <i class="fas fa-receipt"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

function renderCardsList() {
  const container = document.getElementById('cards-list-container');
  if (!container) return;

  if (state.cards.length === 0) {
    container.innerHTML = '<div class="text-center py-6 text-slate-400">No cards issued. Debit cards are provisioned automatically with Checking accounts.</div>';
    return;
  }

  container.innerHTML = state.cards.map(c => `
    <div class="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-emerald-400">${c.card_type}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full ${c.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} border border-current">
          ${c.status}
        </span>
      </div>
      <div class="font-mono text-base font-bold tracking-widest py-2">
        •••• •••• •••• ${c.card_number.slice(-4)}
      </div>
      <div class="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/10">
        <div>
          <div>CARDHOLDER</div>
          <div class="text-white font-bold">${c.holder_name}</div>
        </div>
        <div class="text-right">
          <div>EXPIRES</div>
          <div class="text-white font-bold">${c.expiry}</div>
        </div>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="handleCardAction('${c.card_number}', '${c.status === 'ACTIVE' ? 'FREEZE' : 'UNFREEZE'}')" class="btn-secondary flex-1 py-1 text-xs">
          ${c.status === 'ACTIVE' ? '<i class="fas fa-lock mr-1"></i> Freeze Card' : '<i class="fas fa-unlock mr-1"></i> Unfreeze'}
        </button>
        <button onclick="promptCardLimit('${c.card_number}')" class="btn-secondary py-1 px-3 text-xs">
          Set Limit
        </button>
      </div>
    </div>
  `).join('');
}

function renderManagerWorkspace(data) {
  const pendingBadge = document.getElementById('manager-pending-badge');
  const txnsTbody = document.getElementById('manager-txns-tbody');
  const loansTbody = document.getElementById('manager-loans-tbody');

  const count = (data.pending_transactions?.length || 0) + (data.pending_loans?.length || 0);
  if (pendingBadge) pendingBadge.innerText = `${count} Items`;

  if (txnsTbody) {
    if (!data.pending_transactions || data.pending_transactions.length === 0) {
      txnsTbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">Approval queue clear. No transactions pending dual-control.</td></tr>';
    } else {
      txnsTbody.innerHTML = data.pending_transactions.map(t => `
        <tr>
          <td class="py-3 px-3 font-mono font-bold">${t.ref_no}</td>
          <td class="py-3 px-3 font-mono text-[11px]">${t.source_account} → ${t.destination_account}</td>
          <td class="py-3 px-3 font-bold">${t.recipient_name}</td>
          <td class="py-3 px-3">${t.transfer_channel}</td>
          <td class="py-3 px-3 font-mono font-bold text-amber-600">${formatUSD(t.amount)}</td>
          <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">${t.fraud_risk_score}/100</span></td>
          <td class="py-3 px-3 text-right">
            <button onclick="handleManagerAction('${t.ref_no}', 'APPROVE')" class="btn-primary py-1 px-2.5 text-xs bg-emerald-600 mr-1">Approve</button>
            <button onclick="handleManagerAction('${t.ref_no}', 'REJECT')" class="btn-secondary py-1 px-2.5 text-xs text-rose-600">Reject</button>
          </td>
        </tr>
      `).join('');
    }
  }

  if (loansTbody) {
    if (!data.pending_loans || data.pending_loans.length === 0) {
      loansTbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">No credit facility applications pending review.</td></tr>';
    } else {
      loansTbody.innerHTML = data.pending_loans.map(l => `
        <tr>
          <td class="py-3 px-3 font-mono font-bold">${l.loan_ref}</td>
          <td class="py-3 px-3 font-bold">${l.borrower_name}</td>
          <td class="py-3 px-3">${l.loan_type}</td>
          <td class="py-3 px-3 font-mono font-bold">${formatUSD(l.principal)}</td>
          <td class="py-3 px-3 font-mono font-bold text-sky-600">${l.credit_score}</td>
          <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold">${l.risk_grade}</span></td>
          <td class="py-3 px-3 text-right">
            <button onclick="handleLoanReview('${l.loan_ref}', 'APPROVE')" class="btn-primary py-1 px-2.5 text-xs bg-emerald-600 mr-1">Approve & Disburse</button>
            <button onclick="handleLoanReview('${l.loan_ref}', 'REJECT')" class="btn-secondary py-1 px-2.5 text-xs text-rose-600">Reject</button>
          </td>
        </tr>
      `).join('');
    }
  }
}

async function fetchAdminData() {
  try {
    const [statsRes, usersRes, auditRes, configsRes] = await Promise.all([
      fetch(`${API_BASE}/admin/dashboard-stats`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
      fetch(`${API_BASE}/admin/users`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
      fetch(`${API_BASE}/admin/audit-logs`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
      fetch(`${API_BASE}/admin/configs`, { headers: { 'Authorization': `Bearer ${state.token}` } })
    ]);

    if (statsRes.ok) {
      const s = await statsRes.json();
      state.adminStats = s;
      document.getElementById('admin-tps-val').innerText = `${s.system_health.api_tps} req/s`;
      document.getElementById('admin-cpu-val').innerText = `${s.system_health.cpu_load_pct}%`;
      document.getElementById('admin-latency-val').innerText = `${s.system_health.db_latency_ms} ms`;
      document.getElementById('admin-thresh-val').innerText = formatUSD(parseFloat(s.config.high_value_approval_threshold || '10000'));
    }

    if (usersRes.ok) {
      const u = await usersRes.json();
      state.adminUsers = u.users || [];
      renderAdminUsersTable();
    }

    if (auditRes.ok) {
      const a = await auditRes.json();
      state.auditLogs = a.audit_logs || [];
      renderAuditLogsTable();
    }

    if (configsRes.ok) {
      const c = await configsRes.json();
      populateAdminConfigFields(c.configs || []);
    }

    // Trigger initial analytics fetch and start real-time telemetry polling
    fetchAdminAnalytics(false);
    if (!state.analyticsPollTimer) {
      state.analyticsPollTimer = setInterval(() => {
        if (state.currentUser?.role === 'SYSTEM_ADMIN' && state.activeAdminTab === 'analytics') {
          fetchAdminAnalytics(false);
        }
      }, 10000);
    }
  } catch (err) {
    console.error('Admin telemetry fetch failed:', err);
  }
}

function renderAdminUsersTable() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.adminUsers.map(u => `
    <tr>
      <td class="py-3 px-3 font-mono">${u.id}</td>
      <td class="py-3 px-3">
        <div class="font-bold text-slate-800 dark:text-slate-200">${u.full_name}</div>
        <div class="text-[10px] text-slate-400 font-mono">@${u.username}</div>
      </td>
      <td class="py-3 px-3 text-slate-500">${u.email}</td>
      <td class="py-3 px-3">
        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950">${u.kyc_tier}</span>
      </td>
      <td class="py-3 px-3">
        <span class="font-bold text-xs ${u.role === 'SYSTEM_ADMIN' ? 'text-rose-500' : u.role === 'MANAGER' ? 'text-purple-500' : u.role === 'TELLER' ? 'text-sky-500' : 'text-[#00B074]'}">
          ${u.role}
        </span>
      </td>
      <td class="py-3 px-3 text-right">
        <select onchange="handleUserRoleChange(${u.id}, this.value)" class="input-clean text-xs py-1 px-2 font-medium w-auto">
          <option value="CUSTOMER" ${u.role === 'CUSTOMER' ? 'selected' : ''}>Customer</option>
          <option value="TELLER" ${u.role === 'TELLER' ? 'selected' : ''}>Teller</option>
          <option value="MANAGER" ${u.role === 'MANAGER' ? 'selected' : ''}>Manager</option>
          <option value="SYSTEM_ADMIN" ${u.role === 'SYSTEM_ADMIN' ? 'selected' : ''}>System Admin</option>
        </select>
      </td>
    </tr>
  `).join('');
}

function renderAuditLogsTable(filter = '') {
  const tbody = document.getElementById('admin-audit-tbody');
  if (!tbody) return;

  const f = filter.toLowerCase();
  const list = state.auditLogs.filter(l => 
    !f || l.actor_username.toLowerCase().includes(f) || l.action_type.toLowerCase().includes(f) || l.target_entity.toLowerCase().includes(f)
  );

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-slate-400">No matching audit logs found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(l => `
    <tr>
      <td class="py-2 px-3 text-slate-400">${l.timestamp}</td>
      <td class="py-2 px-3 font-bold">${l.actor_username} <span class="text-[9px] text-slate-400">(${l.actor_role})</span></td>
      <td class="py-2 px-3 font-semibold text-emerald-600">${l.action_type}</td>
      <td class="py-2 px-3 font-mono">${l.target_entity}</td>
      <td class="py-2 px-3 text-[10px] text-slate-500 max-w-xs truncate">${l.details}</td>
      <td class="py-2 px-3 font-mono text-[10px] text-sky-600">${l.signature_hash}</td>
    </tr>
  `).join('');
}

function filterAuditLogs(val) {
  renderAuditLogsTable(val);
}

function toggleAdminModuleDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('admin-module-dropdown-menu');
  const caret = document.getElementById('admin-dropdown-caret');
  if (menu) {
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    if (caret) caret.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}

// Close admin module dropdown on outside click
document.addEventListener('click', (e) => {
  const container = document.getElementById('admin-module-dropdown-container');
  const menu = document.getElementById('admin-module-dropdown-menu');
  const caret = document.getElementById('admin-dropdown-caret');
  if (container && menu && !container.contains(e.target)) {
    menu.classList.add('hidden');
    if (caret) caret.style.transform = 'rotate(0deg)';
  }
});

function setAdminTab(tab) {
  state.activeAdminTab = tab;
  ['analytics', 'forecasts', 'users', 'settings', 'audit', 'db'].forEach(t => {
    document.getElementById(`admin-tab-${t}`)?.classList.toggle('active', t === tab);
    document.getElementById(`admin-view-${t}`)?.classList.toggle('hidden', t !== tab);
  });

  // Update side dropdown button label and active indicator
  const moduleMeta = {
    analytics: { name: 'Analytics & Health', icon: 'fa-chart-line', color: 'text-emerald-500' },
    forecasts: { name: 'Forecasts & Insights', icon: 'fa-wand-magic-sparkles', color: 'text-purple-500' },
    users: { name: 'RBAC Users Matrix', icon: 'fa-users-gear', color: 'text-sky-500' },
    settings: { name: 'System Settings', icon: 'fa-sliders', color: 'text-amber-500' },
    audit: { name: 'Audit Trail', icon: 'fa-fingerprint', color: 'text-rose-500' },
    db: { name: 'Database Diagnostics', icon: 'fa-database', color: 'text-slate-400' }
  };

  const meta = moduleMeta[tab] || moduleMeta.analytics;
  const labelEl = document.getElementById('admin-selected-module-label');
  if (labelEl) {
    labelEl.innerHTML = `<i class="fas ${meta.icon} ${meta.color}"></i> <span>${meta.name}</span>`;
  }
  const viewNameEl = document.getElementById('admin-active-view-name');
  if (viewNameEl) {
    viewNameEl.innerText = meta.name;
  }
  const indicatorIcon = document.getElementById('admin-module-indicator-icon');
  if (indicatorIcon) {
    indicatorIcon.className = `fas ${meta.icon}`;
  }

  // Highlight active option in dropdown
  document.querySelectorAll('.admin-dropdown-opt').forEach(opt => {
    const isThisTab = opt.getAttribute('data-tab') === tab;
    opt.classList.toggle('bg-slate-100', isThisTab);
    opt.classList.toggle('dark:bg-slate-800/80', isThisTab);
  });

  // Close dropdown menu
  const menu = document.getElementById('admin-module-dropdown-menu');
  const caret = document.getElementById('admin-dropdown-caret');
  if (menu) menu.classList.add('hidden');
  if (caret) caret.style.transform = 'rotate(0deg)';

  if (tab === 'analytics') {
    fetchAdminAnalytics(false);
  } else if (tab === 'forecasts') {
    fetchAdminForecasts(state.forecastHorizonDays);
  } else if (tab === 'db') {
    runDbMaintenance('CHECK');
  }
}

// -----------------------------------------------------------------------------
// ADMIN ANALYTICS & VISUALIZATION ENGINE (Chart.js Integration)
// -----------------------------------------------------------------------------

function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    textColor: isDark ? '#94A3B8' : '#64748B',
    gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
    tooltipBg: isDark ? '#1E293B' : '#0F172A',
    tooltipText: '#FFFFFF',
    font: { family: "'Inter', sans-serif" }
  };
}

async function fetchAdminAnalytics(isManual = false) {
  if (!state.token || state.currentUser?.role !== 'SYSTEM_ADMIN') return;

  const refreshIcon = document.getElementById('analytics-refresh-icon');
  if (refreshIcon && isManual) refreshIcon.classList.add('fa-spin');

  try {
    const [overviewRes, chartsRes] = await Promise.all([
      fetch(`${API_BASE}/admin/analytics/overview`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
      fetch(`${API_BASE}/admin/analytics/charts`, { headers: { 'Authorization': `Bearer ${state.token}` } })
    ]);

    if (overviewRes.ok) {
      const overview = await overviewRes.json();
      state.adminAnalytics = overview;
      renderAdminTelemetryOverview(overview);
    }

    if (chartsRes.ok) {
      const chartsData = await chartsRes.json();
      renderTransactionTrendChart(chartsData.trend_chart);
      renderLoanPortfolioChart(chartsData.loan_portfolio_chart);
      renderUserGrowthChart(chartsData.user_growth_chart);
    }

    const updatedEl = document.getElementById('analytics-last-updated');
    if (updatedEl) {
      updatedEl.innerText = `Last updated: ${new Date().toLocaleTimeString()} (Atomic DB sync nominal)`;
    }
  } catch (err) {
    console.error('Failed to load admin analytics:', err);
  } finally {
    if (refreshIcon && isManual) {
      setTimeout(() => refreshIcon.classList.remove('fa-spin'), 600);
    }
  }
}

function renderAdminTelemetryOverview(data) {
  const m = data.metrics_24h || {};
  const t = data.telemetry || {};

  // Active Users Card
  const activeUsersEl = document.getElementById('stat-active-users');
  if (activeUsersEl) activeUsersEl.innerText = m.active_users_today ?? '--';
  const totalUsersEl = document.getElementById('stat-total-users');
  if (totalUsersEl) totalUsersEl.innerText = `${m.total_users ?? 0} total`;
  const verifiedPctEl = document.getElementById('stat-verified-pct');
  if (verifiedPctEl) verifiedPctEl.innerText = `${m.verified_users_pct ?? 100}% verified`;

  // 24h Volumes Card
  const inflowEl = document.getElementById('stat-inflow-24h');
  if (inflowEl) inflowEl.innerText = `+${formatUSD(m.inflow_volume_24h || 0)}`;
  const outflowEl = document.getElementById('stat-outflow-24h');
  if (outflowEl) outflowEl.innerText = `-${formatUSD(m.outflow_volume_24h || 0)}`;
  const txCountEl = document.getElementById('stat-tx-count-24h');
  if (txCountEl) txCountEl.innerText = `${m.total_transactions_24h ?? 0} txns`;

  // Cluster Uptime Card
  const uptimeEl = document.getElementById('stat-cluster-uptime');
  if (uptimeEl) uptimeEl.innerText = t.server_uptime || '99.99%';
  const regionEl = document.getElementById('stat-active-region');
  if (regionEl) regionEl.innerText = t.active_cluster_region || 'AWS ap-southeast-1';

  // DB Latency Card
  const latencyEl = document.getElementById('stat-db-latency');
  if (latencyEl) latencyEl.innerText = `${t.db_query_latency_ms ?? 0.85} ms`;

  // Exception Logs Card
  const exceptionsEl = document.getElementById('stat-exceptions-count');
  if (exceptionsEl) exceptionsEl.innerText = t.error_exception_logs_count ?? 0;
  const threatLevelEl = document.getElementById('analytics-threat-level');
  if (threatLevelEl) threatLevelEl.innerText = t.security_threat_level || 'NOMINAL';
}

function renderTransactionTrendChart(data) {
  if (!data || !window.Chart) return;
  const canvas = document.getElementById('chart-transaction-trend');
  if (!canvas) return;

  const colors = getChartColors();

  if (state.charts.trend) {
    state.charts.trend.destroy();
  }

  const ctx = canvas.getContext('2d');
  
  const formattedLabels = (data.labels || []).map(d => {
    try {
      const parts = d.split('-');
      if (parts.length === 3) {
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return d;
    } catch {
      return d;
    }
  });

  state.charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: formattedLabels,
      datasets: [
        {
          label: 'Inflow ($ USD)',
          data: data.inflow || [],
          borderColor: '#00B074',
          backgroundColor: 'rgba(0, 176, 116, 0.12)',
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          label: 'Outflow ($ USD)',
          data: data.outflow || [],
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          label: 'Net Gross Volume',
          data: data.net_volume || [],
          borderColor: '#0EA5E9',
          borderWidth: 2,
          borderDash: [4, 4],
          tension: 0.35,
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          titleFont: { weight: 'bold', family: "'Inter', sans-serif" },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${formatUSD(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: colors.gridColor, drawBorder: false },
          ticks: { color: colors.textColor, font: { size: 10, family: "'Inter', sans-serif" }, maxTicksLimit: 10 }
        },
        y: {
          grid: { color: colors.gridColor, drawBorder: false },
          ticks: {
            color: colors.textColor,
            font: { size: 10, family: "'Inter', sans-serif" },
            callback: value => `$${(value / 1000).toFixed(0)}k`
          }
        }
      }
    }
  });
}

function renderLoanPortfolioChart(data) {
  if (!data || !window.Chart) return;
  const canvas = document.getElementById('chart-loan-portfolio');
  if (!canvas) return;

  const colors = getChartColors();

  if (state.charts.loan) {
    state.charts.loan.destroy();
  }

  const sb = data.status_breakdown || { labels: ['Approved', 'Pending', 'Defaulted'], counts: [0, 0, 0], amounts: [0, 0, 0] };

  const appVal = document.getElementById('loan-stat-approved-val');
  if (appVal) appVal.innerText = sb.counts[0] ?? 0;
  const pendVal = document.getElementById('loan-stat-pending-val');
  if (pendVal) pendVal.innerText = sb.counts[1] ?? 0;
  const defVal = document.getElementById('loan-stat-default-val');
  if (defVal) defVal.innerText = sb.counts[2] ?? 0;

  const ctx = canvas.getContext('2d');
  state.charts.loan = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sb.labels,
      datasets: [{
        data: sb.counts.some(c => c > 0) ? sb.counts : [1, 0, 0],
        backgroundColor: ['#00B074', '#F59E0B', '#EF4444'],
        hoverBackgroundColor: ['#009663', '#D97706', '#DC2626'],
        borderWidth: 2,
        borderColor: colors.borderColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const count = context.parsed;
              const idx = context.dataIndex;
              const amt = sb.amounts ? sb.amounts[idx] : 0;
              return `${context.label}: ${count} facilities (${formatUSD(amt)})`;
            }
          }
        }
      }
    }
  });
}

function renderUserGrowthChart(data) {
  if (!data || !window.Chart) return;
  const canvas = document.getElementById('chart-user-growth');
  if (!canvas) return;

  const colors = getChartColors();

  if (state.charts.userGrowth) {
    state.charts.userGrowth.destroy();
  }

  const ctx = canvas.getContext('2d');
  state.charts.userGrowth = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels || [],
      datasets: [
        {
          label: 'New Registrations',
          data: data.new_registrations || [],
          backgroundColor: '#0EA5E9',
          borderRadius: 6,
          barPercentage: 0.6,
          categoryPercentage: 0.6
        },
        {
          label: 'Active Daily Users',
          data: data.active_users || [],
          backgroundColor: '#6366F1',
          borderRadius: 6,
          barPercentage: 0.6,
          categoryPercentage: 0.6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y} users`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.textColor, font: { size: 10, family: "'Inter', sans-serif" } }
        },
        y: {
          grid: { color: colors.gridColor, drawBorder: false },
          ticks: { color: colors.textColor, font: { size: 10, family: "'Inter', sans-serif" }, precision: 0 }
        }
      }
    }
  });
}

// -----------------------------------------------------------------------------
// PREDICTIVE ANALYTICS & FORECASTING CONTROLLER
// -----------------------------------------------------------------------------

async function fetchAdminForecasts(horizonDays = 30) {
  if (!state.token || state.currentUser?.role !== 'SYSTEM_ADMIN') return;
  state.forecastHorizonDays = horizonDays;

  [30, 60, 90].forEach(d => {
    const pill = document.getElementById(`forecast-pill-${d}`);
    if (pill) {
      if (d === horizonDays) {
        pill.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-purple-600 text-white shadow-sm';
      } else {
        pill.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white';
      }
    }
  });

  try {
    const res = await fetch(`${API_BASE}/admin/analytics/forecasts?days=${horizonDays}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) return;

    const data = await res.json();
    state.adminForecast = data;

    const s = data.summary_insights || {};
    const totVolEl = document.getElementById('forecast-total-vol');
    if (totVolEl) totVolEl.innerText = formatUSD(s.projected_total_volume || 0);

    const deltaPctEl = document.getElementById('forecast-delta-pct');
    if (deltaPctEl) {
      const sign = (s.projected_growth_delta_pct || 0) >= 0 ? '+' : '';
      deltaPctEl.innerText = `${sign}${s.projected_growth_delta_pct || 0}% projected delta`;
    }

    const netLiqEl = document.getElementById('forecast-net-liquidity');
    if (netLiqEl) netLiqEl.innerText = formatUSD(s.estimated_net_liquidity_inflow || 0);

    const peakDayEl = document.getElementById('forecast-peak-day');
    if (peakDayEl) peakDayEl.innerText = s.predicted_peak_day || 'Day 22 (Month-End)';

    const peakVolEl = document.getElementById('forecast-peak-vol');
    if (peakVolEl) peakVolEl.innerText = `Peak: ${formatUSD(s.predicted_peak_volume || 0)}`;

    const peakTpsEl = document.getElementById('forecast-peak-tps');
    if (peakTpsEl) peakTpsEl.innerText = `${s.estimated_peak_tps || 72.0} req/s`;

    renderForecastChart(data);
    renderForecastRecommendations(data.executive_recommendations || []);

  } catch (err) {
    console.error('Forecast fetch failed:', err);
  }
}

function switchForecastHorizon(days) {
  fetchAdminForecasts(days);
}

function renderForecastChart(data) {
  if (!data || !window.Chart) return;
  const canvas = document.getElementById('chart-forecast-trend');
  if (!canvas) return;

  const colors = getChartColors();

  if (state.charts.forecast) {
    state.charts.forecast.destroy();
  }

  const proj = data.projections || {};
  const histDates = proj.historical_recent_dates || [];
  const histVols = proj.historical_recent_volumes || [];
  const fDates = proj.dates || [];
  const fVols = proj.projected_volumes || [];
  const ciUpper = proj.ci_upper || [];
  const ciLower = proj.ci_lower || [];

  const allLabels = [...histDates, ...fDates].map(d => {
    try {
      const parts = d.split('-');
      if (parts.length === 3) {
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return d;
    } catch {
      return d;
    }
  });

  const histSeries = [...histVols];
  for (let i = 0; i < fDates.length; i++) {
    histSeries.push(null);
  }

  const forecastSeries = [];
  const ciUpperSeries = [];
  const ciLowerSeries = [];

  for (let i = 0; i < histDates.length - 1; i++) {
    forecastSeries.push(null);
    ciUpperSeries.push(null);
    ciLowerSeries.push(null);
  }

  const anchorVal = histVols.length > 0 ? histVols[histVols.length - 1] : null;
  forecastSeries.push(anchorVal);
  ciUpperSeries.push(anchorVal);
  ciLowerSeries.push(anchorVal);

  fVols.forEach((v, idx) => {
    forecastSeries.push(v);
    ciUpperSeries.push(ciUpper[idx] !== undefined ? ciUpper[idx] : v);
    ciLowerSeries.push(ciLower[idx] !== undefined ? ciLower[idx] : v);
  });

  const ctx = canvas.getContext('2d');
  state.charts.forecast = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        {
          label: 'Historical Actuals',
          data: histSeries,
          borderColor: '#94A3B8',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          label: 'Projected Trend',
          data: forecastSeries,
          borderColor: '#8B5CF6',
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 6
        },
        {
          label: '95% CI Upper',
          data: ciUpperSeries,
          borderColor: 'rgba(139, 92, 246, 0.25)',
          borderDash: [3, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill: '+1',
          backgroundColor: 'rgba(139, 92, 246, 0.10)'
        },
        {
          label: '95% CI Lower',
          data: ciLowerSeries,
          borderColor: 'rgba(139, 92, 246, 0.25)',
          borderDash: [3, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              if (context.parsed.y === null || isNaN(context.parsed.y)) return null;
              return `${context.dataset.label}: ${formatUSD(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: colors.gridColor, drawBorder: false },
          ticks: { color: colors.textColor, font: { size: 10, family: "'Inter', sans-serif" }, maxTicksLimit: 12 }
        },
        y: {
          grid: { color: colors.gridColor, drawBorder: false },
          ticks: {
            color: colors.textColor,
            font: { size: 10, family: "'Inter', sans-serif" },
            callback: value => `$${(value / 1000).toFixed(0)}k`
          }
        }
      }
    }
  });
}

function renderForecastRecommendations(recs) {
  const container = document.getElementById('forecast-recommendations-grid');
  if (!container) return;

  if (!recs || recs.length === 0) {
    container.innerHTML = '<div class="col-span-3 text-center text-slate-400 py-4">No active recommendations for current horizon.</div>';
    return;
  }

  container.innerHTML = recs.map(r => {
    const badgeClass = r.category === 'TREASURY' ? 'badge-treasury' :
                       r.category === 'DEVOPS' ? 'badge-devops' : 'badge-risk';
    const iconClass = r.category === 'TREASURY' ? 'fa-vault' :
                      r.category === 'DEVOPS' ? 'fa-server' : 'fa-shield-halved';

    return `
      <div class="recommendation-card">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeClass}">
              <i class="fas ${iconClass} mr-1"></i> ${r.category} • ${r.urgency}
            </span>
            <span class="text-[10px] text-slate-400 font-mono">AUTONOMIC</span>
          </div>
          <h4 class="text-xs font-bold text-slate-900 dark:text-white">${r.title}</h4>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
            ${r.recommendation}
          </p>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <i class="fas fa-circle-check mr-1"></i> ${r.action}
          </span>
          <button onclick="showToast('Executive recommendation protocol staged for administrative review.', 'info', 'Recommendation Staged')" class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <i class="fas fa-chevron-right text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function updateChartsTheme() {
  if (state.charts.trend && state.charts.trend.data) {
    renderTransactionTrendChart(state.charts.trend.data);
  }
  if (state.charts.loan && state.charts.loan.data) {
    renderLoanPortfolioChart(state.charts.loan.data);
  }
  if (state.charts.userGrowth && state.charts.userGrowth.data) {
    renderUserGrowthChart(state.charts.userGrowth.data);
  }
  if (state.charts.forecast && state.adminForecast) {
    renderForecastChart(state.adminForecast);
  }
}

function populateAdminConfigFields(configs) {
  configs.forEach(c => {
    if (c.key === 'high_value_approval_threshold') {
      const el = document.getElementById('setting-high-val');
      if (el) el.value = c.value;
    } else if (c.key === 'daily_default_card_limit') {
      const el = document.getElementById('setting-card-limit');
      if (el) el.value = c.value;
    } else if (c.key === 'admin_bootstrap_key') {
      const el = document.getElementById('setting-admin-key');
      if (el) el.value = c.value;
    } else if (c.key === 'ollama_endpoint') {
      const el = document.getElementById('setting-ollama-url');
      if (el) el.value = c.value;
    } else if (c.key === 'ollama_model') {
      const el = document.getElementById('setting-ollama-model');
      if (el) el.value = c.value;
    } else if (c.key === 'cloud_provider') {
      const el = document.getElementById('setting-cloud-prov');
      if (el) el.value = c.value;
    } else if (c.key === 'dual_control_approval') {
      const el = document.getElementById('toggle-dual-control');
      if (el) el.checked = c.value === 'ENABLED';
    } else if (c.key === 'fraud_detection_engine') {
      const el = document.getElementById('toggle-fraud-engine');
      if (el) el.checked = c.value === 'ENABLED' || c.value === 'ENABLED_ACTIVE';
    } else if (c.key === 'biometric_kyc_enforced') {
      const el = document.getElementById('toggle-biometric-kyc');
      if (el) el.checked = c.value === 'ENABLED';
    } else if (c.key === 'maintenance_mode') {
      const el = document.getElementById('toggle-maintenance');
      if (el) el.checked = c.value === 'ENABLED';
    }
  });
}

async function saveConfigParam(key, inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const value = input.value.trim();

  try {
    const res = await fetch(`${API_BASE}/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ key, value })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success', 'Setting Saved');
      fetchAllData();
    }
  } catch (err) {
    showToast('Failed to update system config parameter.', 'error');
  }
}

async function toggleSecuritySetting(key, isChecked) {
  const value = isChecked ? 'ENABLED' : 'DISABLED';
  try {
    const res = await fetch(`${API_BASE}/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ key, value })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`${key}: ${value}`, 'info', 'Security Policy Updated');
    }
  } catch (err) {
    showToast('Failed to update security policy toggle.', 'error');
  }
}

async function handleUserRoleChange(userId, newRole) {
  try {
    const res = await fetch(`${API_BASE}/admin/users/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ user_id: userId, role: newRole })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success', 'Role Assigned');
      fetchAdminData();
    }
  } catch (err) {
    showToast('Failed to reassign user role.', 'error');
  }
}

async function runDbMaintenance(action) {
  try {
    const res = await fetch(`${API_BASE}/admin/db-maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ action })
    });
    const data = await res.json();

    if (res.ok) {
      showToast(data.message, 'success', `DB Maintenance (${action})`);
      const container = document.getElementById('db-stats-container');
      if (container && data.table_stats) {
        container.innerHTML = `
          <div class="clean-card p-3 col-span-2 sm:col-span-4 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center">
            <div>
              <div class="font-bold text-slate-800 dark:text-slate-200">Database Size: ${data.db_size_formatted}</div>
              <div class="text-[10px] text-slate-400">Atomic SQLite Ledger</div>
            </div>
            <span class="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">Integrity Passed</span>
          </div>
          ${Object.entries(data.table_stats).map(([tbl, count]) => `
            <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
              <span class="font-mono text-slate-500">${tbl}</span>
              <span class="font-bold font-mono text-slate-900 dark:text-white">${count} rows</span>
            </div>
          `).join('')}
        `;
      }
    }
  } catch (err) {
    showToast('Database maintenance call failed.', 'error');
  }
}

// -----------------------------------------------------------------------------
// USER ACTIONS & TRANSACTIONS (Online + Offline Supported)
// -----------------------------------------------------------------------------
function toggleBalanceVisibility() {
  state.isBalanceHidden = !state.isBalanceHidden;
  localStorage.setItem('ub_hide_balance', state.isBalanceHidden);

  const eyeIcon = document.getElementById('eye-icon');
  if (eyeIcon) {
    eyeIcon.className = state.isBalanceHidden ? 'fas fa-eye-slash text-sm' : 'fas fa-eye text-sm';
  }

  // Refresh balance numbers
  fetchAllData();
}

function openTransferModal() {
  document.getElementById('transfer-modal')?.classList.add('active');
}
function closeTransferModal() {
  document.getElementById('transfer-modal')?.classList.remove('active');
}

function openOpenAccountModal() {
  document.getElementById('open-account-modal')?.classList.add('active');
}
function closeOpenAccountModal() {
  document.getElementById('open-account-modal')?.classList.remove('active');
}

function openCardsModal() {
  renderCardsList();
  document.getElementById('cards-modal')?.classList.add('active');
}
function closeCardsModal() {
  document.getElementById('cards-modal')?.classList.remove('active');
}

function openLoanModal() {
  const nameInput = document.getElementById('loan-borrower-name');
  const emailInput = document.getElementById('loan-borrower-email');
  if (state.currentUser) {
    if (nameInput) nameInput.value = state.currentUser.full_name;
    if (emailInput) emailInput.value = state.currentUser.email || `${state.currentUser.username}@unitybank.io`;
  }
  document.getElementById('loan-modal')?.classList.add('active');
}
function closeLoanModal() {
  document.getElementById('loan-modal')?.classList.remove('active');
}

async function handleExecuteTransfer(e) {
  e.preventDefault();
  const source_account = document.getElementById('transfer-source-acc').value;
  const destination_account = document.getElementById('transfer-dest-acc').value.trim();
  const recipient_name = document.getElementById('transfer-recipient-name').value.trim();
  const amount = parseFloat(document.getElementById('transfer-amount').value);
  const description = document.getElementById('transfer-desc').value.trim();

  let transfer_channel = 'INTERNAL';
  const channelRadios = document.getElementsByName('transfer-channel');
  for (const r of channelRadios) {
    if (r.checked) {
      transfer_channel = r.value;
      break;
    }
  }

  closeTransferModal();

  // If in Offline Mode: queue transaction locally and issue offline receipt voucher
  if (state.isOfflineMode) {
    const offlineRef = `UB-OFFLINE-${Date.now().toString(36).toUpperCase()}`;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const offlineItem = {
      offline_ref: offlineRef,
      operation_type: 'TRANSFER',
      source_account,
      destination_account,
      recipient_name,
      amount,
      channel: transfer_channel,
      description,
      timestamp: nowStr,
      signature: `SIG-OFFLINE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    };

    state.offlineQueue.push(offlineItem);
    localStorage.setItem('ub_offline_queue', JSON.stringify(state.offlineQueue));
    updateNetworkStatusUI();

    showReceipt({
      ref_no: offlineRef,
      source_account,
      recipient_name,
      amount,
      channel: `Offline ${transfer_channel}`,
      status: 'QUEUED_OFFLINE',
      timestamp: nowStr,
      signature: offlineItem.signature,
      isOffline: true
    });

    showToast(`Offline transfer of ${formatUSD(amount)} logged into local queue.`, 'warning', 'Offline Transaction');
    return;
  }

  // Online execution
  try {
    const res = await fetch(`${API_BASE}/transfers/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({
        source_account,
        destination_account,
        recipient_name,
        transfer_channel,
        amount,
        description
      })
    });
    const data = await res.json();

    if (!res.ok || data.status !== 'success') {
      throw new Error(data.detail || 'Transfer failed.');
    }

    if (data.receipt) {
      showReceipt(data.receipt);
    }
    showToast(data.message, data.requires_manager_approval ? 'warning' : 'success', 'Transfer Processed');
    fetchAllData();
  } catch (err) {
    showToast(err.message, 'error', 'Transfer Failed');
  }
}

async function handleCreateAccountSubmit(e) {
  e.preventDefault();
  const account_name = document.getElementById('new-acc-name').value.trim();
  const account_type = document.getElementById('new-acc-type').value;
  const initial_deposit = parseFloat(document.getElementById('new-acc-deposit').value || '500');

  closeOpenAccountModal();

  try {
    const res = await fetch(`${API_BASE}/accounts/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ account_name, account_type, initial_deposit })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success', 'Account Opened');
      fetchAllData();
    }
  } catch (err) {
    showToast('Could not open account.', 'error');
  }
}

async function handleApplyLoan(e) {
  e.preventDefault();
  const borrower_name = document.getElementById('loan-borrower-name').value.trim();
  const borrower_email = document.getElementById('loan-borrower-email').value.trim();
  const loan_type = document.getElementById('loan-type-select').value;
  const principal = parseFloat(document.getElementById('loan-principal').value);
  const term_months = parseInt(document.getElementById('loan-term').value);
  const monthly_income = parseFloat(document.getElementById('loan-income').value);
  const purpose = document.getElementById('loan-purpose').value.trim();

  closeLoanModal();

  try {
    const res = await fetch(`${API_BASE}/loans/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({
        borrower_name,
        borrower_email,
        loan_type,
        principal,
        term_months,
        monthly_income,
        collateral_type: 'Liquid Reserves & Assets',
        collateral_value: principal * 1.25,
        purpose
      })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Application ${data.loan_ref} submitted! Credit Score: ${data.credit_score} (${data.risk_grade})`, 'success', 'Credit Facility Applied');
      fetchAllData();
    }
  } catch (err) {
    showToast('Failed to submit loan application.', 'error');
  }
}

async function handleCardAction(cardNumber, action) {
  try {
    const res = await fetch(`${API_BASE}/cards/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ card_number: cardNumber, action })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success', 'Card Control');
      fetchAllData();
    }
  } catch (err) {
    showToast('Failed to execute card action.', 'error');
  }
}

function promptCardLimit(cardNumber) {
  const newLimit = prompt('Enter new daily spending limit ($):', '15000');
  if (newLimit && !isNaN(newLimit)) {
    fetch(`${API_BASE}/cards/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ card_number: cardNumber, action: 'UPDATE_LIMIT', new_limit: parseFloat(newLimit) })
    }).then(res => res.json()).then(data => {
      showToast(data.message, 'success', 'Limit Adjusted');
      fetchAllData();
    });
  }
}

// -----------------------------------------------------------------------------
// TELLER DESK ACTIONS (Online + Offline)
// -----------------------------------------------------------------------------
async function handleTellerCashOperation(e) {
  e.preventDefault();
  const account_number = document.getElementById('teller-acc-number').value.trim();
  const amount = parseFloat(document.getElementById('teller-amount').value);
  const teller_notes = document.getElementById('teller-notes').value.trim();

  let operation = 'DEPOSIT';
  const opRadios = document.getElementsByName('teller-op');
  for (const r of opRadios) {
    if (r.checked) {
      operation = r.value;
      break;
    }
  }

  // Offline Teller Cash Handling
  if (state.isOfflineMode) {
    const offlineRef = `UB-OTC-OFFLINE-${Date.now().toString(36).toUpperCase()}`;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const offlineItem = {
      offline_ref: offlineRef,
      operation_type: operation,
      source_account: operation === 'WITHDRAWAL' ? account_number : null,
      destination_account: operation === 'DEPOSIT' ? account_number : null,
      recipient_name: 'Over-The-Counter Cash Customer',
      amount,
      channel: `OFFLINE_OTC_${operation}`,
      description: teller_notes || 'Over-the-counter teller transaction',
      timestamp: nowStr,
      signature: `SIG-OTC-OFFLINE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    };

    state.offlineQueue.push(offlineItem);
    localStorage.setItem('ub_offline_queue', JSON.stringify(state.offlineQueue));
    updateNetworkStatusUI();

    showReceipt({
      ref_no: offlineRef,
      source_account: account_number,
      recipient_name: 'Cash Customer',
      amount,
      channel: `Offline OTC ${operation}`,
      status: 'COMPLETED_OFFLINE',
      timestamp: nowStr,
      signature: offlineItem.signature,
      isOffline: true
    });

    showToast(`Offline OTC ${operation} recorded. Receipt generated.`, 'warning', 'Teller Offline Queue');
    return;
  }

  // Online execution
  try {
    const res = await fetch(`${API_BASE}/teller/cash-operation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ account_number, operation, amount, teller_notes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Teller transaction failed.');

    if (data.receipt) {
      showReceipt({
        ref_no: data.receipt.ref_no,
        source_account: data.receipt.account_number,
        recipient_name: data.receipt.account_name,
        amount: data.receipt.amount,
        channel: `OTC ${data.receipt.operation}`,
        status: 'COMPLETED',
        timestamp: data.receipt.timestamp,
        signature: `SIG-TELLER-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
      });
    }

    showToast(data.message, 'success', 'Teller Operation Complete');
    fetchAllData();
  } catch (err) {
    showToast(err.message, 'error', 'Teller Error');
  }
}

async function handleTellerVerifyCustomer(e) {
  e.preventDefault();
  const account_number = document.getElementById('teller-verify-acc').value.trim();
  const id_type = document.getElementById('teller-id-type').value;
  const id_number = document.getElementById('teller-id-number').value.trim();

  try {
    const res = await fetch(`${API_BASE}/teller/verify-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ account_number, id_type, id_number })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Verification failed.');

    const resContainer = document.getElementById('teller-verify-result');
    if (resContainer && data.customer) {
      resContainer.classList.remove('hidden');
      document.getElementById('lookup-customer-name').innerText = data.customer.full_name;
      document.getElementById('lookup-customer-contact').innerText = `${data.customer.email} • ${data.customer.phone}`;
      document.getElementById('lookup-customer-balance').innerText = `Primary Balance: ${formatUSD(data.customer.balance)}`;
    }
    showToast(data.message, 'success', 'KYC Upgraded');
  } catch (err) {
    showToast(err.message, 'error', 'Lookup Failed');
  }
}

// -----------------------------------------------------------------------------
// MANAGER WORKSTATION APPROVALS
// -----------------------------------------------------------------------------
async function handleManagerAction(refNo, action) {
  const note = prompt(`Enter manager compliance note for ${action} of ${refNo}:`, `Authorized by Manager ${state.currentUser?.full_name}`);
  if (note === null) return;

  try {
    const res = await fetch(`${API_BASE}/manager/action-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ ref_no: refNo, action, note })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, action === 'APPROVE' ? 'success' : 'warning', 'Manager Action Logged');
      fetchAllData();
    }
  } catch (err) {
    showToast('Failed to record manager action.', 'error');
  }
}

async function handleLoanReview(loanRef, action) {
  const note = prompt(`Enter risk decision note for ${action} of loan ${loanRef}:`, `Adjudicated by ${state.currentUser?.full_name}`);
  if (note === null) return;

  try {
    const res = await fetch(`${API_BASE}/loans/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ loan_ref: loanRef, action, note })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, action === 'APPROVE' ? 'success' : 'warning', 'Loan Decision');
      fetchAllData();
    }
  } catch (err) {
    showToast('Failed to review loan facility.', 'error');
  }
}

// -----------------------------------------------------------------------------
// DIGITAL RECEIPT VOUCHER MODAL
// -----------------------------------------------------------------------------
function showReceipt(data) {
  const modal = document.getElementById('receipt-modal');
  if (!modal) return;

  document.getElementById('receipt-amount').innerText = formatUSD(data.amount);
  document.getElementById('receipt-status').innerText = data.status || 'COMPLETED';
  document.getElementById('receipt-ref').innerText = data.ref_no || 'UB-TXN-STAMP';
  document.getElementById('receipt-time').innerText = data.timestamp || new Date().toLocaleString();
  document.getElementById('receipt-channel').innerText = data.channel || 'Internal Transfer';
  document.getElementById('receipt-recipient').innerText = data.recipient_name || 'UnityBank Beneficiary';
  document.getElementById('receipt-account').innerText = data.source_account || data.destination_account || 'Primary Checking';
  document.getElementById('receipt-sig').innerText = data.signature || `SIG-SEC-${Math.random().toString(36).substring(2, 12).toUpperCase()}`;

  const offTag = document.getElementById('receipt-offline-tag');
  if (offTag) {
    if (data.isOffline) offTag.classList.remove('hidden');
    else offTag.classList.add('hidden');
  }

  modal.classList.add('active');
}

function viewTransactionReceipt(t) {
  showReceipt({
    ref_no: t.ref_no,
    amount: t.amount,
    status: t.status,
    timestamp: t.created_at,
    channel: t.transfer_channel,
    recipient_name: t.recipient_name,
    source_account: t.source_account,
    signature: t.audit_hash
  });
}

function closeReceiptModal() {
  document.getElementById('receipt-modal')?.classList.remove('active');
}

// -----------------------------------------------------------------------------
// 100% OFFLINE AI ASSISTANT CONCIERGE INTEGRATION
// -----------------------------------------------------------------------------
function toggleChatDrawer() {
  const drawer = document.getElementById('chat-drawer');
  if (!drawer) return;
  state.isChatOpen = !state.isChatOpen;
  drawer.classList.toggle('hidden', !state.isChatOpen);
  drawer.classList.toggle('flex', state.isChatOpen);

  if (state.isChatOpen) {
    fetchChatHistory();
    document.getElementById('chat-input')?.focus();
  }
}

function setupChatQuickChips() {
  const container = document.getElementById('chat-quick-chips');
  if (!container || !state.currentUser) return;
  const role = state.currentUser.role;

  let chips = [];
  if (role === 'CUSTOMER') {
    chips = [
      'What is my total liquid balance?',
      'How do I freeze my debit card?',
      'What are the loan interest rates?',
      'What is the transfer approval threshold?'
    ];
  } else if (role === 'TELLER') {
    chips = [
      'What are the OTC cash limits?',
      'How do I upgrade customer to Tier 3 KYC?',
      'How does offline sync work?'
    ];
  } else if (role === 'MANAGER') {
    chips = [
      'Review pending approval queue',
      'What are the credit scoring risk grades?',
      'High-value transfer escalation rules'
    ];
  } else if (role === 'SYSTEM_ADMIN') {
    chips = [
      'System cluster health status',
      'How are audit signatures verified?',
      'Explain RBAC privilege isolation'
    ];
  }

  container.innerHTML = chips.map(c => `
    <button type="button" onclick="sendQuickChat('${c.replace(/'/g, "\\'")}')" class="chat-chip">
      ${c}
    </button>
  `).join('');
}

function sendQuickChat(text) {
  const input = document.getElementById('chat-input');
  if (input) {
    input.value = text;
    handleSendChat(new Event('submit'));
  }
}

async function fetchChatHistory() {
  if (!state.token) return;
  try {
    const res = await fetch(`${API_BASE}/chat/history`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (data.status === 'success') {
      renderChatMessages(data.messages);
    }
  } catch (err) {
    console.warn('Could not fetch chat history (offline mode active)');
  }
}

function renderChatMessages(messages) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  container.innerHTML = messages.map(m => {
    const isAi = m.sender === 'UNITY_AI';
    return `
      <div class="flex ${isAi ? 'justify-start' : 'justify-end'}">
        <div class="max-w-[85%] p-3 rounded-2xl ${isAi ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' : 'bg-[#00B074] text-white font-medium'}">
          <div class="text-[9px] opacity-70 mb-1 flex items-center gap-1.5">
            <span>${isAi ? 'Unity AI' : 'You'}</span>
            <span>•</span>
            <span>${m.timestamp ? m.timestamp.substring(11, 16) : 'Now'}</span>
          </div>
          <div class="leading-relaxed text-xs select-text">${m.message}</div>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

async function handleSendChat(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';

  // Append user message immediately
  const container = document.getElementById('chat-messages-container');
  const userDiv = document.createElement('div');
  userDiv.className = 'flex justify-end';
  userDiv.innerHTML = `
    <div class="max-w-[85%] p-3 rounded-2xl bg-[#00B074] text-white font-medium">
      <div class="text-[9px] opacity-70 mb-1">You • Just now</div>
      <div class="leading-relaxed text-xs">${msg}</div>
    </div>
  `;
  container.appendChild(userDiv);
  container.scrollTop = container.scrollHeight;

  // Typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'flex justify-start';
  typingDiv.id = 'ai-typing-indicator';
  typingDiv.innerHTML = `
    <div class="max-w-[85%] p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs flex items-center gap-2">
      <i class="fas fa-circle-notch fa-spin text-emerald-500"></i>
      <span>Analyzing offline banking knowledge...</span>
    </div>
  `;
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const res = await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    typingDiv.remove();

    if (res.ok && data.status === 'success') {
      const aiDiv = document.createElement('div');
      aiDiv.className = 'flex justify-start';
      aiDiv.innerHTML = `
        <div class="max-w-[85%] p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
          <div class="text-[9px] opacity-70 mb-1 flex items-center gap-1.5">
            <span class="font-bold text-emerald-600">Unity AI</span>
            <span>•</span>
            <span>${data.engine || '100% Offline'}</span>
          </div>
          <div class="leading-relaxed text-xs select-text">${data.reply}</div>
        </div>
      `;
      container.appendChild(aiDiv);
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    typingDiv.remove();
    showToast('Failed to contact local AI assistant.', 'error');
  }
}

async function clearChatMessages() {
  if (confirm('Clear your conversation history?')) {
    try {
      await fetch(`${API_BASE}/chat/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      document.getElementById('chat-messages-container').innerHTML = '';
      showToast('Chat history cleared.', 'info');
    } catch {}
  }
}

// -----------------------------------------------------------------------------
// DOM INITIALIZATION
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuthSession();

  // Background polling loop (every 6 seconds if active and online)
  setInterval(() => {
    if (state.token && !state.isOfflineMode) {
      fetchAllData();
    }
  }, 6000);
});
