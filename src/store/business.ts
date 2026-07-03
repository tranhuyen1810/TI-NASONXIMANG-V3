import { create } from 'zustand';

export type Role = 'ADMIN' | 'SALES' | 'ACCOUNTING' | 'WAREHOUSE' | 'WEIGHING' | 'SECURITY';

export type Department =
  | 'KHACH_HANG'
  | 'KINH_DOANH'
  | 'KE_TOAN'
  | 'KHO'
  | 'CAN_XE'
  | 'BAO_VE'
  | 'HE_THONG';

export type WorkflowStage =
  | 'TAO_DON_HANG'
  | 'TIEP_NHAN_DON'
  | 'LAP_PHIEU_XUAT'
  | 'XE_VAO_CONG'
  | 'CAN_XE_VAO'
  | 'XUAT_HANG'
  | 'CAN_XE_RA'
  | 'HOAN_TAT_GIAO_DICH';

export type StepStatus = 'DANG_XU_LY' | 'HOAN_THANH';

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

export type ProductCatalogItem = {
  id: string;
  groupName: string;
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  active: boolean;
};

export type SalesOrder = {
  id: string;
  orderNo: string;
  createdDate: string;
  customerId: string;
  productGroup?: string;
  productCode?: string;
  product: string;
  spec: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  deliveryDate?: string;
  deliveryAddress?: string;
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

export type WorkflowStep = {
  id: string;
  orderId: string;
  stage: WorkflowStage;
  department: Department;
  actor: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: StepStatus;
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

export type ProcessMetrics = {
  avgStepMinutes: number;
  fastestDepartment: string;
  slowestDepartment: string;
  slowestEmployee: string;
  avgOrderCompletionMinutes: number;
};

type BusinessStore = {
  role: Role;
  customers: Customer[];
  orders: SalesOrder[];
  deliveryTickets: DeliveryTicket[];
  weighIns: WeighInRecord[];
  warehouseExports: WarehouseExport[];
  weighOuts: WeighOutRecord[];
  productCatalog: ProductCatalogItem[];
  workflowSteps: WorkflowStep[];
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
  markVehicleEntry: (orderId: string, actor?: string) => void;
  addProduct: (payload: Omit<ProductCatalogItem, 'id' | 'active'>, actor?: string) => void;
  toggleProduct: (id: string, actor?: string) => void;
  resolveAlert: (id: string) => void;
  addUser: (user: Omit<UserAccount, 'id'>, actor?: string) => void;
  toggleUser: (id: string, actor?: string) => void;
  resetUserPasswordLog: (id: string, actor?: string) => void;
  setMismatchThreshold: (value: number, actor?: string) => void;
  backupData: () => string;
  restoreData: (json: string, actor?: string) => { ok: boolean; message: string };
  getStats: () => DashboardStats;
  getProcessMetrics: () => ProcessMetrics;
};

const STORAGE_KEY = 'ti-nasonximang-business-v2';

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

function departmentLabel(dep: Department): string {
  const labels: Record<Department, string> = {
    KHACH_HANG: 'Khach hang',
    KINH_DOANH: 'Phong Kinh doanh',
    KE_TOAN: 'Phong Ke toan',
    KHO: 'Thu kho',
    CAN_XE: 'Nhan vien can',
    BAO_VE: 'Bao ve',
    HE_THONG: 'He thong'
  };

  return labels[dep];
}

function findLastStepEnd(steps: WorkflowStep[], orderId: string): string | null {
  const records = steps.filter((item) => item.orderId === orderId).sort((a, b) => a.endAt.localeCompare(b.endAt));
  if (!records.length) {
    return null;
  }

  return records[records.length - 1].endAt;
}

function recordCompletedStep(
  steps: WorkflowStep[],
  params: {
    orderId: string;
    stage: WorkflowStage;
    department: Department;
    actor: string;
    endAt?: string;
  }
): WorkflowStep[] {
  const endAt = params.endAt ?? now();
  const startAt = findLastStepEnd(steps, params.orderId) ?? endAt;
  const durationMinutes = Math.max(0, (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);

  return [
    {
      id: uid('step'),
      orderId: params.orderId,
      stage: params.stage,
      department: params.department,
      actor: params.actor,
      startAt,
      endAt,
      durationMinutes,
      status: 'HOAN_THANH'
    },
    ...steps
  ];
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
  productCatalog: ProductCatalogItem[];
  workflowSteps: WorkflowStep[];
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
        productGroup: 'Xi măng',
        productCode: 'XM01',
        product: 'Xi măng 1',
        spec: 'Bao 50kg',
        unit: 'Tấn',
        quantity: 30,
        unitPrice: 1450000,
        amount: 43500000,
        deliveryDate: todayString(),
        deliveryAddress: 'KCN Dong Xuyen, Vung Tau',
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
    productCatalog: [
      { id: uid('prd'), groupName: 'Xi măng', code: 'XM01', name: 'Xi măng 1', unit: 'Tấn', unitPrice: 1450000, active: true },
      { id: uid('prd'), groupName: 'Xi măng', code: 'XM02', name: 'Xi măng 2', unit: 'Tấn', unitPrice: 1420000, active: true },
      { id: uid('prd'), groupName: 'Xi măng', code: 'XM03', name: 'Xi măng 3', unit: 'Tấn', unitPrice: 1390000, active: true },
      { id: uid('prd'), groupName: 'Gạch', code: 'G01', name: 'Gạch 1', unit: 'Viên', unitPrice: 1300, active: true },
      { id: uid('prd'), groupName: 'Gạch', code: 'G02', name: 'Gạch 2', unit: 'Viên', unitPrice: 1450, active: true },
      { id: uid('prd'), groupName: 'Gạch', code: 'G03', name: 'Gạch 3', unit: 'Viên', unitPrice: 1700, active: true },
      { id: uid('prd'), groupName: 'Vữa', code: 'V01', name: 'Vữa xây trát 1', unit: 'Bao', unitPrice: 74000, active: true },
      { id: uid('prd'), groupName: 'Vữa', code: 'V02', name: 'Vữa xây trát 2', unit: 'Bao', unitPrice: 81000, active: true }
    ],
    workflowSteps: [],
    inventory: [
      {
        id: uid('inv'),
        product: 'Xi măng 1',
        spec: 'Bao 50kg',
        lot: 'LO-2407A',
        warehouse: 'Kho thành phẩm 1',
        stockQty: 240,
        unitPrice: 1450000
      },
      {
        id: uid('inv'),
        product: 'Xi măng 2',
        spec: 'Bao 50kg',
        lot: 'LO-2407B',
        warehouse: 'Kho thành phẩm 2',
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
      const nextSteps = recordCompletedStep(state.workflowSteps, {
        orderId: nextOrder.id,
        stage: 'TAO_DON_HANG',
        department: 'KHACH_HANG',
        actor
      });
      const nextAlerts = recalcAlerts({ ...state, orders: nextOrders });
      const nextLogs = appendLog(state.logs, 'THEM_DON_HANG', actor, 'ORDER', nextOrder.id);
      const next = { ...state, orders: nextOrders, workflowSteps: nextSteps, alerts: nextAlerts, logs: nextLogs };
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
      let nextSteps = state.workflowSteps;

      if (status === 'APPROVED') {
        nextSteps = recordCompletedStep(nextSteps, {
          orderId: id,
          stage: 'TIEP_NHAN_DON',
          department: 'KINH_DOANH',
          actor
        });
      }

      if (status === 'COMPLETED') {
        nextSteps = recordCompletedStep(nextSteps, {
          orderId: id,
          stage: 'HOAN_TAT_GIAO_DICH',
          department: 'KE_TOAN',
          actor
        });
      }

      const nextAlerts = recalcAlerts({ ...state, orders: nextOrders });
      const nextLogs = appendLog(state.logs, 'DOI_TRANG_THAI_DON', actor, 'ORDER', id);
      const next = { ...state, orders: nextOrders, workflowSteps: nextSteps, alerts: nextAlerts, logs: nextLogs };
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

      const nextSteps = recordCompletedStep(current.workflowSteps, {
        orderId: payload.orderId,
        stage: 'LAP_PHIEU_XUAT',
        department: 'KE_TOAN',
        actor
      });

      const nextAlerts = recalcAlerts({ ...current, orders: nextOrders, deliveryTickets: nextTickets });
      const nextLogs = appendLog(current.logs, 'LAP_PHIEU_XUAT', actor, 'DELIVERY', nextTickets[0].id);
      const next = {
        ...current,
        deliveryTickets: nextTickets,
        orders: nextOrders,
        workflowSteps: nextSteps,
        alerts: nextAlerts,
        logs: nextLogs
      };
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
      const ticket = state.deliveryTickets.find((item) => item.id === payload.deliveryTicketId);
      const nextSteps = ticket
        ? recordCompletedStep(state.workflowSteps, {
            orderId: ticket.orderId,
            stage: 'CAN_XE_VAO',
            department: 'CAN_XE',
            actor,
            endAt: payload.weighedAt
          })
        : state.workflowSteps;
      const nextAlerts = recalcAlerts({ ...state, weighIns: nextWeighIns });
      const nextLogs = appendLog(state.logs, 'CAN_VAO', actor, 'WEIGH_IN', nextWeighIns[0].id);
      const next = { ...state, weighIns: nextWeighIns, workflowSteps: nextSteps, alerts: nextAlerts, logs: nextLogs };
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

      const ticket = current.deliveryTickets.find((item) => item.id === payload.deliveryTicketId);
      const nextSteps = ticket
        ? recordCompletedStep(current.workflowSteps, {
            orderId: ticket.orderId,
            stage: 'XUAT_HANG',
            department: 'KHO',
            actor,
            endAt: payload.exportedAt
          })
        : current.workflowSteps;

      const nextAlerts = recalcAlerts({ ...current, warehouseExports: nextExports });
      const nextLogs = appendLog(current.logs, 'XUAT_KHO', actor, 'WAREHOUSE_EXPORT', nextExports[0].id);
      const next = {
        ...current,
        warehouseExports: nextExports,
        workflowSteps: nextSteps,
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

      let nextSteps = state.workflowSteps;

      if (orderId) {
        nextSteps = recordCompletedStep(nextSteps, {
          orderId,
          stage: 'CAN_XE_RA',
          department: 'CAN_XE',
          actor,
          endAt: payload.weighedAt
        });

        nextSteps = recordCompletedStep(nextSteps, {
          orderId,
          stage: 'HOAN_TAT_GIAO_DICH',
          department: 'KE_TOAN',
          actor
        });
      }

      const nextAlerts = recalcAlerts({ ...state, weighOuts: nextWeighOuts, orders: nextOrders });
      const nextLogs = appendLog(state.logs, 'CAN_RA', actor, 'WEIGH_OUT', nextWeighOuts[0].id);
      const next = {
        ...state,
        weighOuts: nextWeighOuts,
        orders: nextOrders,
        workflowSteps: nextSteps,
        alerts: nextAlerts,
        logs: nextLogs
      };
      saveState(next);
      return next;
    });
  },

  markVehicleEntry: (orderId, actor = 'system') => {
    set((state) => {
      const nextSteps = recordCompletedStep(state.workflowSteps, {
        orderId,
        stage: 'XE_VAO_CONG',
        department: 'BAO_VE',
        actor
      });
      const nextLogs = appendLog(state.logs, 'XE_VAO_CONG', actor, 'ORDER', orderId);
      const next = { ...state, workflowSteps: nextSteps, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  addProduct: (payload, actor = 'system') => {
    set((state) => {
      const nextProducts = [{ id: uid('prd'), ...payload, active: true }, ...state.productCatalog];
      const nextLogs = appendLog(state.logs, 'THEM_SAN_PHAM', actor, 'PRODUCT', nextProducts[0].id);
      const next = { ...state, productCatalog: nextProducts, logs: nextLogs };
      saveState(next);
      return next;
    });
  },

  toggleProduct: (id, actor = 'system') => {
    set((state) => {
      const nextProducts = state.productCatalog.map((item) => (item.id === id ? { ...item, active: !item.active } : item));
      const nextLogs = appendLog(state.logs, 'NGUNG_KICH_HOAT_SAN_PHAM', actor, 'PRODUCT', id);
      const next = { ...state, productCatalog: nextProducts, logs: nextLogs };
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
        productCatalog: state.productCatalog,
        workflowSteps: state.workflowSteps,
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
        productCatalog: ProductCatalogItem[];
        workflowSteps: WorkflowStep[];
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
  },

  getProcessMetrics: () => {
    const state = get();
    const completedSteps = state.workflowSteps.filter((item) => item.status === 'HOAN_THANH');

    if (!completedSteps.length) {
      return {
        avgStepMinutes: 0,
        fastestDepartment: '-',
        slowestDepartment: '-',
        slowestEmployee: '-',
        avgOrderCompletionMinutes: 0
      };
    }

    const avgStepMinutes = completedSteps.reduce((sum, item) => sum + item.durationMinutes, 0) / completedSteps.length;

    const deptMap = new Map<Department, { total: number; count: number }>();
    for (const step of completedSteps) {
      const value = deptMap.get(step.department) ?? { total: 0, count: 0 };
      value.total += step.durationMinutes;
      value.count += 1;
      deptMap.set(step.department, value);
    }

    const deptAverages = Array.from(deptMap.entries()).map(([department, value]) => ({
      department,
      avg: value.total / value.count
    }));

    deptAverages.sort((a, b) => a.avg - b.avg);

    const employeeTotals = new Map<string, number>();
    for (const step of completedSteps) {
      employeeTotals.set(step.actor, (employeeTotals.get(step.actor) ?? 0) + step.durationMinutes);
    }

    const slowestEmployee = Array.from(employeeTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

    const orderMap = new Map<string, WorkflowStep[]>();
    for (const step of completedSteps) {
      const list = orderMap.get(step.orderId) ?? [];
      list.push(step);
      orderMap.set(step.orderId, list);
    }

    const completionMinutes = Array.from(orderMap.values())
      .map((list) => list.sort((a, b) => a.startAt.localeCompare(b.startAt)))
      .map((list) => {
        const first = list[0];
        const last = list[list.length - 1];
        return Math.max(0, (new Date(last.endAt).getTime() - new Date(first.startAt).getTime()) / 60000);
      });

    const avgOrderCompletionMinutes = completionMinutes.length
      ? completionMinutes.reduce((sum, value) => sum + value, 0) / completionMinutes.length
      : 0;

    return {
      avgStepMinutes,
      fastestDepartment: deptAverages.length ? departmentLabel(deptAverages[0].department) : '-',
      slowestDepartment: deptAverages.length ? departmentLabel(deptAverages[deptAverages.length - 1].department) : '-',
      slowestEmployee,
      avgOrderCompletionMinutes
    };
  }
}));
