const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = Number(process.env.SYNC_PORT || 5174);
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'kasir-store.json');
const DIST_DIR = path.join(__dirname, '../dist');
const CLOUDFLARED_BIN = path.join(__dirname, '../node_modules/cloudflared/bin/cloudflared.exe');

let tunnelState = {
  status: 'idle', // 'idle' | 'starting' | 'active' | 'error'
  url: null,
  error: null,
  process: null
};

function stopRemoteTunnel() {
  if (tunnelState.process) {
    try {
      tunnelState.process.kill();
    } catch {
      // ignore
    }
  }
  tunnelState = { status: 'idle', url: null, error: null, process: null };
}

function startRemoteTunnel() {
  return new Promise((resolve) => {
    if (tunnelState.status === 'active' && tunnelState.url) {
      return resolve({ ok: true, status: 'active', url: tunnelState.url });
    }
    if (!fs.existsSync(CLOUDFLARED_BIN)) {
      tunnelState = { status: 'error', url: null, error: 'Binary cloudflared belum terpasang.', process: null };
      return resolve({ ok: false, error: tunnelState.error });
    }

    stopRemoteTunnel();
    tunnelState.status = 'starting';

    const child = spawn(CLOUDFLARED_BIN, ['tunnel', '--protocol', 'http2', '--url', `http://127.0.0.1:${PORT}`], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    tunnelState.process = child;

    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const handleOutput = (chunk) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) {
        tunnelState.status = 'active';
        tunnelState.url = match[0];
        tunnelState.error = null;
        finish({ ok: true, status: 'active', url: match[0] });
      }
    };

    child.stdout.on('data', handleOutput);
    child.stderr.on('data', handleOutput);

    child.on('exit', (code) => {
      if (tunnelState.process === child) {
        const wasActive = tunnelState.status === 'active';
        tunnelState.process = null;
        tunnelState.url = null;
        tunnelState.status = wasActive ? 'idle' : 'error';
        if (!wasActive) {
          tunnelState.error = `Tunnel terputus (kode ${code}).`;
          finish({ ok: false, error: tunnelState.error });
        }
      }
    });

    setTimeout(() => {
      if (!settled) {
        tunnelState.status = 'error';
        tunnelState.error = 'Waktu tunggu koneksi internet tunnel habis. Coba lagi.';
        stopRemoteTunnel();
        finish({ ok: false, error: tunnelState.error });
      }
    }, 20000);
  });
}

process.on('exit', stopRemoteTunnel);
process.on('SIGINT', () => {
  stopRemoteTunnel();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopRemoteTunnel();
  process.exit(0);
});

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

const DEFAULT_PIN_HASH = sha256('123456');

const defaultStore = {
  revision: 1,
  seeded: false,
  products: [],
  transactions: [],
  heldCarts: [],
  auditLogs: [],
  settings: {
    id: 1,
    storeName: 'SENJA COFFEE & EATERY',
    tagline: 'Specialty Coffee & Warm Pastry',
    address: 'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan',
    phone: '0812-8899-7766',
    footerMessage: 'Terima Kasih Atas Kunjungan Anda!\nPassword Wi-Fi: senjakopi2026\nFollow IG: @senjacoffee.id',
    logoBase64: '',
    logoWidth: 120,
    showLogo: true,
    showDate: true,
    showCashier: true,
    showCustomer: true,
    showBarcode: true,
    showTax: false,
    taxRate: 11,
    paperWidth: '58mm',
    fontFamily: 'monospace',
    separatorChar: '-',
    autoPrintOnPayment: true,
    openCashDrawer: true,
    copies: 1,
    printerMode: 'system',
    selectedPrinterName: '',
    bluetoothDeviceName: '',
    serialBaudRate: 9600,
    security: {
      ownerPinHash: DEFAULT_PIN_HASH,
      cashierCanAddMenu: true,
      cashierCanEditMenu: false,
      cashierCanViewReports: false,
      cashierCanDeleteHeldCart: false,
      terminalLocked: false
    }
  }
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultStore, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(defaultStore));
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.settings) parsed.settings = defaultStore.settings;
    if (!parsed.settings.security) parsed.settings.security = defaultStore.settings.security;
    if (!Array.isArray(parsed.products)) parsed.products = [];
    if (!Array.isArray(parsed.transactions)) parsed.transactions = [];
    if (!Array.isArray(parsed.heldCarts)) parsed.heldCarts = [];
    if (!Array.isArray(parsed.auditLogs)) parsed.auditLogs = [];
    if (!parsed.revision) parsed.revision = 1;
    return parsed;
  } catch (err) {
    console.error('Failed reading store, resetting backup:', err);
    return JSON.parse(JSON.stringify(defaultStore));
  }
}

let store = ensureStore();
const sseClients = new Set();

function persistStore() {
  store.revision = (store.revision || 0) + 1;
  const tmpFile = DATA_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
  broadcastSSE({ type: 'sync', revision: store.revision, timestamp: new Date().toISOString() });
}

function appendAudit(actor, role, action, summary, amount) {
  const nextId = store.auditLogs.reduce((max, l) => Math.max(max, l.id || 0), 0) + 1;
  store.auditLogs.unshift({
    id: nextId,
    timestamp: new Date().toISOString(),
    actor: actor || (role === 'OWNER' ? 'Owner' : 'Kasir'),
    role: role || 'CASHIER',
    action,
    summary,
    ...(amount !== undefined ? { amount } : {})
  });
  // Keep latest 500 audit entries
  if (store.auditLogs.length > 500) {
    store.auditLogs = store.auditLogs.slice(0, 500);
  }
}

function broadcastSSE(payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(msg);
    } catch {
      sseClients.delete(res);
    }
  }
}

function getLanUrls() {
  const urls = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push({ interface: name, ip: net.address });
      }
    }
  }
  return urls;
}

function verifyOwnerPin(pin) {
  if (!pin) return false;
  const targetHash = store.settings?.security?.ownerPinHash || DEFAULT_PIN_HASH;
  return sha256(pin) === targetHash;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res) {
  if (!fs.existsSync(DIST_DIR)) {
    return sendJson(res, 404, { error: 'Not found' });
  }
  const urlPath = (req.url || '/').split('?')[0];
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // 1. Health & Network Info
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        revision: store.revision,
        seeded: store.seeded,
        lanInterfaces: getLanUrls(),
        port: PORT,
        timestamp: new Date().toISOString()
      });
    }

    // 2. SSE Real-time Event Stream
    if (req.method === 'GET' && pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(`data: ${JSON.stringify({ type: 'connected', revision: store.revision })}\n\n`);
      sseClients.add(res);
      const keepAlive = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clearInterval(keepAlive);
        }
      }, 20000);
      req.on('close', () => {
        clearInterval(keepAlive);
        sseClients.delete(res);
      });
      return;
    }

    // 3. Get Full Synchronized State
    if (req.method === 'GET' && pathname === '/api/state') {
      return sendJson(res, 200, {
        revision: store.revision,
        seeded: store.seeded,
        products: store.products,
        transactions: store.transactions,
        heldCarts: store.heldCarts,
        settings: store.settings,
        auditLogs: store.auditLogs
      });
    }

    // 4. Initial Seed from Cashier Client if Server is Empty
    if (req.method === 'POST' && pathname === '/api/seed') {
      const body = await readJsonBody(req);
      if (!store.seeded) {
        if (Array.isArray(body.products) && body.products.length > 0) {
          store.products = body.products;
        }
        if (Array.isArray(body.transactions) && body.transactions.length > 0) {
          store.transactions = body.transactions;
        }
        if (Array.isArray(body.heldCarts) && body.heldCarts.length > 0) {
          store.heldCarts = body.heldCarts;
        }
        if (body.settings) {
          store.settings = {
            ...store.settings,
            ...body.settings,
            security: {
              ...store.settings.security,
              ...(body.settings.security || {})
            }
          };
        }
        store.seeded = true;
        persistStore();
      }
      return sendJson(res, 200, { ok: true, revision: store.revision, seeded: store.seeded });
    }

    // 5. Verify Owner PIN
    if (req.method === 'POST' && pathname === '/api/owner/verify') {
      const body = await readJsonBody(req);
      const ok = verifyOwnerPin(body.pin);
      if (ok) {
        appendAudit(body.actor || 'Owner', 'OWNER', 'OWNER_LOGIN', `Owner berhasil masuk dari ${body.device || 'perangkat'}`);
        persistStore();
        return sendJson(res, 200, { ok: true });
      } else {
        appendAudit(body.actor || 'Tidak Dikenal', 'CASHIER', 'OWNER_LOGIN_FAILED', `Percobaan PIN Owner gagal dari ${body.device || 'perangkat'}`);
        persistStore();
        return sendJson(res, 401, { ok: false, error: 'PIN Owner salah.' });
      }
    }

    // 6. Add Transaction (Append-Only)
    if (req.method === 'POST' && pathname === '/api/transactions') {
      const tx = await readJsonBody(req);
      const exists = store.transactions.find((t) => t.invoiceNumber === tx.invoiceNumber);
      if (exists) {
        return sendJson(res, 200, { ok: true, transaction: exists, revision: store.revision });
      }
      const nextId = store.transactions.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;
      const savedTx = { ...tx, id: nextId, status: 'COMPLETED' };
      store.transactions.push(savedTx);
      store.seeded = true;
      persistStore();
      return sendJson(res, 201, { ok: true, transaction: savedTx, revision: store.revision });
    }

    // 7. Void Transaction (STRICTLY REQUIRES OWNER PIN)
    const voidMatch = pathname.match(/^\/api\/transactions\/(\d+)\/void$/);
    if (req.method === 'POST' && voidMatch) {
      const txId = Number(voidMatch[1]);
      const body = await readJsonBody(req);
      if (!verifyOwnerPin(body.ownerPin)) {
        appendAudit(body.actor || 'Kasir', 'CASHIER', 'OWNER_LOGIN_FAILED', `Gagal void struk ID #${txId} — PIN Owner salah`);
        persistStore();
        return sendJson(res, 403, { ok: false, error: 'PIN Owner tidak valid. Kasir tidak diizinkan membatalkan struk.' });
      }
      const reason = String(body.reason || '').trim();
      if (!reason) {
        return sendJson(res, 400, { ok: false, error: 'Alasan pembatalan wajib diisi.' });
      }
      const idx = store.transactions.findIndex((t) => t.id === txId);
      if (idx === -1) {
        return sendJson(res, 404, { ok: false, error: 'Transaksi tidak ditemukan.' });
      }
      const targetTx = store.transactions[idx];
      store.transactions[idx] = {
        ...targetTx,
        status: 'CANCELLED',
        voidReason: reason,
        voidBy: body.actor || 'Owner',
        voidAt: new Date().toISOString()
      };
      appendAudit(
        body.actor || 'Owner',
        'OWNER',
        'VOID_TRANSACTION',
        `Membatalkan struk ${targetTx.invoiceNumber} — Alasan: "${reason}"`,
        targetTx.total
      );
      persistStore();
      return sendJson(res, 200, { ok: true, transaction: store.transactions[idx], revision: store.revision });
    }

    // 8. Held Carts (Create / Restore / Delete with Anti-Fraud Audit)
    if (req.method === 'POST' && pathname === '/api/held-carts') {
      const cart = await readJsonBody(req);
      const nextId = store.heldCarts.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;
      const saved = { ...cart, id: nextId };
      store.heldCarts.push(saved);
      persistStore();
      return sendJson(res, 201, { ok: true, heldCart: saved, revision: store.revision });
    }

    const heldMatch = pathname.match(/^\/api\/held-carts\/(\d+)$/);
    if (req.method === 'DELETE' && heldMatch) {
      const cartId = Number(heldMatch[1]);
      const body = await readJsonBody(req);
      const isRestoring = !!body.isRestoring; // restoring to active cart to pay is allowed
      const canDelete = store.settings?.security?.cashierCanDeleteHeldCart;

      if (!isRestoring && !canDelete && !verifyOwnerPin(body.ownerPin)) {
        appendAudit(
          body.actor || 'Kasir',
          'CASHIER',
          'OWNER_LOGIN_FAILED',
          `Percobaan hapus Open Bill #${cartId} ditolak — memerlukan PIN Owner`
        );
        persistStore();
        return sendJson(res, 403, { ok: false, error: 'Menghapus Open Bill memerlukan PIN Owner.' });
      }

      const idx = store.heldCarts.findIndex((c) => c.id === cartId);
      if (idx !== -1) {
        const removed = store.heldCarts[idx];
        store.heldCarts.splice(idx, 1);
        if (!isRestoring) {
          appendAudit(
            body.actor || 'Kasir',
            verifyOwnerPin(body.ownerPin) ? 'OWNER' : 'CASHIER',
            'DELETE_HELD_CART',
            `Menghapus Open Bill "${removed.referenceName}" tanpa pembayaran`,
            removed.total
          );
        }
        persistStore();
      }
      return sendJson(res, 200, { ok: true, revision: store.revision });
    }

    // 9. Products CRUD
    if (req.method === 'POST' && pathname === '/api/products') {
      const body = await readJsonBody(req);
      const isOwner = verifyOwnerPin(body.ownerPin);
      if (!isOwner && !store.settings?.security?.cashierCanAddMenu) {
        return sendJson(res, 403, { ok: false, error: 'Penambahan menu dikunci oleh Owner.' });
      }
      const product = body.product || body;
      const nextId = store.products.reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;
      const saved = { ...product, id: nextId };
      store.products.push(saved);
      store.seeded = true;
      appendAudit(
        body.actor || (isOwner ? 'Owner' : 'Kasir'),
        isOwner ? 'OWNER' : 'CASHIER',
        'MENU_CHANGED',
        `Menambah menu "${saved.name}" (Rp ${Number(saved.price).toLocaleString('id-ID')})`
      );
      persistStore();
      return sendJson(res, 201, { ok: true, product: saved, revision: store.revision });
    }

    const prodMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (req.method === 'PUT' && prodMatch) {
      const prodId = Number(prodMatch[1]);
      const body = await readJsonBody(req);
      const isOwner = verifyOwnerPin(body.ownerPin);
      if (!isOwner && !store.settings?.security?.cashierCanEditMenu) {
        return sendJson(res, 403, { ok: false, error: 'Edit harga/menu hanya dapat dilakukan oleh Owner.' });
      }
      const idx = store.products.findIndex((p) => p.id === prodId);
      if (idx === -1) return sendJson(res, 404, { ok: false, error: 'Menu tidak ditemukan.' });
      const prev = store.products[idx];
      const updates = body.product || body;
      store.products[idx] = { ...prev, ...updates, id: prodId };
      appendAudit(
        body.actor || (isOwner ? 'Owner' : 'Kasir'),
        isOwner ? 'OWNER' : 'CASHIER',
        'MENU_CHANGED',
        `Mengubah menu "${store.products[idx].name}" (Rp ${Number(prev.price).toLocaleString('id-ID')} -> Rp ${Number(store.products[idx].price).toLocaleString('id-ID')})`
      );
      persistStore();
      return sendJson(res, 200, { ok: true, product: store.products[idx], revision: store.revision });
    }

    if (req.method === 'DELETE' && prodMatch) {
      const prodId = Number(prodMatch[1]);
      const body = await readJsonBody(req);
      const isOwner = verifyOwnerPin(body.ownerPin);
      if (!isOwner && !store.settings?.security?.cashierCanEditMenu) {
        return sendJson(res, 403, { ok: false, error: 'Penghapusan menu hanya dapat dilakukan oleh Owner.' });
      }
      const idx = store.products.findIndex((p) => p.id === prodId);
      if (idx !== -1) {
        const removed = store.products[idx];
        store.products.splice(idx, 1);
        appendAudit(
          body.actor || (isOwner ? 'Owner' : 'Kasir'),
          isOwner ? 'OWNER' : 'CASHIER',
          'MENU_CHANGED',
          `Menghapus menu "${removed.name}"`
        );
        persistStore();
      }
      return sendJson(res, 200, { ok: true, revision: store.revision });
    }

    // 10. Reset Sample Menus (Owner only)
    if (req.method === 'POST' && pathname === '/api/products/reset-sample') {
      const body = await readJsonBody(req);
      if (!verifyOwnerPin(body.ownerPin)) {
        return sendJson(res, 403, { ok: false, error: 'Diperlukan PIN Owner untuk mereset daftar menu.' });
      }
      store.products = (body.products || []).map((p, idx) => ({ ...p, id: idx + 1 }));
      store.seeded = true;
      appendAudit('Owner', 'OWNER', 'MENU_CHANGED', 'Memuat ulang daftar menu contoh cafe');
      persistStore();
      return sendJson(res, 200, { ok: true, products: store.products, revision: store.revision });
    }

    // 11. Update Printer Hardware Settings (Accessible by Cashiers)
    if (req.method === 'PUT' && pathname === '/api/printer-settings') {
      const body = await readJsonBody(req);
      const allowedFields = [
        'printerMode',
        'selectedPrinterName',
        'bluetoothDeviceName',
        'serialBaudRate',
        'autoPrintOnPayment',
        'openCashDrawer',
        'copies'
      ];
      const patch = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          patch[field] = body[field];
        }
      }
      store.settings = { ...store.settings, ...patch, id: 1 };
      persistStore();
      return sendJson(res, 200, { ok: true, settings: store.settings, revision: store.revision });
    }

    // 12. Update Settings & Security Controls (Owner only)
    if (req.method === 'PUT' && pathname === '/api/settings') {
      const body = await readJsonBody(req);
      if (!verifyOwnerPin(body.ownerPin)) {
        return sendJson(res, 403, { ok: false, error: 'PIN Owner tidak valid.' });
      }
      const nextSettings = { ...store.settings, ...(body.settings || {}), id: 1 };
      if (body.newOwnerPin && String(body.newOwnerPin).length >= 4) {
        nextSettings.security = {
          ...(nextSettings.security || {}),
          ownerPinHash: sha256(String(body.newOwnerPin))
        };
      }
      const prevLock = !!store.settings?.security?.terminalLocked;
      const nextLock = !!nextSettings?.security?.terminalLocked;
      store.settings = nextSettings;

      if (prevLock !== nextLock) {
        appendAudit(
          'Owner',
          'OWNER',
          'REMOTE_LOCK_CHANGED',
          nextLock ? 'Owner mengunci terminal kasir dari jarak jauh' : 'Owner membuka kunci terminal kasir'
        );
      } else {
        appendAudit('Owner', 'OWNER', 'SETTINGS_CHANGED', 'Owner memperbarui pengaturan keamanan / toko');
      }
      persistStore();
      return sendJson(res, 200, { ok: true, settings: store.settings, revision: store.revision });
    }

    // 13. Restore Backup (Owner only)
    if (req.method === 'POST' && pathname === '/api/restore') {
      const body = await readJsonBody(req);
      if (!verifyOwnerPin(body.ownerPin)) {
        return sendJson(res, 403, { ok: false, error: 'Restore database memerlukan PIN Owner.' });
      }
      if (Array.isArray(body.products)) store.products = body.products;
      if (Array.isArray(body.transactions)) store.transactions = body.transactions;
      if (body.settings) {
        store.settings = {
          ...store.settings,
          ...body.settings,
          security: store.settings.security // preserve current owner PIN & locks
        };
      }
      store.seeded = true;
      appendAudit('Owner', 'OWNER', 'DB_RESTORED', 'Owner memulihkan database dari file backup JSON');
      persistStore();
      return sendJson(res, 200, { ok: true, revision: store.revision });
    }

    // 14. Remote Internet Tunnel Control (Owner only for start/stop)
    if (req.method === 'GET' && pathname === '/api/remote-tunnel/status') {
      return sendJson(res, 200, {
        status: tunnelState.status,
        url: tunnelState.url,
        ownerUrl: tunnelState.url ? `${tunnelState.url}/?mode=owner` : null,
        error: tunnelState.error
      });
    }

    if (req.method === 'POST' && pathname === '/api/remote-tunnel/start') {
      const body = await readJsonBody(req);
      if (!verifyOwnerPin(body.ownerPin)) {
        return sendJson(res, 403, { ok: false, error: 'Diperlukan PIN Owner untuk membuka akses internet.' });
      }
      const result = await startRemoteTunnel();
      return sendJson(res, result.ok ? 200 : 500, {
        ...result,
        ownerUrl: result.url ? `${result.url}/?mode=owner` : null
      });
    }

    if (req.method === 'POST' && pathname === '/api/remote-tunnel/stop') {
      const body = await readJsonBody(req);
      if (!verifyOwnerPin(body.ownerPin)) {
        return sendJson(res, 403, { ok: false, error: 'PIN Owner tidak valid.' });
      }
      stopRemoteTunnel();
      return sendJson(res, 200, { ok: true, status: 'idle', url: null });
    }

    // Fallback to serving static built web app if available
    if (req.method === 'GET' && !pathname.startsWith('/api/')) {
      return serveStatic(req, res);
    }

    return sendJson(res, 404, { error: 'Endpoint not found' });
  } catch (err) {
    console.error('Sync server error:', err);
    return sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Senja POS Sync Server active on http://0.0.0.0:${PORT}`);
  });
}

module.exports = { server, PORT };
