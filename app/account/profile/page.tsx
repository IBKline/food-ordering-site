"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  contact_number: string | null;
  default_address: string | null;
  role: string | null;
  created_at: string | null;
};

export default function AccountProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [defaultAddress, setDefaultAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
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
      .from("profiles")
      .select("id, email, full_name, contact_number, default_address, role, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile load error:", error);
      alert(`Failed to load profile: ${error.message}`);
      setLoading(false);
      return;
    }

    const loadedProfile = data as Profile | null;

    if (loadedProfile) {
      setProfile(loadedProfile);
      setFullName(loadedProfile.full_name || "");
      setContactNumber(loadedProfile.contact_number || "");
      setDefaultAddress(loadedProfile.default_address || "");
    } else {
      setProfile(null);
      setFullName("");
      setContactNumber("");
      setDefaultAddress("");
    }

    setLoading(false);
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!fullName.trim()) {
      alert("Please enter your full name.");
      return;
    }

    if (!contactNumber.trim()) {
      alert("Please enter your contact number.");
      return;
    }

    setSaving(true);
    setSuccessMessage("");

    const profilePayload = {
      id: user.id,
      email: user.email || null,
      full_name: fullName.trim(),
      contact_number: contactNumber.trim(),
      default_address: defaultAddress.trim() || null,
      role: profile?.role || "customer",
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (error) {
      console.error("Profile save error:", error);
      alert(`Failed to save profile: ${error.message}`);
      setSaving(false);
      return;
    }

    setSuccessMessage("Profile saved successfully. Your checkout details will now autofill.");
    await loadProfile();
    setSaving(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "Unknown";

    return new Date(dateString).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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

        .side-panel {
          padding: 24px;
          position: sticky;
          top: 96px;
        }

        .profile-avatar {
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

        .profile-name {
          margin: 18px 0 0;
          color: #18120e;
          font-size: 28px;
          line-height: 1;
          letter-spacing: -0.05em;
          font-weight: 1000;
        }

        .profile-email {
          margin: 8px 0 0;
          color: #695d52;
          font-weight: 700;
          line-height: 1.5;
          word-break: break-word;
        }

        .status-pill {
          display: inline-flex;
          margin-top: 16px;
          border-radius: 999px;
          background: #e9fbf7;
          color: #0f766e;
          padding: 9px 13px;
          font-size: 12px;
          font-weight: 1000;
          text-transform: uppercase;
          letter-spacing: 0.1em;
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

        .form-panel {
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
          font-size: clamp(32px, 4vw, 48px);
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

        .notice {
          margin-top: 18px;
          border-radius: 22px;
          background: #fffaf0;
          color: #695d52;
          padding: 15px;
          line-height: 1.6;
          font-size: 14px;
          font-weight: 700;
        }

        .form-grid {
          display: grid;
          gap: 16px;
          margin-top: 24px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #201a16;
          font-weight: 1000;
        }

        .field,
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
          min-height: 120px;
          resize: vertical;
        }

        .field:focus,
        .textarea:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
        }

        .readonly-box {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 18px;
          background: #f7f3ea;
          padding: 15px 16px;
          color: #695d52;
          font-weight: 800;
          word-break: break-word;
        }

        .two-cols {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 22px;
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

        .success {
          margin-top: 18px;
          border: 1px solid rgba(22, 101, 52, 0.22);
          border-radius: 22px;
          background: #dcfce7;
          color: #166534;
          padding: 16px;
          font-weight: 900;
          line-height: 1.5;
        }

        .empty-card {
          margin-top: 30px;
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

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .side-panel {
            position: static;
          }

          .two-cols {
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
        }
      `}</style>

      <nav className="nav">
        <div className="container nav-inner">
          <a href="/" className="brand">
            <div className="brand-icon">🍱</div>
            <div>
              <p className="brand-title">Kline&apos;s Daily Meals</p>
              <p className="brand-subtitle">Customer profile center</p>
            </div>
          </a>

          <div className="nav-actions">
            <a className="pill-link" href="/">
              Menu
            </a>
            <a className="pill-link" href="/account/orders">
              Orders
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
            <div className="eyebrow">👤 Customer Profile</div>
            <h1 className="hero-title">
              Save your details,
              <span>order faster next time.</span>
            </h1>
            <p className="hero-text">
              Your profile details are used to autofill checkout, making future
              orders faster, cleaner, and easier to confirm.
            </p>
          </div>
        </div>
      </section>

      <section className="container">
        {loading ? (
          <div className="empty-card">
            <div className="empty-emoji">⏳</div>
            <h2>Loading profile...</h2>
            <p>Please wait while we load your customer details.</p>
          </div>
        ) : !user ? (
          <div className="empty-card">
            <div className="empty-emoji">🔐</div>
            <h2>Login required</h2>
            <p>
              Please login or create an account to save your profile details.
              Guest checkout is still available from the menu page.
            </p>

            <div className="button-row" style={{ justifyContent: "center" }}>
              <a className="button button-orange" href="/login">
                Login / Create Account
              </a>
              <a className="button button-soft" href="/">
                Back to Menu
              </a>
            </div>
          </div>
        ) : (
          <div className="layout">
            <aside className="panel side-panel">
              <div className="profile-avatar">👤</div>

              <h2 className="profile-name">
                {fullName.trim() || "Customer Profile"}
              </h2>

              <p className="profile-email">{user.email}</p>

              <div className="status-pill">
                {profile?.role || "customer"}
              </div>

              <div className="quick-links">
                <a className="quick-link" href="/account/orders">
                  <span>My Orders</span>
                  <span>→</span>
                </a>

                <a className="quick-link" href="/account/support">
                  <span>Support Tickets</span>
                  <span>→</span>
                </a>

                <a className="quick-link" href="/account/live-chat">
                  <span>Live Chat</span>
                  <span>→</span>
                </a>

                <a className="quick-link" href="/">
                  <span>Back to Menu</span>
                  <span>→</span>
                </a>
              </div>
            </aside>

            <form className="panel form-panel" onSubmit={saveProfile}>
              <p className="section-kicker">Profile Details</p>
              <h2 className="section-title">Checkout Autofill</h2>
              <p className="section-desc">
                Keep these details updated so your name, contact number, and
                default address automatically appear during checkout.
              </p>

              <div className="notice">
                Your email comes from your login account and cannot be edited
                here. You can update your saved checkout details below.
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Email</label>
                  <div className="readonly-box">{user.email || "No email"}</div>
                </div>

                <div className="two-cols">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      className="field"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Contact Number</label>
                    <input
                      className="field"
                      value={contactNumber}
                      onChange={(event) => setContactNumber(event.target.value)}
                      placeholder="09XXXXXXXXX"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Default Address / Pickup Note</label>
                  <textarea
                    className="textarea"
                    value={defaultAddress}
                    onChange={(event) => setDefaultAddress(event.target.value)}
                    placeholder="Complete address, landmark, or pickup note"
                  />
                </div>

                <div className="two-cols">
                  <div className="form-group">
                    <label>Account Created</label>
                    <div className="readonly-box">
                      {formatDate(profile?.created_at || null)}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Account Role</label>
                    <div className="readonly-box">
                      {profile?.role || "customer"}
                    </div>
                  </div>
                </div>

                <div className="button-row">
                  <button
                    className="button button-orange"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Profile"}
                  </button>

                  <button
                    className="button button-soft"
                    type="button"
                    onClick={loadProfile}
                    disabled={saving}
                  >
                    Refresh
                  </button>
                </div>

                {successMessage && (
                  <div className="success">{successMessage}</div>
                )}
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}