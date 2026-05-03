"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Meal = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_available: boolean;
};

type CartItem = Meal & {
  quantity: number;
};

type Profile = {
  full_name: string | null;
  contact_number: string | null;
  default_address: string | null;
};

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [loadingMeals, setLoadingMeals] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("delivery");
  const [address, setAddress] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [notes, setNotes] = useState("");

  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofInputKey, setPaymentProofInputKey] = useState(0);

  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchMeals();
    loadCurrentUser();
    setDefaultSchedule();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user || null;
      setUser(authUser);

      if (authUser) {
        await loadProfile(authUser.id);
      } else {
        setLoadingProfile(false);
        setCart([]);
        setCustomerName("");
        setContactNumber("");
        setAddress("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    if (user) {
      await loadProfile(user.id);
    } else {
      setLoadingProfile(false);
    }
  }

  async function loadProfile(userId: string) {
    setLoadingProfile(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, contact_number, default_address")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile load error:", error);
      setLoadingProfile(false);
      return;
    }

    const profile = data as Profile | null;

    if (profile) {
      setCustomerName(profile.full_name || "");
      setContactNumber(profile.contact_number || "");
      setAddress(profile.default_address || "");
    }

    setLoadingProfile(false);
  }

  async function fetchMeals() {
    setLoadingMeals(true);

    const { data, error } = await supabase
      .from("meals")
      .select("id, name, description, price, image_url, category, is_available")
      .eq("is_available", true);

    if (error) {
      console.error("Meals load error:", error);
      alert(
        `Failed to load meals: ${
          error.message || error.details || error.hint || "Unknown Supabase error"
        }`
      );
      setLoadingMeals(false);
      return;
    }

    setMeals((data || []) as Meal[]);
    setLoadingMeals(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setCart([]);
    setCustomerName("");
    setContactNumber("");
    setAddress("");
  }

  function requireLogin() {
    alert("Please login or create an account before ordering.");
    window.location.href = "/login";
  }

  function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getCurrentTime() {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;

    if (roundedMinutes === 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
    } else {
      now.setMinutes(roundedMinutes);
    }

    return `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
  }

  function setDefaultSchedule() {
    setPreferredDate(getTodayDate());
    setPreferredTime(getCurrentTime());
  }

  function addToCart(meal: Meal) {
    if (!user) {
      requireLogin();
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.id === meal.id);

      if (existing) {
        return current.map((item) =>
          item.id === meal.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { ...meal, quantity: 1 }];
    });
  }

  function increaseQuantity(mealId: string) {
    if (!user) {
      requireLogin();
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.id === mealId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  function decreaseQuantity(mealId: string) {
    if (!user) {
      requireLogin();
      return;
    }

    setCart((current) =>
      current
        .map((item) =>
          item.id === mealId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(mealId: string) {
    if (!user) {
      requireLogin();
      return;
    }

    setCart((current) => current.filter((item) => item.id !== mealId));
  }

  function formatPeso(amount: number) {
    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  const total = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );
  }, [cart]);

  const categories = useMemo(() => {
    const list = meals.map((meal) => meal.category || "Others");
    return ["all", ...Array.from(new Set(list))];
  }, [meals]);

  const filteredMeals = useMemo(() => {
    const search = menuSearch.trim().toLowerCase();

    return meals.filter((meal) => {
      const category = meal.category || "Others";

      const matchesCategory =
        selectedCategory === "all" || category === selectedCategory;

      const matchesSearch =
        !search ||
        meal.name.toLowerCase().includes(search) ||
        (meal.description || "").toLowerCase().includes(search) ||
        category.toLowerCase().includes(search);

      return matchesCategory && matchesSearch;
    });
  }, [meals, menuSearch, selectedCategory]);

  async function uploadPaymentProof(orderId: string) {
    if (!paymentProofFile) return null;

    const extension = paymentProofFile.name.split(".").pop() || "jpg";
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;
    const filePath = `orders/${orderId}/${fileName}`;

    const { error } = await supabase.storage
      .from("payment-proofs")
      .upload(filePath, paymentProofFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Payment proof upload error:", error);
      alert(`Failed to upload payment proof: ${error.message}`);
      return null;
    }

    return filePath;
  }

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();
    setSuccessMessage("");

    if (!user) {
      requireLogin();
      return;
    }

    if (cart.length === 0) {
      alert("Please add at least one meal.");
      return;
    }

    if (!customerName.trim()) {
      alert("Please enter your full name.");
      return;
    }

    if (!contactNumber.trim()) {
      alert("Please enter your contact number.");
      return;
    }

    if (!preferredDate) {
      alert("Please select your preferred date.");
      return;
    }

    if (!preferredTime) {
      alert("Please select your preferred time.");
      return;
    }

    if (!address.trim()) {
      alert("Please enter your address or pickup note.");
      return;
    }

    if (preferredDate === getTodayDate() && preferredTime < getCurrentTime()) {
      alert("Please choose a later time.");
      setPreferredTime(getCurrentTime());
      return;
    }

    setSubmitting(true);

    const orderId = crypto.randomUUID();
    const paymentProofPath = await uploadPaymentProof(orderId);

    if (paymentProofFile && !paymentProofPath) {
      setSubmitting(false);
      return;
    }

    const { error: orderError } = await supabase.from("orders").insert({
      id: orderId,
      user_id: user.id,
      customer_name: customerName.trim(),
      contact_number: contactNumber.trim(),
      delivery_method: deliveryMethod,
      address: address.trim(),
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      payment_method: "GCash",
      payment_status: "unpaid",
      order_status: "pending",
      payment_proof_path: paymentProofPath,
      notes: notes.trim() || null,
      total,
    });

    if (orderError) {
      console.error("Order insert error:", orderError);
      alert(`Failed to submit order: ${orderError.message}`);
      setSubmitting(false);
      return;
    }

    const orderItems = cart.map((item) => ({
      order_id: orderId,
      meal_id: item.id,
      meal_name: item.name,
      quantity: item.quantity,
      unit_price: Number(item.price),
      subtotal: Number(item.price) * item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Order items insert error:", itemsError);
      alert(`Order created, but items failed to save: ${itemsError.message}`);
      setSubmitting(false);
      return;
    }

    setSuccessMessage(
      paymentProofPath
        ? `Order submitted successfully! Total: ${formatPeso(
            total
          )}. Your payment proof was uploaded.`
        : `Order submitted successfully! Total: ${formatPeso(
            total
          )}. Please send or upload your payment screenshot for confirmation.`
    );

    setCart([]);
    setNotes("");
    setPaymentProofFile(null);
    setPaymentProofInputKey((current) => current + 1);
    setSubmitting(false);
    setDefaultSchedule();
  }

  return (
    <main className="homepage">
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

        .homepage {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(255, 186, 73, 0.32), transparent 34rem),
            radial-gradient(circle at top right, rgba(20, 184, 166, 0.22), transparent 32rem),
            linear-gradient(180deg, #fffaf0 0%, #f7f3ea 42%, #fff 100%);
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
          position: relative;
          overflow: hidden;
          padding: 72px 0 54px;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          gap: 42px;
          align-items: center;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(234, 88, 12, 0.22);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.78);
          color: #9a3412;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 950;
          box-shadow: 0 14px 40px rgba(32, 26, 22, 0.06);
        }

        .hero-title {
          margin: 22px 0 0;
          max-width: 760px;
          color: #18120e;
          font-size: clamp(44px, 7vw, 78px);
          line-height: 0.94;
          letter-spacing: -0.08em;
          font-weight: 1000;
        }

        .hero-title span {
          display: block;
          background: linear-gradient(135deg, #ea580c, #0f766e);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero-text {
          max-width: 640px;
          margin: 24px 0 0;
          color: #5a4b40;
          font-size: 18px;
          line-height: 1.8;
          font-weight: 650;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 32px;
        }

        .button {
          border: 0;
          border-radius: 20px;
          padding: 15px 21px;
          color: white;
          background: #18120e;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: 160ms ease;
        }

        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 32px rgba(24, 18, 14, 0.16);
        }

        .button-orange {
          background: linear-gradient(135deg, #ea580c, #f59e0b);
        }

        .button-outline {
          background: rgba(255, 255, 255, 0.78);
          color: #201a16;
          border: 1px solid rgba(32, 26, 22, 0.12);
        }

        .hero-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          max-width: 650px;
          margin-top: 34px;
        }

        .stat {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.7);
          padding: 18px;
          box-shadow: 0 18px 40px rgba(32, 26, 22, 0.06);
        }

        .stat strong {
          display: block;
          color: #18120e;
          font-size: 24px;
          font-weight: 1000;
        }

        .stat span {
          display: block;
          margin-top: 4px;
          color: #766a5d;
          font-size: 13px;
          font-weight: 800;
        }

        .hero-card {
          border: 1px solid rgba(255, 255, 255, 0.52);
          border-radius: 36px;
          background: rgba(255, 255, 255, 0.55);
          padding: 14px;
          box-shadow: 0 30px 80px rgba(32, 26, 22, 0.12);
        }

        .hero-card-inner {
          overflow: hidden;
          border-radius: 28px;
          background: #18120e;
          color: white;
        }

        .hero-card-top {
          padding: 34px;
          background:
            radial-gradient(circle at top right, rgba(250, 204, 21, 0.42), transparent 18rem),
            linear-gradient(135deg, #0f766e, #111827);
        }

        .hero-card-top h2 {
          margin: 24px 0 0;
          font-size: 36px;
          line-height: 1;
          letter-spacing: -0.05em;
          font-weight: 1000;
        }

        .hero-card-top p {
          margin: 14px 0 0;
          color: rgba(255, 255, 255, 0.82);
          line-height: 1.7;
          font-weight: 650;
        }

        .hero-card-list {
          display: grid;
          gap: 12px;
          padding: 18px;
        }

        .hero-card-item {
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.08);
          padding: 16px;
        }

        .hero-card-item strong {
          display: block;
          font-size: 15px;
        }

        .hero-card-item span {
          display: block;
          margin-top: 5px;
          color: rgba(255, 255, 255, 0.68);
          font-size: 13px;
          line-height: 1.5;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          padding: 32px 0;
        }

        .feature-card {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.86);
          padding: 24px;
          box-shadow: 0 18px 42px rgba(32, 26, 22, 0.06);
        }

        .feature-icon {
          display: grid;
          place-items: center;
          width: 50px;
          height: 50px;
          border-radius: 18px;
          background: #fff3df;
          font-size: 24px;
        }

        .feature-card h3 {
          margin: 16px 0 0;
          font-size: 18px;
          letter-spacing: -0.03em;
          font-weight: 1000;
        }

        .feature-card p {
          margin: 8px 0 0;
          color: #695d52;
          line-height: 1.65;
          font-size: 14px;
          font-weight: 650;
        }

        .section {
          padding: 42px 0;
        }

        .section-header {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 22px;
          margin-bottom: 22px;
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
        }

        .cutoff-badge {
          border-radius: 18px;
          background: #e9fbf7;
          color: #0f766e;
          padding: 13px 16px;
          font-size: 13px;
          font-weight: 1000;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 260px;
          gap: 12px;
          margin-bottom: 22px;
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

        .field:focus,
        .select:focus,
        .textarea:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
        }

        .textarea {
          min-height: 96px;
          resize: vertical;
        }

        .meal-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
        }

        .meal-card {
          overflow: hidden;
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 30px;
          background: white;
          box-shadow: 0 18px 44px rgba(32, 26, 22, 0.07);
          transition: 180ms ease;
        }

        .meal-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 28px 66px rgba(32, 26, 22, 0.12);
        }

        .meal-image-wrap {
          position: relative;
          height: 230px;
          overflow: hidden;
          background:
            radial-gradient(circle at top right, rgba(245, 158, 11, 0.28), transparent 12rem),
            linear-gradient(135deg, #fef3c7, #ccfbf1);
        }

        .meal-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .meal-fallback {
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
          font-size: 68px;
        }

        .category-chip {
          position: absolute;
          top: 16px;
          left: 16px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          color: #9a3412;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 1000;
          box-shadow: 0 10px 24px rgba(32, 26, 22, 0.1);
        }

        .meal-content {
          padding: 20px;
        }

        .meal-top {
          display: flex;
          justify-content: space-between;
          gap: 14px;
        }

        .meal-title {
          margin: 0;
          color: #18120e;
          font-size: 21px;
          line-height: 1.15;
          letter-spacing: -0.04em;
          font-weight: 1000;
        }

        .price {
          height: fit-content;
          flex-shrink: 0;
          border-radius: 16px;
          background: #e9fbf7;
          color: #0f766e;
          padding: 10px 12px;
          font-weight: 1000;
        }

        .meal-desc {
          min-height: 48px;
          margin: 12px 0 0;
          color: #695d52;
          font-size: 14px;
          line-height: 1.65;
          font-weight: 650;
        }

        .add-button {
          width: 100%;
          margin-top: 18px;
          border: 0;
          border-radius: 18px;
          background: linear-gradient(135deg, #18120e, #0f766e);
          color: white;
          padding: 14px 18px;
          font-weight: 1000;
          cursor: pointer;
          transition: 160ms ease;
        }

        .add-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 30px rgba(15, 118, 110, 0.22);
        }

        .login-lock {
          margin-bottom: 22px;
          border: 1px solid rgba(234, 88, 12, 0.18);
          border-radius: 28px;
          background: #fff7ed;
          padding: 22px;
          color: #9a3412;
          box-shadow: 0 18px 42px rgba(32, 26, 22, 0.06);
        }

        .login-lock h3 {
          margin: 0;
          color: #9a3412;
          font-size: 24px;
          letter-spacing: -0.04em;
          font-weight: 1000;
        }

        .login-lock p {
          margin: 8px 0 0;
          color: #9a3412;
          line-height: 1.65;
          font-weight: 700;
        }

        .order-layout {
          display: grid;
          grid-template-columns: 0.92fr 1.08fr;
          gap: 22px;
          align-items: start;
        }

        .panel {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 20px 50px rgba(32, 26, 22, 0.07);
        }

        .cart-panel {
          position: sticky;
          top: 96px;
          padding: 20px;
        }

        .panel-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
        }

        .panel-title {
          margin: 0;
          color: #18120e;
          font-size: 28px;
          letter-spacing: -0.05em;
          font-weight: 1000;
        }

        .panel-subtitle {
          margin: 4px 0 0;
          color: #766a5d;
          font-size: 13px;
          font-weight: 750;
        }

        .total-pill {
          border-radius: 18px;
          background: #18120e;
          color: white;
          padding: 11px 14px;
          text-align: right;
        }

        .total-pill span {
          display: block;
          color: rgba(255, 255, 255, 0.66);
          font-size: 11px;
          font-weight: 800;
        }

        .total-pill strong {
          display: block;
          margin-top: 2px;
          font-size: 20px;
          font-weight: 1000;
        }

        .empty-cart {
          margin-top: 18px;
          border: 1px dashed rgba(32, 26, 22, 0.2);
          border-radius: 24px;
          background: #fffaf0;
          padding: 30px 18px;
          text-align: center;
        }

        .empty-cart div {
          font-size: 48px;
        }

        .empty-cart strong {
          display: block;
          margin-top: 10px;
        }

        .empty-cart p {
          margin: 5px 0 0;
          color: #766a5d;
          font-size: 14px;
        }

        .cart-list {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .cart-item {
          border: 1px solid rgba(32, 26, 22, 0.09);
          border-radius: 22px;
          background: #fffaf0;
          padding: 15px;
        }

        .cart-item-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .cart-name {
          margin: 0;
          color: #18120e;
          font-weight: 1000;
          letter-spacing: -0.03em;
        }

        .cart-price {
          margin: 5px 0 0;
          color: #695d52;
          font-size: 13px;
          font-weight: 750;
        }

        .remove-button {
          border: 1px solid rgba(190, 18, 60, 0.18);
          border-radius: 999px;
          background: white;
          color: #be123c;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 1000;
          cursor: pointer;
        }

        .cart-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 14px;
        }

        .qty {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .qty-button {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border: 1px solid rgba(32, 26, 22, 0.14);
          border-radius: 999px;
          background: white;
          color: #18120e;
          font-size: 18px;
          font-weight: 1000;
          cursor: pointer;
        }

        .qty-number {
          width: 28px;
          text-align: center;
          font-weight: 1000;
        }

        .cart-line-total {
          color: #0f766e;
          font-weight: 1000;
        }

        .checkout-panel {
          padding: 24px;
        }

        .checkout-badge {
          display: inline-flex;
          border-radius: 999px;
          background: #e9fbf7;
          color: #0f766e;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 1000;
        }

        .checkout-title {
          margin: 10px 0 0;
          color: #18120e;
          font-size: 36px;
          letter-spacing: -0.06em;
          line-height: 1;
          font-weight: 1000;
        }

        .checkout-note {
          margin-top: 16px;
          border-radius: 20px;
          background: #fffaf0;
          color: #695d52;
          padding: 14px;
          line-height: 1.6;
          font-size: 14px;
          font-weight: 650;
        }

        .form-grid {
          display: grid;
          gap: 16px;
          margin-top: 22px;
        }

        .two-cols {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #201a16;
          font-weight: 1000;
        }

        .payment-box {
          border: 1px solid rgba(15, 118, 110, 0.18);
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(20, 184, 166, 0.16), transparent 16rem),
            #e9fbf7;
          padding: 18px;
        }

        .payment-box h3 {
          margin: 0;
          color: #0f766e;
          font-size: 20px;
          letter-spacing: -0.03em;
          font-weight: 1000;
        }

        .payment-box p {
          margin: 8px 0 0;
          color: #115e59;
          line-height: 1.6;
          font-size: 14px;
          font-weight: 700;
        }

        .gcash-card {
          margin-top: 14px;
          border-radius: 18px;
          background: white;
          padding: 14px;
        }

        .gcash-card span {
          display: block;
          color: #766a5d;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .gcash-card strong {
          display: block;
          margin-top: 5px;
          color: #18120e;
          font-size: 18px;
          font-weight: 1000;
        }

        .upload-box {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 24px;
          background: #fffaf0;
          padding: 18px;
        }

        .selected-file {
          margin-top: 12px;
          border-radius: 16px;
          background: #dcfce7;
          color: #166534;
          padding: 12px;
          font-size: 13px;
          font-weight: 900;
        }

        .submit-box {
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(245, 158, 11, 0.26), transparent 14rem),
            #18120e;
          color: white;
          padding: 20px;
        }

        .submit-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .submit-content span {
          display: block;
          color: rgba(255, 255, 255, 0.68);
          font-size: 13px;
          font-weight: 800;
        }

        .submit-content strong {
          display: block;
          margin-top: 4px;
          font-size: 36px;
          line-height: 1;
          font-weight: 1000;
        }

        .submit-button {
          border: 0;
          border-radius: 18px;
          background: linear-gradient(135deg, #ea580c, #f59e0b);
          color: white;
          padding: 15px 22px;
          font-weight: 1000;
          cursor: pointer;
          box-shadow: 0 16px 34px rgba(234, 88, 12, 0.22);
        }

        .submit-button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .success {
          border: 1px solid rgba(22, 101, 52, 0.22);
          border-radius: 22px;
          background: #dcfce7;
          color: #166534;
          padding: 16px;
          font-weight: 900;
          line-height: 1.5;
        }

        .support-strip {
          margin: 44px 0;
          border-radius: 34px;
          background:
            radial-gradient(circle at top right, rgba(20, 184, 166, 0.2), transparent 20rem),
            linear-gradient(135deg, #18120e, #0f766e);
          color: white;
          padding: 34px;
        }

        .support-strip-content {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 20px;
          align-items: center;
        }

        .support-strip h2 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.05em;
          font-weight: 1000;
        }

        .support-strip p {
          margin: 10px 0 0;
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.7;
          font-weight: 650;
        }

        .support-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .white-button {
          border-radius: 18px;
          background: white;
          color: #18120e;
          padding: 14px 18px;
          text-decoration: none;
          font-weight: 1000;
        }

        .orange-button {
          border-radius: 18px;
          background: #ea580c;
          color: white;
          padding: 14px 18px;
          text-decoration: none;
          font-weight: 1000;
        }

        .footer {
          border-top: 1px solid rgba(32, 26, 22, 0.1);
          background: rgba(255, 255, 255, 0.7);
          padding: 34px 0;
        }

        .footer-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
        }

        .footer strong {
          display: block;
          font-size: 18px;
          font-weight: 1000;
        }

        .footer span {
          display: block;
          margin-top: 4px;
          color: #766a5d;
          font-size: 14px;
          font-weight: 650;
        }

        .loading-card {
          border: 1px solid rgba(32, 26, 22, 0.1);
          border-radius: 24px;
          background: white;
          padding: 22px;
          color: #695d52;
          font-weight: 800;
        }

        @media (max-width: 980px) {
          .hero-grid,
          .order-layout,
          .support-strip-content {
            grid-template-columns: 1fr;
          }

          .meal-grid,
          .feature-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .cart-panel {
            position: static;
          }
        }

        @media (max-width: 700px) {
          .nav-inner {
            align-items: flex-start;
            flex-direction: column;
          }

          .nav-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .hero {
            padding-top: 46px;
          }

          .hero-stats,
          .meal-grid,
          .feature-grid,
          .filters,
          .two-cols {
            grid-template-columns: 1fr;
          }

          .hero-title {
            font-size: 45px;
          }

          .submit-content {
            align-items: stretch;
            flex-direction: column;
          }

          .submit-button {
            width: 100%;
          }

          .footer-inner {
            align-items: flex-start;
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
              <p className="brand-subtitle">Elegant comfort meals by pre-order</p>
            </div>
          </a>

          <div className="nav-actions">
            {user ? (
              <>
                <a className="pill-link" href="/account/profile">
                  Profile
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
                <button className="pill-button" type="button" onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <a className="pill-link pill-primary" href="/login">
                Login / Create Account
              </a>
            )}
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">✨ Account-required pre-order meals</div>

            <h1 className="hero-title">
              Home-cooked meals with a
              <span>premium ordering feel.</span>
            </h1>

            <p className="hero-text">
              Simple pre-ordering for rice meals, pasta, and budget-friendly
              comfort dishes. To protect both customers and the business, an
              account is required before placing an order.
            </p>

            <div className="hero-actions">
              <a className="button button-orange" href="#menu">
                Browse Menu
              </a>

              {user ? (
                <a className="button button-outline" href="#checkout">
                  Checkout
                </a>
              ) : (
                <a className="button button-outline" href="/login">
                  Login to Order
                </a>
              )}

              {user && (
                <a className="button button-outline" href="/account/live-chat">
                  Ask Admin
                </a>
              )}
            </div>

            <div className="hero-stats">
              <div className="stat">
                <strong>Account</strong>
                <span>Required to order</span>
              </div>
              <div className="stat">
                <strong>GCash</strong>
                <span>Payment proof upload</span>
              </div>
              <div className="stat">
                <strong>CRM</strong>
                <span>Order history saved</span>
              </div>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-inner">
              <div className="hero-card-top">
                <div className="eyebrow">Today&apos;s Reminder</div>
                <h2>Login first. Order safely.</h2>
                <p>
                  Requiring an account helps us prevent fake orders, protect
                  customer records, and contact you properly for updates.
                </p>
              </div>

              <div className="hero-card-list">
                <div className="hero-card-item">
                  <strong>👤 Verified customer flow</strong>
                  <span>Your order history is connected to your account.</span>
                </div>
                <div className="hero-card-item">
                  <strong>📸 Upload payment proof</strong>
                  <span>Attach your GCash screenshot directly at checkout.</span>
                </div>
                <div className="hero-card-item">
                  <strong>💬 Need help?</strong>
                  <span>Use support or live chat after logging in.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!user && (
        <section className="container">
          <div className="login-lock">
            <h3>Login required before ordering</h3>
            <p>
              You can browse the menu freely, but you need an account to add
              meals to cart, upload payment proof, and submit an order.
            </p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <a className="button button-orange" href="/login">
                Login / Create Account
              </a>
            </div>
          </div>
        </section>
      )}

      <section className="container feature-grid">
        <div className="feature-card">
          <div className="feature-icon">💳</div>
          <h3>Payment First</h3>
          <p>
            Orders are confirmed after your GCash payment proof is received and
            reviewed.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🛵</div>
          <h3>Delivery or Pickup</h3>
          <p>
            Choose delivery or pickup. Delivery fee is shouldered by the
            customer unless stated otherwise.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">👤</div>
          <h3>Account Required</h3>
          <p>
            Orders are connected to a customer account for safer transactions and
            better support.
          </p>
        </div>
      </section>

      <section id="menu" className="container section">
        <div className="section-header">
          <div>
            <p className="section-kicker">Menu</p>
            <h2 className="section-title">Available Meals</h2>
            <p className="section-desc">
              Browse the menu. Login is required when you are ready to order.
            </p>
          </div>

          <div className="cutoff-badge">Pre-order system</div>
        </div>

        <div className="filters">
          <input
            className="field"
            value={menuSearch}
            onChange={(event) => setMenuSearch(event.target.value)}
            placeholder="Search meals, descriptions, or category..."
          />

          <select
            className="select"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === "all" ? "All Categories" : category}
              </option>
            ))}
          </select>
        </div>

        {loadingMeals ? (
          <div className="loading-card">Loading meals...</div>
        ) : filteredMeals.length === 0 ? (
          <div className="loading-card">No meals available right now.</div>
        ) : (
          <div className="meal-grid">
            {filteredMeals.map((meal) => (
              <div className="meal-card" key={meal.id}>
                <div className="meal-image-wrap">
                  {meal.image_url ? (
                    <img
                      className="meal-image"
                      src={meal.image_url}
                      alt={meal.name}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="meal-fallback">🍱</div>
                  )}

                  <div className="category-chip">{meal.category || "Meal"}</div>
                </div>

                <div className="meal-content">
                  <div className="meal-top">
                    <div>
                      <h3 className="meal-title">{meal.name}</h3>
                      <p className="meal-desc">
                        {meal.description || "Freshly prepared comfort meal."}
                      </p>
                    </div>

                    <div className="price">
                      {formatPeso(Number(meal.price))}
                    </div>
                  </div>

                  <button
                    className="add-button"
                    type="button"
                    onClick={() => addToCart(meal)}
                  >
                    {user ? "Add to Order" : "Login to Order"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="checkout" className="container section">
        <div className="order-layout">
          <aside className="panel cart-panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Your Cart</h2>
                <p className="panel-subtitle">
                  {cart.length} item{cart.length === 1 ? "" : "s"} selected
                </p>
              </div>

              <div className="total-pill">
                <span>Total</span>
                <strong>{formatPeso(total)}</strong>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart">
                <div>🛒</div>
                <strong>{user ? "Your cart is empty" : "Login to start cart"}</strong>
                <p>
                  {user
                    ? "Add meals from the menu to begin."
                    : "You need an account before adding meals."}
                </p>
              </div>
            ) : (
              <div className="cart-list">
                {cart.map((item) => (
                  <div className="cart-item" key={item.id}>
                    <div className="cart-item-top">
                      <div>
                        <p className="cart-name">{item.name}</p>
                        <p className="cart-price">
                          {formatPeso(Number(item.price))} each
                        </p>
                      </div>

                      <button
                        className="remove-button"
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="cart-controls">
                      <div className="qty">
                        <button
                          className="qty-button"
                          type="button"
                          onClick={() => decreaseQuantity(item.id)}
                        >
                          -
                        </button>

                        <span className="qty-number">{item.quantity}</span>

                        <button
                          className="qty-button"
                          type="button"
                          onClick={() => increaseQuantity(item.id)}
                        >
                          +
                        </button>
                      </div>

                      <div className="cart-line-total">
                        {formatPeso(Number(item.price) * item.quantity)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <form className="panel checkout-panel" onSubmit={submitOrder}>
            <div className="checkout-badge">
              {user ? "Logged-in checkout" : "Login required"}
            </div>

            <h2 className="checkout-title">Complete Your Order</h2>

            <p className="checkout-note">
              {loadingProfile
                ? "Loading your profile..."
                : user
                ? "Your saved profile details were loaded. You can edit them for this order."
                : "Please login or create an account before placing an order. This protects your order history and helps us contact you properly."}
            </p>

            {!user && (
              <div className="login-lock" style={{ marginTop: 18 }}>
                <h3>Checkout is locked</h3>
                <p>
                  Please login or create an account first. After logging in, your
                  profile details can autofill here.
                </p>
                <div className="hero-actions" style={{ marginTop: 16 }}>
                  <a className="button button-orange" href="/login">
                    Login / Create Account
                  </a>
                </div>
              </div>
            )}

            <div className="form-grid">
              <div className="two-cols">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    className="field"
                    value={customerName}
                    disabled={!user}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label>Contact Number</label>
                  <input
                    className="field"
                    value={contactNumber}
                    disabled={!user}
                    onChange={(event) => setContactNumber(event.target.value)}
                    placeholder="09XXXXXXXXX"
                  />
                </div>
              </div>

              <div className="two-cols">
                <div className="form-group">
                  <label>Preferred Date</label>
                  <input
                    className="field"
                    type="date"
                    min={getTodayDate()}
                    value={preferredDate}
                    disabled={!user}
                    onChange={(event) => {
                      const newDate = event.target.value;
                      setPreferredDate(newDate);

                      if (
                        newDate === getTodayDate() &&
                        preferredTime < getCurrentTime()
                      ) {
                        setPreferredTime(getCurrentTime());
                      }
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Preferred Time</label>
                  <input
                    className="field"
                    type="time"
                    value={preferredTime}
                    disabled={!user}
                    min={
                      preferredDate === getTodayDate()
                        ? getCurrentTime()
                        : undefined
                    }
                    onChange={(event) => setPreferredTime(event.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Delivery Method</label>
                <select
                  className="select"
                  value={deliveryMethod}
                  disabled={!user}
                  onChange={(event) => setDeliveryMethod(event.target.value)}
                >
                  <option value="delivery">Delivery</option>
                  <option value="pickup">Pickup</option>
                </select>
              </div>

              <div className="form-group">
                <label>Address / Pickup Note</label>
                <textarea
                  className="textarea"
                  value={address}
                  disabled={!user}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Complete address, landmark, or pickup details"
                />
              </div>

              <div className="form-group">
                <label>Special Instructions</label>
                <textarea
                  className="textarea"
                  value={notes}
                  disabled={!user}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes, food preferences, or instructions"
                />
              </div>

              <div className="payment-box">
                <h3>Payment Instructions</h3>
                <p>
                  Please pay via GCash and upload your screenshot below for
                  faster confirmation.
                </p>

                <div className="gcash-card">
                  <span>GCash Number</span>
                  <strong>09XX XXX XXXX</strong>
                </div>
              </div>

              <div className="upload-box">
                <div className="form-group">
                  <label>Upload Payment Proof</label>
                  <input
                    key={paymentProofInputKey}
                    className="field"
                    type="file"
                    accept="image/*"
                    disabled={!user}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setPaymentProofFile(file);
                    }}
                  />

                  {paymentProofFile && (
                    <div className="selected-file">
                      Selected: {paymentProofFile.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="submit-box">
                <div className="submit-content">
                  <div>
                    <span>Order Total</span>
                    <strong>{formatPeso(total)}</strong>
                  </div>

                  <button
                    className="submit-button"
                    type="submit"
                    disabled={submitting || !user}
                  >
                    {!user
                      ? "Login Required"
                      : submitting
                      ? "Submitting..."
                      : "Submit Order"}
                  </button>
                </div>
              </div>

              {successMessage && <div className="success">{successMessage}</div>}
            </div>
          </form>
        </div>
      </section>

      <section className="container">
        <div className="support-strip">
          <div className="support-strip-content">
            <div>
              <h2>Need help with your order?</h2>
              <p>
                Logged-in customers can use support tickets for detailed
                concerns or live chat for quick questions.
              </p>
            </div>

            <div className="support-actions">
              {user ? (
                <>
                  <a className="white-button" href="/account/support">
                    Support
                  </a>
                  <a className="orange-button" href="/account/live-chat">
                    Live Chat
                  </a>
                </>
              ) : (
                <a className="white-button" href="/login">
                  Login to Contact Us
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <strong>Kline&apos;s Daily Meals</strong>
            <span>Elegant, simple, and account-secured food ordering.</span>
          </div>

          <a className="pill-link" href="#menu">
            Back to Menu
          </a>
        </div>
      </footer>
    </main>
  );
}