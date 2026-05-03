"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/AdminNav";
import type { User } from "@supabase/supabase-js";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  contact_number: string | null;
};

type Order = {
  id: string;
  customer_name: string;
  contact_number: string;
  total: number;
  payment_status: string;
  order_status: string;
  created_at: string;
};

type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_role: string;
  message: string;
  attachment_path: string | null;
  attachment_name: string | null;
  created_at: string;
};

type SupportTicket = {
  id: string;
  user_id: string;
  related_order_id: string | null;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  profile: Profile | null;
  related_order: Order | null;
  support_messages: SupportMessage[];
};

export default function AdminSupportPage() {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyTextByTicket, setReplyTextByTicket] = useState<
    Record<string, string>
  >({});
  const [replyAttachmentByTicket, setReplyAttachmentByTicket] = useState<
    Record<string, File | null>
  >({});
  const [replyAttachmentKeys, setReplyAttachmentKeys] = useState<
    Record<string, number>
  >({});

  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadSupportData();

    const interval = setInterval(() => {
      loadSupportData(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function loadSupportData(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setAdminUser(user);

    const { data: ticketData, error: ticketError } = await supabase
      .from("support_tickets")
      .select(
        `
        id,
        user_id,
        related_order_id,
        subject,
        status,
        created_at,
        updated_at,
        support_messages (
          id,
          ticket_id,
          sender_id,
          sender_role,
          message,
          attachment_path,
          attachment_name,
          created_at
        )
      `
      )
      .order("updated_at", { ascending: false });

    if (ticketError) {
      console.error("Admin support tickets error:", ticketError);
      alert(`Failed to load support tickets: ${ticketError.message}`);
      setLoading(false);
      return;
    }

    const baseTickets = (ticketData || []) as Omit<
      SupportTicket,
      "profile" | "related_order"
    >[];

    const userIds = Array.from(new Set(baseTickets.map((ticket) => ticket.user_id)));
    const orderIds = Array.from(
      new Set(
        baseTickets
          .map((ticket) => ticket.related_order_id)
          .filter(Boolean) as string[]
      )
    );

    let profiles: Profile[] = [];
    let orders: Order[] = [];

    if (userIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, contact_number")
        .in("id", userIds);

      if (profileError) {
        console.error("Admin support profiles error:", profileError);
      } else {
        profiles = (profileData || []) as Profile[];
      }
    }

    if (orderIds.length > 0) {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          "id, customer_name, contact_number, total, payment_status, order_status, created_at"
        )
        .in("id", orderIds);

      if (orderError) {
        console.error("Admin support orders error:", orderError);
      } else {
        orders = (orderData || []) as Order[];
      }
    }

    const enrichedTickets: SupportTicket[] = baseTickets.map((ticket) => ({
      ...ticket,
      profile: profiles.find((profile) => profile.id === ticket.user_id) || null,
      related_order:
        orders.find((order) => order.id === ticket.related_order_id) || null,
      support_messages: [...(ticket.support_messages || [])].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    }));

    setTickets(enrichedTickets);

    if (!selectedTicketId && enrichedTickets.length > 0) {
      const firstOpen =
        enrichedTickets.find((ticket) => ticket.status !== "closed") ||
        enrichedTickets[0];

      setSelectedTicketId(firstOpen.id);
    }

    await loadAttachmentUrls(enrichedTickets);

    setLoading(false);
  }

  async function loadAttachmentUrls(ticketList: SupportTicket[]) {
    const messagesWithAttachments = ticketList.flatMap((ticket) =>
      ticket.support_messages.filter((message) => message.attachment_path)
    );

    const entries = await Promise.all(
      messagesWithAttachments.map(async (message) => {
        const { data, error } = await supabase.storage
          .from("support-attachments")
          .createSignedUrl(message.attachment_path as string, 60 * 60);

        if (error || !data?.signedUrl) {
          console.error("Admin support attachment signed URL error:", error);
          return [message.id, ""] as const;
        }

        return [message.id, data.signedUrl] as const;
      })
    );

    const urlMap: Record<string, string> = {};

    entries.forEach(([messageId, url]) => {
      if (url) {
        urlMap[messageId] = url;
      }
    });

    setAttachmentUrls(urlMap);
  }

  async function uploadAttachment(file: File, ticketId: string, adminId: string) {
    const fileExtension = file.name.split(".").pop() || "file";
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExtension}`;

    const filePath = `admin/${adminId}/${ticketId}/${fileName}`;

    const { error } = await supabase.storage
      .from("support-attachments")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Admin support attachment upload error:", error);
      alert(`Failed to upload attachment: ${error.message}`);
      return null;
    }

    return filePath;
  }

  async function sendReply(ticket: SupportTicket) {
    if (!adminUser) {
      alert("Admin account not detected.");
      return;
    }

    if (ticket.status === "closed") {
      alert("This ticket is closed. Reopen it before replying.");
      return;
    }

    const replyText = replyTextByTicket[ticket.id] || "";
    const replyAttachment = replyAttachmentByTicket[ticket.id] || null;

    if (!replyText.trim()) {
      alert("Please type a reply.");
      return;
    }

    setReplyingTicketId(ticket.id);

    let attachmentPath: string | null = null;

    if (replyAttachment) {
      attachmentPath = await uploadAttachment(replyAttachment, ticket.id, adminUser.id);

      if (!attachmentPath) {
        setReplyingTicketId(null);
        return;
      }
    }

    const { error: messageError } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_id: adminUser.id,
        sender_role: "admin",
        message: replyText.trim(),
        attachment_path: attachmentPath,
        attachment_name: replyAttachment?.name || null,
      });

    if (messageError) {
      console.error("Admin support reply error:", messageError);
      alert(`Failed to send reply: ${messageError.message}`);
      setReplyingTicketId(null);
      return;
    }

    const { error: ticketError } = await supabase
      .from("support_tickets")
      .update({
        status: "replied",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    if (ticketError) {
      console.error("Admin support ticket update error:", ticketError);
      alert(`Reply sent, but ticket status failed: ${ticketError.message}`);
    }

    setReplyTextByTicket((current) => ({
      ...current,
      [ticket.id]: "",
    }));

    setReplyAttachmentByTicket((current) => ({
      ...current,
      [ticket.id]: null,
    }));

    setReplyAttachmentKeys((current) => ({
      ...current,
      [ticket.id]: (current[ticket.id] || 0) + 1,
    }));

    await loadSupportData(false);
    setReplyingTicketId(null);
  }

  async function updateTicketStatus(ticketId: string, status: string) {
    setUpdatingTicketId(ticketId);

    const { error } = await supabase
      .from("support_tickets")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    if (error) {
      console.error("Admin support status update error:", error);
      alert(`Failed to update ticket: ${error.message}`);
      setUpdatingTicketId(null);
      return;
    }

    setTickets((currentTickets) =>
      currentTickets.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              status,
              updated_at: new Date().toISOString(),
            }
          : ticket
      )
    );

    setUpdatingTicketId(null);
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

  function getStatusClass(status: string) {
    if (status === "closed") return "status neutral";
    if (status === "replied") return "status teal";
    return "status orange";
  }

  function getSenderClass(role: string) {
    return role === "customer" ? "message customer" : "message admin";
  }

  const summary = useMemo(() => {
    const openTickets = tickets.filter((ticket) => ticket.status === "open");
    const repliedTickets = tickets.filter((ticket) => ticket.status === "replied");
    const closedTickets = tickets.filter((ticket) => ticket.status === "closed");

    const customerMessages = tickets.reduce(
      (sum, ticket) =>
        sum +
        ticket.support_messages.filter((message) => message.sender_role === "customer")
          .length,
      0
    );

    const adminMessages = tickets.reduce(
      (sum, ticket) =>
        sum +
        ticket.support_messages.filter((message) => message.sender_role === "admin")
          .length,
      0
    );

    return {
      totalTickets: tickets.length,
      openTickets: openTickets.length,
      repliedTickets: repliedTickets.length,
      closedTickets: closedTickets.length,
      customerMessages,
      adminMessages,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === "all" ? true : ticket.status === statusFilter;

      if (!searchValue) return matchesStatus;

      const matchesSearch =
        ticket.subject.toLowerCase().includes(searchValue) ||
        ticket.status.toLowerCase().includes(searchValue) ||
        ticket.profile?.full_name?.toLowerCase().includes(searchValue) ||
        ticket.profile?.email?.toLowerCase().includes(searchValue) ||
        ticket.profile?.contact_number?.toLowerCase().includes(searchValue) ||
        ticket.related_order?.customer_name?.toLowerCase().includes(searchValue) ||
        ticket.related_order?.contact_number?.toLowerCase().includes(searchValue) ||
        ticket.support_messages.some((message) =>
          message.message.toLowerCase().includes(searchValue)
        );

      return matchesStatus && matchesSearch;
    });
  }, [tickets, search, statusFilter]);

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ||
    filteredTickets[0] ||
    null;

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
            grid-template-columns: repeat(6, 1fr);
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

          .support-layout {
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
            gap: 10px;
            margin-bottom: 14px;
          }

          .filter-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
          }

          .field,
          .select,
          .textarea {
            width: 100%;
            border: 1px solid rgba(15, 23, 42, 0.14);
            outline: none;
            border-radius: 16px;
            background: white;
            color: #0f172a;
            padding: 12px 14px;
            font-weight: 800;
          }

          .textarea {
            min-height: 120px;
            resize: vertical;
          }

          .field:focus,
          .select:focus,
          .textarea:focus {
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

          .button-soft {
            border: 1px solid rgba(15, 23, 42, 0.12);
            background: white;
            color: #0f172a;
          }

          .ticket-list {
            display: grid;
            gap: 10px;
            max-height: 720px;
            overflow-y: auto;
            padding-right: 4px;
          }

          .ticket-button {
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

          .ticket-button:hover {
            background: #f0fdfa;
            border-color: rgba(15, 118, 110, 0.22);
          }

          .ticket-button.selected {
            background: #ccfbf1;
            border-color: rgba(15, 118, 110, 0.34);
          }

          .ticket-top {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }

          .ticket-title {
            margin: 0;
            color: #0f172a;
            font-size: 17px;
            font-weight: 1000;
            letter-spacing: -0.03em;
          }

          .ticket-detail {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.45;
          }

          .status {
            display: inline-flex;
            height: fit-content;
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

          .status.neutral {
            background: #e2e8f0;
            color: #475569;
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

          .ticket-hero {
            overflow: hidden;
            border-radius: 26px;
            background:
              radial-gradient(circle at top right, rgba(20, 184, 166, 0.2), transparent 18rem),
              linear-gradient(135deg, #0f172a, #111827);
            color: white;
            padding: 22px;
          }

          .ticket-hero-top {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 16px;
            align-items: start;
          }

          .ticket-hero h2 {
            margin: 0;
            color: white;
            font-size: 34px;
            line-height: 1;
            letter-spacing: -0.06em;
            font-weight: 1000;
          }

          .ticket-hero p {
            margin: 8px 0 0;
            color: rgba(255, 255, 255, 0.68);
            font-size: 13px;
            line-height: 1.6;
            font-weight: 700;
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

          .action-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 14px;
          }

          .conversation {
            display: grid;
            gap: 12px;
            margin-top: 16px;
          }

          .message {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 22px;
            padding: 14px;
          }

          .message.customer {
            background: #fff7ed;
          }

          .message.admin {
            background: #f0fdfa;
          }

          .message-head {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            color: #0f172a;
            font-size: 13px;
            font-weight: 1000;
          }

          .message-date {
            color: #64748b;
            font-weight: 700;
          }

          .message-text {
            margin: 10px 0 0;
            color: #0f172a;
            white-space: pre-wrap;
            line-height: 1.7;
            font-weight: 700;
          }

          .attachment-link {
            display: inline-flex;
            margin-top: 12px;
            border: 1px solid rgba(15, 118, 110, 0.18);
            border-radius: 999px;
            background: white;
            color: #0f766e;
            padding: 9px 12px;
            font-size: 13px;
            font-weight: 1000;
            text-decoration: none;
          }

          .reply-box {
            margin-top: 16px;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 24px;
            background: #f8fafc;
            padding: 16px;
          }

          .form-grid {
            display: grid;
            gap: 12px;
          }

          .selected-file {
            border-radius: 16px;
            background: #dcfce7;
            color: #166534;
            padding: 11px;
            font-size: 13px;
            font-weight: 900;
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

            .support-layout {
              grid-template-columns: 1fr;
            }

            .ticket-list {
              max-height: 520px;
            }
          }

          @media (max-width: 850px) {
            .admin-page {
              padding: 14px;
            }

            .summary-grid,
            .detail-grid,
            .filter-row,
            .ticket-hero-top {
              grid-template-columns: 1fr;
            }

            .action-row .button {
              width: 100%;
            }
          }
        `}</style>

        <div className="admin-container">
          <AdminNav
            title="Support Inbox"
            description="Review customer tickets, inspect attachments, reply as admin, and manage support status."
          />

          <div className="content">
            <section className="summary-grid">
              <div className="metric-card dark">
                <p className="metric-label">Total Tickets</p>
                <p className="metric-value">{summary.totalTickets}</p>
                <p className="metric-note">All customer support requests</p>
              </div>

              <div className="metric-card orange">
                <p className="metric-label">Open</p>
                <p className="metric-value">{summary.openTickets}</p>
                <p className="metric-note">Needs admin reply or action</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Replied</p>
                <p className="metric-value">{summary.repliedTickets}</p>
                <p className="metric-note">Admin has responded</p>
              </div>

              <div className="metric-card red">
                <p className="metric-label">Closed</p>
                <p className="metric-value">{summary.closedTickets}</p>
                <p className="metric-note">Resolved conversations</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Customer Messages</p>
                <p className="metric-value">{summary.customerMessages}</p>
                <p className="metric-note">Messages sent by customers</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Admin Replies</p>
                <p className="metric-value">{summary.adminMessages}</p>
                <p className="metric-note">Messages sent by admin</p>
              </div>
            </section>

            <section className="support-layout">
              <aside className="section-card">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Ticket Queue</p>
                    <h2 className="section-title">Support Tickets</h2>
                    <p className="section-desc">
                      Search by customer, subject, order, or message content.
                    </p>
                  </div>
                </div>

                <div className="toolbar">
                  <input
                    className="field"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tickets..."
                  />

                  <div className="filter-row">
                    <select
                      className="select"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="open">Open</option>
                      <option value="replied">Replied</option>
                      <option value="closed">Closed</option>
                      <option value="all">All Tickets</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => loadSupportData()}
                      className="button button-teal"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="empty-state">Loading support tickets...</div>
                ) : filteredTickets.length === 0 ? (
                  <div className="empty-state">No support tickets found.</div>
                ) : (
                  <div className="ticket-list">
                    {filteredTickets.map((ticket) => {
                      const isSelected = selectedTicket?.id === ticket.id;
                      const latestMessage =
                        ticket.support_messages[ticket.support_messages.length - 1];

                      return (
                        <button
                          key={ticket.id}
                          type="button"
                          className={`ticket-button ${
                            isSelected ? "selected" : ""
                          }`}
                          onClick={() => setSelectedTicketId(ticket.id)}
                        >
                          <div className="ticket-top">
                            <div>
                              <p className="ticket-title">{ticket.subject}</p>
                              <p className="ticket-detail">
                                {ticket.profile?.full_name ||
                                  ticket.profile?.email ||
                                  "Customer"}
                              </p>
                              <p className="ticket-detail">
                                Latest:{" "}
                                {latestMessage
                                  ? latestMessage.message.slice(0, 80)
                                  : "No messages"}
                              </p>
                            </div>

                            <span className={getStatusClass(ticket.status)}>
                              {ticket.status}
                            </span>
                          </div>

                          <div className="tag-row">
                            <span className="tag">
                              {ticket.support_messages.length} message
                              {ticket.support_messages.length === 1 ? "" : "s"}
                            </span>

                            {ticket.related_order_id && (
                              <span className="tag">Linked Order</span>
                            )}

                            {ticket.support_messages.some(
                              (message) => message.attachment_path
                            ) && <span className="tag">Attachment</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </aside>

              <section className="section-card">
                {!selectedTicket ? (
                  <div className="empty-state">
                    Select a ticket to view the support conversation.
                  </div>
                ) : (
                  <>
                    <div className="ticket-hero">
                      <div className="ticket-hero-top">
                        <div>
                          <h2>{selectedTicket.subject}</h2>
                          <p>
                            Customer:{" "}
                            {selectedTicket.profile?.full_name ||
                              selectedTicket.profile?.email ||
                              "Unknown customer"}
                            <br />
                            Created: {formatDate(selectedTicket.created_at)}
                            <br />
                            Updated: {formatDate(selectedTicket.updated_at)}
                          </p>
                        </div>

                        <span className={getStatusClass(selectedTicket.status)}>
                          {selectedTicket.status}
                        </span>
                      </div>
                    </div>

                    <div className="detail-grid">
                      <div className="detail-box">
                        <span className="detail-label">Email</span>
                        <span className="detail-value">
                          {selectedTicket.profile?.email || "No email"}
                        </span>
                      </div>

                      <div className="detail-box">
                        <span className="detail-label">Contact</span>
                        <span className="detail-value">
                          {selectedTicket.profile?.contact_number || "No contact"}
                        </span>
                      </div>

                      <div className="detail-box">
                        <span className="detail-label">Related Order</span>
                        <span className="detail-value">
                          {selectedTicket.related_order
                            ? `${formatPeso(
                                Number(selectedTicket.related_order.total)
                              )} · ${selectedTicket.related_order.order_status}`
                            : "No linked order"}
                        </span>
                      </div>
                    </div>

                    <div className="action-row">
                      <select
                        className="select"
                        value={selectedTicket.status}
                        disabled={updatingTicketId === selectedTicket.id}
                        onChange={(event) =>
                          updateTicketStatus(selectedTicket.id, event.target.value)
                        }
                        style={{ maxWidth: 220 }}
                      >
                        <option value="open">Open</option>
                        <option value="replied">Replied</option>
                        <option value="closed">Closed</option>
                      </select>

                      <a className="button button-soft" href="/admin/orders">
                        Open Orders
                      </a>

                      <a className="button button-soft" href="/admin/customers">
                        Open CRM
                      </a>

                      <a className="button button-teal" href="/admin/live-chat">
                        Open Live Chat
                      </a>
                    </div>

                    <div className="conversation">
                      {selectedTicket.support_messages.length === 0 ? (
                        <div className="empty-state">
                          This ticket has no messages.
                        </div>
                      ) : (
                        selectedTicket.support_messages.map((message) => (
                          <div
                            key={message.id}
                            className={getSenderClass(message.sender_role)}
                          >
                            <div className="message-head">
                              <span>
                                {message.sender_role === "customer"
                                  ? "Customer"
                                  : "Admin"}
                              </span>
                              <span className="message-date">
                                {formatDate(message.created_at)}
                              </span>
                            </div>

                            <p className="message-text">{message.message}</p>

                            {message.attachment_path && (
                              <>
                                {attachmentUrls[message.id] ? (
                                  <a
                                    className="attachment-link"
                                    href={attachmentUrls[message.id]}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    View Attachment:{" "}
                                    {message.attachment_name || "File"}
                                  </a>
                                ) : (
                                  <p className="message-text">
                                    Loading attachment...
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {selectedTicket.status === "closed" ? (
                      <div className="reply-box">
                        <p className="section-desc">
                          This ticket is closed. Reopen it before replying.
                        </p>
                      </div>
                    ) : (
                      <div className="reply-box">
                        <div className="section-head">
                          <div>
                            <p className="section-kicker">Admin Reply</p>
                            <h2 className="section-title">Send Response</h2>
                            <p className="section-desc">
                              Reply to the customer and optionally attach a file.
                            </p>
                          </div>
                        </div>

                        <div className="form-grid">
                          <textarea
                            className="textarea"
                            value={replyTextByTicket[selectedTicket.id] || ""}
                            onChange={(event) =>
                              setReplyTextByTicket((current) => ({
                                ...current,
                                [selectedTicket.id]: event.target.value,
                              }))
                            }
                            placeholder="Type your admin reply..."
                          />

                          <input
                            key={replyAttachmentKeys[selectedTicket.id] || 0}
                            className="field"
                            type="file"
                            accept="image/*,.pdf,.doc,.docx"
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;

                              setReplyAttachmentByTicket((current) => ({
                                ...current,
                                [selectedTicket.id]: file,
                              }));
                            }}
                          />

                          {replyAttachmentByTicket[selectedTicket.id] && (
                            <div className="selected-file">
                              Selected:{" "}
                              {replyAttachmentByTicket[selectedTicket.id]?.name}
                            </div>
                          )}

                          <button
                            className="button button-teal"
                            type="button"
                            disabled={replyingTicketId === selectedTicket.id}
                            onClick={() => sendReply(selectedTicket)}
                          >
                            {replyingTicketId === selectedTicket.id
                              ? "Sending Reply..."
                              : "Send Admin Reply"}
                          </button>
                        </div>
                      </div>
                    )}
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