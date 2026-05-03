"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type AdminGuardProps = {
  children: React.ReactNode;
};

export default function AdminGuard({ children }: AdminGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);
    setChecking(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-white p-5 text-black">
        <p>Checking admin access...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-white p-5 text-black">
        <div className="mx-auto max-w-xl rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-black">Admin Login Required</h1>

          <p className="mt-2 text-black">
            Please login with the admin account to access this page.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="/login"
              className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 font-bold text-orange-900 hover:bg-orange-200"
            >
              Login
            </a>

            <a
              href="/"
              className="rounded-xl border border-gray-400 bg-gray-100 px-4 py-2 font-bold text-black hover:bg-gray-200"
            >
              Back to Menu
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (user.email !== adminEmail) {
    return (
      <main className="min-h-screen bg-white p-5 text-black">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-300 bg-red-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-red-900">Access Denied</h1>

          <p className="mt-2 text-red-900">
            You are logged in, but this account is not allowed to access the admin page.
          </p>

          <p className="mt-3 text-sm text-red-900">
            Current account: {user.email}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-red-700 bg-red-100 px-4 py-2 font-bold text-red-900 hover:bg-red-200"
            >
              Logout
            </button>

            <a
              href="/"
              className="rounded-xl border border-gray-400 bg-white px-4 py-2 font-bold text-black hover:bg-gray-100"
            >
              Back to Menu
            </a>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}