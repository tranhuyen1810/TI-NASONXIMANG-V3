import { create } from 'zustand';

export type Role = 'ADMIN' | 'SALES' | 'ACCOUNTING' | 'WAREHOUSE' | 'WEIGHING' | 'SECURITY';

export type CustomerStatus = 'ACTIVE' | 'LOCKED';

export type OrderStatus = 'NEW' | 'APPROVED' | 'PICKING' | 'COMPLETED' | 'CANCELLED';

export type AlertLevel = 'INFO' | 'WARN' | 'ERROR';

export type Customer = {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  taxCode: string;
  note: string;
  status: CustomerStatus;
  createdAt: string;
};

export type InventoryItem = {
  id: string;
  product: string;
  spec: string;
  lot: string;
  warehouse: string;
  stockQty: number;
  unitPrice: number;
};

export type SalesOrder = {
  id: string;
  orderNo: string;
  createdDate: string;
  customerId: string;
  product: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  createdBy: string;
  note: string;
  truckPlate: string;
  driverName: string;
  status: OrderStatus;
};

export type DeliveryTicket = {
  id: string;
  ticketNo: string;
  orderId: string;
  date: string;
  customerId: string;
  truckPlate: string;
  product: string;
  quantity: number;
  warehouse: string;
  createdBy: string;
  printedAt: string;
  cancelledAt: string;
};

export type WeighInRecord = {
  id: string;
  ticketNo: string;
  deliveryTicketId: string;
  truckPlate: string;
  driverName: string;
  customerId: string;
  product: string;
  weightIn: number;
  weighedAt: string;
  weighedBy: string;
  method: 'AUTO' | 'MANUAL';
  imageNote: string;
};

export type WarehouseExport = {
  id: string;
  deliveryTicketId: string;
  warehouse: string;
  product: string;
  lot: string;
  quantity: number;
  exportedBy: string;
  exportedAt: string;
};

export type WeighOutRecord = {
  id: string;
  weighInId: string;
  ticketNo: string;
  truckPlate: string;
  weightOut: number;
  weighedAt: string;
  weighedBy: string;
  method: 'AUTO' | 'MANUAL';
  note: string;
};

export type ReconciliationAlert = {
  id: string;
  orderId: string;
  level: AlertLevel;
  message: string;
  createdAt: string;
  resolved: boolean;
};

export type UserAccount = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
};

export type SystemLog = {
  id: string;
  action: string;
  actor: string;
  objectType: string;
  objectId: string;
  createdAt: string;
};

type NewCustomerInput = Omit<Customer, 'id' | 'createdAt' | 'status'>;

type NewOrderInput = Omit<SalesOrder, 'id' | 'amount' | 'status'>;

type NewDeliveryTicketInput = Omit<DeliveryTicket, 'id' | 'printedAt' | 'cancelledAt'>;

type NewWeighInInput = Omit<WeighInRecord, 'id'>;

type NewWarehouseExportInput = Omit<WarehouseExport, 'id'>;

type NewWeighOutInput = Omit<WeighOutRecord, 'id'>;

export type DashboardStats = {
  totalCustomers: number;
  activeOrders: number;
  todayExports: number;
  unresolvedAlerts: number;
};

type BusinessStore = {
  role: Role;
  customers: Customer[];
  orders: SalesOrder[];
  deliveryTickets: DeliveryTicket[];
  weighIns: WeighInRecord[];
  warehouseExports: WarehouseExport[];
  weighOuts: WeighOutRecord[];
  inventory: InventoryItem[];
  users: UserAccount[];
  logs: SystemLog[];
  mismatchThreshold: number;
  alerts: ReconciliationAlert[];
  setRole: (role: Role) => void;
  addCustomer: (payload: NewCustomerInput, actor?: string) => void;
  updateCustomer: (id: string, payload: Partial<NewCustomerInput>, actor?: string) => void;
  removeCustomer: (id: string, actor?: string) => { ok: boolean; message: string };
  toggleCustomerStatus: (id: string, actor?: string) => void;
  addOrder: (payload: NewOrderInput, actor?: string) => void;
  updateOrder: (id: string, patch: Partial<NewOrderInput>, actor?: string) => void;
  setOrderStatus: (id: string, status: OrderStatus, actor?: string) => void;
  createDeliveryTicket: (payload: NewDeliveryTicketInput, actor?: string) => { ok: boolean; message: string };
  cancelDeliveryTicket: (id: string, actor?: string) => void;
  addWeighIn: (payload: NewWeighInInput, actor?: string) => void;
  addWarehouseExport: (payload: NewWarehouseExportInput, actor?: string) => { ok: boolean; message: string };
  addWeighOut: (payload: NewWeighOutInput, actor?: string) => void;
  resolveAlert: (id: string) => void;
  addUser: (user: Omit<UserAccount, 'id'>, actor?: string) => void;
  toggleUser: (id: string, actor?: string) => void;
  resetUserPasswordLog: (id: string, actor?: string) => void;
  setMismatchThreshold: (value: number, actor?: string) => void;
  backupData: () => string;
  restoreData: (json: string, actor?: string) => { ok: boolean; message: string };
  getStats: () => DashboardStats;
};

const STORAGE_KEY = 'ti-nasonximang-business-v1';

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function appendLog(logs: SystemLog[], action: string, actor: string, objectType: string, objectId: string): SystemLog[] {
  return [
    {
      id: uid('log'),
      action,
      actor,
      objectType,
      objectId,
      createdAt: now()
    },
    ...logs
  ].slice(0, 500);
}

function recalcAlerts(state: {
  orders: SalesOrder[];
  deliveryTickets: DeliveryTicket[];
  weighIns: WeighInRecord[];
  weighOuts: WeighOutRecord[];
  warehouseExports: WarehouseExport[];
  mismatchThreshold: number;
}): ReconciliationAlert[] {
  const alerts: ReconciliationAlert[] = [];

  for (const order of state.orders) {
    if (order.status === 'CANCELLED') {
      continue;
    }

    const ticket = state.deliveryTickets.find((item) => item.orderId === order.id && !item.cancelledAt);
    const weighIn = ticket ? state.weighIns.find((item) => item.deliveryTicketId === ticket.id) : undefined;
    const weighOut = weighIn ? state.weighOuts.find((item) => item.weighInId === weighIn.id) : undefined;
    const exported = ticket
      ? state.warehouseExports.filter((item) => item.deliveryTicketId === ticket.id).reduce((sum, item) => sum + item.quantity, 0)
      : 0;

    if (ticket && !weighIn) {
      alerts.push({
        id: uid('alert'),
        orderId: order.id,
        level: 'WARN',
        message: `Don ${order.orderNo} thieu can vao.`,
        createdAt: now(),
        resolved: false
      });
    }

    if (weighIn && !weighOut) {
      alerts.push({
        id: uid('alert'),
        orderId: order.id,
        level: 'WARN',
        message: `Don ${order.orderNo} thieu can ra.`,
        createdAt: now(),
        resolved: false
      });
    }

    if (exported > order.quantity) {
      alerts.push({
        id: uid('alert'),
        orderId: order.id,
        level: 'ERROR',
        message: `Don ${order.orderNo} xuat vuot so luong dat (${exported}/${order.quantity}).`,
        createdAt: now(),
        resolved: false
      });
    }

    if (ticket && ticket.customerId !== order.customerId) {
      alerts.push({
        id: uid('alert'),
        orderId: order.id,
        level: 'ERROR',
        message: `Don ${order.orderNo} sai khach hang giua don va phieu xuat.`,
        createdAt: now(),
        resolved: false
      });
    }

    if (ticket && ticket.truckPlate && ticket.truckPlate !== order.truckPlate) {
      alerts.push({
        id: uid('alert'),
        orderId: order.id,
        level: 'WARN',
        message: `Don ${order.orderNo} sai bien so xe giua don va phieu xuat.`,
        createdAt: now(),
        resolved: false
      });
    }

    if (weighIn && weighOut) {
      const actualQty = Math.abs(weighOut.weightOut - weighIn.weightIn);
      const diff = Math.abs(actualQty - exported);
      if (diff > state.mismatchThreshold) {
        alerts.push({
          id: uid('alert'),
          orderId: order.id,
          level: 'ERROR',
          message: `Don ${order.orderNo} sai trong luong (${actualQty.toFixed(2)} tan) chenhlech ${diff.toFixed(2)} tan.`,
          createdAt: now(),
          resolved: false
        });
      }
    }
  }

  return alerts;
}

function saveState(partial: {
  customers: Customer[];
  orders: SalesOrder[];
  deliveryTickets: DeliveryTicket[];
  weighIns: WeighInRecord[];
  warehouseExports: WarehouseExport[];
  weighOuts: WeighOutRecord[];
  inventory: InventoryItem[];
  users: UserAccount[];
  logs: SystemLog[];
  mismatchThreshold: number;
  alerts: ReconciliationAlert[];
}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(partial));
}

function initialData() {
  const customerId = uid('cus');
  const orderId = uid('ord');

  return {
    role: 'ADMIN' as Role,
    customers: [
      {
        id: customerId,
        code: 'KH-0001',
        name: 'Cong ty TNHH Van Tai Minh Long',
        address: 'KCN Dong Xuyen, Vung Tau',
        phone: '0909000111',
        email: 'minhlong@example.com',
        contactPerson: 'Nguyen Van Binh',
        taxCode: '3500123123',
        note: 'Khach hang uu tien',
        status: 'ACTIVE' as CustomerStatus,
        createdAt: now()
      }
    ],
    orders: [
      {
        id: orderId,
        orderNo: 'DH-202607-001',
        createdDate: todayString(),
        customerId,
        product: 'Xi mang PCB40',
        spec: 'Bao 50kg',
        quantity: 30,
        unitPrice: 1450000,
        amount: 43500000,
        createdBy: 'sales01',
        note: '',
        truckPlate: '72C-12345',
        driverName: 'Tran Van Loc',
        status: 'APPROVED' as OrderStatus
      }
    ],
    deliveryTickets: [],
    weighIns: [],
    warehouseExports: [],
    weighOuts: [],
    inventory: [
      {
        id: uid('inv'),
        product: 'Xi mang PCB40',
        spec: 'Bao 50kg',
        lot: 'LO-2407A',
        warehouse: 'Kho thanh pham 1',
        stockQty: 240,
        unitPrice: 1450000
      },
      {
        id: uid('inv'),
        product: 'Xi mang PCB30',
        spec: 'Bao 50kg',
        lot: 'LO-2407B',
        warehouse: 'Kho thanh pham 2',
        stockQty: 120,
        unitPrice: 1320000
      }
    ],
    users: [
      { id: uid('usr'), username: 'admin', fullName: 'Quan tri he thong', role: 'ADMIN' as Role, active: true },
      { id: uid('usr'), username: 'sales01', fullName: 'Phong kinh doanh', role: 'SALES' as Role, active: true },
      { id: uid('usr'), username: 'weight01', fullName: 'Nhan vien can', role: 'WEIGHING' as Role, active: true }
    ],
    logs: [] as SystemLog[],
    mismatchThreshold: 0.5,
    alerts: [] as ReconciliationAlert[]
  };
}

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return initialData();
    }

    const parsed = JSON.parse(raw) as ReturnType<typeof initialData>;
    return {
      ...initialData(),
      ...parsed
    };
  } catch {
    return initialData();
  }
}

export function calcActualWeight(weightIn: number, weightOut: number): number {
  return Math.abs(weightOut - weightIn);
}

export const useBusinessStore = create<BusinessStore>((set, get) => ({
  ...hydrate(),

  setRole: (role) => set({ role }),

  addCustomer: (payload, actor = 'system') => {
    set((state) => {
      const nextCustomers = [
        {
          id: uid('cus'),
          ...payload,
          status: 'ACTIVE' as CustomerStatus,
          createdAt: now()
        },
        ...state.customers
      ];

      const nextLogs = appendLog(state.logs, 'THEM_KHACH_HANG', actor, 'CUSTOMER', nextCustomers[0].id);
      const next = { ...state, customers: nextCustomers, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  updateCustomer: (id, payload, actor = 'system') => {
    set((state) => {
      const nextCustomers = state.customers.map((item) => (item.id === id ? { ...item, ...payload } : item));
      const nextLogs = appendLog(state.logs, 'SUA_KHACH_HANG', actor, 'CUSTOMER', id);
      const next = { ...state, customers: nextCustomers, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  removeCustomer: (id, actor = 'system') => {
    const hasTransactions = get().orders.some((item) => item.customerId === id);
    if (hasTransactions) {
      return { ok: false, message: 'Khong the xoa khach hang da phat sinh giao dich.' };
    }

    set((state) => {
      const nextCustomers = state.customers.filter((item) => item.id !== id);
      const nextLogs = appendLog(state.logs, 'XOA_KHACH_HANG', actor, 'CUSTOMER', id);
      const next = { ...state, customers: nextCustomers, logs: nextLogs };
      saveState(next);
      return next;
    });

    return { ok: true, message: 'Da xoa khach hang.' };
  },

  toggleCustomerStatus: (id, actor = 'system') => {
    set((state) => {
      const nextCustomers = state.customers.map((item) => {
        if (item.id !== id) {
          return item;
        }

        return {
          ...item,
          status: item.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE'
        };
      });

      const nextLogs = appendLog(state.logs, 'KHOA_MO_KHACH_HANG', actor, 'CUSTOMER', id);
      const next = { ...state, customers: nextCustomers, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  addOrder: (payload, actor = 'system') => {
    set((state) => {
      const nextOrder = {
        id: uid('ord'),
        ...payload,
        amount: payload.quantity * payload.unitPrice,
        status: 'NEW' as OrderStatus
      };

      const nextOrders = [nextOrder, ...state.orders];
      const nextAlerts = recalcAlerts({ ...state, orders: nextOrders });
      const nextLogs = appendLog(state.logs, 'THEM_DON_HANG', actor, 'ORDER', nextOrder.id);
      const next = { ...state, orders: nextOrders, alerts: nextAlerts, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  updateOrder: (id, patch, actor = 'system') => {
    set((state) => {
      const nextOrders = state.orders.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const quantity = patch.quantity ?? item.quantity;
        const unitPrice = patch.unitPrice ?? item.unitPrice;

        return {
          ...item,
          ...patch,
          amount: quantity * unitPrice
        };
      });

      const nextAlerts = recalcAlerts({ ...state, orders: nextOrders });
      const nextLogs = appendLog(state.logs, 'SUA_DON_HANG', actor, 'ORDER', id);
      const next = { ...state, orders: nextOrders, alerts: nextAlerts, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  setOrderStatus: (id, status, actor = 'system') => {
    set((state) => {
      const nextOrders = state.orders.map((item) => (item.id === id ? { ...item, status } : item));
      const nextAlerts = recalcAlerts({ ...state, orders: nextOrders });
      const nextLogs = appendLog(state.logs, 'DOI_TRANG_THAI_DON', actor, 'ORDER', id);
      const next = { ...state, orders: nextOrders, alerts: nextAlerts, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  createDeliveryTicket: (payload, actor = 'system') => {
    const state = get();
    const order = state.orders.find((item) => item.id === payload.orderId);
    if (!order) {
      return { ok: false, message: 'Khong tim thay don hang.' };
    }

    const inv = state.inventory.find((item) => item.product === payload.product && item.warehouse === payload.warehouse);
    if (!inv || inv.stockQty < payload.quantity) {
      return { ok: false, message: 'Ton kho khong du de lap phieu.' };
    }

    set((current) => {
      const nextTickets = [
        {
          id: uid('exp'),
          ...payload,
          printedAt: '',
          cancelledAt: ''
        },
        ...current.deliveryTickets
      ];

      const nextOrders = current.orders.map((item) =>
        item.id === payload.orderId
          ? {
              ...item,
              status: 'PICKING' as OrderStatus
            }
          : item
      );

      const nextAlerts = recalcAlerts({ ...current, orders: nextOrders, deliveryTickets: nextTickets });
      const nextLogs = appendLog(current.logs, 'LAP_PHIEU_XUAT', actor, 'DELIVERY', nextTickets[0].id);
      const next = { ...current, deliveryTickets: nextTickets, orders: nextOrders, alerts: nextAlerts, logs: nextLogs };
      saveState(next);
      return next;
    });

    return { ok: true, message: 'Da lap phieu xuat kho.' };
  },

  cancelDeliveryTicket: (id, actor = 'system') => {
    set((state) => {
      const nextTickets = state.deliveryTickets.map((item) =>
        item.id === id
          ? {
              ...item,
              cancelledAt: now()
            }
          : item
      );
      const nextAlerts = recalcAlerts({ ...state, deliveryTickets: nextTickets });
      const nextLogs = appendLog(state.logs, 'HUY_PHIEU_XUAT', actor, 'DELIVERY', id);
      const next = { ...state, deliveryTickets: nextTickets, alerts: nextAlerts, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  addWeighIn: (payload, actor = 'system') => {
    set((state) => {
      const nextWeighIns = [{ id: uid('wi'), ...payload }, ...state.weighIns];
      const nextAlerts = recalcAlerts({ ...state, weighIns: nextWeighIns });
      const nextLogs = appendLog(state.logs, 'CAN_VAO', actor, 'WEIGH_IN', nextWeighIns[0].id);
      const next = { ...state, weighIns: nextWeighIns, alerts: nextAlerts, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  addWarehouseExport: (payload, actor = 'system') => {
    const state = get();
    const inv = state.inventory.find((item) => item.product === payload.product && item.warehouse === payload.warehouse);
    if (!inv || inv.stockQty < payload.quantity) {
      return { ok: false, message: 'Ton kho khong du de xuat.' };
    }

    set((current) => {
      const nextExports = [{ id: uid('wh'), ...payload }, ...current.warehouseExports];
      const nextInventory = current.inventory.map((item) => {
        if (item.product === payload.product && item.warehouse === payload.warehouse) {
          return {
            ...item,
            stockQty: item.stockQty - payload.quantity
          };
        }

        return item;
      });

      const nextAlerts = recalcAlerts({ ...current, warehouseExports: nextExports });
      const nextLogs = appendLog(current.logs, 'XUAT_KHO', actor, 'WAREHOUSE_EXPORT', nextExports[0].id);
      const next = {
        ...current,
        warehouseExports: nextExports,
        inventory: nextInventory,
        alerts: nextAlerts,
        logs: nextLogs
      };
      saveState(next);
      return next;
    });

    return { ok: true, message: 'Da xac nhan xuat kho.' };
  },

  addWeighOut: (payload, actor = 'system') => {
    set((state) => {
      const nextWeighOuts = [{ id: uid('wo'), ...payload }, ...state.weighOuts];

      const weighIn = state.weighIns.find((item) => item.id === payload.weighInId);
      const ticket = weighIn ? state.deliveryTickets.find((item) => item.id === weighIn.deliveryTicketId) : undefined;
      const orderId = ticket?.orderId;

      const nextOrders = orderId
        ? state.orders.map((item) =>
            item.id === orderId
              ? {
                  ...item,
                  status: 'COMPLETED' as OrderStatus
                }
              : item
          )
        : state.orders;

      const nextAlerts = recalcAlerts({ ...state, weighOuts: nextWeighOuts, orders: nextOrders });
      const nextLogs = appendLog(state.logs, 'CAN_RA', actor, 'WEIGH_OUT', nextWeighOuts[0].id);
      const next = { ...state, weighOuts: nextWeighOuts, orders: nextOrders, alerts: nextAlerts, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  resolveAlert: (id) => {
    set((state) => {
      const nextAlerts = state.alerts.map((item) => (item.id === id ? { ...item, resolved: true } : item));
      const next = { ...state, alerts: nextAlerts };
      saveState(next);
      return next;
    });
  },

  addUser: (user, actor = 'system') => {
    set((state) => {
      const nextUsers = [{ ...user, id: uid('usr') }, ...state.users];
      const nextLogs = appendLog(state.logs, 'THEM_USER', actor, 'USER', nextUsers[0].id);
      const next = { ...state, users: nextUsers, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  toggleUser: (id, actor = 'system') => {
    set((state) => {
      const nextUsers = state.users.map((user) => (user.id === id ? { ...user, active: !user.active } : user));
      const nextLogs = appendLog(state.logs, 'KHOA_MO_USER', actor, 'USER', id);
      const next = { ...state, users: nextUsers, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  resetUserPasswordLog: (id, actor = 'system') => {
    set((state) => {
      const nextLogs = appendLog(state.logs, 'RESET_PASSWORD', actor, 'USER', id);
      const next = { ...state, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  setMismatchThreshold: (value, actor = 'system') => {
    set((state) => {
      const nextAlerts = recalcAlerts({ ...state, mismatchThreshold: value });
      const nextLogs = appendLog(state.logs, 'CAU_HINH_NGUONG_CHENH_LECH', actor, 'SETTING', 'mismatch-threshold');
      const next = { ...state, mismatchThreshold: value, alerts: nextAlerts, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  backupData: () => {
    const state = get();
    return JSON.stringify(
      {
        customers: state.customers,
        orders: state.orders,
        deliveryTickets: state.deliveryTickets,
        weighIns: state.weighIns,
        warehouseExports: state.warehouseExports,
        weighOuts: state.weighOuts,
        inventory: state.inventory,
        users: state.users,
        logs: state.logs,
        mismatchThreshold: state.mismatchThreshold,
        alerts: state.alerts
      },
      null,
      2
    );
  },

  restoreData: (json, actor = 'system') => {
    try {
      const parsed = JSON.parse(json) as {
        customers: Customer[];
        orders: SalesOrder[];
        deliveryTickets: DeliveryTicket[];
        weighIns: WeighInRecord[];
        warehouseExports: WarehouseExport[];
        weighOuts: WeighOutRecord[];
        inventory: InventoryItem[];
        users: UserAccount[];
        logs: SystemLog[];
        mismatchThreshold: number;
        alerts: ReconciliationAlert[];
      };

      set((state) => {
        const nextAlerts = recalcAlerts(parsed);
        const nextLogs = appendLog(parsed.logs ?? state.logs, 'KHOI_PHUC_DU_LIEU', actor, 'SYSTEM', 'backup');
        const next = {
          ...state,
          ...parsed,
          alerts: nextAlerts,
          logs: nextLogs
        };
        saveState(next);
        return next;
      });

      return { ok: true, message: 'Khoi phuc du lieu thanh cong.' };
    } catch {
      return { ok: false, message: 'File backup khong hop le.' };
    }
  },

  getStats: () => {
    const state = get();
    const totalCustomers = state.customers.length;
    const activeOrders = state.orders.filter((item) => ['NEW', 'APPROVED', 'PICKING'].includes(item.status)).length;
    const todayExports = state.warehouseExports.filter((item) => item.exportedAt.slice(0, 10) === todayString()).length;
    const unresolvedAlerts = state.alerts.filter((item) => !item.resolved).length;

    return {
      totalCustomers,
      activeOrders,
      todayExports,
      unresolvedAlerts
    };
  }
}));