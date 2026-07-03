import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useOrderStore } from './store/orders';

type FormState = {
  customerName: string;
  phone: string;
  productName: string;
  quantity: string;
  note: string;
};

const initialForm: FormState = {
  customerName: '',
  phone: '',
  productName: '',
  quantity: '1',
  note: ''
};

export default function App() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isWebMode, setIsWebMode] = useState(false);

  const { apiBaseUrl, orders, loading, error, setApiBaseUrl, fetchOrders, createOrder } = useOrderStore();

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
      if (parsed.type === 'order:created') {
        fetchOrders();
      }
    };

    return () => {
      socket.close();
    };
  }, [apiBaseUrl, fetchOrders]);

  const totalQuantity = useMemo(
    () => orders.reduce((total, item) => total + Number(item.quantity || 0), 0),
    [orders]
  );

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-700 to-slate-900 px-4 py-8 text-slate-50 md:px-8">
      <main className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[430px_1fr]">
        <section className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-lg">
          <p className="text-sm uppercase tracking-[0.2em] text-brand-100">TI-NASONXIMANG</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">Khach hang nhap don hang</h1>
          <p className="mt-2 text-sm text-slate-200">Thong tin se duoc luu vao SQLite noi bo va dong bo danh sach theo thoi gian thuc qua WebSocket.</p>
          {isWebMode && (
            <p className="mt-2 rounded-lg bg-amber-100/90 px-3 py-2 text-sm text-amber-900">
              Dang chay tren web. Du lieu don hang tam thoi duoc luu trong localStorage cua trinh duyet.
            </p>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Input label="Ten khach hang" value={form.customerName} onChange={(value) => setForm((prev) => ({ ...prev, customerName: value }))} required />
            <Input label="So dien thoai" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} required />
            <Input label="San pham" value={form.productName} onChange={(value) => setForm((prev) => ({ ...prev, productName: value }))} required />
            <Input label="So luong" type="number" min="0.1" step="0.1" value={form.quantity} onChange={(value) => setForm((prev) => ({ ...prev, quantity: value }))} required />
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
              {submitting ? 'Dang gui don...' : 'Gui don hang'}
            </button>
          </form>

          {submitMessage && <p className="mt-4 text-sm text-brand-100">{submitMessage}</p>}
        </section>

        <section className="rounded-2xl border border-white/20 bg-white p-6 text-slate-900 shadow-2xl">
          <header className="flex flex-col gap-2 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Danh sach don hang</h2>
              <p className="text-sm text-slate-500">Tong don: {orders.length} | Tong so luong: {totalQuantity.toFixed(1)}</p>
            </div>
            {loading && <p className="text-sm text-brand-700">Dang tai du lieu...</p>}
          </header>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] table-auto border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Khach hang</th>
                  <th className="px-2 py-2">Dien thoai</th>
                  <th className="px-2 py-2">San pham</th>
                  <th className="px-2 py-2">So luong</th>
                  <th className="px-2 py-2">Ghi chu</th>
                  <th className="px-2 py-2">Thoi gian</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-3">#{order.id}</td>
                    <td className="px-2 py-3 font-medium">{order.customer_name}</td>
                    <td className="px-2 py-3">{order.phone}</td>
                    <td className="px-2 py-3">{order.product_name}</td>
                    <td className="px-2 py-3">{order.quantity}</td>
                    <td className="px-2 py-3">{order.note || '-'}</td>
                    <td className="px-2 py-3 text-xs text-slate-500">{new Date(order.created_at).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
                {!orders.length && !loading && (
                  <tr>
                    <td colSpan={7} className="px-2 py-8 text-center text-slate-500">
                      Chua co don hang nao.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
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
    <label className="block text-sm text-slate-200">
      {label}
      <input
        required={required}
        type={type}
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-100"
      />
    </label>
  );
}
