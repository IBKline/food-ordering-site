"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!email || !password) {
      alert("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setMessage("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        alert(`Sign up failed: ${error.message}`);
        setLoading(false);
        return;
      }

      setMessage(
        "Account created. If email confirmation is enabled, please check your email before logging in."
      );
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(`Login failed: ${error.message}`);
        setLoading(false);
        return;
      }

      window.location.href = "/";
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-white p-5 text-black">
      <div className="mx-auto max-w-md">
        <div className="mb-5">
          <a
            href="/"
            className="rounded-xl border border-gray-400 bg-gray-100 px-4 py-2 font-bold text-black hover:bg-gray-200"
          >
            Back to Menu
          </a>
        </div>

        <section className="rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-black">
            {mode === "login" ? "Customer Login" : "Create Account"}
          </h1>

          <p className="mt-2 text-gray-900">
            Login is optional. You can still order as a guest, but logging in lets
            you track your order history.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={`rounded-xl border px-4 py-2 font-bold ${
                mode === "login"
                  ? "border-orange-700 bg-orange-100 text-orange-900"
                  : "border-gray-400 bg-gray-100 text-black hover:bg-gray-200"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMessage("");
              }}
              className={`rounded-xl border px-4 py-2 font-bold ${
                mode === "signup"
                  ? "border-orange-700 bg-orange-100 text-orange-900"
                  : "border-gray-400 bg-gray-100 text-black hover:bg-gray-200"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
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

            <div>
              <label className="font-semibold text-black">Password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-3 font-bold text-orange-900 hover:bg-orange-200 disabled:opacity-60"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Login"
                : "Create Account"}
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