import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { OrderService } from '../services/order-service/index';

const isDev = process.env.NODE_ENV === 'development';
let mainWindow: BrowserWindow | null = null;
let orderService: OrderService | null = null;
const SERVICE_PORT = 3899;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'TI-NASONXIMANG - Khach Hang Nhap Don',
    autoHideMenuBar: true,
    backgroundColor: '#f1f5f9',
    icon: path.join(__dirname, '../../resources/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

async function bootstrapServices() {
  const dbPath = path.join(app.getPath('userData'), 'orders.db');
  orderService = new OrderService(dbPath);
  await orderService.start(SERVICE_PORT);
}

app.whenReady().then(async () => {
  await bootstrapServices();
  ipcMain.handle('app:getApiBaseUrl', () => `http://127.0.0.1:${SERVICE_PORT}`);
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await orderService?.stop();
    app.quit();
  }
});

app.on('before-quit', async () => {
  await orderService?.stop();
});
