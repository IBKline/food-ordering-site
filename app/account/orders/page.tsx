"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
  preferred_date: string | null;
  preferred_time: string | null;
  payment_status: string;
  order_status: string;
  payment_proof_path: string | null;
  notes: string | null;
  total: number;
  created_at: string;
  order_items: OrderItem[];
};

export default function AccountOrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
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
        id,
        customer_name,
        contact_number,
        delivery_method,
        address,
        preferred_date,
        preferred_time,
        payment_status,
        order_status,
        payment_proof_path,
        notes,
        total,
        created_at,
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
      console.error("Customer orders error:", error);
      alert(`Failed to load orders: ${error.message}`);
      setLoading(false);
      return;
    }

    setOrders((data || []) as Order[]);
    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function formatPeso(amount: number) {
    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getPaymentClass(status: string) {
    return status === "paid" ? "badge success" : "badge danger";
  }

  function getOrderClass(status: string) {
    if (status === "completed") return "badge success";
    if (status === "cancelled") return "badge danger";
    return "badge info";
  }

  return (
    <main className="customer-page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f7f3ea;
          color: #201a16;
          font-family: Inter, Arial, Helvetica, sans-serif;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        .customer-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(255, 186, 73, 0.28), transparent 34rem),
            radial-gradient(circle at top right, rgba(20, 184, 166, 0.2), transparent 32rem),
            linear-gradient(180deg, #fffaf0 0%, #f7f3ea 48%, #ffffff 100%);
        }

        .container {
          width: min(1180px, calc(100% - 32px));
          margin: 0 auto;
        }

        .nav {
          position: sticky;
          top: 0;
          z-index: 40;
          border-bottom: 1px solid rgba(60, 48, 38, 0.1);
          background: rgba(255, 250, 240, 0.88);
          backdrop-filter: blur(18px);
        }

        .nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 16px 0;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: inherit;
          text-decoration: none;
        }

        .brand-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border-radius: 18px;
          background: linear-gradient(135deg, #111827, #0f766e);
          color: white;
          font-size: 24px;
          box-shadow: 0 16px 40px rgba(15, 118, 110, 0.22);
        }

        .brand-title {
          margin: 0;
          font-size: 19px;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .brand-subtitle {
          margin: 2px 0 0;
          color: #74665b;
          font-size: 13px;
          font-weight: 700;
        }

        .nav-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .pill-link,
        .pill-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          border: 1px solid rgba(32, 26, 22, 0.12);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.72);
          color: #201a16;
          padding: 9px 15px;
          font-size: 13px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          transition: 160ms ease;
        }

        .pill-link:hover,
        .pill-button:hover {
          transform: translateY(-1px);
          background: white;
          box-shadow: 0 10px 25px rgba(32, 26, 22, 0.08);
        }

        .pill-primary {
          border: none;
          background: linear-gradient(135deg, #ea580c, #f59e0b);
          color: white;
          box-shadow: 0 12px 30px rgba(234, 88, 12, 0.22);
        }

        .hero {
          padding: 56px 0 34px;
        }

        .hero-card {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.58);
          border-radius: 34px;
          background:
            radial-gradient(circle at top right, rgba(20, 184, 166, 0.22), transparent 22rem),
            linear-gradient(135deg, #18120e, #0f766e);
          color: white;
          padding: 34px;
          box-shadow: 0 30px 80px rgba(32, 26, 22, 0.14);
        }

        .eyebrow {
          display: inline-flex;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          color: #fef3c7;
          padding: 9px 13px;
          font-size: 13px;
          font-weight: 950;
          backdrop-filter: blur(14px);
        }

        .hero-title {
          max-width: 820px;
          margin: 20px 0 0;
          font-size: clamp(38px, 6vw, 66px);
          line-height: 0.96;
          letter-spacing: -0.07em;
          font-weight: 1000;
        }

        .hero-title span {
          display: block;
          background: linear-gradient(135deg, #fbbf24, #5eead4);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero-text {
          max-width: 720px;
          margin: 18px 0 0;
          color: rgba(255, 255, 255, 0.78);
          font-size: 16px;
          line-height: 1.8;
          font-weight: 650;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 26px;
        }

        .summary-card {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.86);
          padding: 18px;
          box-shadow: 0 18px 42px rgba(32, 26, 22, 0.06);
        }

        .summary-label {
          margin: 0;
          color: #766a5d;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .summary-value {
          margin: 8px 0 0;
          color: #18120e;
          font-size: 28px;
          font-weight: 1000;
          letter-spacing: -0.05em;
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin: 26px 0 18px;
        }

        .section-title {
          margin: 0;
          color: #18120e;
          font-size: 34px;
          line-height: 1;
          letter-spacing: -0.06em;
          font-weight: 1000;
        }

        .section-subtitle {
          margin: 8px 0 0;
          color: #695d52;
          font-weight: 650;
        }

        .button {
          border: 0;
          border-radius: 18px;
          background: #18120e;
          color: white;
          padding: 14px 18px;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
          transition: 160ms ease;
        }

        .button:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(24, 18, 14, 0.16);
        }

        .button-orange {
          background: linear-gradient(135deg, #ea580c, #f59e0b);
        }

        .button-soft {
          border: 1px solid rgba(32, 26, 22, 0.12);
          background: rgba(255, 255, 255, 0.8);
          color: #201a16;
        }

        .loading-card,
        .empty-card {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 28px;
          background: white;
          padding: 32px;
          color: #695d52;
          font-weight: 800;
          box-shadow: 0 18px 42px rgba(32, 26, 22, 0.06);
        }

        .empty-card {
          text-align: center;
        }

        .empty-emoji {
          font-size: 54px;
        }

        .empty-card h2 {
          margin: 12px 0 0;
          color: #18120e;
          font-size: 28px;
          letter-spacing: -0.04em;
          font-weight: 1000;
        }

        .empty-card p {
          margin: 8px auto 0;
          max-width: 520px;
          line-height: 1.7;
        }

        .orders-grid {
          display: grid;
          gap: 18px;
          padding-bottom: 54px;
        }

        .order-card {
          overflow: hidden;
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 20px 52px rgba(32, 26, 22, 0.07);
        }

        .order-top {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          padding: 22px;
          border-bottom: 1px solid rgba(32, 26, 22, 0.08);
          background:
            radial-gradient(circle at top right, rgba(20, 184, 166, 0.12), transparent 16rem),
            #fffaf0;
        }

        .order-name {
          margin: 0;
          color: #18120e;
          font-size: 24px;
          letter-spacing: -0.04em;
          font-weight: 1000;
        }

        .order-meta {
          margin: 7px 0 0;
          color: #695d52;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.6;
        }

        .order-total {
          min-width: 150px;
          height: fit-content;
          border-radius: 22px;
          background: #18120e;
          color: white;
          padding: 14px;
          text-align: right;
        }

        .order-total span {
          display: block;
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
          font-weight: 800;
        }

        .order-total strong {
          display: block;
          margin-top: 3px;
          font-size: 26px;
          font-weight: 1000;
        }

        .order-body {
          padding: 22px;
        }

        .status-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 18px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border: 1px solid transparent;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 1000;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .success {
          border-color: rgba(22, 101, 52, 0.22);
          background: #dcfce7;
          color: #166534;
        }

        .danger {
          border-color: rgba(190, 18, 60, 0.18);
          background: #ffe4e6;
          color: #be123c;
        }

        .info {
          border-color: rgba(15, 118, 110, 0.2);
          background: #ccfbf1;
          color: #0f766e;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .detail-box {
          border: 1px solid rgba(32, 26, 22, 0.08);
          border-radius: 20px;
          background: #fffaf0;
          padding: 14px;
        }

        .detail-label {
          display: block;
          color: #766a5d;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .detail-value {
          display: block;
          margin-top: 5px;
          color: #18120e;
          font-weight: 850;
          line-height: 1.45;
        }

        .items-panel {
          margin-top: 16px;
          border: 1px solid rgba(32, 26, 22, 0.08);
          border-radius: 22px;
          background: white;
          overflow: hidden;
        }

        .items-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          background: #18120e;
          color: white;
        }

        .items-head strong {
          font-weight: 1000;
        }

        .items-list {
          display: grid;
        }

        .item-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          padding: 13px 16px;
          border-bottom: 1px solid rgba(32, 26, 22, 0.08);
        }

        .item-row:last-child {
          border-bottom: 0;
        }

        .item-name {
          font-weight: 950;
          color: #18120e;
        }

        .item-sub {
          margin-top: 3px;
          color: #766a5d;
          font-size: 13px;
          font-weight: 700;
        }

        .item-price {
          color: #0f766e;
          font-weight: 1000;
        }

        .order-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .proof-note {
          margin-top: 14px;
          border-radius: 18px;
          background: #e9fbf7;
          color: #115e59;
          padding: 13px;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.5;
        }

        @media (max-width: 900px) {
          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .order-top,
          .detail-grid {
            grid-template-columns: 1fr;
          }

          .order-total {
            width: 100%;
            text-align: left;
          }
        }

        @media (max-width: 650px) {
          .nav-inner {
            align-items: flex-start;
            flex-direction: column;
          }

          .nav-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .hero-card {
            padding: 24px;
          }

          .toolbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .hero-title {
            font-size: 42px;
          }
        }
      `}</style>

      <nav className="nav">
        <div className="container nav-inner">
          <a href="/" className="brand">
            <div className="brand-icon">🍱</div>
            <div>
              <p className="brand-title">Kline&apos;s Daily Meals</p>
              <p className="brand-subtitle">Customer order center</p>
            </div>
          </a>

          <div className="nav-actions">
            <a className="pill-link" href="/">
              Menu
            </a>
            <a className="pill-link" href="/account/profile">
              Profile
            </a>
            <a className="pill-link" href="/account/support">
              Support
            </a>
            <a className="pill-link" href="/account/live-chat">
              Live Chat
            </a>
            {user ? (
              <button className="pill-button" type="button" onClick={logout}>
                Logout
              </button>
            ) : (
              <a className="pill-link pill-primary" href="/login">
                Login
              </a>
            )}
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="container">
          <div className="hero-card">
            <div className="eyebrow">📦 Order Tracking</div>
            <h1 className="hero-title">
              Your meals,
              <span>tracked beautifully.</span>
            </h1>
            <p className="hero-text">
              Review your previous orders, payment status, preparation status,
              preferred schedule, and meal details in one clean customer center.
            </p>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <p className="summary-label">Total Orders</p>
              <p className="summary-value">{orders.length}</p>
            </div>

            <div className="summary-card">
              <p className="summary-label">Unpaid</p>
              <p className="summary-value">
                {orders.filter((order) => order.payment_status !== "paid").length}
              </p>
            </div>

            <div className="summary-card">
              <p className="summary-label">Active</p>
              <p className="summary-value">
                {
                  orders.filter(
                    (order) =>
                      order.order_status !== "completed" &&
                      order.order_status !== "cancelled"
                  ).length
                }
              </p>
            </div>

            <div className="summary-card">
              <p className="summary-label">Completed</p>
              <p className="summary-value">
                {
                  orders.filter((order) => order.order_status === "completed")
                    .length
                }
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container">
        <div className="toolbar">
          <div>
            <h2 className="section-title">My Orders</h2>
            <p className="section-subtitle">
              Latest orders appear first. Refresh if you recently submitted a new
              order.
            </p>
          </div>

          <button className="button button-orange" type="button" onClick={loadOrders}>
            Refresh Orders
          </button>
        </div>

        {loading ? (
          <div className="loading-card">Loading your orders...</div>
        ) : !user ? (
          <div className="empty-card">
            <div className="empty-emoji">🔐</div>
            <h2>Login required</h2>
            <p>
              Please login to view your saved order history. Guest orders are not
              attached to an account.
            </p>

            <div className="order-actions" style={{ justifyContent: "center" }}>
              <a className="button button-orange" href="/login">
                Login
              </a>
              <a className="button button-soft" href="/">
                Back to Menu
              </a>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-card">
            <div className="empty-emoji">🍽️</div>
            <h2>No orders yet</h2>
            <p>
              You have no saved orders on this account. Start from the menu and
              place your first pre-order.
            </p>

            <div className="order-actions" style={{ justifyContent: "center" }}>
              <a className="button button-orange" href="/">
                Browse Menu
              </a>
              <a className="button button-soft" href="/account/live-chat">
                Ask Admin
              </a>
            </div>
          </div>
        ) : (
          <div className="orders-grid">
            {orders.map((order) => {
              const isOpen = openOrderId === order.id;

              return (
                <article className="order-card" key={order.id}>
                  <div className="order-top">
                    <div>
                      <h3 className="order-name">
                        Order from {formatDate(order.created_at)}
                      </h3>
                      <p className="order-meta">
                        {order.delivery_method} · {order.preferred_date || "No date"} at{" "}
                        {order.preferred_time || "No time"}
                      </p>
                    </div>

                    <div className="order-total">
                      <span>Total</span>
                      <strong>{formatPeso(Number(order.total))}</strong>
                    </div>
                  </div>

                  <div className="order-body">
                    <div className="status-row">
                      <span className={getPaymentClass(order.payment_status)}>
                        Payment: {order.payment_status}
                      </span>

                      <span className={getOrderClass(order.order_status)}>
                        Order: {order.order_status}
                      </span>

                      {order.payment_proof_path ? (
                        <span className="badge success">Proof uploaded</span>
                      ) : (
                        <span className="badge danger">No proof uploaded</span>
                      )}
                    </div>

                    <div className="detail-grid">
                      <div className="detail-box">
                        <span className="detail-label">Customer</span>
                        <span className="detail-value">{order.customer_name}</span>
                      </div>

                      <div className="detail-box">
                        <span className="detail-label">Contact</span>
                        <span className="detail-value">{order.contact_number}</span>
                      </div>

                      <div className="detail-box">
                        <span className="detail-label">Address / Pickup Note</span>
                        <span className="detail-value">{order.address}</span>
                      </div>

                      <div className="detail-box">
                        <span className="detail-label">Notes</span>
                        <span className="detail-value">
                          {order.notes || "No special instructions."}
                        </span>
                      </div>
                    </div>

                    <div className="order-actions">
                      <button
                        className="button button-soft"
                        type="button"
                        onClick={() => setOpenOrderId(isOpen ? null : order.id)}
                      >
                        {isOpen ? "Hide Items" : "View Items"}
                      </button>

                      <a className="button button-soft" href="/account/support">
                        Contact Support
                      </a>

                      <a className="button button-soft" href="/account/live-chat">
                        Live Chat
                      </a>
                    </div>

                    {!order.payment_proof_path && (
                      <div className="proof-note">
                        Payment proof has not been uploaded for this order. If
                        you already paid, contact support or live chat so admin
                        can verify it.
                      </div>
                    )}

                    {isOpen && (
                      <div className="items-panel">
                        <div className="items-head">
                          <strong>Order Items</strong>
                          <span>{order.order_items.length} item rows</span>
                        </div>

                        <div className="items-list">
                          {order.order_items.length === 0 ? (
                            <div className="item-row">
                              <div>
                                <div className="item-name">No items found</div>
                                <div className="item-sub">
                                  This order has no saved item records.
                                </div>
                              </div>
                            </div>
                          ) : (
                            order.order_items.map((item) => (
                              <div className="item-row" key={item.id}>
                                <div>
                                  <div className="item-name">{item.meal_name}</div>
                                  <div className="item-sub">
                                    {item.quantity} x{" "}
                                    {formatPeso(Number(item.unit_price))}
                                  </div>
                                </div>

                                <div className="item-price">
                                  {formatPeso(Number(item.subtotal))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}