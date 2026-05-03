"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AdminNavProps = {
  title: string;
  description: string;
};

export default function AdminNav({ title, description }: AdminNavProps) {
  const [orderAlertCount, setOrderAlertCount] = useState(0);
  const [supportAlertCount, setSupportAlertCount] = useState(0);
  const [liveChatAlertCount, setLiveChatAlertCount] = useState(0);

  useEffect(() => {
    loadAttentionCounts();

    const interval = setInterval(() => {
      loadAttentionCounts();
    }, 10000);

    function handleFocus() {
      loadAttentionCounts();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  async function loadAttentionCounts() {
    await Promise.all([
      loadOrderAlertCount(),
      loadSupportAlertCount(),
      loadLiveChatAlertCount(),
    ]);
  }

  async function loadOrderAlertCount() {
    const { data, error } = await supabase
      .from("orders")
      .select("id, payment_status, order_status");

    if (error) {
      console.error("Order alert count error:", error);
      setOrderAlertCount(0);
      return;
    }

    const attentionOrders = (data || []).filter((order) => {
      const paymentNeedsAttention = order.payment_status !== "paid";

      const orderNeedsAttention =
        order.order_status !== "completed" &&
        order.order_status !== "cancelled";

      return paymentNeedsAttention || orderNeedsAttention;
    });

    setOrderAlertCount(attentionOrders.length);
  }

  async function loadSupportAlertCount() {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, status")
      .neq("status", "closed");

    if (error) {
      console.error("Support alert count error:", error);
      setSupportAlertCount(0);
      return;
    }

    setSupportAlertCount((data || []).length);
  }

  async function loadLiveChatAlertCount() {
    const { data, error } = await supabase
      .from("live_chat_messages")
      .select("id, sender_role, read_by_admin")
      .eq("sender_role", "customer")
      .eq("read_by_admin", false);

    if (error) {
      console.error("Live chat alert count error:", error);
      setLiveChatAlertCount(0);
      return;
    }

    setLiveChatAlertCount((data || []).length);
  }

  function Badge({ count }: { count: number }) {
    if (count <= 0) return null;

    return (
      <span className="admin-badge">
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  return (
    <>
      <style jsx global>{`
        .admin-shell-header {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 30px;
          background:
            radial-gradient(circle at top right, rgba(20, 184, 166, 0.22), transparent 22rem),
            radial-gradient(circle at bottom left, rgba(245, 158, 11, 0.16), transparent 20rem),
            linear-gradient(135deg, #0f172a, #111827 48%, #0f766e);
          color: white;
          padding: 24px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
        }

        .admin-shell-top {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 20px;
          align-items: start;
        }

        .admin-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          color: #fef3c7;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          backdrop-filter: blur(14px);
        }

        .admin-title {
          margin: 14px 0 0;
          color: white;
          font-size: clamp(32px, 4vw, 52px);
          line-height: 0.98;
          letter-spacing: -0.06em;
          font-weight: 1000;
        }

        .admin-description {
          max-width: 760px;
          margin: 12px 0 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 15px;
          line-height: 1.65;
          font-weight: 650;
        }

        .admin-customer-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          padding: 10px 15px;
          font-size: 13px;
          font-weight: 950;
          text-decoration: none;
          white-space: nowrap;
          backdrop-filter: blur(14px);
          transition: 160ms ease;
        }

        .admin-customer-button:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.16);
        }

        .admin-nav-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 10px;
          margin-top: 22px;
        }

        .admin-nav-link {
          position: relative;
          display: flex;
          min-height: 76px;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.08);
          color: white;
          padding: 13px;
          text-decoration: none;
          backdrop-filter: blur(14px);
          transition: 160ms ease;
        }

        .admin-nav-link:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.14);
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.16);
        }

        .admin-nav-icon {
          font-size: 21px;
          line-height: 1;
        }

        .admin-nav-label {
          color: white;
          font-size: 13px;
          font-weight: 1000;
          letter-spacing: -0.01em;
        }

        .admin-nav-sub {
          color: rgba(255, 255, 255, 0.55);
          font-size: 11px;
          font-weight: 700;
        }

        .admin-badge {
          position: absolute;
          right: -7px;
          top: -7px;
          display: flex;
          min-width: 26px;
          height: 26px;
          align-items: center;
          justify-content: center;
          border: 2px solid #0f172a;
          border-radius: 999px;
          background: linear-gradient(135deg, #ef4444, #be123c);
          color: white;
          padding: 0 7px;
          font-size: 11px;
          font-weight: 1000;
          box-shadow: 0 10px 24px rgba(239, 68, 68, 0.28);
        }

        .admin-alert-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 14px;
        }

        .admin-alert-card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.075);
          padding: 12px 13px;
          backdrop-filter: blur(14px);
        }

        .admin-alert-card span {
          display: block;
          color: rgba(255, 255, 255, 0.55);
          font-size: 11px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .admin-alert-card strong {
          display: block;
          margin-top: 3px;
          color: white;
          font-size: 22px;
          line-height: 1;
          font-weight: 1000;
        }

        @media (max-width: 1100px) {
          .admin-nav-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .admin-shell-header {
            border-radius: 24px;
            padding: 20px;
          }

          .admin-shell-top {
            grid-template-columns: 1fr;
          }

          .admin-nav-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .admin-alert-strip {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .admin-nav-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <header className="admin-shell-header">
        <div className="admin-shell-top">
          <div>
            <div className="admin-kicker">Back Office Command Center</div>
            <h1 className="admin-title">{title}</h1>
            <p className="admin-description">{description}</p>
          </div>

          <a href="/" className="admin-customer-button">
            View Customer Site →
          </a>
        </div>

        <div className="admin-alert-strip">
          <div className="admin-alert-card">
            <span>Orders Needing Attention</span>
            <strong>{orderAlertCount}</strong>
          </div>

          <div className="admin-alert-card">
            <span>Open Support Tickets</span>
            <strong>{supportAlertCount}</strong>
          </div>

          <div className="admin-alert-card">
            <span>Unread Live Chats</span>
            <strong>{liveChatAlertCount}</strong>
          </div>
        </div>

        <nav className="admin-nav-grid">
          <a href="/admin/dashboard" className="admin-nav-link">
            <span className="admin-nav-icon">📊</span>
            <span className="admin-nav-label">Dashboard</span>
            <span className="admin-nav-sub">Sales overview</span>
          </a>

          <a href="/admin/orders" className="admin-nav-link">
            <span className="admin-nav-icon">📦</span>
            <span className="admin-nav-label">Orders</span>
            <span className="admin-nav-sub">Manage queue</span>
            <Badge count={orderAlertCount} />
          </a>

          <a href="/admin/meals" className="admin-nav-link">
            <span className="admin-nav-icon">🍱</span>
            <span className="admin-nav-label">Meals</span>
            <span className="admin-nav-sub">Menu control</span>
          </a>

          <a href="/admin/customers" className="admin-nav-link">
            <span className="admin-nav-icon">👥</span>
            <span className="admin-nav-label">Customers</span>
            <span className="admin-nav-sub">CRM history</span>
          </a>

          <a href="/admin/invoices" className="admin-nav-link">
            <span className="admin-nav-icon">🧾</span>
            <span className="admin-nav-label">Invoices</span>
            <span className="admin-nav-sub">Billing records</span>
          </a>

          <a href="/admin/support" className="admin-nav-link">
            <span className="admin-nav-icon">🎧</span>
            <span className="admin-nav-label">Support</span>
            <span className="admin-nav-sub">Ticket inbox</span>
            <Badge count={supportAlertCount} />
          </a>

          <a href="/admin/live-chat" className="admin-nav-link">
            <span className="admin-nav-icon">💬</span>
            <span className="admin-nav-label">Live Chat</span>
            <span className="admin-nav-sub">Real-time help</span>
            <Badge count={liveChatAlertCount} />
          </a>
        </nav>
      </header>
    </>
  );
}