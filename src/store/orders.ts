import { create } from 'zustand';

export type WorkflowStatus =
  | 'NEW'
  | 'DOCS_PREPARED'
  | 'INBOUND_WEIGHED'
  | 'WAREHOUSE_CONFIRMED'
  | 'OUTBOUND_WEIGHED'
  | 'SECURITY_REVIEW'
  | 'MISMATCH'
  | 'COMPLETED';

export type Order = {
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

type NewOrderInput = {
  customerName: string;
  phone: string;
  productName: string;
  quantity: number;
  deliveryTime?: string;
  note: string;
};

export type OrderPatch = Partial<{
  delivery_note_number: string;
  export_note_number: string;
  driver_name: string;
  truck_plate: string;
  weigh_in_ticket: string;
  weigh_in_weight: number;
  weigh_in_at: string;
  warehouse_actual_quantity: number;
  warehouse_note: string;
  warehouse_checked_at: string;
  warehouse_released_at: string;
  driver_received_docs_at: string;
  left_factory_at: string;
  weigh_out_ticket: string;
  weigh_out_weight: number;
  weigh_out_at: string;
  accounting_received_weigh_out_at: string;
  security_checked_at: string;
  security_note: string;
  security_match: 0 | 1;
  security_confirmed_at: string;
  summary_exported_at: string;
  status: WorkflowStatus;
}>;

type OrderStore = {
  apiBaseUrl: string;
  orders: Order[];
  loading: boolean;
  error: string | null;
  setApiBaseUrl: (apiBaseUrl: string) => void;
  fetchOrders: () => Promise<void>;
  createOrder: (payload: NewOrderInput) => Promise<void>;
  updateOrder: (id: number, patch: OrderPatch) => Promise<Order>;
};

const LOCAL_STORAGE_KEY = 'ti-nasonximang-orders';

function toOrder(record: unknown): Order | null {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const item = record as Partial<Order> & {
    quantity?: number;
  };

  const now = new Date().toISOString();
  const plannedQuantity = typeof item.planned_quantity === 'number' ? item.planned_quantity : item.quantity;

  if (
    typeof item.id !== 'number' ||
    !item.customer_name ||
    !item.phone ||
    !item.product_name ||
    typeof plannedQuantity !== 'number' ||
    plannedQuantity <= 0
  ) {
    return null;
  }

  return {
    id: item.id,
    customer_name: item.customer_name,
    phone: item.phone,
    product_name: item.product_name,
    planned_quantity: plannedQuantity,
    delivery_time: item.delivery_time ?? '',
    note: item.note ?? '',
    delivery_note_number: item.delivery_note_number ?? '',
    export_note_number: item.export_note_number ?? '',
    driver_name: item.driver_name ?? '',
    truck_plate: item.truck_plate ?? '',
    weigh_in_ticket: item.weigh_in_ticket ?? '',
    weigh_in_weight: item.weigh_in_weight ?? null,
    weigh_in_at: item.weigh_in_at ?? '',
    warehouse_actual_quantity: item.warehouse_actual_quantity ?? null,
    warehouse_note: item.warehouse_note ?? '',
    warehouse_checked_at: item.warehouse_checked_at ?? '',
    warehouse_released_at: item.warehouse_released_at ?? '',
    driver_received_docs_at: item.driver_received_docs_at ?? '',
    left_factory_at: item.left_factory_at ?? '',
    weigh_out_ticket: item.weigh_out_ticket ?? '',
    weigh_out_weight: item.weigh_out_weight ?? null,
    weigh_out_at: item.weigh_out_at ?? '',
    accounting_received_weigh_out_at: item.accounting_received_weigh_out_at ?? '',
    security_checked_at: item.security_checked_at ?? '',
    security_note: item.security_note ?? '',
    security_match: item.security_match ?? null,
    security_confirmed_at: item.security_confirmed_at ?? '',
    summary_exported_at: item.summary_exported_at ?? '',
    status: item.status ?? 'NEW',
    created_at: item.created_at ?? now,
    updated_at: item.updated_at ?? item.created_at ?? now
  };
}

function readLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => toOrder(item)).filter((item): item is Order => item !== null);
  } catch {
    return [];
  }
}

function writeLocalOrders(orders: Order[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  apiBaseUrl: '',
  orders: [],
  loading: false,
  error: null,

  setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),

  fetchOrders: async () => {
    const { apiBaseUrl } = get();
    if (!apiBaseUrl) {
      return;
    }

    if (apiBaseUrl === '__LOCAL__') {
      set({ loading: true, error: null });
      const localOrders = readLocalOrders();
      set({ orders: localOrders, loading: false });
      return;
    }

    set({ loading: true, error: null });

    try {
      const response = await fetch(`${apiBaseUrl}/api/orders`);
      if (!response.ok) {
        throw new Error('Khong tai duoc danh sach don hang.');
      }

      const rows = (await response.json()) as unknown[];
      const orders = rows.map((item) => toOrder(item)).filter((item): item is Order => item !== null);
      set({ orders, loading: false, error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Co loi xay ra.',
        loading: false
      });
    }
  },

  createOrder: async (payload) => {
    const { apiBaseUrl, fetchOrders } = get();
    if (!apiBaseUrl) {
      throw new Error('He thong chua san sang.');
    }

    if (apiBaseUrl === '__LOCAL__') {
      const existing = readLocalOrders();
      const nextId = existing.length ? Math.max(...existing.map((item) => item.id)) + 1 : 1;

      const nextOrder: Order = {
        id: nextId,
        customer_name: payload.customerName,
        phone: payload.phone,
        product_name: payload.productName,
        planned_quantity: payload.quantity,
        delivery_time: payload.deliveryTime ?? '',
        note: payload.note,
        delivery_note_number: '',
        export_note_number: '',
        driver_name: '',
        truck_plate: '',
        weigh_in_ticket: '',
        weigh_in_weight: null,
        weigh_in_at: '',
        warehouse_actual_quantity: null,
        warehouse_note: '',
        warehouse_checked_at: '',
        warehouse_released_at: '',
        driver_received_docs_at: '',
        left_factory_at: '',
        weigh_out_ticket: '',
        weigh_out_weight: null,
        weigh_out_at: '',
        accounting_received_weigh_out_at: '',
        security_checked_at: '',
        security_note: '',
        security_match: null,
        security_confirmed_at: '',
        summary_exported_at: '',
        status: 'NEW',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const nextOrders = [nextOrder, ...existing];
      writeLocalOrders(nextOrders);
      set({ orders: nextOrders, error: null });
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ error: 'Khong tao duoc don hang.' }))) as {
        error?: string;
      };

      throw new Error(body.error ?? 'Khong tao duoc don hang.');
    }

    await fetchOrders();
  },

  updateOrder: async (id, patch) => {
    const { apiBaseUrl, orders } = get();
    if (!apiBaseUrl) {
      throw new Error('He thong chua san sang.');
    }

    if (apiBaseUrl === '__LOCAL__') {
      const now = new Date().toISOString();
      const nextOrders = orders.map((order) => {
        if (order.id !== id) {
          return order;
        }

        return {
          ...order,
          ...patch,
          updated_at: now
        };
      });

      const nextOrder = nextOrders.find((order) => order.id === id);
      if (!nextOrder) {
        throw new Error('Khong tim thay ho so can cap nhat.');
      }

      writeLocalOrders(nextOrders);
      set({ orders: nextOrders, error: null });
      return nextOrder;
    }

    const response = await fetch(`${apiBaseUrl}/api/orders/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patch)
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ error: 'Khong cap nhat duoc quy trinh.' }))) as {
        error?: string;
      };

      throw new Error(body.error ?? 'Khong cap nhat duoc quy trinh.');
    }

    const updated = toOrder(await response.json());
    if (!updated) {
      throw new Error('Du lieu tra ve khong hop le.');
    }

    set((state) => ({
      orders: state.orders.map((order) => (order.id === id ? updated : order)),
      error: null
    }));

    return updated;
  }
}));
