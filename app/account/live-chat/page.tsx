"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type LiveChatThread = {
  id: string;
  user_id: string;
  subject: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

type LiveChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_role: string;
  message: string;
  read_by_admin: boolean;
  read_by_customer: boolean;
  created_at: string;
};

export default function AccountLiveChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [thread, setThread] = useState<LiveChatThread | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingThread, setCreatingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadChat();

    const interval = setInterval(() => {
      loadChat(false);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  async function loadChat(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: threadData, error: threadError } = await supabase
      .from("live_chat_threads")
      .select("id, user_id, subject, status, last_message_at, created_at, updated_at")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (threadError) {
      console.error("Live chat thread error:", threadError);
      alert(`Failed to load live chat: ${threadError.message}`);
      setLoading(false);
      return;
    }

    if (!threadData) {
      setThread(null);
      setMessages([]);
      setLoading(false);
      return;
    }

    const loadedThread = threadData as LiveChatThread;
    setThread(loadedThread);

    const { data: messageData, error: messageError } = await supabase
      .from("live_chat_messages")
      .select("id, thread_id, sender_id, sender_role, message, read_by_admin, read_by_customer, created_at")
      .eq("thread_id", loadedThread.id)
      .order("created_at", { ascending: true });

    if (messageError) {
      console.error("Live chat messages error:", messageError);
      alert(`Failed to load messages: ${messageError.message}`);
    } else {
      setMessages((messageData || []) as LiveChatMessage[]);
    }

    await supabase
      .from("live_chat_messages")
      .update({ read_by_customer: true })
      .eq("thread_id", loadedThread.id)
      .neq("sender_role", "customer");

    setLoading(false);
  }

  async function startChat() {
    if (!user) {
      alert("Please login first.");
      return;
    }

    setCreatingThread(true);

    const { data, error } = await supabase
      .from("live_chat_threads")
      .insert({
        user_id: user.id,
        subject: "Customer Live Chat",
        status: "open",
        last_message_at: new Date().toISOString(),
      })
      .select("id, user_id, subject, status, last_message_at, created_at, updated_at")
      .single();

    if (error) {
      console.error("Start chat error:", error);
      alert(`Failed to start chat: ${error.message}`);
      setCreatingThread(false);
      return;
    }

    setThread(data as LiveChatThread);
    setMessages([]);
    setCreatingThread(false);
  }

  async function reopenChat() {
    if (!thread) return;

    const { error } = await supabase
      .from("live_chat_threads")
      .update({
        status: "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread.id);

    if (error) {
      alert(`Failed to reopen chat: ${error.message}`);
      return;
    }

    await loadChat();
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();

    if (!user || !thread) {
      alert("Please start a chat first.");
      return;
    }

    if (thread.status === "closed") {
      alert("This chat is closed. Reopen it first.");
      return;
    }

    if (!messageText.trim()) {
      alert("Please type a message.");
      return;
    }

    setSending(true);

    const { error: messageError } = await supabase
      .from("live_chat_messages")
      .insert({
        thread_id: thread.id,
        sender_id: user.id,
        sender_role: "customer",
        message: messageText.trim(),
        read_by_admin: false,
        read_by_customer: true,
      });

    if (messageError) {
      console.error("Send chat message error:", messageError);
      alert(`Failed to send message: ${messageError.message}`);
      setSending(false);
      return;
    }

    await supabase
      .from("live_chat_threads")
      .update({
        status: "open",
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread.id);

    setMessageText("");
    await loadChat(false);
    setSending(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const unreadAdminMessages = messages.filter(
    (message) => message.sender_role !== "customer" && !message.read_by_customer
  ).length;

  return (
    <main className="customer-page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
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

        .chat-shell {
          display: grid;
          grid-template-columns: 0.75fr 1.25fr;
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

        .side-panel {
          position: sticky;
          top: 96px;
          padding: 24px;
        }

        .side-icon {
          display: grid;
          place-items: center;
          width: 82px;
          height: 82px;
          border-radius: 28px;
          background: linear-gradient(135deg, #ea580c, #f59e0b);
          color: white;
          font-size: 38px;
          box-shadow: 0 18px 44px rgba(234, 88, 12, 0.2);
        }

        .side-title {
          margin: 18px 0 0;
          color: #18120e;
          font-size: 30px;
          line-height: 1;
          letter-spacing: -0.05em;
          font-weight: 1000;
        }

        .side-text {
          margin: 12px 0 0;
          color: #695d52;
          line-height: 1.7;
          font-weight: 650;
        }

        .status-pill {
          display: inline-flex;
          margin-top: 16px;
          border-radius: 999px;
          padding: 9px 13px;
          font-size: 12px;
          font-weight: 1000;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .status-open {
          background: #dcfce7;
          color: #166534;
        }

        .status-closed {
          background: #f7f3ea;
          color: #5a4b40;
        }

        .quick-links {
          display: grid;
          gap: 10px;
          margin-top: 24px;
        }

        .quick-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 18px;
          background: #fffaf0;
          color: #201a16;
          padding: 13px 14px;
          text-decoration: none;
          font-weight: 950;
          transition: 160ms ease;
        }

        .quick-link:hover {
          transform: translateY(-1px);
          background: white;
          box-shadow: 0 10px 24px rgba(32, 26, 22, 0.08);
        }

        .chat-panel {
          overflow: hidden;
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px;
          border-bottom: 1px solid rgba(32, 26, 22, 0.08);
          background: #fffaf0;
        }

        .chat-title {
          margin: 0;
          color: #18120e;
          font-size: 24px;
          letter-spacing: -0.04em;
          font-weight: 1000;
        }

        .chat-subtitle {
          margin: 6px 0 0;
          color: #695d52;
          font-size: 13px;
          font-weight: 750;
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

        .button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .messages-area {
          height: 560px;
          overflow-y: auto;
          background:
            radial-gradient(circle at top right, rgba(20, 184, 166, 0.12), transparent 20rem),
            #fffdf7;
          padding: 20px;
        }

        .messages-list {
          display: grid;
          gap: 12px;
        }

        .message-row {
          display: flex;
        }

        .message-row.customer {
          justify-content: flex-end;
        }

        .message-row.admin {
          justify-content: flex-start;
        }

        .bubble {
          max-width: min(78%, 620px);
          border: 1px solid rgba(32, 26, 22, 0.08);
          border-radius: 24px;
          padding: 15px;
          box-shadow: 0 12px 26px rgba(32, 26, 22, 0.05);
        }

        .bubble.customer {
          border-bottom-right-radius: 8px;
          background: #fff7ed;
        }

        .bubble.admin {
          border-bottom-left-radius: 8px;
          background: #e9fbf7;
        }

        .bubble-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #18120e;
          font-size: 12px;
          font-weight: 1000;
        }

        .bubble-date {
          color: #766a5d;
          font-weight: 750;
        }

        .bubble-text {
          margin: 9px 0 0;
          white-space: pre-wrap;
          color: #201a16;
          line-height: 1.65;
          font-weight: 650;
        }

        .empty-chat {
          border: 1px dashed rgba(32, 26, 22, 0.18);
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.72);
          padding: 34px;
          text-align: center;
        }

        .empty-emoji {
          font-size: 58px;
        }

        .empty-chat h2 {
          margin: 14px 0 0;
          color: #18120e;
          font-size: 28px;
          letter-spacing: -0.05em;
          font-weight: 1000;
        }

        .empty-chat p {
          margin: 9px auto 0;
          max-width: 520px;
          color: #695d52;
          line-height: 1.7;
          font-weight: 650;
        }

        .composer {
          border-top: 1px solid rgba(32, 26, 22, 0.08);
          background: white;
          padding: 18px;
        }

        .composer-grid {
          display: grid;
          gap: 12px;
        }

        .textarea {
          width: 100%;
          min-height: 104px;
          border: 1px solid rgba(32, 26, 22, 0.16);
          outline: none;
          border-radius: 20px;
          background: #fffaf0;
          color: #201a16;
          padding: 15px 16px;
          font-weight: 750;
          resize: vertical;
          transition: 160ms ease;
        }

        .textarea:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
        }

        .closed-box {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 24px;
          background: #fffaf0;
          padding: 18px;
        }

        .closed-box strong {
          display: block;
          color: #18120e;
          font-size: 18px;
          font-weight: 1000;
        }

        .closed-box p {
          margin: 8px 0 0;
          color: #695d52;
          line-height: 1.6;
          font-weight: 650;
        }

        .start-card {
          padding: 42px;
          text-align: center;
        }

        .start-card .side-icon {
          margin: 0 auto;
        }

        .start-card h2 {
          margin: 20px 0 0;
          color: #18120e;
          font-size: 36px;
          letter-spacing: -0.06em;
          font-weight: 1000;
        }

        .start-card p {
          max-width: 580px;
          margin: 12px auto 0;
          color: #695d52;
          line-height: 1.75;
          font-weight: 650;
        }

        .start-card .button {
          margin-top: 22px;
        }

        .login-card {
          margin: 34px auto 0;
          max-width: 720px;
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 30px;
          background: white;
          padding: 34px;
          text-align: center;
          box-shadow: 0 20px 52px rgba(32, 26, 22, 0.07);
        }

        @media (max-width: 980px) {
          .chat-shell {
            grid-template-columns: 1fr;
          }

          .side-panel {
            position: static;
          }

          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .messages-area {
            height: 480px;
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

          .chat-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .bubble {
            max-width: 92%;
          }
        }
      `}</style>

      <nav className="nav">
        <div className="container nav-inner">
          <a href="/" className="brand">
            <div className="brand-icon">🍱</div>
            <div>
              <p className="brand-title">Kline&apos;s Daily Meals</p>
              <p className="brand-subtitle">Customer live chat</p>
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
            <a className="pill-link" href="/account/support">
              Support
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
            <div className="eyebrow">💬 Live Chat</div>
            <h1 className="hero-title">
              Quick questions,
              <span>direct to admin.</span>
            </h1>
            <p className="hero-text">
              Use live chat for quick updates about payment confirmation, pickup,
              delivery, order changes, or meal availability.
            </p>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <p className="summary-label">Chat Status</p>
              <p className="summary-value">{thread?.status || "None"}</p>
            </div>

            <div className="summary-card">
              <p className="summary-label">Messages</p>
              <p className="summary-value">{messages.length}</p>
            </div>

            <div className="summary-card">
              <p className="summary-label">Unread</p>
              <p className="summary-value">{unreadAdminMessages}</p>
            </div>

            <div className="summary-card">
              <p className="summary-label">Refresh</p>
              <p className="summary-value">4s</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container">
        {loading ? (
          <div className="login-card">
            <div className="empty-emoji">⏳</div>
            <h2>Loading live chat...</h2>
            <p>Please wait while we load your chat history.</p>
          </div>
        ) : !user ? (
          <div className="login-card">
            <div className="empty-emoji">🔐</div>
            <h2>Login required</h2>
            <p>
              Please login or create an account to use live chat. Guest checkout
              is still available from the menu page.
            </p>

            <div style={{ marginTop: 20 }}>
              <a className="button button-orange" href="/login">
                Login / Create Account
              </a>
            </div>
          </div>
        ) : !thread ? (
          <div className="panel start-card">
            <div className="side-icon">💬</div>
            <h2>Start a live chat</h2>
            <p>
              Start a conversation with admin for quick concerns. For detailed
              concerns with attachments, use Support Tickets.
            </p>

            <button
              className="button button-orange"
              type="button"
              disabled={creatingThread}
              onClick={startChat}
            >
              {creatingThread ? "Starting..." : "Start Chat"}
            </button>
          </div>
        ) : (
          <div className="chat-shell">
            <aside className="panel side-panel">
              <div className="side-icon">💬</div>

              <h2 className="side-title">Live Chat</h2>

              <p className="side-text">
                Your messages refresh automatically every few seconds. Keep this
                page open while waiting for admin replies.
              </p>

              <span
                className={`status-pill ${
                  thread.status === "open" ? "status-open" : "status-closed"
                }`}
              >
                {thread.status}
              </span>

              <div className="quick-links">
                <a className="quick-link" href="/account/support">
                  <span>Support Tickets</span>
                  <span>→</span>
                </a>

                <a className="quick-link" href="/account/orders">
                  <span>My Orders</span>
                  <span>→</span>
                </a>

                <a className="quick-link" href="/account/profile">
                  <span>My Profile</span>
                  <span>→</span>
                </a>

                <a className="quick-link" href="/">
                  <span>Back to Menu</span>
                  <span>→</span>
                </a>
              </div>
            </aside>

            <section className="panel chat-panel">
              <div className="chat-header">
                <div>
                  <h2 className="chat-title">Customer Live Chat</h2>
                  <p className="chat-subtitle">
                    Last activity: {formatDate(thread.last_message_at)}
                  </p>
                </div>

                <button
                  className="button button-soft"
                  type="button"
                  onClick={() => loadChat(false)}
                >
                  Refresh
                </button>
              </div>

              <div className="messages-area">
                {messages.length === 0 ? (
                  <div className="empty-chat">
                    <div className="empty-emoji">👋</div>
                    <h2>No messages yet</h2>
                    <p>
                      Send your first message below. Admin will see it in the
                      back office live chat inbox.
                    </p>
                  </div>
                ) : (
                  <div className="messages-list">
                    {messages.map((message) => {
                      const isCustomer = message.sender_role === "customer";

                      return (
                        <div
                          key={message.id}
                          className={`message-row ${
                            isCustomer ? "customer" : "admin"
                          }`}
                        >
                          <div
                            className={`bubble ${
                              isCustomer ? "customer" : "admin"
                            }`}
                          >
                            <div className="bubble-head">
                              <span>{isCustomer ? "You" : "Admin"}</span>
                              <span className="bubble-date">
                                {formatDate(message.created_at)}
                              </span>
                            </div>

                            <p className="bubble-text">{message.message}</p>
                          </div>
                        </div>
                      );
                    })}

                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {thread.status === "closed" ? (
                <div className="composer">
                  <div className="closed-box">
                    <strong>This chat is closed.</strong>
                    <p>
                      You can reopen this chat if you still need help from admin.
                    </p>

                    <button
                      className="button button-orange"
                      type="button"
                      onClick={reopenChat}
                      style={{ marginTop: 14 }}
                    >
                      Reopen Chat
                    </button>
                  </div>
                </div>
              ) : (
                <form className="composer" onSubmit={sendMessage}>
                  <div className="composer-grid">
                    <textarea
                      className="textarea"
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      placeholder="Type your message to admin..."
                    />

                    <button
                      className="button button-orange"
                      type="submit"
                      disabled={sending}
                    >
                      {sending ? "Sending..." : "Send Message"}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}