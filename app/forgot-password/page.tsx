"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function sendResetEmail(event: React.FormEvent) {
    event.preventDefault();

    if (!email) {
      alert("Please enter your email.");
      return;
    }

    setSending(true);
    setMessage("");

    const origin = window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      alert(`Failed to send reset email: ${error.message}`);
      setSending(false);
      return;
    }

    setMessage("Password reset email sent. Please check your inbox.");
    setSending(false);
  }

  return (
    <main className="min-h-screen bg-white p-5 text-black">
      <div className="mx-auto max-w-md">
        <div className="mb-5">
          <a
            href="/login"
            className="rounded-xl border border-gray-400 bg-gray-100 px-4 py-2 font-bold text-black hover:bg-gray-200"
          >
            Back to Login
          </a>
        </div>

        <section className="rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-black">Forgot Password</h1>

          <p className="mt-2 text-black">
            Enter your account email and we’ll send a password reset link.
          </p>

          <form onSubmit={sendResetEmail} className="mt-5 grid gap-4">
            <div>
              <label className="font-semibold text-black">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="customer@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-3 font-bold text-orange-900 hover:bg-orange-200 disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send Reset Email"}
            </button>

            {message && (
              <div className="rounded-xl border border-green-700 bg-green-100 p-4 text-green-900">
                {message}
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}