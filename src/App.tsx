import { FormEvent, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertLevel,
  CustomerStatus,
  OrderStatus,
  Role,
  SalesOrder,
  calcActualWeight,
  useBusinessStore
} from './store/business';

type TabKey =
  | 'overview'
  | 'customers'
  | 'orders'
  | 'delivery'
  | 'weighing'
  | 'reconcile'
  | 'reports'
  | 'permissions'
  | 'admin';

type PermissionAction =
  | 'CUSTOMER_ADD'
  | 'CUSTOMER_EDIT'
  | 'CUSTOMER_DELETE'
  | 'CUSTOMER_TOGGLE'
  | 'ORDER_ADD'
  | 'ORDER_EDIT'
  | 'ORDER_APPROVE'
  | 'ORDER_CANCEL'
  | 'DELIVERY_CREATE'
  | 'DELIVERY_CANCEL'
  | 'DELIVERY_PRINT'
  | 'WEIGH_IN'
  | 'WEIGH_OUT'
  | 'WAREHOUSE_EXPORT'
  | 'ALERT_RESOLVE'
  | 'REPORT_EXPORT'
  | 'USER_MANAGE'
  | 'CONFIG_EDIT'
  | 'BACKUP_RESTORE';

const rolePermissions: Record<Role, PermissionAction[]> = {
  ADMIN: [
    'CUSTOMER_ADD',
    'CUSTOMER_EDIT',
    'CUSTOMER_DELETE',
    'CUSTOMER_TOGGLE',
    'ORDER_ADD',
    'ORDER_EDIT',
    'ORDER_APPROVE',
    'ORDER_CANCEL',
    'DELIVERY_CREATE',
    'DELIVERY_CANCEL',
    'DELIVERY_PRINT',
    'WEIGH_IN',
    'WEIGH_OUT',
    'WAREHOUSE_EXPORT',
    'ALERT_RESOLVE',
    'REPORT_EXPORT',
    'USER_MANAGE',
    'CONFIG_EDIT',
    'BACKUP_RESTORE'
  ],
  SALES: ['CUSTOMER_ADD', 'CUSTOMER_EDIT', 'CUSTOMER_TOGGLE', 'ORDER_ADD', 'ORDER_EDIT', 'ORDER_APPROVE', 'REPORT_EXPORT'],
  ACCOUNTING: ['ORDER_EDIT', 'REPORT_EXPORT', 'ALERT_RESOLVE'],
  WAREHOUSE: ['DELIVERY_CREATE', 'DELIVERY_CANCEL', 'DELIVERY_PRINT', 'WAREHOUSE_EXPORT', 'ALERT_RESOLVE'],
  WEIGHING: ['WEIGH_IN', 'WEIGH_OUT', 'DELIVERY_PRINT', 'REPORT_EXPORT'],
  SECURITY: ['ALERT_RESOLVE', 'REPORT_EXPORT']
};

const tabs: Array<{ id: TabKey; label: string }> = [
  { id: 'overview', label: 'Tong quan' },
  { id: 'customers', label: 'Khach hang' },
  { id: 'orders', label: 'Don hang' },
  { id: 'delivery', label: 'Phieu xuat kho' },
  { id: 'weighing', label: 'Can vao/ra + xuat kho' },
  { id: 'reconcile', label: 'Doi chieu canh bao' },
  { id: 'reports', label: 'Bao cao' },
  { id: 'permissions', label: 'Phan quyen' },
  { id: 'admin', label: 'Quan tri he thong' }
];

function downloadTextFile(content: string, name: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function currency(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(value);
}

function orderStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    NEW: 'Moi tao',
    APPROVED: 'Da duyet',
    PICKING: 'Dang xuat kho',
    COMPLETED: 'Da hoan thanh',
    CANCELLED: 'Da huy'
  };

  return labels[status];
}

function customerStatusLabel(status: CustomerStatus): string {
  return status === 'ACTIVE' ? 'Dang hoat dong' : 'Da khoa';
}

function alertClass(level: AlertLevel): string {
  if (level === 'ERROR') {
    return 'bg-rose-100 text-rose-700 border-rose-200';
  }

  if (level === 'WARN') {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }

  return 'bg-sky-100 text-sky-700 border-sky-200';
}

async function exportTemplateWorkbook(rows: Array<Record<string, string | number>>) {
  try {
    const response = await fetch('/templates/1-bang-mau-xm-t4-2026-xi-mang.xlsx');
    if (!response.ok) {
      throw new Error('Khong tai duoc file mau');
    }

    const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const firstName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstName];

    XLSX.utils.sheet_add_json(firstSheet, rows, {
      origin: 'A8',
      skipHeader: false
    });

    XLSX.writeFile(workbook, `bao-cao-theo-mau-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'BaoCao');
    XLSX.writeFile(wb, `bao-cao-du-phong-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
}

export default function App() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [message, setMessage] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [backupContent, setBackupContent] = useState('');
  const [reportFrom, setReportFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(new Date().toISOString().slice(0, 10));

  const {
    role,
    setRole,
    customers,
    orders,
    deliveryTickets,
    weighIns,
    warehouseExports,
    weighOuts,
    inventory,
    users,
    logs,
    mismatchThreshold,
    alerts,
    addCustomer,
    updateCustomer,
    removeCustomer,
    toggleCustomerStatus,
    addOrder,
    updateOrder,
    setOrderStatus,
    createDeliveryTicket,
    cancelDeliveryTicket,
    addWeighIn,
    addWarehouseExport,
    addWeighOut,
    resolveAlert,
    addUser,
    toggleUser,
    resetUserPasswordLog,
    setMismatchThreshold,
    backupData,
    restoreData,
    getStats
  } = useBusinessStore();

  const [customerForm, setCustomerForm] = useState({
    id: '',
    code: '',
    name: '',
    address: '',
    phone: '',
    email: '',
    contactPerson: '',
    taxCode: '',
    note: ''
  });

  const [orderForm, setOrderForm] = useState({
    id: '',
    orderNo: '',
    createdDate: new Date().toISOString().slice(0, 10),
    customerId: '',
    product: '',
    spec: '',
    quantity: '1',
    unitPrice: '0',
    createdBy: role.toLowerCase(),
    note: '',
    truckPlate: '',
    driverName: ''
  });

  const [deliveryForm, setDeliveryForm] = useState({
    ticketNo: '',
    orderId: '',
    date: new Date().toISOString().slice(0, 10),
    customerId: '',
    truckPlate: '',
    product: '',
    quantity: '1',
    warehouse: 'Kho thanh pham 1',
    createdBy: role.toLowerCase()
  });

  const [weighInForm, setWeighInForm] = useState({
    ticketNo: '',
    deliveryTicketId: '',
    truckPlate: '',
    driverName: '',
    customerId: '',
    product: '',
    weightIn: '0',
    weighedAt: new Date().toISOString().slice(0, 16),
    weighedBy: role.toLowerCase(),
    method: 'MANUAL' as 'AUTO' | 'MANUAL',
    imageNote: ''
  });

  const [warehouseForm, setWarehouseForm] = useState({
    deliveryTicketId: '',
    warehouse: 'Kho thanh pham 1',
    product: '',
    lot: '',
    quantity: '1',
    exportedBy: role.toLowerCase(),
    exportedAt: new Date().toISOString().slice(0, 16)
  });

  const [weighOutForm, setWeighOutForm] = useState({
    weighInId: '',
    ticketNo: '',
    truckPlate: '',
    weightOut: '0',
    weighedAt: new Date().toISOString().slice(0, 16),
    weighedBy: role.toLowerCase(),
    method: 'MANUAL' as 'AUTO' | 'MANUAL',
    note: ''
  });

  const [userForm, setUserForm] = useState({
    username: '',
    fullName: '',
    role: 'SALES' as Role
  });

  const stats = getStats();

  const can = (action: PermissionAction) => rolePermissions[role].includes(action);

  const visibleCustomers = useMemo(() => {
    const text = customerFilter.trim().toLowerCase();
    if (!text) {
      return customers;
    }

    return customers.filter((item) =>
      [item.code, item.name, item.phone, item.taxCode, item.email].some((value) => value.toLowerCase().includes(text))
    );
  }, [customers, customerFilter]);

  const visibleOrders = useMemo(() => {
    const text = orderFilter.trim().toLowerCase();
    if (!text) {
      return orders;
    }

    return orders.filter((item) =>
      [item.orderNo, item.product, item.spec, item.truckPlate, item.driverName].some((value) =>
        value.toLowerCase().includes(text)
      )
    );
  }, [orders, orderFilter]);

  const reportOrders = useMemo(() => {
    return orders.filter((item) => item.createdDate >= reportFrom && item.createdDate <= reportTo);
  }, [orders, reportFrom, reportTo]);

  const salesRevenue = reportOrders.reduce((sum, item) => sum + item.amount, 0);

  const weighReportRows = useMemo(() => {
    return weighOuts.map((wo) => {
      const wi = weighIns.find((item) => item.id === wo.weighInId);
      const ticket = wi ? deliveryTickets.find((item) => item.id === wi.deliveryTicketId) : undefined;
      const order = ticket ? orders.find((item) => item.id === ticket.orderId) : undefined;
      const customer = order ? customers.find((item) => item.id === order.customerId) : undefined;

      return {
        ngay: wo.weighedAt.slice(0, 10),
        phieuCanVao: wi?.ticketNo ?? '',
        phieuCanRa: wo.ticketNo,
        khachHang: customer?.name ?? '',
        bienSoXe: wo.truckPlate,
        canVao: wi?.weightIn ?? 0,
        canRa: wo.weightOut,
        khoiLuongHang: wi ? calcActualWeight(wi.weightIn, wo.weightOut).toFixed(3) : '0',
        nguoiCan: wo.weighedBy
      };
    });
  }, [customers, deliveryTickets, orders, weighIns, weighOuts]);

  function flash(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(''), 2400);
  }

  function onSubmitCustomer(event: FormEvent) {
    event.preventDefault();
    if (!customerForm.code || !customerForm.name || !customerForm.phone) {
      flash('Can nhap ma, ten va so dien thoai khach hang.');
      return;
    }

    if (customerForm.id) {
      if (!can('CUSTOMER_EDIT')) {
        flash('Vai tro hien tai khong co quyen sua khach hang.');
        return;
      }
      updateCustomer(customerForm.id, { ...customerForm, id: undefined } as never, role.toLowerCase());
      flash('Da cap nhat khach hang.');
    } else {
      if (!can('CUSTOMER_ADD')) {
        flash('Vai tro hien tai khong co quyen them khach hang.');
        return;
      }
      addCustomer(customerForm, role.toLowerCase());
      flash('Da them khach hang moi.');
    }

    setCustomerForm({
      id: '',
      code: '',
      name: '',
      address: '',
      phone: '',
      email: '',
      contactPerson: '',
      taxCode: '',
      note: ''
    });
  }

  function onSubmitOrder(event: FormEvent) {
    event.preventDefault();
    if (!orderForm.orderNo || !orderForm.customerId || !orderForm.product) {
      flash('Can chon khach hang va nhap thong tin don hang.');
      return;
    }

    if (orderForm.id) {
      if (!can('ORDER_EDIT')) {
        flash('Vai tro hien tai khong co quyen sua don hang.');
        return;
      }
      updateOrder(
        orderForm.id,
        {
          orderNo: orderForm.orderNo,
          createdDate: orderForm.createdDate,
          customerId: orderForm.customerId,
          product: orderForm.product,
          spec: orderForm.spec,
          quantity: Number(orderForm.quantity),
          unitPrice: Number(orderForm.unitPrice),
          createdBy: orderForm.createdBy,
          note: orderForm.note,
          truckPlate: orderForm.truckPlate,
          driverName: orderForm.driverName
        },
        role.toLowerCase()
      );
      flash('Da cap nhat don hang.');
    } else {
      if (!can('ORDER_ADD')) {
        flash('Vai tro hien tai khong co quyen tao don hang.');
        return;
      }
      addOrder(
        {
          orderNo: orderForm.orderNo,
          createdDate: orderForm.createdDate,
          customerId: orderForm.customerId,
          product: orderForm.product,
          spec: orderForm.spec,
          quantity: Number(orderForm.quantity),
          unitPrice: Number(orderForm.unitPrice),
          createdBy: orderForm.createdBy,
          note: orderForm.note,
          truckPlate: orderForm.truckPlate,
          driverName: orderForm.driverName
        },
        role.toLowerCase()
      );
      flash('Da tao don hang moi.');
    }

    setOrderForm({
      id: '',
      orderNo: '',
      createdDate: new Date().toISOString().slice(0, 10),
      customerId: '',
      product: '',
      spec: '',
      quantity: '1',
      unitPrice: '0',
      createdBy: role.toLowerCase(),
      note: '',
      truckPlate: '',
      driverName: ''
    });
  }

  function exportCustomersSheet() {
    if (!can('REPORT_EXPORT')) {
      flash('Vai tro hien tai khong co quyen xuat file.');
      return;
    }

    const rows = customers.map((item) => ({
      maKhachHang: item.code,
      tenKhachHang: item.name,
      diaChi: item.address,
      soDienThoai: item.phone,
      email: item.email,
      nguoiLienHe: item.contactPerson,
      maSoThue: item.taxCode,
      ghiChu: item.note,
      trangThai: customerStatusLabel(item.status)
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'KhachHang');
    XLSX.writeFile(wb, `danh-sach-khach-hang-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportSalesSummary() {
    if (!can('REPORT_EXPORT')) {
      flash('Vai tro hien tai khong co quyen xuat file.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(
      reportOrders.map((item) => ({
        soDon: item.orderNo,
        ngayLap: item.createdDate,
        khachHang: customers.find((c) => c.id === item.customerId)?.name ?? '',
        hangHoa: item.product,
        quyCach: item.spec,
        soLuongDat: item.quantity,
        donGia: item.unitPrice,
        thanhTien: item.amount,
        trangThai: orderStatusLabel(item.status)
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws1, 'BaoCaoBanHang');

    const ws2 = XLSX.utils.json_to_sheet(
      weighReportRows.map((item) => ({
        ngay: item.ngay,
        phieuCanVao: item.phieuCanVao,
        phieuCanRa: item.phieuCanRa,
        bienSoXe: item.bienSoXe,
        canVao: item.canVao,
        canRa: item.canRa,
        khoiLuong: item.khoiLuongHang
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws2, 'BaoCaoCan');

    XLSX.writeFile(wb, `bao-cao-tong-hop-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function onCreateDelivery(event: FormEvent) {
    event.preventDefault();
    if (!can('DELIVERY_CREATE')) {
      flash('Vai tro hien tai khong co quyen lap phieu xuat kho.');
      return;
    }

    const result = createDeliveryTicket(
      {
        ticketNo: deliveryForm.ticketNo,
        orderId: deliveryForm.orderId,
        date: deliveryForm.date,
        customerId: deliveryForm.customerId,
        truckPlate: deliveryForm.truckPlate,
        product: deliveryForm.product,
        quantity: Number(deliveryForm.quantity),
        warehouse: deliveryForm.warehouse,
        createdBy: deliveryForm.createdBy
      },
      role.toLowerCase()
    );

    flash(result.message);
  }

  function onWeighIn(event: FormEvent) {
    event.preventDefault();
    if (!can('WEIGH_IN')) {
      flash('Vai tro hien tai khong co quyen can vao.');
      return;
    }

    addWeighIn(
      {
        ticketNo: weighInForm.ticketNo,
        deliveryTicketId: weighInForm.deliveryTicketId,
        truckPlate: weighInForm.truckPlate,
        driverName: weighInForm.driverName,
        customerId: weighInForm.customerId,
        product: weighInForm.product,
        weightIn: Number(weighInForm.weightIn),
        weighedAt: new Date(weighInForm.weighedAt).toISOString(),
        weighedBy: weighInForm.weighedBy,
        method: weighInForm.method,
        imageNote: weighInForm.imageNote
      },
      role.toLowerCase()
    );

    flash('Da tao phieu can vao.');
  }

  function onWarehouseExport(event: FormEvent) {
    event.preventDefault();
    if (!can('WAREHOUSE_EXPORT')) {
      flash('Vai tro hien tai khong co quyen xuat kho.');
      return;
    }

    const result = addWarehouseExport(
      {
        deliveryTicketId: warehouseForm.deliveryTicketId,
        warehouse: warehouseForm.warehouse,
        product: warehouseForm.product,
        lot: warehouseForm.lot,
        quantity: Number(warehouseForm.quantity),
        exportedBy: warehouseForm.exportedBy,
        exportedAt: new Date(warehouseForm.exportedAt).toISOString()
      },
      role.toLowerCase()
    );

    flash(result.message);
  }

  function onWeighOut(event: FormEvent) {
    event.preventDefault();
    if (!can('WEIGH_OUT')) {
      flash('Vai tro hien tai khong co quyen can ra.');
      return;
    }

    addWeighOut(
      {
        weighInId: weighOutForm.weighInId,
        ticketNo: weighOutForm.ticketNo,
        truckPlate: weighOutForm.truckPlate,
        weightOut: Number(weighOutForm.weightOut),
        weighedAt: new Date(weighOutForm.weighedAt).toISOString(),
        weighedBy: weighOutForm.weighedBy,
        method: weighOutForm.method,
        note: weighOutForm.note
      },
      role.toLowerCase()
    );

    flash('Da tao phieu can ra va cap nhat khoi luong thuc xuat.');
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fee2e2,_#fff7ed_35%,_#ecfeff_70%,_#e0f2fe)] px-3 py-6 text-slate-900 md:px-8">
      <main className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-rose-700">TI Nason Xi Mang</p>
              <h1 className="text-2xl font-black text-slate-900 md:text-3xl">He thong quan ly xuat kho va can xe toan quy trinh</h1>
              <p className="text-sm text-slate-600">Khach hang -> Don hang -> Phieu xuat -> Can vao -> Xuat kho -> Can ra -> Doi chieu -> Bao cao</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Vai tro dang dang nhap</label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="ADMIN">Quan tri</option>
                <option value="SALES">Phong kinh doanh</option>
                <option value="ACCOUNTING">Ke toan</option>
                <option value="WAREHOUSE">Thu kho</option>
                <option value="WEIGHING">Nhan vien can</option>
                <option value="SECURITY">Bao ve</option>
              </select>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Khach hang" value={String(stats.totalCustomers)} tone="rose" />
            <StatCard title="Don dang xu ly" value={String(stats.activeOrders)} tone="amber" />
            <StatCard title="Luot xuat kho hom nay" value={String(stats.todayExports)} tone="sky" />
            <StatCard title="Canh bao chua xu ly" value={String(stats.unresolvedAlerts)} tone="emerald" />
          </div>
        </header>

        <nav className="grid gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 md:grid-cols-3 lg:grid-cols-9">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                tab === item.id ? 'bg-rose-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {message && <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">{message}</p>}

        {tab === 'overview' && (
          <section className="space-y-4">
            <Panel title="Quy trinh nghiep vu tong the">
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  'Khach hang / Tao don',
                  'Duyet don / Lap phieu xuat',
                  'Can vao / Xuat kho / Can ra',
                  'Tinh thuc xuat / Doi chieu / Bao cao'
                ].map((step, index) => (
                  <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="text-xs font-bold text-rose-700">Buoc {index + 1}</p>
                    <p className="mt-1 font-semibold text-slate-700">{step}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Canh bao he thong tu dong">
              <div className="space-y-2">
                {alerts.length === 0 && <p className="text-sm text-slate-500">Hien khong co canh bao.</p>}
                {alerts.slice(0, 8).map((alert) => (
                  <div key={alert.id} className={`rounded-lg border px-3 py-2 text-sm ${alertClass(alert.level)}`}>
                    <p>{alert.message}</p>
                    <p className="text-xs opacity-80">{new Date(alert.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {tab === 'customers' && (
          <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Panel title="Thong tin khach hang">
              <form className="space-y-2" onSubmit={onSubmitCustomer}>
                <Input label="Ma khach hang" value={customerForm.code} onChange={(value) => setCustomerForm((s) => ({ ...s, code: value }))} required />
                <Input label="Ten khach hang" value={customerForm.name} onChange={(value) => setCustomerForm((s) => ({ ...s, name: value }))} required />
                <Input label="Dia chi" value={customerForm.address} onChange={(value) => setCustomerForm((s) => ({ ...s, address: value }))} />
                <Input label="So dien thoai" value={customerForm.phone} onChange={(value) => setCustomerForm((s) => ({ ...s, phone: value }))} required />
                <Input label="Email" value={customerForm.email} onChange={(value) => setCustomerForm((s) => ({ ...s, email: value }))} />
                <Input label="Nguoi lien he" value={customerForm.contactPerson} onChange={(value) => setCustomerForm((s) => ({ ...s, contactPerson: value }))} />
                <Input label="Ma so thue" value={customerForm.taxCode} onChange={(value) => setCustomerForm((s) => ({ ...s, taxCode: value }))} />
                <Input label="Ghi chu" value={customerForm.note} onChange={(value) => setCustomerForm((s) => ({ ...s, note: value }))} />
                <button className="w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700" type="submit">
                  {customerForm.id ? 'Cap nhat khach hang' : 'Them khach hang'}
                </button>
              </form>
            </Panel>

            <Panel title="Danh sach va lich su giao dich">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <input
                  value={customerFilter}
                  onChange={(event) => setCustomerFilter(event.target.value)}
                  placeholder="Tim theo ma, ten, SDT, MST"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm md:max-w-sm"
                />
                <button
                  type="button"
                  onClick={exportCustomersSheet}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Xuat danh sach khach hang ra Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-2 py-2">Ma</th>
                      <th className="px-2 py-2">Ten</th>
                      <th className="px-2 py-2">SDT</th>
                      <th className="px-2 py-2">MST</th>
                      <th className="px-2 py-2">Trang thai</th>
                      <th className="px-2 py-2">Lich su giao dich</th>
                      <th className="px-2 py-2">Thao tac</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCustomers.map((item) => {
                      const txCount = orders.filter((order) => order.customerId === item.id).length;
                      return (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="px-2 py-2 font-semibold">{item.code}</td>
                          <td className="px-2 py-2">{item.name}</td>
                          <td className="px-2 py-2">{item.phone}</td>
                          <td className="px-2 py-2">{item.taxCode || '-'}</td>
                          <td className="px-2 py-2">{customerStatusLabel(item.status)}</td>
                          <td className="px-2 py-2">{txCount} giao dich</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => setCustomerForm({ ...item, id: item.id })}
                                className="rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700"
                              >
                                Sua
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!can('CUSTOMER_TOGGLE')) {
                                    flash('Khong co quyen khoa/mo khach hang.');
                                    return;
                                  }
                                  toggleCustomerStatus(item.id, role.toLowerCase());
                                }}
                                className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
                              >
                                Khoa/Mo
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!can('CUSTOMER_DELETE')) {
                                    flash('Khong co quyen xoa khach hang.');
                                    return;
                                  }
                                  const result = removeCustomer(item.id, role.toLowerCase());
                                  flash(result.message);
                                }}
                                className="rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700"
                              >
                                Xoa
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        )}

        {tab === 'orders' && (
          <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Panel title="Tao/Sua don hang">
              <form className="space-y-2" onSubmit={onSubmitOrder}>
                <Input label="So don hang" value={orderForm.orderNo} onChange={(value) => setOrderForm((s) => ({ ...s, orderNo: value }))} required />
                <Input label="Ngay lap" type="date" value={orderForm.createdDate} onChange={(value) => setOrderForm((s) => ({ ...s, createdDate: value }))} required />
                <Select
                  label="Khach hang"
                  value={orderForm.customerId}
                  onChange={(value) => setOrderForm((s) => ({ ...s, customerId: value }))}
                  options={customers.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                />
                <Input label="Hang hoa" value={orderForm.product} onChange={(value) => setOrderForm((s) => ({ ...s, product: value }))} required />
                <Input label="Quy cach" value={orderForm.spec} onChange={(value) => setOrderForm((s) => ({ ...s, spec: value }))} required />
                <Input label="So luong dat" type="number" value={orderForm.quantity} onChange={(value) => setOrderForm((s) => ({ ...s, quantity: value }))} required />
                <Input label="Don gia" type="number" value={orderForm.unitPrice} onChange={(value) => setOrderForm((s) => ({ ...s, unitPrice: value }))} required />
                <Input label="Nguoi lap" value={orderForm.createdBy} onChange={(value) => setOrderForm((s) => ({ ...s, createdBy: value }))} required />
                <Input label="Bien so xe" value={orderForm.truckPlate} onChange={(value) => setOrderForm((s) => ({ ...s, truckPlate: value }))} />
                <Input label="Tai xe" value={orderForm.driverName} onChange={(value) => setOrderForm((s) => ({ ...s, driverName: value }))} />
                <Input label="Ghi chu" value={orderForm.note} onChange={(value) => setOrderForm((s) => ({ ...s, note: value }))} />
                <button className="w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700" type="submit">
                  {orderForm.id ? 'Cap nhat don hang' : 'Tao don hang moi'}
                </button>
              </form>
            </Panel>

            <Panel title="Danh sach don hang va theo doi trang thai">
              <input
                value={orderFilter}
                onChange={(event) => setOrderFilter(event.target.value)}
                placeholder="Tim so don, hang hoa, bien so, tai xe"
                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm md:max-w-sm"
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-2 py-2">So don</th>
                      <th className="px-2 py-2">Ngay</th>
                      <th className="px-2 py-2">Khach hang</th>
                      <th className="px-2 py-2">Hang hoa</th>
                      <th className="px-2 py-2">Thanh tien</th>
                      <th className="px-2 py-2">Trang thai</th>
                      <th className="px-2 py-2">Thao tac</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="px-2 py-2 font-semibold">{item.orderNo}</td>
                        <td className="px-2 py-2">{item.createdDate}</td>
                        <td className="px-2 py-2">{customers.find((c) => c.id === item.customerId)?.name ?? '-'}</td>
                        <td className="px-2 py-2">{item.product} / {item.spec}</td>
                        <td className="px-2 py-2">{currency(item.amount)}</td>
                        <td className="px-2 py-2">{orderStatusLabel(item.status)}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700"
                              onClick={() =>
                                setOrderForm({
                                  id: item.id,
                                  orderNo: item.orderNo,
                                  createdDate: item.createdDate,
                                  customerId: item.customerId,
                                  product: item.product,
                                  spec: item.spec,
                                  quantity: String(item.quantity),
                                  unitPrice: String(item.unitPrice),
                                  createdBy: item.createdBy,
                                  note: item.note,
                                  truckPlate: item.truckPlate,
                                  driverName: item.driverName
                                })
                              }
                            >
                              Chi tiet/Sua
                            </button>
                            <button
                              type="button"
                              className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
                              onClick={() => {
                                if (!can('ORDER_APPROVE')) {
                                  flash('Khong co quyen duyet don.');
                                  return;
                                }
                                setOrderStatus(item.id, 'APPROVED', role.toLowerCase());
                              }}
                            >
                              Duyet
                            </button>
                            <button
                              type="button"
                              className="rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700"
                              onClick={() => {
                                if (!can('ORDER_CANCEL')) {
                                  flash('Khong co quyen huy don.');
                                  return;
                                }
                                setOrderStatus(item.id, 'CANCELLED', role.toLowerCase());
                              }}
                            >
                              Huy
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        )}

        {tab === 'delivery' && (
          <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Panel title="Lap phieu xuat kho tu don hang">
              <form className="space-y-2" onSubmit={onCreateDelivery}>
                <Input label="So phieu" value={deliveryForm.ticketNo} onChange={(value) => setDeliveryForm((s) => ({ ...s, ticketNo: value }))} required />
                <Select
                  label="Chon don hang"
                  value={deliveryForm.orderId}
                  onChange={(value) => {
                    const order = orders.find((item) => item.id === value);
                    setDeliveryForm((s) => ({
                      ...s,
                      orderId: value,
                      customerId: order?.customerId ?? '',
                      truckPlate: order?.truckPlate ?? '',
                      product: order?.product ?? '',
                      quantity: String(order?.quantity ?? 1)
                    }));
                  }}
                  options={orders
                    .filter((item) => item.status === 'APPROVED')
                    .map((item) => ({ value: item.id, label: `${item.orderNo} - ${item.product}` }))}
                />
                <Input label="Ngay xuat" type="date" value={deliveryForm.date} onChange={(value) => setDeliveryForm((s) => ({ ...s, date: value }))} required />
                <Select
                  label="Kho xuat"
                  value={deliveryForm.warehouse}
                  onChange={(value) => setDeliveryForm((s) => ({ ...s, warehouse: value }))}
                  options={Array.from(new Set(inventory.map((item) => item.warehouse))).map((name) => ({ value: name, label: name }))}
                />
                <Input label="Nguoi lap" value={deliveryForm.createdBy} onChange={(value) => setDeliveryForm((s) => ({ ...s, createdBy: value }))} required />
                <button className="w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700" type="submit">
                  Sinh phieu xuat kho
                </button>
              </form>
            </Panel>

            <Panel title="Danh sach phieu xuat va thao tac in/huy">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-2 py-2">So phieu</th>
                      <th className="px-2 py-2">Don hang</th>
                      <th className="px-2 py-2">Khach hang</th>
                      <th className="px-2 py-2">Hang hoa</th>
                      <th className="px-2 py-2">Kho</th>
                      <th className="px-2 py-2">So luong</th>
                      <th className="px-2 py-2">Thao tac</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryTickets.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="px-2 py-2 font-semibold">{item.ticketNo}</td>
                        <td className="px-2 py-2">{orders.find((o) => o.id === item.orderId)?.orderNo ?? '-'}</td>
                        <td className="px-2 py-2">{customers.find((c) => c.id === item.customerId)?.name ?? '-'}</td>
                        <td className="px-2 py-2">{item.product}</td>
                        <td className="px-2 py-2">{item.warehouse}</td>
                        <td className="px-2 py-2">{item.quantity}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700"
                            >
                              In phieu
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!can('DELIVERY_CANCEL')) {
                                  flash('Khong co quyen huy phieu xuat.');
                                  return;
                                }
                                cancelDeliveryTicket(item.id, role.toLowerCase());
                                flash('Da huy phieu xuat.');
                              }}
                              className="rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700"
                            >
                              Huy phieu
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        )}

        {tab === 'weighing' && (
          <section className="grid gap-4 xl:grid-cols-3">
            <Panel title="Quan ly can xe vao">
              <form className="space-y-2" onSubmit={onWeighIn}>
                <Input label="So phieu can vao" value={weighInForm.ticketNo} onChange={(value) => setWeighInForm((s) => ({ ...s, ticketNo: value }))} required />
                <Select
                  label="Phieu xuat kho"
                  value={weighInForm.deliveryTicketId}
                  onChange={(value) => {
                    const ticket = deliveryTickets.find((item) => item.id === value);
                    const order = ticket ? orders.find((item) => item.id === ticket.orderId) : undefined;
                    setWeighInForm((s) => ({
                      ...s,
                      deliveryTicketId: value,
                      truckPlate: ticket?.truckPlate ?? '',
                      driverName: order?.driverName ?? '',
                      customerId: ticket?.customerId ?? '',
                      product: ticket?.product ?? ''
                    }));
                  }}
                  options={deliveryTickets
                    .filter((item) => !item.cancelledAt)
                    .map((item) => ({ value: item.id, label: `${item.ticketNo} - ${item.truckPlate}` }))}
                />
                <Input label="Bien so" value={weighInForm.truckPlate} onChange={(value) => setWeighInForm((s) => ({ ...s, truckPlate: value }))} required />
                <Input label="Tai xe" value={weighInForm.driverName} onChange={(value) => setWeighInForm((s) => ({ ...s, driverName: value }))} required />
                <Input label="Trong luong xe vao" type="number" value={weighInForm.weightIn} onChange={(value) => setWeighInForm((s) => ({ ...s, weightIn: value }))} required />
                <Input label="Thoi gian can" type="datetime-local" value={weighInForm.weighedAt} onChange={(value) => setWeighInForm((s) => ({ ...s, weighedAt: value }))} required />
                <Select
                  label="Nguon du lieu"
                  value={weighInForm.method}
                  onChange={(value) => setWeighInForm((s) => ({ ...s, method: value as 'AUTO' | 'MANUAL' }))}
                  options={[
                    { value: 'AUTO', label: 'Dau can tu dong' },
                    { value: 'MANUAL', label: 'Nhap tay' }
                  ]}
                />
                <Input label="Anh xe/Ghi chu" value={weighInForm.imageNote} onChange={(value) => setWeighInForm((s) => ({ ...s, imageNote: value }))} />
                <button className="w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700" type="submit">
                  Tao phieu can vao
                </button>
              </form>
            </Panel>

            <Panel title="Xuat kho va cap nhat ton">
              <form className="space-y-2" onSubmit={onWarehouseExport}>
                <Select
                  label="Phieu xuat kho"
                  value={warehouseForm.deliveryTicketId}
                  onChange={(value) => {
                    const ticket = deliveryTickets.find((item) => item.id === value);
                    const lot = inventory.find((it) => it.product === ticket?.product && it.warehouse === ticket?.warehouse)?.lot ?? '';
                    setWarehouseForm((s) => ({
                      ...s,
                      deliveryTicketId: value,
                      warehouse: ticket?.warehouse ?? s.warehouse,
                      product: ticket?.product ?? '',
                      quantity: String(ticket?.quantity ?? 1),
                      lot
                    }));
                  }}
                  options={deliveryTickets
                    .filter((item) => !item.cancelledAt)
                    .map((item) => ({ value: item.id, label: `${item.ticketNo} - ${item.product}` }))}
                />
                <Select
                  label="Kho"
                  value={warehouseForm.warehouse}
                  onChange={(value) => setWarehouseForm((s) => ({ ...s, warehouse: value }))}
                  options={Array.from(new Set(inventory.map((item) => item.warehouse))).map((w) => ({ value: w, label: w }))}
                />
                <Input label="Hang hoa" value={warehouseForm.product} onChange={(value) => setWarehouseForm((s) => ({ ...s, product: value }))} required />
                <Input label="Lo hang" value={warehouseForm.lot} onChange={(value) => setWarehouseForm((s) => ({ ...s, lot: value }))} required />
                <Input label="So luong xuat" type="number" value={warehouseForm.quantity} onChange={(value) => setWarehouseForm((s) => ({ ...s, quantity: value }))} required />
                <Input label="Nguoi xuat" value={warehouseForm.exportedBy} onChange={(value) => setWarehouseForm((s) => ({ ...s, exportedBy: value }))} required />
                <Input label="Thoi gian" type="datetime-local" value={warehouseForm.exportedAt} onChange={(value) => setWarehouseForm((s) => ({ ...s, exportedAt: value }))} required />
                <button className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" type="submit">
                  Xac nhan xuat kho
                </button>
              </form>
              <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                <p className="font-semibold text-slate-700">Ton kho hien tai</p>
                {inventory.map((item) => (
                  <p key={item.id}>
                    {item.warehouse} - {item.product} ({item.lot}): <span className="font-bold">{item.stockQty}</span>
                  </p>
                ))}
              </div>
            </Panel>

            <Panel title="Quan ly can xe ra + tinh khoi luong thuc xuat">
              <form className="space-y-2" onSubmit={onWeighOut}>
                <Select
                  label="Phieu can vao"
                  value={weighOutForm.weighInId}
                  onChange={(value) => {
                    const wi = weighIns.find((item) => item.id === value);
                    setWeighOutForm((s) => ({ ...s, weighInId: value, truckPlate: wi?.truckPlate ?? '' }));
                  }}
                  options={weighIns.map((item) => ({ value: item.id, label: `${item.ticketNo} - ${item.truckPlate}` }))}
                />
                <Input label="So phieu can ra" value={weighOutForm.ticketNo} onChange={(value) => setWeighOutForm((s) => ({ ...s, ticketNo: value }))} required />
                <Input label="Bien so xe" value={weighOutForm.truckPlate} onChange={(value) => setWeighOutForm((s) => ({ ...s, truckPlate: value }))} required />
                <Input label="Trong luong xe ra" type="number" value={weighOutForm.weightOut} onChange={(value) => setWeighOutForm((s) => ({ ...s, weightOut: value }))} required />
                <Input label="Thoi gian can" type="datetime-local" value={weighOutForm.weighedAt} onChange={(value) => setWeighOutForm((s) => ({ ...s, weighedAt: value }))} required />
                <Select
                  label="Nguon du lieu"
                  value={weighOutForm.method}
                  onChange={(value) => setWeighOutForm((s) => ({ ...s, method: value as 'AUTO' | 'MANUAL' }))}
                  options={[
                    { value: 'AUTO', label: 'Dau can tu dong' },
                    { value: 'MANUAL', label: 'Nhap tay' }
                  ]}
                />
                <Input label="Ghi chu" value={weighOutForm.note} onChange={(value) => setWeighOutForm((s) => ({ ...s, note: value }))} />
                <button className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700" type="submit">
                  Tao phieu can ra
                </button>
              </form>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                <p className="font-semibold text-slate-700">Cong thuc tinh</p>
                <p>Khoi luong hang = | Can ra - Can vao |</p>
                <p className="mt-1">Neu chenhlech vuot nguong {mismatchThreshold} tan, he thong se canh bao va yeu cau xac nhan.</p>
              </div>
            </Panel>
          </section>
        )}

        {tab === 'reconcile' && (
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <Panel title="Doi chieu don - phieu xuat - can vao/ra - ton kho">
              <div className="space-y-2">
                {alerts.length === 0 && <p className="text-sm text-slate-500">Khong co sai lech.</p>}
                {alerts.map((alert) => (
                  <div key={alert.id} className={`rounded-lg border px-3 py-2 text-sm ${alertClass(alert.level)}`}>
                    <p className="font-semibold">{alert.message}</p>
                    <p className="text-xs opacity-80">{new Date(alert.createdAt).toLocaleString('vi-VN')}</p>
                    {!alert.resolved && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!can('ALERT_RESOLVE')) {
                            flash('Vai tro hien tai khong co quyen xu ly canh bao.');
                            return;
                          }
                          resolveAlert(alert.id);
                          flash('Da danh dau da xu ly canh bao.');
                        }}
                        className="mt-2 rounded bg-white/80 px-2 py-1 text-xs font-bold text-slate-700"
                      >
                        Danh dau da xu ly
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Nguong canh bao">
              <Input
                label="Nguong chenhlech trong luong cho phep (tan)"
                type="number"
                value={String(mismatchThreshold)}
                onChange={(value) => {
                  if (!can('CONFIG_EDIT')) {
                    flash('Vai tro hien tai khong co quyen sua cau hinh.');
                    return;
                  }
                  setMismatchThreshold(Number(value), role.toLowerCase());
                }}
              />
            </Panel>
          </section>
        )}

        {tab === 'reports' && (
          <section className="space-y-4">
            <Panel title="Bo loc bao cao (ngay/tuan/thang/quy/nam)">
              <div className="grid gap-2 md:grid-cols-3">
                <Input label="Tu ngay" type="date" value={reportFrom} onChange={setReportFrom} />
                <Input label="Den ngay" type="date" value={reportTo} onChange={setReportTo} />
                <div className="grid grid-cols-2 gap-2 self-end">
                  <button onClick={exportSalesSummary} type="button" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
                    Xuat Excel
                  </button>
                  <button
                    onClick={() => exportTemplateWorkbook(weighReportRows)}
                    type="button"
                    className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                  >
                    Xuat theo bieu mau
                  </button>
                  <button onClick={() => window.print()} type="button" className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                    Xuat PDF
                  </button>
                  <button onClick={() => window.print()} type="button" className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
                    In truc tiep
                  </button>
                </div>
              </div>
            </Panel>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Doanh thu" value={currency(salesRevenue)} tone="rose" />
              <StatCard title="Bao cao can" value={`${weighReportRows.length} phieu`} tone="sky" />
              <StatCard title="Xuat kho" value={`${warehouseExports.length} luot`} tone="amber" />
              <StatCard title="Theo khach hang" value={`${new Set(reportOrders.map((o) => o.customerId)).size} KH`} tone="emerald" />
            </div>

            <Panel title="Bang tong hop bao cao">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-2 py-2">So don</th>
                      <th className="px-2 py-2">Khach hang</th>
                      <th className="px-2 py-2">Hang hoa</th>
                      <th className="px-2 py-2">So luong</th>
                      <th className="px-2 py-2">Thanh tien</th>
                      <th className="px-2 py-2">Trang thai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportOrders.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="px-2 py-2">{item.orderNo}</td>
                        <td className="px-2 py-2">{customers.find((c) => c.id === item.customerId)?.name ?? '-'}</td>
                        <td className="px-2 py-2">{item.product}</td>
                        <td className="px-2 py-2">{item.quantity}</td>
                        <td className="px-2 py-2">{currency(item.amount)}</td>
                        <td className="px-2 py-2">{orderStatusLabel(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        )}

        {tab === 'permissions' && (
          <section className="grid gap-4 md:grid-cols-2">
            <Panel title="Nhom quyen va quyen chi tiet">
              <div className="space-y-3">
                {(Object.keys(rolePermissions) as Role[]).map((roleKey) => (
                  <div key={roleKey} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-bold text-slate-700">{roleKey}</p>
                    <p className="mt-1 text-xs text-slate-500">{rolePermissions[roleKey].join(' | ')}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Quyen cua vai tro hien tai">
              <p className="text-sm text-slate-600">Vai tro dang chon: <span className="font-bold">{role}</span></p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {rolePermissions[role].map((permission) => (
                  <li key={permission} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1">
                    {permission}
                  </li>
                ))}
              </ul>
            </Panel>
          </section>
        )}

        {tab === 'admin' && (
          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel title="Quan ly nguoi dung va cau hinh">
              <form
                className="grid gap-2 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!can('USER_MANAGE')) {
                    flash('Vai tro hien tai khong co quyen quan ly user.');
                    return;
                  }
                  addUser(
                    {
                      username: userForm.username,
                      fullName: userForm.fullName,
                      role: userForm.role,
                      active: true
                    },
                    role.toLowerCase()
                  );
                  flash('Da them nguoi dung.');
                  setUserForm({ username: '', fullName: '', role: 'SALES' });
                }}
              >
                <Input label="Username" value={userForm.username} onChange={(value) => setUserForm((s) => ({ ...s, username: value }))} required />
                <Input label="Ho ten" value={userForm.fullName} onChange={(value) => setUserForm((s) => ({ ...s, fullName: value }))} required />
                <Select
                  label="Vai tro"
                  value={userForm.role}
                  onChange={(value) => setUserForm((s) => ({ ...s, role: value as Role }))}
                  options={[
                    { value: 'ADMIN', label: 'ADMIN' },
                    { value: 'SALES', label: 'SALES' },
                    { value: 'ACCOUNTING', label: 'ACCOUNTING' },
                    { value: 'WAREHOUSE', label: 'WAREHOUSE' },
                    { value: 'WEIGHING', label: 'WEIGHING' },
                    { value: 'SECURITY', label: 'SECURITY' }
                  ]}
                />
                <button type="submit" className="self-end rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                  Them user
                </button>
              </form>

              <div className="mt-3 space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="rounded-lg border border-slate-200 p-2">
                    <p className="text-sm font-semibold text-slate-700">{user.username} - {user.fullName}</p>
                    <p className="text-xs text-slate-500">Role: {user.role} | {user.active ? 'Active' : 'Locked'}</p>
                    <div className="mt-1 flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          toggleUser(user.id, role.toLowerCase());
                          flash('Da thay doi trang thai tai khoan.');
                        }}
                        className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
                      >
                        Khoa/Mo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetUserPasswordLog(user.id, role.toLowerCase());
                          flash('Da ghi nhan reset mat khau vao nhat ky.');
                        }}
                        className="rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700"
                      >
                        Reset mat khau
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Nhat ky he thong + backup/restore">
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!can('BACKUP_RESTORE')) {
                      flash('Vai tro hien tai khong co quyen backup.');
                      return;
                    }
                    downloadTextFile(backupData(), `backup-ti-nason-${new Date().toISOString().slice(0, 10)}.json`);
                  }}
                  className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Backup du lieu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!can('BACKUP_RESTORE')) {
                      flash('Vai tro hien tai khong co quyen restore.');
                      return;
                    }
                    const result = restoreData(backupContent, role.toLowerCase());
                    flash(result.message);
                  }}
                  className="rounded bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Khoi phuc du lieu
                </button>
              </div>
              <textarea
                value={backupContent}
                onChange={(event) => setBackupContent(event.target.value)}
                placeholder="Dan noi dung JSON backup vao day de khoi phuc"
                className="h-32 w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
              <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                {logs.map((log) => (
                  <p key={log.id} className="border-b border-slate-100 py-1">
                    [{new Date(log.createdAt).toLocaleString('vi-VN')}] {log.actor} - {log.action} - {log.objectType}:{log.objectId}
                  </p>
                ))}
              </div>
            </Panel>
          </section>
        )}
      </main>
    </div>
  );
}

type PanelProps = {
  title: string;
  children: React.ReactNode;
};

function Panel({ title, children }: PanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
      <h2 className="mb-3 text-lg font-black text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
};

function Input({ label, value, onChange, type = 'text', required = false }: InputProps) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-500"
      />
    </label>
  );
}

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
};

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-500"
      >
        <option value="">-- Chon --</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type StatCardProps = {
  title: string;
  value: string;
  tone: 'rose' | 'amber' | 'sky' | 'emerald';
};

function StatCard({ title, value, tone }: StatCardProps) {
  const toneClass = {
    rose: 'from-rose-100 to-rose-50 text-rose-800 border-rose-200',
    amber: 'from-amber-100 to-amber-50 text-amber-800 border-amber-200',
    sky: 'from-sky-100 to-sky-50 text-sky-800 border-sky-200',
    emerald: 'from-emerald-100 to-emerald-50 text-emerald-800 border-emerald-200'
  }[tone];

  return (
    <article className={`rounded-xl border bg-gradient-to-br p-3 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-[0.15em]">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </article>
  );
}
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    applyPatch(
                      {
                        driver_name: stepForm.driverName,
                        truck_plate: stepForm.truckPlate
                      },
                      'Da cap nhat thong tin lai xe.'
                    )
                  }
                  className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Luu thong tin lai xe
                </button>

                <Input
                  label="Phieu can xe vao"
                  value={stepForm.weighInTicket}
                  onChange={(value) => setStepForm((prev) => ({ ...prev, weighInTicket: value }))}
                />
                <Input
                  label="Khoi luong can vao"
                  type="number"
                  min="0"
                  step="0.01"
                  value={stepForm.weighInWeight}
                  onChange={(value) => setStepForm((prev) => ({ ...prev, weighInWeight: value }))}
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    applyPatch(
                      {
                        weigh_in_ticket: stepForm.weighInTicket,
                        weigh_in_weight: Number(stepForm.weighInWeight),
                        weigh_in_at: new Date().toISOString()
                      },
                      'Da ghi nhan can xe vao (buoc 6).'
                    )
                  }
                  className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Ghi can vao
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => applyPatch({ driver_received_docs_at: new Date().toISOString() }, 'Da ghi nhan buoc 10.')}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Nhan chung tu tu kho/bao ve
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => applyPatch({ left_factory_at: new Date().toISOString() }, 'Da ghi nhan buoc 11.')}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Xe ra khoi cong ty
                </button>

                <Input
                  label="Phieu can xe ra"
                  value={stepForm.weighOutTicket}
                  onChange={(value) => setStepForm((prev) => ({ ...prev, weighOutTicket: value }))}
                />
                <Input
                  label="Khoi luong can ra"
                  type="number"
                  min="0"
                  step="0.01"
                  value={stepForm.weighOutWeight}
                  onChange={(value) => setStepForm((prev) => ({ ...prev, weighOutWeight: value }))}
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    applyPatch(
                      {
                        weigh_out_ticket: stepForm.weighOutTicket,
                        weigh_out_weight: Number(stepForm.weighOutWeight),
                        weigh_out_at: new Date().toISOString()
                      },
                      'Da ghi nhan can xe ra (buoc 12).'
                    )
                  }
                  className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Ghi can ra
                </button>
              </RoleCard>

              <RoleCard title="Thu kho va bao ve" subtitle="Buoc 8-9, 15-17">
                <Input
                  label="So luong xuat thuc te (tan)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={stepForm.warehouseActualQuantity}
                  onChange={(value) => setStepForm((prev) => ({ ...prev, warehouseActualQuantity: value }))}
                />
                <label className="block text-xs text-slate-600">
                  Ghi chu thu kho
                  <textarea
                    value={stepForm.warehouseNote}
                    onChange={(event) => setStepForm((prev) => ({ ...prev, warehouseNote: event.target.value }))}
                    className="mt-1 h-20 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
                  />
                </label>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    applyPatch(
                      {
                        warehouse_actual_quantity: Number(stepForm.warehouseActualQuantity),
                        warehouse_note: stepForm.warehouseNote,
                        warehouse_checked_at: new Date().toISOString(),
                        warehouse_released_at: new Date().toISOString()
                      },
                      'Da ghi nhan kiem tra va xuat kho (buoc 8-9).'
                    )
                  }
                  className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Xac nhan thu kho
                </button>

                <label className="block text-xs text-slate-600">
                  Ghi chu doi chieu bao ve
                  <textarea
                    value={stepForm.securityNote}
                    onChange={(event) => setStepForm((prev) => ({ ...prev, securityNote: event.target.value }))}
                    className="mt-1 h-20 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
                  />
                </label>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    applyPatch(
                      {
                        security_checked_at: new Date().toISOString(),
                        security_note: stepForm.securityNote,
                        security_match: 1,
                        security_confirmed_at: new Date().toISOString()
                      },
                      'Bao ve da doi chieu khop va xac nhan (buoc 15-17).'
                    )
                  }
                  className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Bao ve xac nhan khop
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    applyPatch(
                      {
                        security_checked_at: new Date().toISOString(),
                        security_note: stepForm.securityNote,
                        security_match: 0
                      },
                      'Bao ve danh dau thong tin khong khop (buoc 16).'
                    )
                  }
                  className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Bao ve danh dau khong khop
                </button>
              </RoleCard>
            </div>
          )}

          {selectedOrder && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <p className="font-semibold">Tong quan ho so #{selectedOrder.id}</p>
              <p>Phieu nhan don: {selectedOrder.delivery_note_number || '-'}</p>
              <p>Phieu xuat kho: {selectedOrder.export_note_number || '-'}</p>
              <p>Lai xe/Bien so: {selectedOrder.driver_name || '-'} / {selectedOrder.truck_plate || '-'}</p>
              <p>Can vao/can ra: {selectedOrder.weigh_in_weight ?? '-'} / {selectedOrder.weigh_out_weight ?? '-'}</p>
              <p>Ket qua bao ve: {selectedOrder.security_match === null ? '-' : selectedOrder.security_match === 1 ? 'Khop' : 'Khong khop'}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

type RoleCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

function RoleCard({ title, subtitle, children }: RoleCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="mb-2 text-xs text-slate-500">{subtitle}</p>
      <div className="space-y-2">{children}</div>
    </article>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  min?: string;
  step?: string;
  variant?: 'light' | 'dark';
};

function Input({ label, value, onChange, required = false, type = 'text', min, step, variant = 'light' }: InputProps) {
  const isDark = variant === 'dark';

  return (
    <label className={`block ${isDark ? 'text-sm text-slate-200' : 'text-xs text-slate-600'}`}>
      {label}
      <input
        required={required}
        type={type}
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full px-3 py-2 outline-none transition ${
          isDark
            ? 'rounded-xl border border-white/20 bg-slate-950/40 text-sm text-slate-100 focus:border-brand-100'
            : 'rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-brand-500'
        }`}
      />
    </label>
  );
}
