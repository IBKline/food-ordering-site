"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/AdminNav";

type OrderItem = {
  id: string;
  order_id: string;
  meal_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type Order = {
  id: string;
  user_id: string | null;
  customer_name: string;
  contact_number: string;
  delivery_method: string;
  address: string;
  preferred_date: string | null;
  preferred_time: string | null;
  payment_method: string | null;
  payment_status: string;
  order_status: string;
  payment_proof_path: string | null;
  notes: string | null;
  total: number;
  created_at: string;
  order_items: OrderItem[];
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentProofUrls, setPaymentProofUrls] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [orderFilter, setOrderFilter] = useState("active");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id,
        user_id,
        customer_name,
        contact_number,
        delivery_method,
        address,
        preferred_date,
        preferred_time,
        payment_method,
        payment_status,
        order_status,
        payment_proof_path,
        notes,
        total,
        created_at,
        order_items (
          id,
          order_id,
          meal_name,
          quantity,
          unit_price,
          subtotal
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin orders error:", error);
      alert(`Failed to load orders: ${error.message}`);
      setLoading(false);
      return;
    }

    const loadedOrders = (data || []) as Order[];

    setOrders(loadedOrders);
    await loadPaymentProofUrls(loadedOrders);

    setLoading(false);
  }

  async function loadPaymentProofUrls(orderList: Order[]) {
    const ordersWithProof = orderList.filter((order) => order.payment_proof_path);

    const entries = await Promise.all(
      ordersWithProof.map(async (order) => {
        const { data, error } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(order.payment_proof_path as string, 60 * 60);

        if (error || !data?.signedUrl) {
          console.error("Payment proof signed URL error:", error);
          return [order.id, ""] as const;
        }

        return [order.id, data.signedUrl] as const;
      })
    );

    const urlMap: Record<string, string> = {};

    entries.forEach(([orderId, url]) => {
      if (url) {
        urlMap[orderId] = url;
      }
    });

    setPaymentProofUrls(urlMap);
  }

  async function updateOrderStatus(
    orderId: string,
    field: "payment_status" | "order_status",
    value: string
  ) {
    setUpdatingOrderId(orderId);

    const { error } = await supabase
      .from("orders")
      .update({
        [field]: value,
      })
      .eq("id", orderId);

    if (error) {
      console.error("Update order status error:", error);
      alert(`Failed to update order: ${error.message}`);
      setUpdatingOrderId(null);
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order
      )
    );

    setUpdatingOrderId(null);
  }

  async function markPaidAndConfirmed(order: Order) {
    setUpdatingOrderId(order.id);

    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        order_status:
          order.order_status === "pending" ? "confirmed" : order.order_status,
      })
      .eq("id", order.id);

    if (error) {
      console.error("Mark paid and confirmed error:", error);
      alert(`Failed to update order: ${error.message}`);
      setUpdatingOrderId(null);
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.map((currentOrder) =>
        currentOrder.id === order.id
          ? {
              ...currentOrder,
              payment_status: "paid",
              order_status:
                currentOrder.order_status === "pending"
                  ? "confirmed"
                  : currentOrder.order_status,
            }
          : currentOrder
      )
    );

    setUpdatingOrderId(null);
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

  function formatSchedule(dateString: string | null, timeString: string | null) {
    if (!dateString && !timeString) return "No schedule";

    const dateLabel = dateString
      ? new Date(`${dateString}T00:00:00`).toLocaleDateString("en-PH", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "No date";

    return `${dateLabel} at ${timeString || "No time"}`;
  }

  function getPaymentClass(status: string) {
    return status === "paid" ? "status success" : "status danger";
  }

  function getOrderClass(status: string) {
    if (status === "completed") return "status success";
    if (status === "cancelled") return "status danger";
    if (status === "confirmed") return "status teal";
    if (status === "preparing") return "status orange";
    if (status === "ready") return "status purple";
    return "status info";
  }

  const summary = useMemo(() => {
    const paidOrders = orders.filter((order) => order.payment_status === "paid");
    const unpaidOrders = orders.filter((order) => order.payment_status !== "paid");

    const activeOrders = orders.filter(
      (order) =>
        order.order_status !== "completed" && order.order_status !== "cancelled"
    );

    const pendingOrders = orders.filter((order) => order.order_status === "pending");

    const completedOrders = orders.filter(
      (order) => order.order_status === "completed"
    );

    const paidSales = paidOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );

    const unpaidSales = unpaidOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );

    return {
      totalOrders: orders.length,
      activeOrders: activeOrders.length,
      pendingOrders: pendingOrders.length,
      paidOrders: paidOrders.length,
      unpaidOrders: unpaidOrders.length,
      completedOrders: completedOrders.length,
      paidSales,
      unpaidSales,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesPayment =
        paymentFilter === "all" ? true : order.payment_status === paymentFilter;

      const matchesOrder =
        orderFilter === "all"
          ? true
          : orderFilter === "active"
          ? order.order_status !== "completed" && order.order_status !== "cancelled"
          : order.order_status === orderFilter;

      if (!searchValue) {
        return matchesPayment && matchesOrder;
      }

      const matchesSearch =
        order.customer_name.toLowerCase().includes(searchValue) ||
        order.contact_number.toLowerCase().includes(searchValue) ||
        order.address.toLowerCase().includes(searchValue) ||
        order.delivery_method.toLowerCase().includes(searchValue) ||
        order.payment_status.toLowerCase().includes(searchValue) ||
        order.order_status.toLowerCase().includes(searchValue) ||
        order.order_items.some((item) =>
          item.meal_name.toLowerCase().includes(searchValue)
        );

      return matchesPayment && matchesOrder && matchesSearch;
    });
  }, [orders, search, paymentFilter, orderFilter]);

  return (
    <AdminGuard>
      <main className="admin-page">
        <style jsx global>{`
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            background: #0f172a;
            color: #e5e7eb;
            font-family: Inter, Arial, Helvetica, sans-serif;
          }

          button,
          input,
          textarea,
          select {
            font: inherit;
          }

          .admin-page {
            min-height: 100vh;
            background:
              radial-gradient(circle at top left, rgba(20, 184, 166, 0.18), transparent 34rem),
              radial-gradient(circle at top right, rgba(245, 158, 11, 0.12), transparent 32rem),
              linear-gradient(180deg, #0f172a 0%, #111827 42%, #f8fafc 42%, #f8fafc 100%);
            padding: 22px;
          }

          .admin-container {
            width: min(1380px, 100%);
            margin: 0 auto;
          }

          .content {
            margin-top: 22px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
          }

          .metric-card {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 24px;
            background: white;
            color: #0f172a;
            padding: 18px;
            box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08);
          }

          .metric-card.dark {
            border-color: rgba(255, 255, 255, 0.08);
            background:
              radial-gradient(circle at top right, rgba(20, 184, 166, 0.24), transparent 16rem),
              linear-gradient(135deg, #0f172a, #111827);
            color: white;
          }

          .metric-card.orange {
            background:
              radial-gradient(circle at top right, rgba(245, 158, 11, 0.16), transparent 14rem),
              white;
          }

          .metric-card.red {
            background:
              radial-gradient(circle at top right, rgba(239, 68, 68, 0.12), transparent 14rem),
              white;
          }

          .metric-label {
            margin: 0;
            color: #64748b;
            font-size: 12px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          .metric-card.dark .metric-label {
            color: rgba(255, 255, 255, 0.58);
          }

          .metric-value {
            margin: 9px 0 0;
            color: inherit;
            font-size: clamp(28px, 3vw, 40px);
            line-height: 1;
            letter-spacing: -0.06em;
            font-weight: 1000;
          }

          .metric-note {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
            font-weight: 700;
          }

          .metric-card.dark .metric-note {
            color: rgba(255, 255, 255, 0.64);
          }

          .toolbar {
            display: grid;
            grid-template-columns: 1fr 180px 210px auto;
            gap: 10px;
            margin-top: 16px;
          }

          .field,
          .select {
            width: 100%;
            border: 1px solid rgba(15, 23, 42, 0.14);
            outline: none;
            border-radius: 16px;
            background: white;
            color: #0f172a;
            padding: 12px 14px;
            font-weight: 800;
          }

          .field:focus,
          .select:focus {
            border-color: #0f766e;
            box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
          }

          .button {
            border: 0;
            border-radius: 16px;
            background: #0f172a;
            color: white;
            padding: 12px 15px;
            font-weight: 950;
            text-decoration: none;
            cursor: pointer;
            transition: 160ms ease;
          }

          .button:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 26px rgba(15, 23, 42, 0.16);
          }

          .button:disabled {
            cursor: not-allowed;
            opacity: 0.6;
          }

          .button-teal {
            background: linear-gradient(135deg, #0f766e, #14b8a6);
          }

          .button-orange {
            background: linear-gradient(135deg, #ea580c, #f59e0b);
          }

          .button-red {
            background: linear-gradient(135deg, #be123c, #ef4444);
          }

          .button-soft {
            border: 1px solid rgba(15, 23, 42, 0.12);
            background: white;
            color: #0f172a;
          }

          .section-card {
            margin-top: 16px;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 28px;
            background: white;
            color: #0f172a;
            padding: 20px;
            box-shadow: 0 18px 46px rgba(15, 23, 42, 0.07);
          }

          .section-head {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
            margin-bottom: 16px;
          }

          .section-kicker {
            margin: 0;
            color: #0f766e;
            font-size: 12px;
            font-weight: 1000;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }

          .section-title {
            margin: 5px 0 0;
            color: #0f172a;
            font-size: 28px;
            line-height: 1;
            letter-spacing: -0.05em;
            font-weight: 1000;
          }

          .section-desc {
            margin: 7px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
            font-weight: 700;
          }

          .orders-grid {
            display: grid;
            gap: 14px;
          }

          .order-card {
            overflow: hidden;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 24px;
            background: #f8fafc;
          }

          .order-top {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 18px;
            border-bottom: 1px solid rgba(15, 23, 42, 0.08);
            background:
              radial-gradient(circle at top right, rgba(20, 184, 166, 0.12), transparent 16rem),
              white;
            padding: 18px;
          }

          .order-name {
            margin: 0;
            color: #0f172a;
            font-size: 24px;
            line-height: 1;
            letter-spacing: -0.05em;
            font-weight: 1000;
          }

          .order-meta {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
            font-weight: 750;
          }

          .order-total {
            min-width: 150px;
            height: fit-content;
            border-radius: 20px;
            background: #0f172a;
            color: white;
            padding: 13px;
            text-align: right;
          }

          .order-total span {
            display: block;
            color: rgba(255, 255, 255, 0.6);
            font-size: 11px;
            font-weight: 850;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .order-total strong {
            display: block;
            margin-top: 4px;
            font-size: 26px;
            font-weight: 1000;
          }

          .order-body {
            padding: 18px;
          }

          .status-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 14px;
          }

          .status {
            display: inline-flex;
            border-radius: 999px;
            padding: 7px 10px;
            font-size: 11px;
            font-weight: 1000;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .status.success {
            background: #dcfce7;
            color: #166534;
          }

          .status.danger {
            background: #ffe4e6;
            color: #be123c;
          }

          .status.info {
            background: #dbeafe;
            color: #1d4ed8;
          }

          .status.teal {
            background: #ccfbf1;
            color: #0f766e;
          }

          .status.orange {
            background: #ffedd5;
            color: #c2410c;
          }

          .status.purple {
            background: #f3e8ff;
            color: #7e22ce;
          }

          .details-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
          }

          .detail-box {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            background: white;
            padding: 13px;
          }

          .detail-label {
            display: block;
            color: #64748b;
            font-size: 11px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }

          .detail-value {
            display: block;
            margin-top: 5px;
            color: #0f172a;
            font-weight: 850;
            line-height: 1.45;
            word-break: break-word;
          }

          .action-panel {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 14px;
          }

          .action-box {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            background: white;
            padding: 13px;
          }

          .action-box label {
            display: block;
            margin-bottom: 8px;
            color: #64748b;
            font-size: 11px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }

          .items-panel {
            margin-top: 14px;
            overflow: hidden;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 20px;
            background: white;
          }

          .items-head {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            background: #0f172a;
            color: white;
            padding: 13px 15px;
          }

          .items-head strong {
            font-weight: 1000;
          }

          .item-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 12px;
            border-top: 1px solid rgba(15, 23, 42, 0.08);
            padding: 13px 15px;
          }

          .item-name {
            color: #0f172a;
            font-weight: 1000;
          }

          .item-meta {
            margin-top: 4px;
            color: #64748b;
            font-size: 13px;
            font-weight: 700;
          }

          .item-total {
            color: #0f766e;
            font-weight: 1000;
          }

          .proof-box {
            margin-top: 14px;
            border: 1px solid rgba(15, 118, 110, 0.18);
            border-radius: 20px;
            background: #f0fdfa;
            padding: 14px;
          }

          .proof-title {
            margin: 0;
            color: #0f766e;
            font-size: 15px;
            font-weight: 1000;
          }

          .proof-image {
            margin-top: 12px;
            max-height: 420px;
            width: 100%;
            border-radius: 18px;
            border: 1px solid rgba(15, 23, 42, 0.1);
            object-fit: contain;
            background: white;
          }

          .empty-state {
            border: 1px dashed rgba(15, 23, 42, 0.18);
            border-radius: 22px;
            background: #f8fafc;
            padding: 22px;
            color: #64748b;
            font-weight: 800;
            text-align: center;
          }

          @media (max-width: 1150px) {
            .summary-grid {
              grid-template-columns: repeat(2, 1fr);
            }

            .toolbar {
              grid-template-columns: 1fr 1fr;
            }

            .details-grid,
            .action-panel {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 760px) {
            .admin-page {
              padding: 14px;
            }

            .summary-grid,
            .toolbar,
            .details-grid,
            .action-panel,
            .order-top {
              grid-template-columns: 1fr;
            }

            .order-total {
              width: 100%;
              text-align: left;
            }
          }
        `}</style>

        <div className="admin-container">
          <AdminNav
            title="Orders Queue"
            description="Review payment proof, update payment status, manage preparation flow, and monitor customer order details."
          />

          <div className="content">
            <section className="summary-grid">
              <div className="metric-card dark">
                <p className="metric-label">Active Orders</p>
                <p className="metric-value">{summary.activeOrders}</p>
                <p className="metric-note">Not completed or cancelled</p>
              </div>

              <div className="metric-card red">
                <p className="metric-label">Unpaid Orders</p>
                <p className="metric-value">{summary.unpaidOrders}</p>
                <p className="metric-note">
                  Potential sales: {formatPeso(summary.unpaidSales)}
                </p>
              </div>

              <div className="metric-card orange">
                <p className="metric-label">Paid Orders</p>
                <p className="metric-value">{summary.paidOrders}</p>
                <p className="metric-note">
                  Paid sales: {formatPeso(summary.paidSales)}
                </p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Completed</p>
                <p className="metric-value">{summary.completedOrders}</p>
                <p className="metric-note">Successfully fulfilled orders</p>
              </div>
            </section>

            <section className="section-card">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Order Management</p>
                  <h2 className="section-title">Order List</h2>
                  <p className="section-desc">
                    Search customer, contact, address, status, or meal name.
                  </p>
                </div>
              </div>

              <div className="toolbar">
                <input
                  className="field"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search orders..."
                />

                <select
                  className="select"
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value)}
                >
                  <option value="all">All Payments</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>

                <select
                  className="select"
                  value={orderFilter}
                  onChange={(event) => setOrderFilter(event.target.value)}
                >
                  <option value="active">Active Orders</option>
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <button
                  type="button"
                  onClick={fetchOrders}
                  className="button button-teal"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="empty-state" style={{ marginTop: 16 }}>
                  Loading orders...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 16 }}>
                  No orders found.
                </div>
              ) : (
                <div className="orders-grid" style={{ marginTop: 16 }}>
                  {filteredOrders.map((order) => {
                    const isOpen = openOrderId === order.id;

                    return (
                      <article className="order-card" key={order.id}>
                        <div className="order-top">
                          <div>
                            <h3 className="order-name">{order.customer_name}</h3>
                            <p className="order-meta">
                              Ordered: {formatDate(order.created_at)}
                              <br />
                              Schedule:{" "}
                              {formatSchedule(
                                order.preferred_date,
                                order.preferred_time
                              )}
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
                              <span className="status success">Proof uploaded</span>
                            ) : (
                              <span className="status danger">No proof</span>
                            )}

                            {order.user_id ? (
                              <span className="status teal">Registered</span>
                            ) : (
                              <span className="status orange">Guest</span>
                            )}
                          </div>

                          <div className="details-grid">
                            <div className="detail-box">
                              <span className="detail-label">Contact</span>
                              <span className="detail-value">
                                {order.contact_number}
                              </span>
                            </div>

                            <div className="detail-box">
                              <span className="detail-label">Method</span>
                              <span className="detail-value">
                                {order.delivery_method}
                              </span>
                            </div>

                            <div className="detail-box">
                              <span className="detail-label">Payment Method</span>
                              <span className="detail-value">
                                {order.payment_method || "Not set"}
                              </span>
                            </div>

                            <div className="detail-box">
                              <span className="detail-label">Address / Pickup</span>
                              <span className="detail-value">{order.address}</span>
                            </div>

                            <div className="detail-box">
                              <span className="detail-label">Notes</span>
                              <span className="detail-value">
                                {order.notes || "No special instructions."}
                              </span>
                            </div>

                            <div className="detail-box">
                              <span className="detail-label">Order ID</span>
                              <span className="detail-value">
                                {order.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>

                          <div className="action-panel">
                            <div className="action-box">
                              <label>Payment Status</label>
                              <select
                                className="select"
                                value={order.payment_status}
                                disabled={updatingOrderId === order.id}
                                onChange={(event) =>
                                  updateOrderStatus(
                                    order.id,
                                    "payment_status",
                                    event.target.value
                                  )
                                }
                              >
                                <option value="unpaid">Unpaid</option>
                                <option value="paid">Paid</option>
                              </select>
                            </div>

                            <div className="action-box">
                              <label>Order Status</label>
                              <select
                                className="select"
                                value={order.order_status}
                                disabled={updatingOrderId === order.id}
                                onChange={(event) =>
                                  updateOrderStatus(
                                    order.id,
                                    "order_status",
                                    event.target.value
                                  )
                                }
                              >
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="preparing">Preparing</option>
                                <option value="ready">Ready</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </div>

                            <div className="action-box">
                              <label>Quick Action</label>
                              <button
                                type="button"
                                disabled={updatingOrderId === order.id}
                                className="button button-teal"
                                style={{ width: "100%" }}
                                onClick={() => markPaidAndConfirmed(order)}
                              >
                                Paid + Confirmed
                              </button>
                            </div>

                            <div className="action-box">
                              <label>Details</label>
                              <button
                                type="button"
                                className="button button-soft"
                                style={{ width: "100%" }}
                                onClick={() =>
                                  setOpenOrderId(isOpen ? null : order.id)
                                }
                              >
                                {isOpen ? "Hide Items" : "View Items"}
                              </button>
                            </div>
                          </div>

                          {isOpen && (
                            <>
                              <div className="items-panel">
                                <div className="items-head">
                                  <strong>Order Items</strong>
                                  <span>
                                    {order.order_items.length} item row
                                    {order.order_items.length === 1 ? "" : "s"}
                                  </span>
                                </div>

                                {order.order_items.length === 0 ? (
                                  <div className="empty-state">
                                    No item records found.
                                  </div>
                                ) : (
                                  order.order_items.map((item) => (
                                    <div className="item-row" key={item.id}>
                                      <div>
                                        <div className="item-name">
                                          {item.meal_name}
                                        </div>
                                        <div className="item-meta">
                                          {item.quantity} x{" "}
                                          {formatPeso(Number(item.unit_price))}
                                        </div>
                                      </div>

                                      <div className="item-total">
                                        {formatPeso(Number(item.subtotal))}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>

                              <div className="proof-box">
                                <p className="proof-title">Payment Proof</p>

                                {!order.payment_proof_path ? (
                                  <p className="section-desc">
                                    No payment proof uploaded for this order.
                                  </p>
                                ) : paymentProofUrls[order.id] ? (
                                  <>
                                    <a
                                      className="button button-soft"
                                      href={paymentProofUrls[order.id]}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ marginTop: 10 }}
                                    >
                                      Open Proof in New Tab
                                    </a>

                                    <img
                                      className="proof-image"
                                      src={paymentProofUrls[order.id]}
                                      alt={`Payment proof for ${order.customer_name}`}
                                    />
                                  </>
                                ) : (
                                  <p className="section-desc">
                                    Loading payment proof...
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}