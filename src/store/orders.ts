import { create } from 'zustand';

export type Order = {
  id: number;
  customer_name: string;
  phone: string;
  product_name: string;
  quantity: number;
  note: string;
  created_at: string;
};

type NewOrderInput = {
  customerName: string;
  phone: string;
  productName: string;
  quantity: number;
  note: string;
};

type OrderStore = {
  apiBaseUrl: string;
  orders: Order[];
  loading: boolean;
  error: string | null;
  setApiBaseUrl: (apiBaseUrl: string) => void;
  fetchOrders: () => Promise<void>;
  createOrder: (payload: NewOrderInput) => Promise<void>;
};

const LOCAL_STORAGE_KEY = 'ti-nasonximang-orders';

function readLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Order[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
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

      const orders = (await response.json()) as Order[];
      set({ orders, loading: false });
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
        quantity: payload.quantity,
        note: payload.note,
        created_at: new Date().toISOString()
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
  }
}));
