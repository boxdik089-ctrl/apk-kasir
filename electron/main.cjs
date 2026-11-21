const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { server: syncServer, PORT: SYNC_PORT } = require('../server/syncServer.cjs');

let mainWindow;

function startEmbeddedSyncServer() {
  return new Promise((resolve) => {
    try {
      if (syncServer.listening) {
        return resolve(true);
      }
      syncServer.once('error', (err) => {
        // Port likely already active from `npm run web` / `npm run sync`
        if (err && err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          console.error('Sync server warning:', err);
          resolve(false);
        }
      });
      syncServer.listen(SYNC_PORT, '0.0.0.0', () => {
        console.log(`Embedded Sync Server listening on http://0.0.0.0:${SYNC_PORT}`);
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Senja POS — Kasir Cafe',
    icon: path.join(__dirname, '../public/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allows loading local blob/images seamlessly
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${SYNC_PORT}`);
  }

  // Handle window controls
  ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window-close', () => {
    mainWindow?.close();
  });

  // Get all installed printers in Windows (both USB & Bluetooth)
  ipcMain.handle('get-printers', async () => {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return printers;
    } catch (err) {
      console.error('Error fetching printers:', err);
      return [];
    }
  });

  // Print silent or via print dialog
  ipcMain.handle('print-receipt', async (event, options = {}) => {
    return new Promise((resolve) => {
      // options: { deviceName, silent, copies, pageSize: { width, height } }
      const printOptions = {
        silent: options.silent ?? true,
        printBackground: true,
        deviceName: options.deviceName || '',
        copies: options.copies || 1,
        margins: {
          marginType: 'none'
        }
      };

      if (options.pageSize) {
        printOptions.pageSize = options.pageSize;
      }

      mainWindow.webContents.print(printOptions, (success, failureReason) => {
        if (!success) {
          console.warn('Print failed or cancelled:', failureReason);
          resolve({ success: false, reason: failureReason });
        } else {
          resolve({ success: true });
        }
      });
    });
  });
}

app.whenReady().then(async () => {
  await startEmbeddedSyncServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
