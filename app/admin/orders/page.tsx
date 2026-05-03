"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminGuard from "@/components/AdminGuard";

type OrderItem = {
  id: string;
  meal_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type Order = {
  id: string;
  customer_name: string;
  contact_number: string;
  delivery_method: string;
  address: string;
  payment_status: string;
  order_status: string;
  notes: string | null;
  total: number;
  created_at: string;
  order_items: OrderItem[];
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          id,
          meal_name,
          quantity,
          unit_price,
          subtotal
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Orders error:", error);
      alert(`Failed to load orders: ${error.message}`);
    } else {
      setOrders((data || []) as Order[]);
    }

    setLoading(false);
  }

  async function updatePaymentStatus(orderId: string, paymentStatus: string) {
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: paymentStatus })
      .eq("id", orderId);

    if (error) {
      console.error("Payment update error:", error);
      alert(`Failed to update payment status: ${error.message}`);
      return;
    }

    await fetchOrders();
  }

  async function updateOrderStatus(orderId: string, orderStatus: string) {
    const { error } = await supabase
      .from("orders")
      .update({ order_status: orderStatus })
      .eq("id", orderId);

    if (error) {
      console.error("Order update error:", error);
      alert(`Failed to update order status: ${error.message}`);
      return;
    }

    await fetchOrders();
  }

  return (
  <AdminGuard>
    <main className="min-h-screen bg-white p-5 text-black">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-black">Admin Orders</h1>
            <p className="mt-1 text-gray-900">
              View orders, confirm payments, and update order status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 font-bold text-orange-900 hover:bg-orange-200"
            >
              Customer Page
            </a>

            <a
              href="/admin/meals"
              className="rounded-xl border border-gray-500 bg-gray-100 px-4 py-2 font-bold text-black hover:bg-gray-200"
            >
              Manage Meals
            </a>

            <button
              onClick={fetchOrders}
              className="rounded-xl border border-blue-700 bg-blue-100 px-4 py-2 font-bold text-blue-900 hover:bg-blue-200"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-black">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="mt-6 rounded-xl border border-gray-300 bg-white p-5 text-black shadow-sm">
            No orders yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-5">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-black">
                      {order.customer_name}
                    </h2>

                    <p className="text-sm text-gray-900">
                      Contact: {order.contact_number}
                    </p>

                    <p className="mt-3 text-black">
                      <strong>Method:</strong> {order.delivery_method}
                    </p>

                    <p className="text-black">
                      <strong>Address/Pickup Note:</strong> {order.address}
                    </p>

                    {order.notes && (
                      <p className="text-black">
                        <strong>Notes:</strong> {order.notes}
                      </p>
                    )}

                    <p className="mt-2 text-sm text-gray-900">
                      Ordered at: {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-right">
                    <p className="text-sm text-black">Total</p>
                    <p className="text-2xl font-bold text-orange-900">
                      ₱{Number(order.total)}
                    </p>

                    <p className="mt-2 text-sm text-black">
                      Payment:{" "}
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-bold ${
                          order.payment_status === "paid"
                            ? "border-green-700 bg-green-100 text-green-900"
                            : "border-red-700 bg-red-100 text-red-900"
                        }`}
                      >
                        {order.payment_status}
                      </span>
                    </p>

                    <p className="mt-2 text-sm text-black">
                      Status:{" "}
                      <span className="rounded-full border border-blue-700 bg-blue-100 px-2 py-1 text-xs font-bold text-blue-900">
                        {order.order_status}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-gray-300 bg-gray-50 p-4">
                  <h3 className="font-bold text-black">Items</h3>

                  <div className="mt-2 space-y-2">
                    {order.order_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between border-b border-gray-300 pb-2 text-sm text-black"
                      >
                        <span>
                          {item.quantity}x {item.meal_name}
                        </span>
                        <span>₱{Number(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="font-semibold text-black">
                      Payment Status
                    </label>

                    <select
                      value={order.payment_status}
                      onChange={(event) =>
                        updatePaymentStatus(order.id, event.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-black">
                      Order Status
                    </label>

                    <select
                      value={order.order_status}
                      onChange={(event) =>
                        updateOrderStatus(order.id, event.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="preparing">Preparing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  </AdminGuard>
  );
}