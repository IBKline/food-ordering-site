"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

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
  preferred_date: string | null;
  preferred_time: string | null;
};

export default function CustomerOrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserAndOrders();
  }, []);

  async function loadUserAndOrders() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

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
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(`Failed to load orders: ${error.message}`);
    } else {
      setOrders((data || []) as Order[]);
    }

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-5 text-black">
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-white p-5 text-black">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-black">Order History</h1>
          <p className="mt-2 text-black">
            Please login to view your order history.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="/login"
              className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 font-bold text-orange-900 hover:bg-orange-200"
            >
              Login
            </a>

            <a
              href="/"
              className="rounded-xl border border-gray-400 bg-gray-100 px-4 py-2 font-bold text-black hover:bg-gray-200"
            >
              Back to Menu
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white p-5 text-black">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-black">My Orders</h1>
            <p className="mt-1 text-gray-900">{user.email}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 font-bold text-orange-900 hover:bg-orange-200"
            >
              Order Again
            </a>

            <button
              onClick={logout}
              className="rounded-xl border border-gray-400 bg-gray-100 px-4 py-2 font-bold text-black hover:bg-gray-200"
            >
              Logout
            </button>
          </div>
        </div>

        {orders.length === 0 ? (
          <p className="mt-6 rounded-xl border border-gray-300 bg-white p-5 text-black shadow-sm">
            You have no orders yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-5">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-black">
                      Order from {new Date(order.created_at).toLocaleString()}
                    </h2>
                   <p className="text-black">
                    <strong>Preferred Schedule:</strong>{" "}
                   {order.preferred_date || "No date"} at {order.preferred_time || "No time"}
                    </p>
                    <p className="mt-2 text-black">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}