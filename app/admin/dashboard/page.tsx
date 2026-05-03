"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/AdminNav";

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
  payment_status: string;
  order_status: string;
  total: number;
  created_at: string;
  preferred_date: string | null;
  preferred_time: string | null;
  order_items: OrderItem[];
};

type SupportTicket = {
  id: string;
  status: string;
};

type LiveChatMessage = {
  id: string;
  sender_role: string;
  read_by_admin: boolean;
};

type MonthlySales = {
  month: string;
  monthIndex: number;
  sales: number;
  paidOrders: number;
};

type FoodSales = {
  mealName: string;
  quantity: number;
  sales: number;
  orderCount: number;
};

type CustomerSummary = {
  customerKey: string;
  customerName: string;
  contactNumber: string;
  totalOrders: number;
  paidOrders: number;
  unpaidOrders: number;
  activeOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  orders: Order[];
};

type DailyRecord = {
  dateKey: string;
  day: number;
  dayName: string;
  fullDateLabel: string;
  sales: number;
  paidOrders: number;
  items: FoodSales[];
  orders: Order[];
};

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [liveChatMessages, setLiveChatMessages] = useState<LiveChatMessage[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(
    null
  );
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const [customerSearch, setCustomerSearch] = useState("");
  const [foodSearch, setFoodSearch] = useState("");

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        user_id,
        customer_name,
        contact_number,
        payment_status,
        order_status,
        total,
        created_at,
        preferred_date,
        preferred_time,
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
      console.error("Dashboard orders error:", orderError);
      alert(`Failed to load dashboard orders: ${orderError.message}`);
    } else {
      const loadedOrders = (orderData || []) as Order[];
      setOrders(loadedOrders);

      const years = getAvailableYears(loadedOrders);
      const currentYear = new Date().getFullYear();

      if (years.includes(currentYear)) {
        setSelectedYear(currentYear);
      } else if (years.length > 0) {
        setSelectedYear(years[0]);
      }
    }

    const { data: supportData, error: supportError } = await supabase
      .from("support_tickets")
      .select("id, status");

    if (supportError) {
      console.error("Dashboard support error:", supportError);
    } else {
      setSupportTickets((supportData || []) as SupportTicket[]);
    }

    const { data: chatData, error: chatError } = await supabase
      .from("live_chat_messages")
      .select("id, sender_role, read_by_admin")
      .eq("sender_role", "customer")
      .eq("read_by_admin", false);

    if (chatError) {
      console.error("Dashboard live chat error:", chatError);
    } else {
      setLiveChatMessages((chatData || []) as LiveChatMessage[]);
    }

    setLoading(false);
  }

  function getAvailableYears(orderList: Order[]) {
    const years = orderList.map((order) =>
      new Date(order.created_at).getFullYear()
    );

    return Array.from(new Set(years)).sort((a, b) => b - a);
  }

  function isSameDay(dateA: Date, dateB: Date) {
    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate()
    );
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

  function getDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getFullDateLabel(date: Date) {
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function getDayName(date: Date) {
    return date.toLocaleDateString("en-PH", {
      weekday: "long",
    });
  }

  function getPaymentClass(status: string) {
    return status === "paid" ? "status success" : "status danger";
  }

  function getOrderClass(status: string) {
    if (status === "completed") return "status success";
    if (status === "cancelled") return "status danger";
    return "status info";
  }

  const availableYears = useMemo(() => getAvailableYears(orders), [orders]);

  const report = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const paidOrders = orders.filter((order) => order.payment_status === "paid");
    const unpaidOrders = orders.filter(
      (order) => order.payment_status !== "paid"
    );
    const pendingOrders = orders.filter(
      (order) =>
        order.order_status !== "completed" &&
        order.order_status !== "cancelled"
    );

    const selectedYearOrders = orders.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate.getFullYear() === selectedYear;
    });

    const selectedYearPaidOrders = paidOrders.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate.getFullYear() === selectedYear;
    });

    const todayPaidOrders = paidOrders.filter((order) =>
      isSameDay(new Date(order.created_at), now)
    );

    const currentMonthPaidOrders = paidOrders.filter((order) => {
      const orderDate = new Date(order.created_at);

      return (
        orderDate.getMonth() === currentMonth &&
        orderDate.getFullYear() === currentYear
      );
    });

    const todaySales = todayPaidOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );

    const currentMonthSales = currentMonthPaidOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );

    const selectedYearSales = selectedYearPaidOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );

    const monthlySales: MonthlySales[] = monthNames.map((monthName, index) => {
      const matchingOrders = selectedYearPaidOrders.filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate.getMonth() === index;
      });

      return {
        month: monthName,
        monthIndex: index,
        sales: matchingOrders.reduce(
          (sum, order) => sum + Number(order.total),
          0
        ),
        paidOrders: matchingOrders.length,
      };
    });

    const bestMonth = monthlySales.reduce(
      (best, current) => (current.sales > best.sales ? current : best),
      monthlySales[0]
    );

    const foodMap = new Map<string, FoodSales>();

    selectedYearPaidOrders.forEach((order) => {
      const uniqueMealsInOrder = new Set<string>();

      order.order_items.forEach((item) => {
        const existingFood = foodMap.get(item.meal_name);

        if (existingFood) {
          existingFood.quantity += Number(item.quantity);
          existingFood.sales += Number(item.subtotal);

          if (!uniqueMealsInOrder.has(item.meal_name)) {
            existingFood.orderCount += 1;
          }
        } else {
          foodMap.set(item.meal_name, {
            mealName: item.meal_name,
            quantity: Number(item.quantity),
            sales: Number(item.subtotal),
            orderCount: 1,
          });
        }

        uniqueMealsInOrder.add(item.meal_name);
      });
    });

    const mostOrderedFoods = Array.from(foodMap.values()).sort(
      (a, b) => b.quantity - a.quantity
    );

    const maxFoodQuantity =
      mostOrderedFoods.length > 0
        ? Math.max(...mostOrderedFoods.map((food) => food.quantity))
        : 0;

    const registeredOrders = selectedYearOrders.filter((order) => order.user_id);
    const guestOrders = selectedYearOrders.filter((order) => !order.user_id);

    return {
      paidOrders,
      selectedYearOrders,
      selectedYearPaidOrders,
      todaySales,
      currentMonthSales,
      selectedYearSales,
      todayPaidOrdersCount: todayPaidOrders.length,
      currentMonthPaidOrdersCount: currentMonthPaidOrders.length,
      selectedYearPaidOrdersCount: selectedYearPaidOrders.length,
      unpaidOrdersCount: unpaidOrders.length,
      pendingOrdersCount: pendingOrders.length,
      monthlySales,
      bestMonth,
      averageMonthlySales: selectedYearSales / 12,
      mostOrderedFoods,
      maxFoodQuantity,
      registeredOrdersCount: registeredOrders.length,
      guestOrdersCount: guestOrders.length,
    };
  }, [orders, selectedYear]);

  const operationalSummary = useMemo(() => {
    const openSupport = supportTickets.filter(
      (ticket) => ticket.status !== "closed"
    ).length;

    const repliedSupport = supportTickets.filter(
      (ticket) => ticket.status === "replied"
    ).length;

    return {
      openSupport,
      repliedSupport,
      unreadChat: liveChatMessages.length,
    };
  }, [supportTickets, liveChatMessages]);

  const filteredFoods = useMemo(() => {
    const search = foodSearch.trim().toLowerCase();

    if (!search) return report.mostOrderedFoods;

    return report.mostOrderedFoods.filter((food) =>
      food.mealName.toLowerCase().includes(search)
    );
  }, [foodSearch, report.mostOrderedFoods]);

  const dailyRecords = useMemo(() => {
    if (selectedMonthIndex === null) return [];

    const selectedMonthPaidOrders = report.selectedYearPaidOrders.filter(
      (order) => {
        const orderDate = new Date(order.created_at);
        return orderDate.getMonth() === selectedMonthIndex;
      }
    );

    const daysInMonth = new Date(
      selectedYear,
      selectedMonthIndex + 1,
      0
    ).getDate();

    const records: DailyRecord[] = Array.from(
      { length: daysInMonth },
      (_value, index) => {
        const day = index + 1;
        const date = new Date(selectedYear, selectedMonthIndex, day);
        const dateKey = getDateKey(date);

        return {
          dateKey,
          day,
          dayName: getDayName(date),
          fullDateLabel: getFullDateLabel(date),
          sales: 0,
          paidOrders: 0,
          items: [],
          orders: [],
        };
      }
    );

    selectedMonthPaidOrders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const day = orderDate.getDate();
      const record = records[day - 1];

      record.sales += Number(order.total);
      record.paidOrders += 1;
      record.orders.push(order);

      const dailyFoodMap = new Map<string, FoodSales>();

      record.items.forEach((item) => {
        dailyFoodMap.set(item.mealName, item);
      });

      order.order_items.forEach((item) => {
        const existingFood = dailyFoodMap.get(item.meal_name);

        if (existingFood) {
          existingFood.quantity += Number(item.quantity);
          existingFood.sales += Number(item.subtotal);
          existingFood.orderCount += 1;
        } else {
          dailyFoodMap.set(item.meal_name, {
            mealName: item.meal_name,
            quantity: Number(item.quantity),
            sales: Number(item.subtotal),
            orderCount: 1,
          });
        }
      });

      record.items = Array.from(dailyFoodMap.values()).sort(
        (a, b) => b.quantity - a.quantity
      );
    });

    return records;
  }, [report.selectedYearPaidOrders, selectedMonthIndex, selectedYear]);

  const selectedMonthSummary = useMemo(() => {
    if (selectedMonthIndex === null) return null;

    const totalSales = dailyRecords.reduce((sum, day) => sum + day.sales, 0);
    const totalPaidOrders = dailyRecords.reduce(
      (sum, day) => sum + day.paidOrders,
      0
    );
    const activeDays = dailyRecords.filter((day) => day.paidOrders > 0).length;

    return {
      monthName: monthNames[selectedMonthIndex],
      totalSales,
      totalPaidOrders,
      activeDays,
      averageDailySales: activeDays > 0 ? totalSales / activeDays : 0,
    };
  }, [dailyRecords, selectedMonthIndex]);

  const customerSummaries = useMemo(() => {
    const customerMap = new Map<string, CustomerSummary>();

    orders.forEach((order) => {
      const normalizedContact = order.contact_number.trim().toLowerCase();
      const normalizedName = order.customer_name.trim().toLowerCase();
      const customerKey = normalizedContact || normalizedName;

      const existingCustomer = customerMap.get(customerKey);

      if (existingCustomer) {
        existingCustomer.totalOrders += 1;
        existingCustomer.orders.push(order);

        if (order.payment_status === "paid") {
          existingCustomer.paidOrders += 1;
          existingCustomer.totalSpent += Number(order.total);
        } else {
          existingCustomer.unpaidOrders += 1;
        }

        if (
          order.order_status !== "completed" &&
          order.order_status !== "cancelled"
        ) {
          existingCustomer.activeOrders += 1;
        }

        const currentLastOrder = new Date(existingCustomer.lastOrderDate);
        const newOrderDate = new Date(order.created_at);

        if (newOrderDate > currentLastOrder) {
          existingCustomer.lastOrderDate = order.created_at;
        }
      } else {
        customerMap.set(customerKey, {
          customerKey,
          customerName: order.customer_name,
          contactNumber: order.contact_number,
          totalOrders: 1,
          paidOrders: order.payment_status === "paid" ? 1 : 0,
          unpaidOrders: order.payment_status === "paid" ? 0 : 1,
          activeOrders:
            order.order_status !== "completed" &&
            order.order_status !== "cancelled"
              ? 1
              : 0,
          totalSpent: order.payment_status === "paid" ? Number(order.total) : 0,
          lastOrderDate: order.created_at,
          orders: [order],
        });
      }
    });

    const summaries = Array.from(customerMap.values()).sort(
      (a, b) =>
        new Date(b.lastOrderDate).getTime() -
        new Date(a.lastOrderDate).getTime()
    );

    const search = customerSearch.trim().toLowerCase();

    if (!search) return summaries.slice(0, 10);

    return summaries.filter(
      (customer) =>
        customer.customerName.toLowerCase().includes(search) ||
        customer.contactNumber.toLowerCase().includes(search)
    );
  }, [orders, customerSearch]);

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
              linear-gradient(180deg, #0f172a 0%, #111827 46%, #f8fafc 46%, #f8fafc 100%);
            padding: 22px;
          }

          .admin-container {
            width: min(1380px, 100%);
            margin: 0 auto;
          }

          .dashboard-content {
            margin-top: 22px;
          }

          .toolbar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            margin-bottom: 18px;
          }

          .toolbar-title {
            margin: 0;
            color: white;
            font-size: 24px;
            letter-spacing: -0.04em;
            font-weight: 1000;
          }

          .toolbar-subtitle {
            margin: 5px 0 0;
            color: rgba(255, 255, 255, 0.64);
            font-size: 14px;
            font-weight: 650;
          }

          .toolbar-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }

          .select,
          .field {
            border: 1px solid rgba(15, 23, 42, 0.14);
            outline: none;
            border-radius: 16px;
            background: white;
            color: #0f172a;
            padding: 12px 14px;
            font-weight: 800;
          }

          .dark-select {
            border-color: rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }

          .dark-select option {
            color: #0f172a;
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

          .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
          }

          .metric-card {
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 24px;
            background: white;
            padding: 18px;
            color: #0f172a;
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
            font-size: clamp(26px, 3vw, 38px);
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

          .quick-panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-top: 14px;
          }

          .section-card {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 28px;
            background: white;
            color: #0f172a;
            padding: 20px;
            box-shadow: 0 18px 46px rgba(15, 23, 42, 0.07);
          }

          .section-card.full {
            margin-top: 14px;
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
            font-size: 26px;
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

          .attention-list {
            display: grid;
            gap: 10px;
          }

          .attention-item {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 12px;
            align-items: center;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            background: #f8fafc;
            padding: 13px;
          }

          .attention-icon {
            display: grid;
            place-items: center;
            width: 42px;
            height: 42px;
            border-radius: 16px;
            background: #ccfbf1;
            font-size: 20px;
          }

          .attention-title {
            margin: 0;
            color: #0f172a;
            font-weight: 1000;
          }

          .attention-sub {
            margin: 3px 0 0;
            color: #64748b;
            font-size: 13px;
            font-weight: 700;
          }

          .attention-count {
            border-radius: 999px;
            background: #0f172a;
            color: white;
            padding: 8px 11px;
            font-size: 13px;
            font-weight: 1000;
          }

          .table-wrap {
            overflow-x: auto;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 22px;
          }

          .data-table {
            width: 100%;
            min-width: 760px;
            border-collapse: collapse;
            text-align: left;
          }

          .data-table th {
            background: #f8fafc;
            color: #475569;
            padding: 13px;
            font-size: 12px;
            font-weight: 1000;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }

          .data-table td {
            border-top: 1px solid rgba(15, 23, 42, 0.08);
            padding: 13px;
            color: #0f172a;
            font-weight: 750;
          }

          .data-table tr.clickable {
            cursor: pointer;
          }

          .data-table tr.clickable:hover {
            background: #f0fdfa;
          }

          .selected-row {
            background: #ccfbf1;
          }

          .progress {
            width: 140px;
            height: 10px;
            overflow: hidden;
            border-radius: 999px;
            background: #e2e8f0;
          }

          .progress-fill {
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(135deg, #0f766e, #14b8a6);
          }

          .daily-panel {
            background: #f8fafc;
            padding: 16px;
          }

          .daily-summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }

          .mini-card {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            background: white;
            padding: 14px;
          }

          .mini-label {
            margin: 0;
            color: #64748b;
            font-size: 11px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }

          .mini-value {
            margin: 6px 0 0;
            color: #0f172a;
            font-size: 22px;
            font-weight: 1000;
            letter-spacing: -0.04em;
          }

          .days-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
          }

          .day-card {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            background: white;
            padding: 14px;
          }

          .day-card.active {
            border-color: rgba(15, 118, 110, 0.32);
            background: #f0fdfa;
          }

          .day-top {
            display: flex;
            justify-content: space-between;
            gap: 10px;
          }

          .day-title {
            margin: 0;
            color: #0f172a;
            font-size: 18px;
            font-weight: 1000;
          }

          .day-date {
            margin: 3px 0 0;
            color: #334155;
            font-size: 13px;
            font-weight: 850;
          }

          .day-sales {
            margin: 8px 0 0;
            color: #0f766e;
            font-size: 20px;
            font-weight: 1000;
          }

          .day-button {
            margin-top: 10px;
            width: 100%;
            border: 0;
            border-radius: 14px;
            background: #0f172a;
            color: white;
            padding: 9px;
            font-size: 13px;
            font-weight: 950;
            cursor: pointer;
          }

          .order-list {
            display: grid;
            gap: 10px;
            margin-top: 12px;
          }

          .order-mini {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 16px;
            background: white;
            padding: 12px;
          }

          .order-mini-name {
            margin: 0;
            color: #0f172a;
            font-weight: 1000;
          }

          .order-mini-text {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
            font-weight: 700;
          }

          .food-list {
            display: grid;
            gap: 10px;
          }

          .food-card {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            background: #f8fafc;
            padding: 13px;
          }

          .food-top {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }

          .food-name {
            margin: 0;
            color: #0f172a;
            font-weight: 1000;
          }

          .food-meta {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 13px;
            font-weight: 700;
          }

          .status {
            display: inline-flex;
            border-radius: 999px;
            padding: 6px 9px;
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
            background: #ccfbf1;
            color: #0f766e;
          }

          .customer-list {
            display: grid;
            gap: 12px;
          }

          .customer-card {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 20px;
            background: #f8fafc;
            padding: 14px;
          }

          .customer-top {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 12px;
          }

          .customer-name {
            margin: 0;
            color: #0f172a;
            font-size: 18px;
            font-weight: 1000;
          }

          .customer-detail {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 13px;
            font-weight: 700;
          }

          .customer-stats {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
          }

          .customer-stat {
            border-radius: 999px;
            background: white;
            color: #0f172a;
            padding: 7px 10px;
            font-size: 12px;
            font-weight: 950;
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
            .dashboard-grid {
              grid-template-columns: repeat(2, 1fr);
            }

            .quick-panel {
              grid-template-columns: 1fr;
            }

            .days-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 760px) {
            .admin-page {
              padding: 14px;
            }

            .dashboard-grid,
            .daily-summary,
            .days-grid {
              grid-template-columns: 1fr;
            }

            .toolbar {
              align-items: flex-start;
              flex-direction: column;
            }

            .toolbar-actions {
              width: 100%;
            }

            .select,
            .field,
            .button {
              width: 100%;
            }
          }
        `}</style>

        <div className="admin-container">
          <AdminNav
            title="Sales Dashboard"
            description="Monitor daily sales, monthly reports, customer activity, top meals, and urgent back-office items."
          />

          <div className="dashboard-content">
            <div className="toolbar">
              <div>
                <h2 className="toolbar-title">Command Overview</h2>
                <p className="toolbar-subtitle">
                  Years are detected automatically from order records.
                </p>
              </div>

              <div className="toolbar-actions">
                <select
                  className="select dark-select"
                  value={selectedYear}
                  onChange={(event) => {
                    setSelectedYear(Number(event.target.value));
                    setSelectedMonthIndex(null);
                    setSelectedDayKey(null);
                  }}
                >
                  {availableYears.length === 0 ? (
                    <option value={new Date().getFullYear()}>
                      {new Date().getFullYear()}
                    </option>
                  ) : (
                    availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))
                  )}
                </select>

                <button
                  type="button"
                  onClick={fetchDashboardData}
                  className="button button-teal"
                >
                  Refresh Dashboard
                </button>
              </div>
            </div>

            {loading ? (
              <div className="empty-state">Loading dashboard...</div>
            ) : (
              <>
                <section className="dashboard-grid">
                  <div className="metric-card dark">
                    <p className="metric-label">Today&apos;s Paid Sales</p>
                    <p className="metric-value">{formatPeso(report.todaySales)}</p>
                    <p className="metric-note">
                      {report.todayPaidOrdersCount} paid orders today
                    </p>
                  </div>

                  <div className="metric-card dark">
                    <p className="metric-label">Current Month Sales</p>
                    <p className="metric-value">
                      {formatPeso(report.currentMonthSales)}
                    </p>
                    <p className="metric-note">
                      {report.currentMonthPaidOrdersCount} paid orders this month
                    </p>
                  </div>

                  <div className="metric-card orange">
                    <p className="metric-label">{selectedYear} Paid Sales</p>
                    <p className="metric-value">
                      {formatPeso(report.selectedYearSales)}
                    </p>
                    <p className="metric-note">
                      {report.selectedYearPaidOrdersCount} paid orders for
                      selected year
                    </p>
                  </div>

                  <div className="metric-card red">
                    <p className="metric-label">Needs Attention</p>
                    <p className="metric-value">
                      {report.pendingOrdersCount + report.unpaidOrdersCount}
                    </p>
                    <p className="metric-note">
                      Pending/active orders plus unpaid orders
                    </p>
                  </div>
                </section>

                <section className="dashboard-grid" style={{ marginTop: 14 }}>
                  <div className="metric-card">
                    <p className="metric-label">Pending / Active Orders</p>
                    <p className="metric-value">{report.pendingOrdersCount}</p>
                    <p className="metric-note">Not completed or cancelled</p>
                  </div>

                  <div className="metric-card">
                    <p className="metric-label">Unpaid Orders</p>
                    <p className="metric-value">{report.unpaidOrdersCount}</p>
                    <p className="metric-note">Not counted as paid sales yet</p>
                  </div>

                  <div className="metric-card">
                    <p className="metric-label">Best Month</p>
                    <p className="metric-value">{report.bestMonth.month}</p>
                    <p className="metric-note">
                      {formatPeso(report.bestMonth.sales)} from{" "}
                      {report.bestMonth.paidOrders} paid orders
                    </p>
                  </div>

                  <div className="metric-card">
                    <p className="metric-label">Average Monthly Sales</p>
                    <p className="metric-value">
                      {formatPeso(report.averageMonthlySales)}
                    </p>
                    <p className="metric-note">Based on selected year</p>
                  </div>
                </section>

                <section className="quick-panel">
                  <div className="section-card">
                    <div className="section-head">
                      <div>
                        <p className="section-kicker">Operations</p>
                        <h2 className="section-title">Attention Center</h2>
                        <p className="section-desc">
                          Quick view of areas that need admin action.
                        </p>
                      </div>
                    </div>

                    <div className="attention-list">
                      <div className="attention-item">
                        <div className="attention-icon">📦</div>
                        <div>
                          <p className="attention-title">Orders Queue</p>
                          <p className="attention-sub">
                            Active or unpaid orders need checking.
                          </p>
                        </div>
                        <span className="attention-count">
                          {report.pendingOrdersCount + report.unpaidOrdersCount}
                        </span>
                      </div>

                      <div className="attention-item">
                        <div className="attention-icon">🎧</div>
                        <div>
                          <p className="attention-title">Support Tickets</p>
                          <p className="attention-sub">
                            Open or replied tickets not yet closed.
                          </p>
                        </div>
                        <span className="attention-count">
                          {operationalSummary.openSupport}
                        </span>
                      </div>

                      <div className="attention-item">
                        <div className="attention-icon">💬</div>
                        <div>
                          <p className="attention-title">Live Chat</p>
                          <p className="attention-sub">
                            Customer messages unread by admin.
                          </p>
                        </div>
                        <span className="attention-count">
                          {operationalSummary.unreadChat}
                        </span>
                      </div>
                    </div>

                    <div className="toolbar-actions" style={{ marginTop: 14 }}>
                      <a className="button button-teal" href="/admin/orders">
                        Open Orders
                      </a>
                      <a className="button button-soft" href="/admin/support">
                        Open Support
                      </a>
                      <a className="button button-soft" href="/admin/live-chat">
                        Open Chat
                      </a>
                    </div>
                  </div>

                  <div className="section-card">
                    <div className="section-head">
                      <div>
                        <p className="section-kicker">Customers</p>
                        <h2 className="section-title">CRM Snapshot</h2>
                        <p className="section-desc">
                          Search customers by name or contact number.
                        </p>
                      </div>

                      <input
                        className="field"
                        value={customerSearch}
                        onChange={(event) => setCustomerSearch(event.target.value)}
                        placeholder="Search customer..."
                      />
                    </div>

                    <div className="customer-list">
                      {customerSummaries.length === 0 ? (
                        <div className="empty-state">No customer records found.</div>
                      ) : (
                        customerSummaries.map((customer) => (
                          <div
                            key={customer.customerKey}
                            className="customer-card"
                          >
                            <div className="customer-top">
                              <div>
                                <p className="customer-name">
                                  {customer.customerName}
                                </p>
                                <p className="customer-detail">
                                  Contact: {customer.contactNumber}
                                </p>
                                <p className="customer-detail">
                                  Last order: {formatDate(customer.lastOrderDate)}
                                </p>
                              </div>

                              <strong>{formatPeso(customer.totalSpent)}</strong>
                            </div>

                            <div className="customer-stats">
                              <span className="customer-stat">
                                Orders: {customer.totalOrders}
                              </span>
                              <span className="customer-stat">
                                Paid: {customer.paidOrders}
                              </span>
                              <span className="customer-stat">
                                Unpaid: {customer.unpaidOrders}
                              </span>
                              <span className="customer-stat">
                                Active: {customer.activeOrders}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <section className="section-card full">
                  <div className="section-head">
                    <div>
                      <p className="section-kicker">Annual Report</p>
                      <h2 className="section-title">
                        Monthly Sales for {selectedYear}
                      </h2>
                      <p className="section-desc">
                        Click a month to open actual daily records with date and
                        weekday.
                      </p>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Paid Orders</th>
                          <th>Paid Sales</th>
                          <th>Year Share</th>
                        </tr>
                      </thead>

                      <tbody>
                        {report.monthlySales.map((month) => {
                          const percentage =
                            report.selectedYearSales > 0
                              ? Math.round(
                                  (month.sales / report.selectedYearSales) * 100
                                )
                              : 0;

                          const isSelected =
                            selectedMonthIndex === month.monthIndex;

                          return (
                            <Fragment key={month.month}>
                              <tr
                                className={`clickable ${
                                  isSelected ? "selected-row" : ""
                                }`}
                                onClick={() => {
                                  setSelectedMonthIndex(
                                    isSelected ? null : month.monthIndex
                                  );
                                  setSelectedDayKey(null);
                                }}
                              >
                                <td>
                                  <strong>{month.month}</strong>
                                  {isSelected ? " · Open" : ""}
                                </td>
                                <td>{month.paidOrders}</td>
                                <td>
                                  <strong>{formatPeso(month.sales)}</strong>
                                </td>
                                <td>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 10,
                                    }}
                                  >
                                    <div className="progress">
                                      <div
                                        className="progress-fill"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                    <span>{percentage}%</span>
                                  </div>
                                </td>
                              </tr>

                              {isSelected && selectedMonthSummary && (
                                <tr>
                                  <td colSpan={4} className="daily-panel">
                                    <div className="section-head">
                                      <div>
                                        <p className="section-kicker">
                                          Daily CRM Record
                                        </p>
                                        <h2 className="section-title">
                                          {selectedMonthSummary.monthName}{" "}
                                          {selectedYear}
                                        </h2>
                                        <p className="section-desc">
                                          Every day is shown with its actual
                                          date and automatically assigned weekday.
                                        </p>
                                      </div>

                                      <button
                                        className="button button-soft"
                                        type="button"
                                        onClick={() => {
                                          setSelectedMonthIndex(null);
                                          setSelectedDayKey(null);
                                        }}
                                      >
                                        Close Month
                                      </button>
                                    </div>

                                    <div className="daily-summary">
                                      <div className="mini-card">
                                        <p className="mini-label">Monthly Sales</p>
                                        <p className="mini-value">
                                          {formatPeso(
                                            selectedMonthSummary.totalSales
                                          )}
                                        </p>
                                      </div>

                                      <div className="mini-card">
                                        <p className="mini-label">Paid Orders</p>
                                        <p className="mini-value">
                                          {selectedMonthSummary.totalPaidOrders}
                                        </p>
                                      </div>

                                      <div className="mini-card">
                                        <p className="mini-label">Active Days</p>
                                        <p className="mini-value">
                                          {selectedMonthSummary.activeDays}
                                        </p>
                                      </div>

                                      <div className="mini-card">
                                        <p className="mini-label">
                                          Avg. Active Day
                                        </p>
                                        <p className="mini-value">
                                          {formatPeso(
                                            selectedMonthSummary.averageDailySales
                                          )}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="days-grid">
                                      {dailyRecords.map((day) => {
                                        const isDayOpen =
                                          selectedDayKey === day.dateKey;

                                        return (
                                          <div
                                            key={day.dateKey}
                                            className={`day-card ${
                                              day.paidOrders > 0 ? "active" : ""
                                            }`}
                                          >
                                            <div className="day-top">
                                              <div>
                                                <p className="day-title">
                                                  {day.dayName}
                                                </p>
                                                <p className="day-date">
                                                  {day.fullDateLabel}
                                                </p>
                                                <p className="customer-detail">
                                                  {day.paidOrders} paid orders
                                                </p>
                                              </div>

                                              <span className="status info">
                                                {day.day}
                                              </span>
                                            </div>

                                            <p className="day-sales">
                                              {formatPeso(day.sales)}
                                            </p>

                                            {day.items.length > 0 && (
                                              <div className="order-list">
                                                {day.items
                                                  .slice(0, 3)
                                                  .map((item) => (
                                                    <div
                                                      key={item.mealName}
                                                      className="order-mini"
                                                    >
                                                      <p className="order-mini-name">
                                                        {item.mealName}
                                                      </p>
                                                      <p className="order-mini-text">
                                                        {item.quantity} sold ·{" "}
                                                        {formatPeso(item.sales)}
                                                      </p>
                                                    </div>
                                                  ))}
                                              </div>
                                            )}

                                            <button
                                              type="button"
                                              className="day-button"
                                              onClick={() =>
                                                setSelectedDayKey(
                                                  isDayOpen ? null : day.dateKey
                                                )
                                              }
                                            >
                                              {isDayOpen
                                                ? "Hide Records"
                                                : "View Records"}
                                            </button>

                                            {isDayOpen && (
                                              <div className="order-list">
                                                {day.orders.length === 0 ? (
                                                  <div className="empty-state">
                                                    No paid orders for this date.
                                                  </div>
                                                ) : (
                                                  day.orders.map((order) => (
                                                    <div
                                                      key={order.id}
                                                      className="order-mini"
                                                    >
                                                      <p className="order-mini-name">
                                                        {order.customer_name}
                                                      </p>
                                                      <p className="order-mini-text">
                                                        Contact:{" "}
                                                        {order.contact_number}
                                                        <br />
                                                        Ordered:{" "}
                                                        {formatDate(
                                                          order.created_at
                                                        )}
                                                        <br />
                                                        Schedule:{" "}
                                                        {order.preferred_date ||
                                                          "No date"}{" "}
                                                        at{" "}
                                                        {order.preferred_time ||
                                                          "No time"}
                                                      </p>

                                                      <div
                                                        style={{
                                                          display: "flex",
                                                          gap: 8,
                                                          flexWrap: "wrap",
                                                          marginTop: 8,
                                                        }}
                                                      >
                                                        <span
                                                          className={getPaymentClass(
                                                            order.payment_status
                                                          )}
                                                        >
                                                          {order.payment_status}
                                                        </span>
                                                        <span
                                                          className={getOrderClass(
                                                            order.order_status
                                                          )}
                                                        >
                                                          {order.order_status}
                                                        </span>
                                                      </div>

                                                      <p className="day-sales">
                                                        {formatPeso(
                                                          Number(order.total)
                                                        )}
                                                      </p>
                                                    </div>
                                                  ))
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="section-card full">
                  <div className="section-head">
                    <div>
                      <p className="section-kicker">Menu Intelligence</p>
                      <h2 className="section-title">
                        Most Ordered Foods in {selectedYear}
                      </h2>
                      <p className="section-desc">
                        Search food items and view quantity sold, order count,
                        and sales.
                      </p>
                    </div>

                    <input
                      className="field"
                      value={foodSearch}
                      onChange={(event) => setFoodSearch(event.target.value)}
                      placeholder="Search food item..."
                    />
                  </div>

                  {filteredFoods.length === 0 ? (
                    <div className="empty-state">No matching food items found.</div>
                  ) : (
                    <div className="food-list">
                      {filteredFoods
                        .slice(0, foodSearch ? 50 : 12)
                        .map((food, index) => {
                          const percentage =
                            report.maxFoodQuantity > 0
                              ? Math.round(
                                  (food.quantity / report.maxFoodQuantity) * 100
                                )
                              : 0;

                          return (
                            <div key={food.mealName} className="food-card">
                              <div className="food-top">
                                <div>
                                  <p className="food-name">
                                    #{index + 1} {food.mealName}
                                  </p>
                                  <p className="food-meta">
                                    Quantity sold: {food.quantity} · Appeared in{" "}
                                    {food.orderCount} paid order
                                    {food.orderCount === 1 ? "" : "s"} · Sales:{" "}
                                    {formatPeso(food.sales)}
                                  </p>
                                </div>

                                <span className="status info">
                                  {food.quantity} sold
                                </span>
                              </div>

                              <div
                                className="progress"
                                style={{ width: "100%", marginTop: 12 }}
                              >
                                <div
                                  className="progress-fill"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}