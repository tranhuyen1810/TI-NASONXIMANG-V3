import express from 'express';
import Database from 'better-sqlite3';
import { createServer, Server as HttpServer } from 'node:http';
import { WebSocketServer } from 'ws';

type WorkflowStatus =
  | 'NEW'
  | 'DOCS_PREPARED'
  | 'INBOUND_WEIGHED'
  | 'WAREHOUSE_CONFIRMED'
  | 'OUTBOUND_WEIGHED'
  | 'SECURITY_REVIEW'
  | 'MISMATCH'
  | 'COMPLETED';

type NewOrderPayload = {
  customerName: string;
  phone: string;
  productName: string;
  quantity: number;
  deliveryTime?: string;
  note?: string;
};

type OrderUpdatePayload = {
  delivery_note_number?: string;
  export_note_number?: string;
  driver_name?: string;
  truck_plate?: string;
  weigh_in_ticket?: string;
  weigh_in_weight?: number;
  weigh_in_at?: string;
  warehouse_actual_quantity?: number;
  warehouse_note?: string;
  warehouse_checked_at?: string;
  warehouse_released_at?: string;
  driver_received_docs_at?: string;
  left_factory_at?: string;
  weigh_out_ticket?: string;
  weigh_out_weight?: number;
  weigh_out_at?: string;
  accounting_received_weigh_out_at?: string;
  security_checked_at?: string;
  security_note?: string;
  security_match?: 0 | 1;
  security_confirmed_at?: string;
  summary_exported_at?: string;
  status?: WorkflowStatus;
};

type OrderRecord = {
  id: number;
  customer_name: string;
  phone: string;
  product_name: string;
  planned_quantity: number;
  delivery_time: string;
  note: string;
  delivery_note_number: string;
  export_note_number: string;
  driver_name: string;
  truck_plate: string;
  weigh_in_ticket: string;
  weigh_in_weight: number | null;
  weigh_in_at: string;
  warehouse_actual_quantity: number | null;
  warehouse_note: string;
  warehouse_checked_at: string;
  warehouse_released_at: string;
  driver_received_docs_at: string;
  left_factory_at: string;
  weigh_out_ticket: string;
  weigh_out_weight: number | null;
  weigh_out_at: string;
  accounting_received_weigh_out_at: string;
  security_checked_at: string;
  security_note: string;
  security_match: 0 | 1 | null;
  security_confirmed_at: string;
  summary_exported_at: string;
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
};

const ALLOWED_UPDATE_FIELDS: ReadonlySet<keyof OrderUpdatePayload> = new Set([
  'delivery_note_number',
  'export_note_number',
  'driver_name',
  'truck_plate',
  'weigh_in_ticket',
  'weigh_in_weight',
  'warehouse_actual_quantity',
  'warehouse_note',
  'driver_received_docs_at',
  'left_factory_at',
  'weigh_out_ticket',
  'weigh_out_weight',
  'accounting_received_weigh_out_at',
  'security_checked_at',
  'security_note',
  'security_match',
  'security_confirmed_at',
  'summary_exported_at',
  'status',
  'weigh_in_at',
  'warehouse_checked_at',
  'warehouse_released_at',
  'weigh_out_at'
]);

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
      CREATE TABLE IF NOT EXISTS order_workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        product_name TEXT NOT NULL,
        planned_quantity REAL NOT NULL,
        delivery_time TEXT DEFAULT '',
        note TEXT DEFAULT '',
        delivery_note_number TEXT DEFAULT '',
        export_note_number TEXT DEFAULT '',
        driver_name TEXT DEFAULT '',
        truck_plate TEXT DEFAULT '',
        weigh_in_ticket TEXT DEFAULT '',
        weigh_in_weight REAL,
        weigh_in_at TEXT DEFAULT '',
        warehouse_actual_quantity REAL,
        warehouse_note TEXT DEFAULT '',
        warehouse_checked_at TEXT DEFAULT '',
        warehouse_released_at TEXT DEFAULT '',
        driver_received_docs_at TEXT DEFAULT '',
        left_factory_at TEXT DEFAULT '',
        weigh_out_ticket TEXT DEFAULT '',
        weigh_out_weight REAL,
        weigh_out_at TEXT DEFAULT '',
        accounting_received_weigh_out_at TEXT DEFAULT '',
        security_checked_at TEXT DEFAULT '',
        security_note TEXT DEFAULT '',
        security_match INTEGER,
        security_confirmed_at TEXT DEFAULT '',
        summary_exported_at TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'NEW',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private registerRoutes(): void {
    this.app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    this.app.get('/api/orders', (_req, res) => {
      const rows = this.db
        .prepare('SELECT * FROM order_workflows ORDER BY id DESC')
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
        `INSERT INTO order_workflows (
          customer_name,
          phone,
          product_name,
          planned_quantity,
          delivery_time,
          note,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      const result = insert.run(
        payload.customerName.trim(),
        payload.phone.trim(),
        payload.productName.trim(),
        payload.quantity,
        payload.deliveryTime?.trim() ?? '',
        payload.note?.trim() ?? '',
        'NEW'
      );

      const order = this.db
        .prepare('SELECT * FROM order_workflows WHERE id = ?')
        .get(result.lastInsertRowid) as OrderRecord;

      this.broadcast({ type: 'order:created', payload: order });
      res.status(201).json(order);
    });

    this.app.patch('/api/orders/:id', (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: 'ID khong hop le.' });
        return;
      }

      const payload = req.body as OrderUpdatePayload;
      const validationError = this.validateUpdate(payload);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const fields = (Object.keys(payload) as Array<keyof OrderUpdatePayload>)
        .filter((key) => ALLOWED_UPDATE_FIELDS.has(key) && payload[key] !== undefined)
        .map((key) => [key, payload[key] as string | number] as const);
      if (!fields.length) {
        res.status(400).json({ error: 'Khong co du lieu cap nhat.' });
        return;
      }

      const setClause = fields.map(([key]) => `${key} = ?`).join(', ');
      const values = fields.map(([, value]) => value);

      this.db
        .prepare(`UPDATE order_workflows SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(...values, id);

      const order = this.db
        .prepare('SELECT * FROM order_workflows WHERE id = ?')
        .get(id) as OrderRecord | undefined;

      if (!order) {
        res.status(404).json({ error: 'Khong tim thay ho so.' });
        return;
      }

      this.broadcast({ type: 'order:updated', payload: order });
      res.json(order);
    });
  }

  private validate(payload: NewOrderPayload): string | null {
    if (!payload || typeof payload !== 'object') {
      return 'Payload khong hop le.';
    }

    for (const key of Object.keys(payload) as Array<keyof OrderUpdatePayload>) {
      if (!ALLOWED_UPDATE_FIELDS.has(key)) {
        return 'Truong cap nhat khong hop le.';
      }
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

  private validateUpdate(payload: OrderUpdatePayload): string | null {
    if (!payload || typeof payload !== 'object') {
      return 'Payload khong hop le.';
    }

    const numericFields: Array<keyof OrderUpdatePayload> = [
      'weigh_in_weight',
      'weigh_out_weight',
      'warehouse_actual_quantity'
    ];

    for (const field of numericFields) {
      const value = payload[field];
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        return 'Gia tri khoi luong/so luong khong hop le.';
      }
    }

    if (payload.security_match !== undefined && payload.security_match !== 0 && payload.security_match !== 1) {
      return 'Gia tri doi chieu bao ve khong hop le.';
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
