import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Order, OrderPatch, useOrderStore, WorkflowStatus } from './store/orders';

type FormState = {
  customerName: string;
  phone: string;
  productName: string;
  quantity: string;
  deliveryTime: string;
  note: string;
};

const initialForm: FormState = {
  customerName: '',
  phone: '',
  productName: '',
  quantity: '1',
  deliveryTime: '',
  note: ''
};

type StepFormState = {
  deliveryNoteNumber: string;
  exportNoteNumber: string;
  driverName: string;
  truckPlate: string;
  weighInTicket: string;
  weighInWeight: string;
  warehouseActualQuantity: string;
  warehouseNote: string;
  weighOutTicket: string;
  weighOutWeight: string;
  securityNote: string;
};

const initialStepForm: StepFormState = {
  deliveryNoteNumber: '',
  exportNoteNumber: '',
  driverName: '',
  truckPlate: '',
  weighInTicket: '',
  weighInWeight: '',
  warehouseActualQuantity: '',
  warehouseNote: '',
  weighOutTicket: '',
  weighOutWeight: '',
  securityNote: ''
};

function deriveStatus(order: Order): WorkflowStatus {
  if (order.summary_exported_at && order.security_match === 1 && order.security_confirmed_at) {
    return 'COMPLETED';
  }

  if (order.security_match === 0) {
    return 'MISMATCH';
  }

  if (order.security_checked_at || order.security_match !== null) {
    return 'SECURITY_REVIEW';
  }

  if (order.weigh_out_at || order.weigh_out_weight !== null) {
    return 'OUTBOUND_WEIGHED';
  }

  if (order.warehouse_checked_at || order.warehouse_released_at) {
    return 'WAREHOUSE_CONFIRMED';
  }

  if (order.weigh_in_at || order.weigh_in_weight !== null) {
    return 'INBOUND_WEIGHED';
  }

  if (order.delivery_note_number || order.export_note_number || order.driver_name) {
    return 'DOCS_PREPARED';
  }

  return 'NEW';
}

function statusLabel(status: WorkflowStatus): string {
  const labels: Record<WorkflowStatus, string> = {
    NEW: 'Moi tao',
    DOCS_PREPARED: 'Da lap chung tu',
    INBOUND_WEIGHED: 'Da can vao',
    WAREHOUSE_CONFIRMED: 'Da xuat kho',
    OUTBOUND_WEIGHED: 'Da can ra',
    SECURITY_REVIEW: 'Bao ve doi chieu',
    MISMATCH: 'Khong khop thong tin',
    COMPLETED: 'Hoan tat'
  };

  return labels[status];
}

function statusClass(status: WorkflowStatus): string {
  const classes: Record<WorkflowStatus, string> = {
    NEW: 'bg-slate-200 text-slate-700',
    DOCS_PREPARED: 'bg-sky-100 text-sky-700',
    INBOUND_WEIGHED: 'bg-indigo-100 text-indigo-700',
    WAREHOUSE_CONFIRMED: 'bg-purple-100 text-purple-700',
    OUTBOUND_WEIGHED: 'bg-amber-100 text-amber-800',
    SECURITY_REVIEW: 'bg-cyan-100 text-cyan-800',
    MISMATCH: 'bg-rose-100 text-rose-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700'
  };

  return classes[status];
}

export default function App() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [stepForm, setStepForm] = useState<StepFormState>(initialStepForm);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isWebMode, setIsWebMode] = useState(false);

  const { apiBaseUrl, orders, loading, error, setApiBaseUrl, fetchOrders, createOrder, updateOrder } = useOrderStore();

  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  useEffect(() => {
    const hasDesktopApi = typeof window !== 'undefined' && typeof window.desktopAPI?.getApiBaseUrl === 'function';

    if (!hasDesktopApi) {
      setApiBaseUrl('__LOCAL__');
      setIsWebMode(true);
      return;
    }

    window.desktopAPI
      ?.getApiBaseUrl()
      .then((url) => {
        setApiBaseUrl(url);
      })
      .catch(() => {
        setApiBaseUrl('__LOCAL__');
        setIsWebMode(true);
      });
  }, [setApiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    fetchOrders();

    if (apiBaseUrl === '__LOCAL__') {
      return;
    }

    const wsUrl = apiBaseUrl.replace('http://', 'ws://');
    const socket = new WebSocket(`${wsUrl}/ws`);

    socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as { type?: string };
      if (parsed.type === 'order:created' || parsed.type === 'order:updated') {
        fetchOrders();
      }
    };

    return () => {
      socket.close();
    };
  }, [apiBaseUrl, fetchOrders]);

  useEffect(() => {
    if (!selectedOrderId && orders.length) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrder) {
      setStepForm(initialStepForm);
      return;
    }

    setStepForm({
      deliveryNoteNumber: selectedOrder.delivery_note_number,
      exportNoteNumber: selectedOrder.export_note_number,
      driverName: selectedOrder.driver_name,
      truckPlate: selectedOrder.truck_plate,
      weighInTicket: selectedOrder.weigh_in_ticket,
      weighInWeight: selectedOrder.weigh_in_weight === null ? '' : String(selectedOrder.weigh_in_weight),
      warehouseActualQuantity:
        selectedOrder.warehouse_actual_quantity === null ? '' : String(selectedOrder.warehouse_actual_quantity),
      warehouseNote: selectedOrder.warehouse_note,
      weighOutTicket: selectedOrder.weigh_out_ticket,
      weighOutWeight: selectedOrder.weigh_out_weight === null ? '' : String(selectedOrder.weigh_out_weight),
      securityNote: selectedOrder.security_note
    });
  }, [selectedOrder]);

  const totalPlannedQuantity = useMemo(
    () => orders.reduce((total, item) => total + Number(item.planned_quantity || 0), 0),
    [orders]
  );

  const completedCount = useMemo(() => orders.filter((item) => item.status === 'COMPLETED').length, [orders]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitMessage(null);

    try {
      await createOrder({
        customerName: form.customerName,
        phone: form.phone,
        productName: form.productName,
        quantity: Number(form.quantity),
        deliveryTime: form.deliveryTime,
        note: form.note
      });

      setForm(initialForm);
      setSubmitMessage('Da tao don hang thanh cong.');
    } catch (submitError) {
      setSubmitMessage(submitError instanceof Error ? submitError.message : 'Tao don hang that bai.');
    } finally {
      setSubmitting(false);
    }
  }

  async function applyPatch(patch: OrderPatch, successMessage: string) {
    if (!selectedOrder) {
      setSubmitMessage('Vui long chon ho so de cap nhat.');
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const next = {
        ...selectedOrder,
        ...patch
      } as Order;

      await updateOrder(selectedOrder.id, {
        ...patch,
        status: deriveStatus(next)
      });

      setSubmitMessage(successMessage);
    } catch (updateError) {
      setSubmitMessage(updateError instanceof Error ? updateError.message : 'Cap nhat that bai.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-700 to-slate-900 px-4 py-8 text-slate-50 md:px-8">
      <main className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-lg">
          <p className="text-sm uppercase tracking-[0.2em] text-brand-100">TI-NASONXIMANG</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">Ho so xuat kho co can xe vao/ra</h1>
          <p className="mt-2 text-sm text-slate-200">Day du cac buoc: ke toan, lai xe, thu kho, bao ve va tong hop theo so do quy trinh.</p>
          {isWebMode && (
            <p className="mt-2 rounded-lg bg-amber-100/90 px-3 py-2 text-sm text-amber-900">
              Dang chay tren web. Toan bo quy trinh se luu localStorage de deploy Vercel van hoat dong du chuc nang.
            </p>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Input label="Ten khach hang" value={form.customerName} onChange={(value) => setForm((prev) => ({ ...prev, customerName: value }))} required />
            <Input label="So dien thoai" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} required />
            <Input label="Chung loai hang hoa" value={form.productName} onChange={(value) => setForm((prev) => ({ ...prev, productName: value }))} required />
            <Input label="So luong du kien (tan)" type="number" min="0.1" step="0.1" value={form.quantity} onChange={(value) => setForm((prev) => ({ ...prev, quantity: value }))} required />
            <Input label="Thoi gian giao hang" value={form.deliveryTime} onChange={(value) => setForm((prev) => ({ ...prev, deliveryTime: value }))} />
            <label className="block text-sm text-slate-200">
              Ghi chu
              <textarea
                className="mt-1 h-24 w-full rounded-xl border border-white/20 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-100"
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-700/60"
            >
              {submitting ? 'Dang tao ho so...' : 'Tao ho so moi'}
            </button>
          </form>

          {submitMessage && <p className="mt-4 text-sm text-brand-100">{submitMessage}</p>}
        </section>

        <section className="space-y-4 rounded-2xl border border-white/20 bg-white p-6 text-slate-900 shadow-2xl">
          <header className="flex flex-col gap-2 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Bang dieu phoi quy trinh</h2>
              <p className="text-sm text-slate-500">
                Tong ho so: {orders.length} | Hoan tat: {completedCount} | Tong so luong: {totalPlannedQuantity.toFixed(1)} tan
              </p>
            </div>
            {loading && <p className="text-sm text-brand-700">Dang tai du lieu...</p>}
          </header>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[840px] table-auto border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                  <th className="px-2 py-2">Ho so</th>
                  <th className="px-2 py-2">Khach hang</th>
                  <th className="px-2 py-2">Hang hoa</th>
                  <th className="px-2 py-2">So luong du kien</th>
                  <th className="px-2 py-2">Can vao</th>
                  <th className="px-2 py-2">Can ra</th>
                  <th className="px-2 py-2">Trang thai</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`cursor-pointer border-b border-slate-100 align-top transition hover:bg-slate-50 ${
                      selectedOrderId === order.id ? 'bg-brand-50' : ''
                    }`}
                  >
                    <td className="px-2 py-3 font-semibold">#{order.id}</td>
                    <td className="px-2 py-3">
                      <p className="font-medium">{order.customer_name}</p>
                      <p className="text-xs text-slate-500">{order.phone}</p>
                    </td>
                    <td className="px-2 py-3">{order.product_name}</td>
                    <td className="px-2 py-3">{order.planned_quantity}</td>
                    <td className="px-2 py-3">{order.weigh_in_weight ?? '-'}</td>
                    <td className="px-2 py-3">{order.weigh_out_weight ?? '-'}</td>
                    <td className="px-2 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!orders.length && !loading && (
                  <tr>
                    <td colSpan={7} className="px-2 py-8 text-center text-slate-500">
                      Chua co ho so nao.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedOrder && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <RoleCard title="Phong ke toan" subtitle="Buoc 2-5, 13, 18">
                <Input
                  label="So phieu nhan don"
                  value={stepForm.deliveryNoteNumber}
                  onChange={(value) => setStepForm((prev) => ({ ...prev, deliveryNoteNumber: value }))}
                />
                <Input
                  label="So phieu xuat kho"
                  value={stepForm.exportNoteNumber}
                  onChange={(value) => setStepForm((prev) => ({ ...prev, exportNoteNumber: value }))}
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    applyPatch(
                      {
                        delivery_note_number: stepForm.deliveryNoteNumber,
                        export_note_number: stepForm.exportNoteNumber
                      },
                      'Da cap nhat chung tu ke toan.'
                    )
                  }
                  className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Luu buoc chung tu
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => applyPatch({ accounting_received_weigh_out_at: new Date().toISOString() }, 'Da ghi nhan buoc 13.')}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Xac nhan nhan phieu can ra (buoc 13)
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => applyPatch({ summary_exported_at: new Date().toISOString() }, 'Da ghi nhan tong hop Excel (buoc 18-19).')}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Tong hop va ket thuc
                </button>
              </RoleCard>

              <RoleCard title="Lai xe" subtitle="Buoc 6-7, 10-12, 14">
                <Input
                  label="Ten lai xe"
                  value={stepForm.driverName}
                  onChange={(value) => setStepForm((prev) => ({ ...prev, driverName: value }))}
                />
                <Input
                  label="Bien so xe"
                  value={stepForm.truckPlate}
                  onChange={(value) => setStepForm((prev) => ({ ...prev, truckPlate: value }))}
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
  children: React.ReactNode;
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
};

function Input({ label, value, onChange, required = false, type = 'text', min, step }: InputProps) {
  return (
    <label className="block text-xs text-slate-600">
      {label}
      <input
        required={required}
        type={type}
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500"
      />
    </label>
  );
}
