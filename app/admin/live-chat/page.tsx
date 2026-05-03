"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type EnrichedThread = LiveChatThread & {
  profile: Profile | null;
  messages: LiveChatMessage[];
  unreadCustomerMessages: number;
};

export default function AdminLiveChatPage() {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [threads, setThreads] = useState<EnrichedThread[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [startingChat, setStartingChat] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadEverything();

    const interval = setInterval(() => {
      loadEverything(false);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedThreadId, threads.length]);

  async function loadEverything(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setAdminUser(user);

    await Promise.all([loadProfiles(), loadChats(false)]);

    setLoading(false);
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, contact_number")
      .eq("role", "customer")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Admin live chat profiles error:", error);
      return;
    }

    setProfiles((data || []) as Profile[]);
  }

  async function loadChats(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }

    const { data: threadData, error: threadError } = await supabase
      .from("live_chat_threads")
      .select("id, user_id, subject, status, last_message_at, created_at, updated_at")
      .order("last_message_at", { ascending: false });

    if (threadError) {
      console.error("Admin live chat thread error:", threadError);
      alert(`Failed to load live chats: ${threadError.message}`);
      setLoading(false);
      return;
    }

    const loadedThreads = (threadData || []) as LiveChatThread[];
    const threadIds = loadedThreads.map((thread) => thread.id);
    const userIds = Array.from(
      new Set(loadedThreads.map((thread) => thread.user_id))
    );

    let loadedProfiles: Profile[] = [];
    let messages: LiveChatMessage[] = [];

    if (userIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, contact_number")
        .in("id", userIds);

      if (profileError) {
        console.error("Live chat profile error:", profileError);
      } else {
        loadedProfiles = (profileData || []) as Profile[];
      }
    }

    if (threadIds.length > 0) {
      const { data: messageData, error: messageError } = await supabase
        .from("live_chat_messages")
        .select(
          "id, thread_id, sender_id, sender_role, message, read_by_admin, read_by_customer, created_at"
        )
        .in("thread_id", threadIds)
        .order("created_at", { ascending: true });

      if (messageError) {
        console.error("Live chat messages error:", messageError);
      } else {
        messages = (messageData || []) as LiveChatMessage[];
      }
    }

    const enrichedThreads: EnrichedThread[] = loadedThreads.map((thread) => {
      const threadMessages = messages.filter(
        (message) => message.thread_id === thread.id
      );

      return {
        ...thread,
        profile:
          loadedProfiles.find((profile) => profile.id === thread.user_id) ||
          null,
        messages: threadMessages,
        unreadCustomerMessages: threadMessages.filter(
          (message) =>
            message.sender_role === "customer" && message.read_by_admin === false
        ).length,
      };
    });

    setThreads(enrichedThreads);

    if (!selectedThreadId && enrichedThreads.length > 0) {
      const firstOpenThread =
        enrichedThreads.find((thread) => thread.status === "open") ||
        enrichedThreads[0];

      setSelectedThreadId(firstOpenThread.id);
    }

    if (selectedThreadId) {
      await markThreadReadByAdmin(selectedThreadId);
    }

    setLoading(false);
  }

  async function markThreadReadByAdmin(threadId: string) {
    await supabase
      .from("live_chat_messages")
      .update({ read_by_admin: true })
      .eq("thread_id", threadId)
      .eq("sender_role", "customer");
  }

  async function selectThread(threadId: string) {
    setSelectedThreadId(threadId);
    setReplyText("");
    await markThreadReadByAdmin(threadId);
    await loadChats(false);
  }

  async function startChatWithCustomer(event: React.FormEvent) {
    event.preventDefault();

    if (!adminUser) {
      alert("Admin account not detected.");
      return;
    }

    if (!selectedCustomerId) {
      alert("Please select a customer.");
      return;
    }

    if (!initialMessage.trim()) {
      alert("Please type the first message.");
      return;
    }

    setStartingChat(true);

    const existingOpenThread = threads.find(
      (thread) => thread.user_id === selectedCustomerId && thread.status === "open"
    );

    let threadId = existingOpenThread?.id || null;

    if (!threadId) {
      const { data: threadData, error: threadError } = await supabase
        .from("live_chat_threads")
        .insert({
          user_id: selectedCustomerId,
          subject: "Admin Started Chat",
          status: "open",
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (threadError) {
        console.error("Start admin chat thread error:", threadError);
        alert(`Failed to start chat: ${threadError.message}`);
        setStartingChat(false);
        return;
      }

      threadId = threadData.id;
    }

    const { error: messageError } = await supabase
      .from("live_chat_messages")
      .insert({
        thread_id: threadId,
        sender_id: adminUser.id,
        sender_role: "admin",
        message: initialMessage.trim(),
        read_by_admin: true,
        read_by_customer: false,
      });

    if (messageError) {
      console.error("Start admin chat message error:", messageError);
      alert(`Failed to send first message: ${messageError.message}`);
      setStartingChat(false);
      return;
    }

    await supabase
      .from("live_chat_threads")
      .update({
        status: "open",
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);

    setInitialMessage("");
    setSelectedCustomerId("");
    setCustomerSearch("");
    setSelectedThreadId(threadId);

    await loadEverything(false);
    setStartingChat(false);
  }

  async function sendAdminReply(event: React.FormEvent) {
    event.preventDefault();

    if (!adminUser || !selectedThreadId) {
      alert("Please select a chat first.");
      return;
    }

    if (!replyText.trim()) {
      alert("Please enter a reply.");
      return;
    }

    const selectedThread = threads.find(
      (thread) => thread.id === selectedThreadId
    );

    if (selectedThread?.status === "closed") {
      alert("This chat is closed. Reopen it first.");
      return;
    }

    setSending(true);

    const { error: messageError } = await supabase
      .from("live_chat_messages")
      .insert({
        thread_id: selectedThreadId,
        sender_id: adminUser.id,
        sender_role: "admin",
        message: replyText.trim(),
        read_by_admin: true,
        read_by_customer: false,
      });

    if (messageError) {
      console.error("Admin live chat reply error:", messageError);
      alert(`Failed to send reply: ${messageError.message}`);
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
      .eq("id", selectedThreadId);

    setReplyText("");
    await loadChats(false);
    setSending(false);
  }

  async function updateThreadStatus(threadId: string, status: string) {
    const { error } = await supabase
      .from("live_chat_threads")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);

    if (error) {
      alert(`Failed to update chat status: ${error.message}`);
      return;
    }

    await loadChats(false);
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

  const filteredCustomers = useMemo(() => {
    const value = customerSearch.trim().toLowerCase();

    if (!value) return profiles.slice(0, 8);

    return profiles
      .filter((profile) => {
        return (
          profile.full_name?.toLowerCase().includes(value) ||
          profile.email?.toLowerCase().includes(value) ||
          profile.contact_number?.toLowerCase().includes(value)
        );
      })
      .slice(0, 12);
  }, [profiles, customerSearch]);

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      const matchesStatus =
        statusFilter === "all" ? true : thread.status === statusFilter;

      const searchValue = search.trim().toLowerCase();

      if (!searchValue) return matchesStatus;

      const matchesSearch =
        thread.profile?.full_name?.toLowerCase().includes(searchValue) ||
        thread.profile?.email?.toLowerCase().includes(searchValue) ||
        thread.profile?.contact_number?.toLowerCase().includes(searchValue) ||
        thread.messages.some((message) =>
          message.message.toLowerCase().includes(searchValue)
        );

      return matchesStatus && matchesSearch;
    });
  }, [threads, search, statusFilter]);

  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) || null;

  const selectedCustomer =
    profiles.find((profile) => profile.id === selectedCustomerId) || null;

  const totalUnread = threads.reduce(
    (sum, thread) => sum + thread.unreadCustomerMessages,
    0
  );

  const summary = useMemo(() => {
    return {
      totalChats: threads.length,
      openChats: threads.filter((thread) => thread.status === "open").length,
      closedChats: threads.filter((thread) => thread.status === "closed").length,
      unreadMessages: totalUnread,
      registeredCustomers: profiles.length,
      totalMessages: threads.reduce(
        (sum, thread) => sum + thread.messages.length,
        0
      ),
    };
  }, [threads, profiles.length, totalUnread]);

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

          .chat-layout {
            display: grid;
            grid-template-columns: 360px 420px 1fr;
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

          .form-grid {
            display: grid;
            gap: 12px;
          }

          .toolbar {
            display: grid;
            gap: 10px;
            margin-bottom: 14px;
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

          .button-soft {
            border: 1px solid rgba(15, 23, 42, 0.12);
            background: white;
            color: #0f172a;
          }

          .customer-list,
          .thread-list {
            display: grid;
            gap: 10px;
            max-height: 620px;
            overflow-y: auto;
            padding-right: 4px;
          }

          .customer-button,
          .thread-button {
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

          .customer-button:hover,
          .thread-button:hover {
            background: #f0fdfa;
            border-color: rgba(15, 118, 110, 0.22);
          }

          .customer-button.selected,
          .thread-button.selected {
            background: #ccfbf1;
            border-color: rgba(15, 118, 110, 0.34);
          }

          .item-top {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }

          .item-title {
            margin: 0;
            color: #0f172a;
            font-size: 17px;
            font-weight: 1000;
            letter-spacing: -0.03em;
          }

          .item-detail {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.45;
          }

          .unread-badge {
            display: inline-flex;
            min-width: 25px;
            height: 25px;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            background: #dc2626;
            color: white;
            padding: 0 8px;
            font-size: 11px;
            font-weight: 1000;
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

          .status.neutral {
            background: #e2e8f0;
            color: #475569;
          }

          .status.teal {
            background: #ccfbf1;
            color: #0f766e;
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

          .selected-customer {
            border: 1px solid rgba(15, 118, 110, 0.18);
            border-radius: 18px;
            background: #f0fdfa;
            color: #0f766e;
            padding: 12px;
            font-size: 13px;
            font-weight: 900;
          }

          .chat-card {
            overflow: hidden;
            padding: 0;
          }

          .chat-header {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 14px;
            align-items: start;
            border-bottom: 1px solid rgba(15, 23, 42, 0.08);
            background:
              radial-gradient(circle at top right, rgba(20, 184, 166, 0.14), transparent 18rem),
              #f8fafc;
            padding: 20px;
          }

          .chat-title {
            margin: 0;
            color: #0f172a;
            font-size: 28px;
            line-height: 1;
            letter-spacing: -0.05em;
            font-weight: 1000;
          }

          .chat-subtitle {
            margin: 7px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.55;
            font-weight: 700;
          }

          .messages-area {
            height: 560px;
            overflow-y: auto;
            background: #f8fafc;
            padding: 18px;
          }

          .messages-list {
            display: grid;
            gap: 12px;
          }

          .message-row {
            display: flex;
          }

          .message-row.admin {
            justify-content: flex-end;
          }

          .message-row.customer {
            justify-content: flex-start;
          }

          .bubble {
            max-width: min(78%, 640px);
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 24px;
            padding: 14px;
            box-shadow: 0 12px 26px rgba(15, 23, 42, 0.05);
          }

          .bubble.admin {
            border-bottom-right-radius: 8px;
            background: #f0fdfa;
          }

          .bubble.customer {
            border-bottom-left-radius: 8px;
            background: #fff7ed;
          }

          .bubble-head {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            color: #0f172a;
            font-size: 12px;
            font-weight: 1000;
          }

          .bubble-date {
            color: #64748b;
            font-weight: 700;
          }

          .bubble-text {
            margin: 9px 0 0;
            color: #0f172a;
            white-space: pre-wrap;
            line-height: 1.7;
            font-weight: 700;
          }

          .composer {
            border-top: 1px solid rgba(15, 23, 42, 0.08);
            background: white;
            padding: 18px;
          }

          .closed-box {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 20px;
            background: #f8fafc;
            padding: 15px;
            color: #64748b;
            font-weight: 800;
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

          @media (max-width: 1250px) {
            .summary-grid {
              grid-template-columns: repeat(3, 1fr);
            }

            .chat-layout {
              grid-template-columns: 1fr;
            }

            .customer-list,
            .thread-list {
              max-height: 420px;
            }
          }

          @media (max-width: 850px) {
            .admin-page {
              padding: 14px;
            }

            .summary-grid,
            .chat-header {
              grid-template-columns: 1fr;
            }

            .button {
              width: 100%;
            }

            .bubble {
              max-width: 92%;
            }

            .messages-area {
              height: 480px;
            }
          }
        `}</style>

        <div className="admin-container">
          <AdminNav
            title="Admin Live Chat"
            description="Reply to customers, monitor unread messages, and start conversations with registered customers."
          />

          <div className="content">
            <section className="summary-grid">
              <div className="metric-card dark">
                <p className="metric-label">Unread Messages</p>
                <p className="metric-value">{summary.unreadMessages}</p>
                <p className="metric-note">Customer messages not yet read</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Open Chats</p>
                <p className="metric-value">{summary.openChats}</p>
                <p className="metric-note">Active live chat conversations</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Closed Chats</p>
                <p className="metric-value">{summary.closedChats}</p>
                <p className="metric-note">Resolved chat threads</p>
              </div>

              <div className="metric-card orange">
                <p className="metric-label">Total Chats</p>
                <p className="metric-value">{summary.totalChats}</p>
                <p className="metric-note">All live chat threads</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Customers</p>
                <p className="metric-value">{summary.registeredCustomers}</p>
                <p className="metric-note">Registered customer profiles</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Messages</p>
                <p className="metric-value">{summary.totalMessages}</p>
                <p className="metric-note">Total chat messages</p>
              </div>
            </section>

            <section className="chat-layout">
              <form className="section-card" onSubmit={startChatWithCustomer}>
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Admin Initiated Chat</p>
                    <h2 className="section-title">Start Chat</h2>
                    <p className="section-desc">
                      Search a registered customer and send the first message.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <input
                    className="field"
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    placeholder="Search name, email, or contact..."
                  />

                  <div className="customer-list">
                    {filteredCustomers.length === 0 ? (
                      <div className="empty-state">No customers found.</div>
                    ) : (
                      filteredCustomers.map((profile) => {
                        const isSelected = selectedCustomerId === profile.id;

                        return (
                          <button
                            key={profile.id}
                            type="button"
                            className={`customer-button ${
                              isSelected ? "selected" : ""
                            }`}
                            onClick={() => setSelectedCustomerId(profile.id)}
                          >
                            <p className="item-title">
                              {profile.full_name || "No name"}
                            </p>
                            <p className="item-detail">
                              {profile.email || "No email"}
                              <br />
                              {profile.contact_number || "No contact"}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {selectedCustomer && (
                    <div className="selected-customer">
                      Selected:{" "}
                      {selectedCustomer.full_name ||
                        selectedCustomer.email ||
                        "Customer"}
                      <br />
                      {selectedCustomer.contact_number || "No contact"}
                    </div>
                  )}

                  <textarea
                    className="textarea"
                    value={initialMessage}
                    onChange={(event) => setInitialMessage(event.target.value)}
                    placeholder="Type your first message to the customer..."
                  />

                  <button
                    type="submit"
                    disabled={startingChat}
                    className="button button-teal"
                  >
                    {startingChat ? "Starting Chat..." : "Start Chat with Customer"}
                  </button>
                </div>
              </form>

              <aside className="section-card">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Chat Queue</p>
                    <h2 className="section-title">Inbox</h2>
                    <p className="section-desc">
                      Search and filter customer live chats.
                    </p>
                  </div>
                </div>

                <div className="toolbar">
                  <input
                    className="field"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customer or message..."
                  />

                  <select
                    className="select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="open">Open Chats</option>
                    <option value="closed">Closed Chats</option>
                    <option value="all">All Chats</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => loadEverything(false)}
                    className="button button-teal"
                  >
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="empty-state">Loading chats...</div>
                ) : filteredThreads.length === 0 ? (
                  <div className="empty-state">No chats found.</div>
                ) : (
                  <div className="thread-list">
                    {filteredThreads.map((thread) => {
                      const isSelected = thread.id === selectedThreadId;
                      const latestMessage =
                        thread.messages[thread.messages.length - 1];

                      return (
                        <button
                          key={thread.id}
                          type="button"
                          className={`thread-button ${
                            isSelected ? "selected" : ""
                          }`}
                          onClick={() => selectThread(thread.id)}
                        >
                          <div className="item-top">
                            <div>
                              <p className="item-title">
                                {thread.profile?.full_name || "Customer"}
                              </p>
                              <p className="item-detail">
                                {thread.profile?.email || "No email"}
                                <br />
                                {latestMessage
                                  ? latestMessage.message.slice(0, 88)
                                  : "No messages yet"}
                              </p>
                            </div>

                            {thread.unreadCustomerMessages > 0 && (
                              <span className="unread-badge">
                                {thread.unreadCustomerMessages}
                              </span>
                            )}
                          </div>

                          <div className="tag-row">
                            <span
                              className={
                                thread.status === "open"
                                  ? "status success"
                                  : "status neutral"
                              }
                            >
                              {thread.status}
                            </span>

                            <span className="tag">
                              {formatDate(thread.last_message_at)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </aside>

              <section className="section-card chat-card">
                {!selectedThread ? (
                  <div className="empty-state" style={{ margin: 20 }}>
                    Select a chat from the inbox or start a new conversation.
                  </div>
                ) : (
                  <>
                    <div className="chat-header">
                      <div>
                        <h2 className="chat-title">
                          {selectedThread.profile?.full_name || "Customer"}
                        </h2>
                        <p className="chat-subtitle">
                          {selectedThread.profile?.email || "No email"} ·{" "}
                          {selectedThread.profile?.contact_number || "No contact"}
                          <br />
                          Last activity: {formatDate(selectedThread.last_message_at)}
                        </p>
                      </div>

                      <select
                        className="select"
                        value={selectedThread.status}
                        onChange={(event) =>
                          updateThreadStatus(selectedThread.id, event.target.value)
                        }
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    <div className="messages-area">
                      {selectedThread.messages.length === 0 ? (
                        <div className="empty-state">No messages yet.</div>
                      ) : (
                        <div className="messages-list">
                          {selectedThread.messages.map((message) => {
                            const isAdmin = message.sender_role !== "customer";

                            return (
                              <div
                                key={message.id}
                                className={`message-row ${
                                  isAdmin ? "admin" : "customer"
                                }`}
                              >
                                <div
                                  className={`bubble ${
                                    isAdmin ? "admin" : "customer"
                                  }`}
                                >
                                  <div className="bubble-head">
                                    <span>{isAdmin ? "Admin" : "Customer"}</span>
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

                    {selectedThread.status === "closed" ? (
                      <div className="composer">
                        <div className="closed-box">
                          This chat is closed. Reopen it above before replying.
                        </div>
                      </div>
                    ) : (
                      <form className="composer" onSubmit={sendAdminReply}>
                        <div className="form-grid">
                          <textarea
                            className="textarea"
                            value={replyText}
                            onChange={(event) => setReplyText(event.target.value)}
                            placeholder="Type admin reply..."
                          />

                          <button
                            type="submit"
                            disabled={sending}
                            className="button button-teal"
                          >
                            {sending ? "Sending..." : "Send Reply"}
                          </button>
                        </div>
                      </form>
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