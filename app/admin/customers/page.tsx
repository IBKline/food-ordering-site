"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/AdminNav";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  contact_number: string | null;
  default_address: string | null;
  role: string | null;
  created_at: string | null;
};

type OrderItem = {
  id: string;
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
  payment_status: string;
  order_status: string;
  total: number;
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
};

type CustomerRecord = {
  key: string;
  profile: Profile | null;
  displayName: string;
  email: string | null;
  contactNumber: string;
  defaultAddress: string | null;
  totalOrders: number;
  paidOrders: number;
  unpaidOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpent: number;
  unpaidValue: number;
  lastOrderDate: string | null;
  firstOrderDate: string | null;
  orders: Order[];
};

export default function AdminCustomersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [sortBy, setSortBy] = useState("last_order");
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(
    null
  );

  useEffect(() => {
    fetchCustomersData();
  }, []);

  async function fetchCustomersData() {
    setLoading(true);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, contact_number, default_address, role, created_at"
      )
      .eq("role", "customer")
      .order("created_at", { ascending: false });

    if (profileError) {
      console.error("Customers profiles error:", profileError);
    } else {
      setProfiles((profileData || []) as Profile[]);
    }

    const { data: orderData, error: orderError } = await supabase
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
        payment_status,
        order_status,
        total,
        notes,
        created_at,
        order_items (
          id,
          meal_name,
          quantity,
          unit_price,
          subtotal
        )
      `
      )
      .order("created_at", { ascending: false });

    if (orderError) {
      console.error("Customers orders error:", orderError);
      alert(`Failed to load customer orders: ${orderError.message}`);
    } else {
      setOrders((orderData || []) as Order[]);
    }

    setLoading(false);
  }

  function formatPeso(amount: number) {
    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "No date";

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

  function normalizeText(value: string | null | undefined) {
    return (value || "").trim().toLowerCase();
  }

  function getCustomerKeyFromOrder(order: Order) {
    if (order.user_id) return `user:${order.user_id}`;

    const contact = normalizeText(order.contact_number);
    if (contact) return `guest-contact:${contact}`;

    return `guest-name:${normalizeText(order.customer_name)}`;
  }

  const customerRecords = useMemo(() => {
    const map = new Map<string, CustomerRecord>();

    profiles.forEach((profile) => {
      const key = `user:${profile.id}`;

      map.set(key, {
        key,
        profile,
        displayName: profile.full_name || profile.email || "Unnamed Customer",
        email: profile.email,
        contactNumber: profile.contact_number || "No contact",
        defaultAddress: profile.default_address,
        totalOrders: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        activeOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalSpent: 0,
        unpaidValue: 0,
        lastOrderDate: null,
        firstOrderDate: null,
        orders: [],
      });
    });

    orders.forEach((order) => {
      const key = getCustomerKeyFromOrder(order);
      const existingRecord = map.get(key);
      const matchingProfile = order.user_id
        ? profiles.find((profile) => profile.id === order.user_id) || null
        : null;

      const record =
        existingRecord ||
        ({
          key,
          profile: matchingProfile,
          displayName:
            matchingProfile?.full_name ||
            order.customer_name ||
            matchingProfile?.email ||
            "Guest Customer",
          email: matchingProfile?.email || null,
          contactNumber:
            matchingProfile?.contact_number || order.contact_number || "No contact",
          defaultAddress: matchingProfile?.default_address || order.address || null,
          totalOrders: 0,
          paidOrders: 0,
          unpaidOrders: 0,
          activeOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          totalSpent: 0,
          unpaidValue: 0,
          lastOrderDate: null,
          firstOrderDate: null,
          orders: [],
        } as CustomerRecord);

      record.totalOrders += 1;
      record.orders.push(order);

      if (order.payment_status === "paid") {
        record.paidOrders += 1;
        record.totalSpent += Number(order.total);
      } else {
        record.unpaidOrders += 1;
        record.unpaidValue += Number(order.total);
      }

      if (
        order.order_status !== "completed" &&
        order.order_status !== "cancelled"
      ) {
        record.activeOrders += 1;
      }

      if (order.order_status === "completed") {
        record.completedOrders += 1;
      }

      if (order.order_status === "cancelled") {
        record.cancelledOrders += 1;
      }

      const orderDate = new Date(order.created_at);

      if (
        !record.lastOrderDate ||
        orderDate > new Date(record.lastOrderDate)
      ) {
        record.lastOrderDate = order.created_at;
      }

      if (
        !record.firstOrderDate ||
        orderDate < new Date(record.firstOrderDate)
      ) {
        record.firstOrderDate = order.created_at;
      }

      if (!existingRecord) {
        map.set(key, record);
      }
    });

    return Array.from(map.values());
  }, [profiles, orders]);

  const summary = useMemo(() => {
    const registeredCustomers = customerRecords.filter(
      (customer) => customer.profile
    );
    const guestCustomers = customerRecords.filter((customer) => !customer.profile);
    const customersWithOrders = customerRecords.filter(
      (customer) => customer.totalOrders > 0
    );
    const customersWithActiveOrders = customerRecords.filter(
      (customer) => customer.activeOrders > 0
    );

    const totalSpent = customerRecords.reduce(
      (sum, customer) => sum + customer.totalSpent,
      0
    );

    const unpaidValue = customerRecords.reduce(
      (sum, customer) => sum + customer.unpaidValue,
      0
    );

    const topCustomer = [...customerRecords].sort(
      (a, b) => b.totalSpent - a.totalSpent
    )[0];

    return {
      totalCustomers: customerRecords.length,
      registeredCustomers: registeredCustomers.length,
      guestCustomers: guestCustomers.length,
      customersWithOrders: customersWithOrders.length,
      customersWithActiveOrders: customersWithActiveOrders.length,
      totalSpent,
      unpaidValue,
      topCustomer,
    };
  }, [customerRecords]);

  const filteredCustomers = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    let list = customerRecords.filter((customer) => {
      if (customerFilter === "registered" && !customer.profile) return false;
      if (customerFilter === "guest" && customer.profile) return false;
      if (customerFilter === "with_orders" && customer.totalOrders === 0)
        return false;
      if (customerFilter === "active" && customer.activeOrders === 0)
        return false;
      if (customerFilter === "unpaid" && customer.unpaidOrders === 0)
        return false;
      if (customerFilter === "vip" && customer.totalSpent < 1000) return false;

      if (!searchValue) return true;

      return (
        customer.displayName.toLowerCase().includes(searchValue) ||
        (customer.email || "").toLowerCase().includes(searchValue) ||
        customer.contactNumber.toLowerCase().includes(searchValue) ||
        (customer.defaultAddress || "").toLowerCase().includes(searchValue) ||
        customer.orders.some((order) =>
          order.order_items.some((item) =>
            item.meal_name.toLowerCase().includes(searchValue)
          )
        )
      );
    });

    if (sortBy === "last_order") {
      list = list.sort(
        (a, b) =>
          new Date(b.lastOrderDate || 0).getTime() -
          new Date(a.lastOrderDate || 0).getTime()
      );
    }

    if (sortBy === "total_spent") {
      list = list.sort((a, b) => b.totalSpent - a.totalSpent);
    }

    if (sortBy === "orders") {
      list = list.sort((a, b) => b.totalOrders - a.totalOrders);
    }

    if (sortBy === "name") {
      list = list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    return list;
  }, [customerRecords, search, customerFilter, sortBy]);

  const selectedCustomer =
    customerRecords.find((customer) => customer.key === selectedCustomerKey) ||
    filteredCustomers[0] ||
    null;

  useEffect(() => {
    if (!selectedCustomerKey && filteredCustomers.length > 0) {
      setSelectedCustomerKey(filteredCustomers[0].key);
    }

    if (
      selectedCustomerKey &&
      filteredCustomers.length > 0 &&
      !filteredCustomers.some((customer) => customer.key === selectedCustomerKey)
    ) {
      setSelectedCustomerKey(filteredCustomers[0].key);
    }
  }, [filteredCustomers, selectedCustomerKey]);

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
            grid-template-columns: repeat(5, 1fr);
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
            font-size: clamp(25px, 3vw, 38px);
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

          .crm-layout {
            display: grid;
            grid-template-columns: 420px 1fr;
            gap: 16px;
            align-items: start;
            margin-top: 16px;
          }

          .section-card {
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

          .toolbar {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-bottom: 14px;
          }

          .filter-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
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
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .button:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 26px rgba(15, 23, 42, 0.16);
          }

          .button-teal {
            background: linear-gradient(135deg, #0f766e, #14b8a6);
          }

          .button-orange {
            background: linear-gradient(135deg, #ea580c, #f59e0b);
          }

          .button-soft {
            border: 1px solid rgba(15, 23, 42, 0.12);
            background: white;
            color: #0f172a;
          }

          .customer-list {
            display: grid;
            gap: 10px;
            max-height: 720px;
            overflow-y: auto;
            padding-right: 4px;
          }

          .customer-button {
            width: 100%;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 20px;
            background: #f8fafc;
            color: #0f172a;
            padding: 14px;
            text-align: left;
            cursor: pointer;
            transition: 160ms ease;
          }

          .customer-button:hover {
            background: #f0fdfa;
            border-color: rgba(15, 118, 110, 0.22);
          }

          .customer-button.selected {
            background: #ccfbf1;
            border-color: rgba(15, 118, 110, 0.34);
          }

          .customer-top {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }

          .customer-name {
            margin: 0;
            color: #0f172a;
            font-size: 17px;
            font-weight: 1000;
            letter-spacing: -0.03em;
          }

          .customer-detail {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.45;
          }

          .customer-spent {
            flex-shrink: 0;
            color: #0f766e;
            font-weight: 1000;
          }

          .tag-row {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
            margin-top: 10px;
          }

          .tag {
            border-radius: 999px;
            background: white;
            color: #0f172a;
            padding: 6px 9px;
            font-size: 11px;
            font-weight: 1000;
          }

          .tag.teal {
            background: #ccfbf1;
            color: #0f766e;
          }

          .tag.orange {
            background: #ffedd5;
            color: #c2410c;
          }

          .tag.red {
            background: #ffe4e6;
            color: #be123c;
          }

          .profile-hero {
            overflow: hidden;
            border-radius: 26px;
            background:
              radial-gradient(circle at top right, rgba(20, 184, 166, 0.2), transparent 18rem),
              linear-gradient(135deg, #0f172a, #111827);
            color: white;
            padding: 22px;
          }

          .profile-hero-top {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 16px;
            align-items: start;
          }

          .avatar {
            display: grid;
            place-items: center;
            width: 72px;
            height: 72px;
            border-radius: 24px;
            background: linear-gradient(135deg, #0f766e, #14b8a6);
            font-size: 34px;
            box-shadow: 0 18px 40px rgba(20, 184, 166, 0.22);
          }

          .profile-name {
            margin: 0;
            color: white;
            font-size: 34px;
            line-height: 1;
            letter-spacing: -0.06em;
            font-weight: 1000;
          }

          .profile-meta {
            margin: 8px 0 0;
            color: rgba(255, 255, 255, 0.68);
            font-size: 13px;
            line-height: 1.6;
            font-weight: 700;
          }

          .profile-badge {
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.12);
            color: #fef3c7;
            padding: 8px 11px;
            font-size: 11px;
            font-weight: 1000;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .profile-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-top: 20px;
          }

          .profile-stat {
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.08);
            padding: 13px;
          }

          .profile-stat span {
            display: block;
            color: rgba(255, 255, 255, 0.58);
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .profile-stat strong {
            display: block;
            margin-top: 5px;
            color: white;
            font-size: 22px;
            font-weight: 1000;
          }

          .detail-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 14px;
          }

          .detail-box {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            background: #f8fafc;
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

          .actions-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 14px;
          }

          .orders-section {
            margin-top: 16px;
          }

          .orders-grid {
            display: grid;
            gap: 12px;
            margin-top: 12px;
          }

          .order-card {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 22px;
            background: #f8fafc;
            padding: 14px;
          }

          .order-top {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 12px;
          }

          .order-title {
            margin: 0;
            color: #0f172a;
            font-size: 18px;
            font-weight: 1000;
            letter-spacing: -0.03em;
          }

          .order-meta {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
            font-weight: 700;
          }

          .order-total {
            color: #0f766e;
            font-size: 20px;
            font-weight: 1000;
          }

          .status-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
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

          .items-list {
            display: grid;
            gap: 8px;
            margin-top: 12px;
          }

          .item-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            border-radius: 14px;
            background: white;
            padding: 10px;
          }

          .item-name {
            color: #0f172a;
            font-weight: 900;
          }

          .item-meta {
            margin-top: 3px;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
          }

          .item-total {
            color: #0f766e;
            font-weight: 1000;
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

          @media (max-width: 1200px) {
            .summary-grid {
              grid-template-columns: repeat(3, 1fr);
            }

            .crm-layout {
              grid-template-columns: 1fr;
            }

            .customer-list {
              max-height: 520px;
            }
          }

          @media (max-width: 850px) {
            .admin-page {
              padding: 14px;
            }

            .summary-grid,
            .profile-stats,
            .detail-grid,
            .filter-row,
            .profile-hero-top {
              grid-template-columns: 1fr;
            }

            .profile-hero-top {
              display: grid;
            }

            .actions-row .button {
              width: 100%;
            }
          }
        `}</style>

        <div className="admin-container">
          <AdminNav
            title="Customer CRM"
            description="Review registered customers, transaction history, contact details, unpaid balances, and repeat-customer behavior."
          />

          <div className="content">
            <section className="summary-grid">
              <div className="metric-card dark">
                <p className="metric-label">Total Customers</p>
                <p className="metric-value">{summary.totalCustomers}</p>
                <p className="metric-note">Registered plus historical customer records</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Registered</p>
                <p className="metric-value">{summary.registeredCustomers}</p>
                <p className="metric-note">Customers with accounts</p>
              </div>

              <div className="metric-card orange">
                <p className="metric-label">With Orders</p>
                <p className="metric-value">{summary.customersWithOrders}</p>
                <p className="metric-note">Customers with transaction history</p>
              </div>

              <div className="metric-card red">
                <p className="metric-label">Unpaid Value</p>
                <p className="metric-value">{formatPeso(summary.unpaidValue)}</p>
                <p className="metric-note">Unpaid order value across customers</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Top Customer</p>
                <p className="metric-value">
                  {summary.topCustomer
                    ? formatPeso(summary.topCustomer.totalSpent)
                    : "₱0"}
                </p>
                <p className="metric-note">
                  {summary.topCustomer?.displayName || "No customer yet"}
                </p>
              </div>
            </section>

            <section className="crm-layout">
              <aside className="section-card">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Customer Directory</p>
                    <h2 className="section-title">CRM List</h2>
                    <p className="section-desc">
                      Search by name, email, contact, address, or ordered meal.
                    </p>
                  </div>
                </div>

                <div className="toolbar">
                  <input
                    className="field"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customers..."
                  />

                  <div className="filter-row">
                    <select
                      className="select"
                      value={customerFilter}
                      onChange={(event) => setCustomerFilter(event.target.value)}
                    >
                      <option value="all">All Customers</option>
                      <option value="registered">Registered</option>
                      <option value="guest">Guest Records</option>
                      <option value="with_orders">With Orders</option>
                      <option value="active">Active Orders</option>
                      <option value="unpaid">With Unpaid Orders</option>
                      <option value="vip">VIP ₱1,000+</option>
                    </select>

                    <select
                      className="select"
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                    >
                      <option value="last_order">Latest Order</option>
                      <option value="total_spent">Highest Spent</option>
                      <option value="orders">Most Orders</option>
                      <option value="name">Name A-Z</option>
                    </select>
                  </div>

                  <button
                    className="button button-teal"
                    type="button"
                    onClick={fetchCustomersData}
                  >
                    Refresh CRM
                  </button>
                </div>

                {loading ? (
                  <div className="empty-state">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="empty-state">No customers found.</div>
                ) : (
                  <div className="customer-list">
                    {filteredCustomers.map((customer) => {
                      const isSelected = selectedCustomer?.key === customer.key;

                      return (
                        <button
                          key={customer.key}
                          type="button"
                          className={`customer-button ${
                            isSelected ? "selected" : ""
                          }`}
                          onClick={() => setSelectedCustomerKey(customer.key)}
                        >
                          <div className="customer-top">
                            <div>
                              <p className="customer-name">
                                {customer.displayName}
                              </p>
                              <p className="customer-detail">
                                {customer.email || "No email"}
                              </p>
                              <p className="customer-detail">
                                Contact: {customer.contactNumber}
                              </p>
                            </div>

                            <span className="customer-spent">
                              {formatPeso(customer.totalSpent)}
                            </span>
                          </div>

                          <div className="tag-row">
                            <span className="tag teal">
                              {customer.profile ? "Registered" : "Guest"}
                            </span>
                            <span className="tag">
                              {customer.totalOrders} orders
                            </span>
                            {customer.unpaidOrders > 0 && (
                              <span className="tag red">
                                {customer.unpaidOrders} unpaid
                              </span>
                            )}
                            {customer.activeOrders > 0 && (
                              <span className="tag orange">
                                {customer.activeOrders} active
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </aside>

              <section className="section-card">
                {!selectedCustomer ? (
                  <div className="empty-state">Select a customer to view CRM details.</div>
                ) : (
                  <>
                    <div className="profile-hero">
                      <div className="profile-hero-top">
                        <div className="avatar">👤</div>

                        <div>
                          <h2 className="profile-name">
                            {selectedCustomer.displayName}
                          </h2>
                          <p className="profile-meta">
                            {selectedCustomer.email || "No email"} · Contact:{" "}
                            {selectedCustomer.contactNumber}
                            <br />
                            First order:{" "}
                            {formatDate(selectedCustomer.firstOrderDate)}
                            <br />
                            Last order: {formatDate(selectedCustomer.lastOrderDate)}
                          </p>
                        </div>

                        <span className="profile-badge">
                          {selectedCustomer.profile ? "Registered" : "Guest Record"}
                        </span>
                      </div>

                      <div className="profile-stats">
                        <div className="profile-stat">
                          <span>Total Spent</span>
                          <strong>{formatPeso(selectedCustomer.totalSpent)}</strong>
                        </div>

                        <div className="profile-stat">
                          <span>Total Orders</span>
                          <strong>{selectedCustomer.totalOrders}</strong>
                        </div>

                        <div className="profile-stat">
                          <span>Active Orders</span>
                          <strong>{selectedCustomer.activeOrders}</strong>
                        </div>

                        <div className="profile-stat">
                          <span>Unpaid Value</span>
                          <strong>{formatPeso(selectedCustomer.unpaidValue)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="detail-grid">
                      <div className="detail-box">
                        <span className="detail-label">Default Address</span>
                        <span className="detail-value">
                          {selectedCustomer.defaultAddress || "No saved address"}
                        </span>
                      </div>

                      <div className="detail-box">
                        <span className="detail-label">Paid Orders</span>
                        <span className="detail-value">
                          {selectedCustomer.paidOrders}
                        </span>
                      </div>

                      <div className="detail-box">
                        <span className="detail-label">Unpaid Orders</span>
                        <span className="detail-value">
                          {selectedCustomer.unpaidOrders}
                        </span>
                      </div>

                      <div className="detail-box">
                        <span className="detail-label">Completed Orders</span>
                        <span className="detail-value">
                          {selectedCustomer.completedOrders}
                        </span>
                      </div>

                      <div className="detail-box">
                        <span className="detail-label">Cancelled Orders</span>
                        <span className="detail-value">
                          {selectedCustomer.cancelledOrders}
                        </span>
                      </div>

                      <div className="detail-box">
                        <span className="detail-label">Customer ID</span>
                        <span className="detail-value">
                          {selectedCustomer.profile?.id || "Guest historical record"}
                        </span>
                      </div>
                    </div>

                    <div className="actions-row">
                      <a className="button button-soft" href="/admin/orders">
                        Open Orders
                      </a>

                      <a className="button button-soft" href="/admin/support">
                        Open Support
                      </a>

                      <a className="button button-teal" href="/admin/live-chat">
                        Start / Open Live Chat
                      </a>
                    </div>

                    <div className="orders-section">
                      <div className="section-head">
                        <div>
                          <p className="section-kicker">Transaction History</p>
                          <h2 className="section-title">Customer Orders</h2>
                          <p className="section-desc">
                            Full order history connected to this customer record.
                          </p>
                        </div>
                      </div>

                      {selectedCustomer.orders.length === 0 ? (
                        <div className="empty-state">
                          This customer has no order history yet.
                        </div>
                      ) : (
                        <div className="orders-grid">
                          {selectedCustomer.orders.map((order) => (
                            <article className="order-card" key={order.id}>
                              <div className="order-top">
                                <div>
                                  <p className="order-title">
                                    Order from {formatDate(order.created_at)}
                                  </p>
                                  <p className="order-meta">
                                    {order.delivery_method} ·{" "}
                                    {formatSchedule(
                                      order.preferred_date,
                                      order.preferred_time
                                    )}
                                    <br />
                                    Address: {order.address}
                                  </p>
                                </div>

                                <span className="order-total">
                                  {formatPeso(Number(order.total))}
                                </span>
                              </div>

                              <div className="status-row">
                                <span className={getPaymentClass(order.payment_status)}>
                                  Payment: {order.payment_status}
                                </span>
                                <span className={getOrderClass(order.order_status)}>
                                  Order: {order.order_status}
                                </span>
                              </div>

                              {order.notes && (
                                <p className="order-meta">Notes: {order.notes}</p>
                              )}

                              <div className="items-list">
                                {order.order_items.length === 0 ? (
                                  <div className="item-row">
                                    <div>
                                      <div className="item-name">No items found</div>
                                      <div className="item-meta">
                                        This order has no saved item rows.
                                      </div>
                                    </div>
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
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            </section>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}