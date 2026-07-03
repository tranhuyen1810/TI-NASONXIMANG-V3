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
