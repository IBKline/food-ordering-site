"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup" | "forgot";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [defaultAddress, setDefaultAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password.trim()) {
      alert("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      alert(`Login failed: ${error.message}`);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  async function signup(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password.trim()) {
      alert("Please enter your email and password.");
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

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      alert(`Create account failed: ${error.message}`);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    if (userId) {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: userId,
          email: email.trim(),
          full_name: fullName.trim(),
          contact_number: contactNumber.trim(),
          default_address: defaultAddress.trim() || null,
          role: "customer",
        },
        { onConflict: "id" }
      );

      if (profileError) {
        console.error("Profile create error:", profileError);
        alert(
          `Account created, but profile failed to save: ${profileError.message}`
        );
        setLoading(false);
        return;
      }
    }

    setMessage(
      "Account created successfully. If email confirmation is enabled in Supabase, please check your email before logging in."
    );

    setPassword("");
    setLoading(false);
    setMode("login");
  }

  async function forgotPassword(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!email.trim()) {
      alert("Please enter your email.");
      return;
    }

    setLoading(true);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/login`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      alert(`Password reset failed: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Password reset email sent. Please check your inbox.");
    setLoading(false);
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setMessage("");
  }

  return (
    <main className="auth-page">
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

        .auth-page {
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

        .pill-link {
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

        .pill-link:hover {
          transform: translateY(-1px);
          background: white;
          box-shadow: 0 10px 25px rgba(32, 26, 22, 0.08);
        }

        .auth-layout {
          display: grid;
          grid-template-columns: 1fr 0.9fr;
          gap: 28px;
          align-items: center;
          padding: 56px 0 70px;
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
          padding: 42px;
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
          max-width: 780px;
          margin: 22px 0 0;
          font-size: clamp(42px, 6vw, 72px);
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
          max-width: 660px;
          margin: 20px 0 0;
          color: rgba(255, 255, 255, 0.78);
          font-size: 16px;
          line-height: 1.8;
          font-weight: 650;
        }

        .feature-grid {
          display: grid;
          gap: 12px;
          margin-top: 28px;
        }

        .feature {
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.1);
          padding: 16px;
        }

        .feature strong {
          display: block;
          color: white;
          font-size: 15px;
          font-weight: 1000;
        }

        .feature span {
          display: block;
          margin-top: 5px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          line-height: 1.5;
          font-weight: 650;
        }

        .auth-card {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 34px;
          background: rgba(255, 255, 255, 0.92);
          padding: 28px;
          box-shadow: 0 20px 52px rgba(32, 26, 22, 0.08);
        }

        .tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          border-radius: 22px;
          background: #fffaf0;
          padding: 8px;
        }

        .tab-button {
          border: 0;
          border-radius: 16px;
          background: transparent;
          color: #695d52;
          padding: 12px;
          font-size: 13px;
          font-weight: 1000;
          cursor: pointer;
        }

        .tab-button.active {
          background: white;
          color: #18120e;
          box-shadow: 0 10px 24px rgba(32, 26, 22, 0.08);
        }

        .form-head {
          margin-top: 24px;
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
          font-size: 38px;
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
          min-height: 100px;
          resize: vertical;
        }

        .field:focus,
        .textarea:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
        }

        .button {
          border: 0;
          border-radius: 18px;
          background: #18120e;
          color: white;
          padding: 15px 18px;
          font-weight: 1000;
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

        .button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .message-box {
          margin-top: 18px;
          border: 1px solid rgba(22, 101, 52, 0.22);
          border-radius: 22px;
          background: #dcfce7;
          color: #166534;
          padding: 16px;
          font-weight: 900;
          line-height: 1.5;
        }

        .mini-note {
          margin-top: 16px;
          border-radius: 20px;
          background: #fffaf0;
          color: #695d52;
          padding: 14px;
          font-size: 13px;
          line-height: 1.6;
          font-weight: 700;
        }

        .switch-text {
          margin-top: 18px;
          color: #695d52;
          text-align: center;
          font-size: 14px;
          font-weight: 700;
        }

        .text-button {
          border: 0;
          background: transparent;
          color: #ea580c;
          font-weight: 1000;
          cursor: pointer;
        }

        @media (max-width: 980px) {
          .auth-layout {
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

          .hero-card,
          .auth-card {
            padding: 24px;
          }

          .hero-title {
            font-size: 42px;
          }

          .tabs {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <nav className="nav">
        <div className="container nav-inner">
          <a href="/" className="brand">
            <div className="brand-icon">🍱</div>
            <div>
              <p className="brand-title">Kline&apos;s Daily Meals</p>
              <p className="brand-subtitle">Customer account access</p>
            </div>
          </a>

          <div className="nav-actions">
            <a className="pill-link" href="/">
              Back to Menu
            </a>
          </div>
        </div>
      </nav>

      <section className="container auth-layout">
        <div className="hero-card">
          <div className="eyebrow">✨ Better customer experience</div>

          <h1 className="hero-title">
            Login once,
            <span>order faster forever.</span>
          </h1>

          <p className="hero-text">
            Create an account to save your checkout details, track your order
            history, use support tickets, and chat with admin.
          </p>

          <div className="feature-grid">
            <div className="feature">
              <strong>🍱 Faster checkout</strong>
              <span>Your name, contact number, and address can autofill.</span>
            </div>

            <div className="feature">
              <strong>📦 Order history</strong>
              <span>View your previous orders and payment/order status.</span>
            </div>

            <div className="feature">
              <strong>💬 Support and live chat</strong>
              <span>Contact admin directly when you need help.</span>
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="tabs">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`tab-button ${mode === "login" ? "active" : ""}`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`tab-button ${mode === "signup" ? "active" : ""}`}
            >
              Create
            </button>

            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className={`tab-button ${mode === "forgot" ? "active" : ""}`}
            >
              Forgot
            </button>
          </div>

          <div className="form-head">
            <p className="section-kicker">
              {mode === "login"
                ? "Welcome Back"
                : mode === "signup"
                ? "New Customer"
                : "Password Help"}
            </p>

            <h2 className="section-title">
              {mode === "login"
                ? "Login"
                : mode === "signup"
                ? "Create Account"
                : "Reset Password"}
            </h2>

            <p className="section-desc">
              {mode === "login"
                ? "Access your customer account and saved order tools."
                : mode === "signup"
                ? "Create an account to make future orders easier."
                : "Enter your email and we’ll send a password reset link."}
            </p>
          </div>

          {mode === "login" && (
            <form className="form-grid" onSubmit={login}>
              <div className="form-group">
                <label>Email</label>
                <input
                  className="field"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@email.com"
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  className="field"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                />
              </div>

              <button
                className="button button-orange"
                type="submit"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>

              <p className="switch-text">
                No account yet?{" "}
                <button
                  className="text-button"
                  type="button"
                  onClick={() => switchMode("signup")}
                >
                  Create one
                </button>
              </p>
            </form>
          )}

          {mode === "signup" && (
            <form className="form-grid" onSubmit={signup}>
              <div className="form-group">
                <label>Email</label>
                <input
                  className="field"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@email.com"
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  className="field"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create password"
                />
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input
                  className="field"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter full name"
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

              <div className="form-group">
                <label>Default Address Optional</label>
                <textarea
                  className="textarea"
                  value={defaultAddress}
                  onChange={(event) => setDefaultAddress(event.target.value)}
                  placeholder="Complete address, landmark, or pickup note"
                />
              </div>

              <button
                className="button button-orange"
                type="submit"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Account"}
              </button>

              <div className="mini-note">
                If Supabase email confirmation is enabled, the customer may need
                to confirm their email before logging in.
              </div>

              <p className="switch-text">
                Already have an account?{" "}
                <button
                  className="text-button"
                  type="button"
                  onClick={() => switchMode("login")}
                >
                  Login
                </button>
              </p>
            </form>
          )}

          {mode === "forgot" && (
            <form className="form-grid" onSubmit={forgotPassword}>
              <div className="form-group">
                <label>Email</label>
                <input
                  className="field"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@email.com"
                />
              </div>

              <button
                className="button button-orange"
                type="submit"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Email"}
              </button>

              <p className="switch-text">
                Remember your password?{" "}
                <button
                  className="text-button"
                  type="button"
                  onClick={() => switchMode("login")}
                >
                  Login
                </button>
              </p>
            </form>
          )}

          {message && <div className="message-box">{message}</div>}
        </div>
      </section>
    </main>
  );
}