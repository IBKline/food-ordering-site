"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Order = {
  id: string;
  total: number;
  created_at: string;
  order_status: string;
  payment_status: string;
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
  support_messages: SupportMessage[];
};

export default function AccountSupportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [relatedOrderId, setRelatedOrderId] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newAttachment, setNewAttachment] = useState<File | null>(null);
  const [newAttachmentKey, setNewAttachmentKey] = useState(0);

  const [replyMessageByTicket, setReplyMessageByTicket] = useState<Record<string, string>>({});
  const [replyAttachmentByTicket, setReplyAttachmentByTicket] = useState<Record<string, File | null>>({});
  const [replyAttachmentKeys, setReplyAttachmentKeys] = useState<Record<string, number>>({});

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id, total, created_at, order_status, payment_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (orderError) {
      console.error("Orders error:", orderError);
    } else {
      setOrders((orderData || []) as Order[]);
    }

    const { data: ticketData, error: ticketError } = await supabase
      .from("support_tickets")
      .select(`
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
      `)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (ticketError) {
      console.error("Support tickets error:", ticketError);
      alert(`Failed to load support tickets: ${ticketError.message}`);
    } else {
      const loadedTickets = (ticketData || []) as SupportTicket[];
      setTickets(loadedTickets);
      await loadAttachmentUrls(loadedTickets);
    }

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
          console.error("Support attachment signed URL error:", error);
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

  async function uploadAttachment(file: File, ticketId: string, userId: string) {
    const fileExtension = file.name.split(".").pop() || "file";
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExtension}`;

    const filePath = `${userId}/${ticketId}/${fileName}`;

    const { error } = await supabase.storage
      .from("support-attachments")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Support attachment upload error:", error);
      alert(`Failed to upload attachment: ${error.message}`);
      return null;
    }

    return filePath;
  }

  async function createTicket(event: React.FormEvent) {
    event.preventDefault();

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!subject.trim()) {
      alert("Please enter a subject.");
      return;
    }

    if (!newMessage.trim()) {
      alert("Please enter your message.");
      return;
    }

    setCreating(true);

    const ticketId = crypto.randomUUID();

    const { error: ticketError } = await supabase.from("support_tickets").insert({
      id: ticketId,
      user_id: user.id,
      related_order_id: relatedOrderId || null,
      subject: subject.trim(),
      status: "open",
      updated_at: new Date().toISOString(),
    });

    if (ticketError) {
      console.error("Create ticket error:", ticketError);
      alert(`Failed to create ticket: ${ticketError.message}`);
      setCreating(false);
      return;
    }

    let attachmentPath: string | null = null;

    if (newAttachment) {
      attachmentPath = await uploadAttachment(newAttachment, ticketId, user.id);

      if (!attachmentPath) {
        setCreating(false);
        return;
      }
    }

    const { error: messageError } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_role: "customer",
        message: newMessage.trim(),
        attachment_path: attachmentPath,
        attachment_name: newAttachment?.name || null,
      });

    if (messageError) {
      console.error("Create message error:", messageError);
      alert(`Ticket created, but message failed: ${messageError.message}`);
      setCreating(false);
      return;
    }

    setSubject("");
    setRelatedOrderId("");
    setNewMessage("");
    setNewAttachment(null);
    setNewAttachmentKey((current) => current + 1);

    await loadData();
    setCreating(false);
  }

  async function sendReply(ticket: SupportTicket) {
    if (!user) {
      alert("Please login first.");
      return;
    }

    if (ticket.status === "closed") {
      alert("This ticket is closed.");
      return;
    }

    const replyMessage = replyMessageByTicket[ticket.id] || "";
    const replyAttachment = replyAttachmentByTicket[ticket.id] || null;

    if (!replyMessage.trim()) {
      alert("Please enter your reply.");
      return;
    }

    setReplyingTicketId(ticket.id);

    let attachmentPath: string | null = null;

    if (replyAttachment) {
      attachmentPath = await uploadAttachment(replyAttachment, ticket.id, user.id);

      if (!attachmentPath) {
        setReplyingTicketId(null);
        return;
      }
    }

    const { error: messageError } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_role: "customer",
        message: replyMessage.trim(),
        attachment_path: attachmentPath,
        attachment_name: replyAttachment?.name || null,
      });

    if (messageError) {
      console.error("Reply error:", messageError);
      alert(`Failed to send reply: ${messageError.message}`);
      setReplyingTicketId(null);
      return;
    }

    await supabase
      .from("support_tickets")
      .update({
        status: "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    setReplyMessageByTicket((current) => ({
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

    await loadData();
    setReplyingTicketId(null);
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

  function getStatusClass(status: string) {
    if (status === "closed") return "badge neutral";
    if (status === "replied") return "badge info";
    return "badge success";
  }

  const orderOptions = useMemo(() => {
    return orders.map((order) => ({
      label: `${formatDate(order.created_at)} — ${formatPeso(
        Number(order.total)
      )} — ${order.order_status}`,
      value: order.id,
    }));
  }, [orders]);

  const filteredTickets = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === "all" ? true : ticket.status === statusFilter;

      if (!searchValue) return matchesStatus;

      const matchesSearch =
        ticket.subject.toLowerCase().includes(searchValue) ||
        ticket.support_messages.some((message) =>
          message.message.toLowerCase().includes(searchValue)
        );

      return matchesStatus && matchesSearch;
    });
  }, [tickets, search, statusFilter]);

  const openCount = tickets.filter((ticket) => ticket.status === "open").length;
  const repliedCount = tickets.filter((ticket) => ticket.status === "replied").length;
  const closedCount = tickets.filter((ticket) => ticket.status === "closed").length;

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
          padding: 56px 0 26px;
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
          max-width: 840px;
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

        .layout {
          display: grid;
          grid-template-columns: 0.85fr 1.15fr;
          gap: 22px;
          align-items: start;
          padding: 28px 0 60px;
        }

        .panel {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 20px 52px rgba(32, 26, 22, 0.07);
        }

        .create-panel {
          padding: 26px;
          position: sticky;
          top: 96px;
        }

        .tickets-panel {
          padding: 26px;
        }

        .section-kicker {
          margin: 0;
          color: #0f766e;
          font-size: 13px;
          font-weight: 1000;
          text-transform: uppercase;
          letter-spacing: 0.18em;
        }

        .section-title {
          margin: 6px 0 0;
          color: #18120e;
          font-size: 34px;
          letter-spacing: -0.06em;
          line-height: 1;
          font-weight: 1000;
        }

        .section-desc {
          margin: 10px 0 0;
          color: #695d52;
          font-weight: 650;
          line-height: 1.7;
        }

        .form-grid {
          display: grid;
          gap: 16px;
          margin-top: 22px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #201a16;
          font-weight: 1000;
        }

        .field,
        .select,
        .textarea {
          width: 100%;
          border: 1px solid rgba(32, 26, 22, 0.16);
          outline: none;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.92);
          color: #201a16;
          padding: 15px 16px;
          font-weight: 750;
          transition: 160ms ease;
        }

        .textarea {
          min-height: 112px;
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

        .button:disabled,
        .field:disabled,
        .textarea:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .selected-file {
          margin-top: 10px;
          border-radius: 16px;
          background: #dcfce7;
          color: #166534;
          padding: 12px;
          font-size: 13px;
          font-weight: 900;
        }

        .toolbar {
          display: grid;
          grid-template-columns: 1fr 180px auto;
          gap: 10px;
          margin-top: 20px;
        }

        .tickets-list {
          display: grid;
          gap: 16px;
          margin-top: 20px;
        }

        .ticket-card {
          overflow: hidden;
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 26px;
          background: white;
          box-shadow: 0 16px 36px rgba(32, 26, 22, 0.055);
        }

        .ticket-top {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 20px;
          background: #fffaf0;
          border-bottom: 1px solid rgba(32, 26, 22, 0.08);
        }

        .ticket-title {
          margin: 0;
          color: #18120e;
          font-size: 22px;
          letter-spacing: -0.04em;
          font-weight: 1000;
        }

        .ticket-meta {
          margin: 7px 0 0;
          color: #695d52;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.55;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          height: fit-content;
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

        .info {
          border-color: rgba(15, 118, 110, 0.2);
          background: #ccfbf1;
          color: #0f766e;
        }

        .neutral {
          border-color: rgba(32, 26, 22, 0.12);
          background: #f7f3ea;
          color: #5a4b40;
        }

        .ticket-body {
          padding: 20px;
        }

        .messages {
          display: grid;
          gap: 12px;
        }

        .message {
          border: 1px solid rgba(32, 26, 22, 0.08);
          border-radius: 20px;
          padding: 15px;
        }

        .message.customer {
          background: #fff7ed;
        }

        .message.admin {
          background: #e9fbf7;
        }

        .message-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #18120e;
          font-size: 13px;
          font-weight: 1000;
        }

        .message-date {
          color: #766a5d;
          font-weight: 700;
        }

        .message-text {
          margin: 10px 0 0;
          white-space: pre-wrap;
          color: #201a16;
          line-height: 1.65;
          font-weight: 650;
        }

        .attachment-link {
          display: inline-flex;
          margin-top: 12px;
          border: 1px solid rgba(15, 118, 110, 0.16);
          border-radius: 999px;
          background: white;
          color: #0f766e;
          padding: 9px 12px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 1000;
        }

        .reply-box {
          margin-top: 16px;
          border-radius: 22px;
          background: #fffaf0;
          padding: 16px;
        }

        .empty-card {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 30px;
          background: white;
          padding: 34px;
          text-align: center;
          box-shadow: 0 20px 52px rgba(32, 26, 22, 0.07);
        }

        .empty-emoji {
          font-size: 58px;
        }

        .empty-card h2 {
          margin: 14px 0 0;
          color: #18120e;
          font-size: 30px;
          letter-spacing: -0.05em;
          font-weight: 1000;
        }

        .empty-card p {
          margin: 10px auto 0;
          max-width: 520px;
          color: #695d52;
          line-height: 1.7;
          font-weight: 650;
        }

        @media (max-width: 980px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .create-panel {
            position: static;
          }

          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .toolbar {
            grid-template-columns: 1fr;
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

          .hero-title {
            font-size: 42px;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .ticket-top {
            flex-direction: column;
          }
        }
      `}</style>

      <nav className="nav">
        <div className="container nav-inner">
          <a href="/" className="brand">
            <div className="brand-icon">🍱</div>
            <div>
              <p className="brand-title">Kline&apos;s Daily Meals</p>
              <p className="brand-subtitle">Customer support center</p>
            </div>
          </a>

          <div className="nav-actions">
            <a className="pill-link" href="/">
              Menu
            </a>
            <a className="pill-link" href="/account/profile">
              Profile
            </a>
            <a className="pill-link" href="/account/orders">
              Orders
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
            <div className="eyebrow">🎧 Customer Support</div>
            <h1 className="hero-title">
              Need help?
              <span>Send us the details.</span>
            </h1>
            <p className="hero-text">
              Create support tickets for payment concerns, delivery updates,
              order changes, screenshots, and questions that need admin review.
            </p>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <p className="summary-label">Total Tickets</p>
              <p className="summary-value">{tickets.length}</p>
            </div>

            <div className="summary-card">
              <p className="summary-label">Open</p>
              <p className="summary-value">{openCount}</p>
            </div>

            <div className="summary-card">
              <p className="summary-label">Replied</p>
              <p className="summary-value">{repliedCount}</p>
            </div>

            <div className="summary-card">
              <p className="summary-label">Closed</p>
              <p className="summary-value">{closedCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container">
        {loading ? (
          <div className="empty-card">
            <div className="empty-emoji">⏳</div>
            <h2>Loading support...</h2>
            <p>Please wait while we load your support tickets.</p>
          </div>
        ) : !user ? (
          <div className="empty-card">
            <div className="empty-emoji">🔐</div>
            <h2>Login required</h2>
            <p>
              Please login to create support tickets and view admin replies.
            </p>

            <div style={{ marginTop: 18 }}>
              <a className="button button-orange" href="/login">
                Login / Create Account
              </a>
            </div>
          </div>
        ) : (
          <div className="layout">
            <form className="panel create-panel" onSubmit={createTicket}>
              <p className="section-kicker">New Ticket</p>
              <h2 className="section-title">Create Request</h2>
              <p className="section-desc">
                Attach screenshots or files if they help explain your concern.
              </p>

              <div className="form-grid">
                <div className="form-group">
                  <label>Subject</label>
                  <input
                    className="field"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Example: Payment confirmation"
                  />
                </div>

                <div className="form-group">
                  <label>Related Order Optional</label>
                  <select
                    className="select"
                    value={relatedOrderId}
                    onChange={(event) => setRelatedOrderId(event.target.value)}
                  >
                    <option value="">No related order</option>
                    {orderOptions.map((order) => (
                      <option key={order.value} value={order.value}>
                        {order.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    className="textarea"
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    placeholder="Write your concern here..."
                  />
                </div>

                <div className="form-group">
                  <label>Attach File / Photo Optional</label>
                  <input
                    key={newAttachmentKey}
                    className="field"
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setNewAttachment(file);
                    }}
                  />

                  {newAttachment && (
                    <div className="selected-file">
                      Selected: {newAttachment.name}
                    </div>
                  )}
                </div>

                <button
                  className="button button-orange"
                  type="submit"
                  disabled={creating}
                >
                  {creating ? "Sending..." : "Create Ticket"}
                </button>
              </div>
            </form>

            <section className="panel tickets-panel">
              <p className="section-kicker">Ticket History</p>
              <h2 className="section-title">My Requests</h2>
              <p className="section-desc">
                Track your support conversations and admin replies.
              </p>

              <div className="toolbar">
                <input
                  className="field"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search ticket or message..."
                />

                <select
                  className="select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="replied">Replied</option>
                  <option value="closed">Closed</option>
                </select>

                <button className="button button-soft" type="button" onClick={loadData}>
                  Refresh
                </button>
              </div>

              {filteredTickets.length === 0 ? (
                <div className="empty-card" style={{ marginTop: 20 }}>
                  <div className="empty-emoji">💬</div>
                  <h2>No tickets found</h2>
                  <p>
                    Create your first support ticket or adjust your search/filter.
                  </p>
                </div>
              ) : (
                <div className="tickets-list">
                  {filteredTickets.map((ticket) => (
                    <article className="ticket-card" key={ticket.id}>
                      <div className="ticket-top">
                        <div>
                          <h3 className="ticket-title">{ticket.subject}</h3>
                          <p className="ticket-meta">
                            Created: {formatDate(ticket.created_at)}
                            <br />
                            Updated: {formatDate(ticket.updated_at)}
                            {ticket.related_order_id && (
                              <>
                                <br />
                                Related order: {ticket.related_order_id.slice(0, 8)}...
                              </>
                            )}
                          </p>
                        </div>

                        <span className={getStatusClass(ticket.status)}>
                          {ticket.status}
                        </span>
                      </div>

                      <div className="ticket-body">
                        <div className="messages">
                          {ticket.support_messages
                            .sort(
                              (a, b) =>
                                new Date(a.created_at).getTime() -
                                new Date(b.created_at).getTime()
                            )
                            .map((message) => (
                              <div
                                key={message.id}
                                className={`message ${
                                  message.sender_role === "customer"
                                    ? "customer"
                                    : "admin"
                                }`}
                              >
                                <div className="message-head">
                                  <span>
                                    {message.sender_role === "customer"
                                      ? "You"
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
                            ))}
                        </div>

                        {ticket.status !== "closed" ? (
                          <div className="reply-box">
                            <div className="form-grid">
                              <div className="form-group">
                                <label>Reply</label>
                                <textarea
                                  className="textarea"
                                  value={replyMessageByTicket[ticket.id] || ""}
                                  onChange={(event) =>
                                    setReplyMessageByTicket((current) => ({
                                      ...current,
                                      [ticket.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Write your reply..."
                                />
                              </div>

                              <div className="form-group">
                                <label>Attach File / Photo Optional</label>
                                <input
                                  key={replyAttachmentKeys[ticket.id] || 0}
                                  className="field"
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0] || null;

                                    setReplyAttachmentByTicket((current) => ({
                                      ...current,
                                      [ticket.id]: file,
                                    }));
                                  }}
                                />

                                {replyAttachmentByTicket[ticket.id] && (
                                  <div className="selected-file">
                                    Selected:{" "}
                                    {replyAttachmentByTicket[ticket.id]?.name}
                                  </div>
                                )}
                              </div>

                              <button
                                className="button button-orange"
                                type="button"
                                disabled={replyingTicketId === ticket.id}
                                onClick={() => sendReply(ticket)}
                              >
                                {replyingTicketId === ticket.id
                                  ? "Sending..."
                                  : "Send Reply"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="reply-box">
                            <strong>This ticket is closed.</strong>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}