"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();

    if (!password || !confirmPassword) {
      alert("Please enter and confirm your new password.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert(`Failed to update password: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Password updated successfully. You can now login.");
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-white p-5 text-black">
      <div className="mx-auto max-w-md">
        <section className="rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-black">Reset Password</h1>

          <p className="mt-2 text-black">
            Enter your new password below.
          </p>

          <form onSubmit={updatePassword} className="mt-5 grid gap-4">
            <div>
              <label className="font-semibold text-black">New Password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
              />
            </div>

            <div>
              <label className="font-semibold text-black">
                Confirm New Password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Retype your new password"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-3 font-bold text-orange-900 hover:bg-orange-200 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Update Password"}
            </button>

            {message && (
              <div className="rounded-xl border border-green-700 bg-green-100 p-4 text-green-900">
                {message}

                <div className="mt-4">
                  <a
                    href="/login"
                    className="inline-block rounded-xl border border-green-700 bg-white px-4 py-2 font-bold text-green-900 hover:bg-green-50"
                  >
                    Go to Login
                  </a>
                </div>
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}