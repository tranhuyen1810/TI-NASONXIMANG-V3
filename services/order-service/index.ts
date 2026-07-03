import express from 'express';
import Database from 'better-sqlite3';
import { createServer, Server as HttpServer } from 'node:http';
import { WebSocketServer } from 'ws';

type NewOrderPayload = {
  customerName: string;
  phone: string;
  productName: string;
  quantity: number;
  note?: string;
};

type OrderRecord = {
  id: number;
  customer_name: string;
  phone: string;
  product_name: string;
  quantity: number;
  note: string;
  created_at: string;
};

export class OrderService {
  private readonly app = express();
  private readonly db: Database.Database;
  private server: HttpServer | null = null;
  private wsServer: WebSocketServer | null = null;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.prepareDatabase();
    this.app.use(express.json());
    this.registerRoutes();
  }

  async start(port: number): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer(this.app);
    this.wsServer = new WebSocketServer({ server: this.server, path: '/ws' });

    await new Promise<void>((resolve, reject) => {
      this.server?.listen(port, '127.0.0.1', () => resolve());
      this.server?.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.wsServer?.clients.forEach((client) => client.close());
      this.wsServer?.close();
      this.server?.close(() => resolve());

      if (!this.server) {
        resolve();
      }
    });

    this.server = null;
    this.wsServer = null;
    this.db.close();
  }

  private prepareDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        note TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private registerRoutes(): void {
    this.app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    this.app.get('/api/orders', (_req, res) => {
      const rows = this.db
        .prepare('SELECT * FROM orders ORDER BY id DESC')
        .all() as OrderRecord[];

      res.json(rows);
    });

    this.app.post('/api/orders', (req, res) => {
      const payload = req.body as NewOrderPayload;
      const validationError = this.validate(payload);

      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const insert = this.db.prepare(
        'INSERT INTO orders (customer_name, phone, product_name, quantity, note) VALUES (?, ?, ?, ?, ?)'
      );

      const result = insert.run(
        payload.customerName.trim(),
        payload.phone.trim(),
        payload.productName.trim(),
        payload.quantity,
        payload.note?.trim() ?? ''
      );

      const order = this.db
        .prepare('SELECT * FROM orders WHERE id = ?')
        .get(result.lastInsertRowid) as OrderRecord;

      this.broadcast({ type: 'order:created', payload: order });
      res.status(201).json(order);
    });
  }

  private validate(payload: NewOrderPayload): string | null {
    if (!payload || typeof payload !== 'object') {
      return 'Payload khong hop le.';
    }

    if (!payload.customerName?.trim()) {
      return 'Vui long nhap ten khach hang.';
    }

    if (!payload.phone?.trim()) {
      return 'Vui long nhap so dien thoai.';
    }

    if (!payload.productName?.trim()) {
      return 'Vui long nhap ten san pham.';
    }

    if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
      return 'So luong phai lon hon 0.';
    }

    return null;
  }

  private broadcast(message: unknown): void {
    if (!this.wsServer) {
      return;
    }

    const data = JSON.stringify(message);
    this.wsServer.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  }
}
