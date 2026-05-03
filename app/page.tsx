"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

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

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("delivery");
  const [address, setAddress] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchMeals();
    loadUser();
    setDefaultDate();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  function setDefaultDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setPreferredDate(tomorrow.toISOString().split("T")[0]);
    setPreferredTime("12:00");
  }

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);
  }

  async function fetchMeals() {
    setLoading(true);

    const { data, error } = await supabase
      .from("meals")
      .select("*")
      .eq("is_available", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Meals error:", error);
      alert(`Failed to load meals: ${error.message}`);
    } else {
      setMeals((data || []) as Meal[]);
    }

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  function addToCart(meal: Meal) {
    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === meal.id);

      if (existingItem) {
        return currentCart.map((item) =>
          item.id === meal.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentCart, { ...meal, quantity: 1 }];
    });
  }

  function increaseQuantity(mealId: string) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === mealId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }

  function decreaseQuantity(mealId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === mealId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(mealId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== mealId)
    );
  }

  const total = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );
  }, [cart]);

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();

    if (cart.length === 0) {
      alert("Please add at least one meal.");
      return;
    }

    if (!customerName || !contactNumber || !address || !preferredDate || !preferredTime) {
      alert("Please complete your name, contact number, date, time, and address/pickup note.");
      return;
    }

    setSubmitting(true);
    setSuccessMessage("");

    const orderId = crypto.randomUUID();

    const { error: orderError } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        user_id: user?.id || null,
        customer_name: customerName,
        contact_number: contactNumber,
        delivery_method: deliveryMethod,
        address,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        payment_method: "GCash",
        payment_status: "unpaid",
        order_status: "pending",
        notes,
        total,
      });

    if (orderError) {
      console.error("Order error:", orderError);
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
      console.error("Items error:", itemsError);
      alert(`Order was created, but items failed to save: ${itemsError.message}`);
      setSubmitting(false);
      return;
    }

    setSuccessMessage(
      `Order submitted! Total: ₱${total}. Please send your GCash payment screenshot for confirmation.`
    );

    setCart([]);
    setCustomerName("");
    setContactNumber("");
    setAddress("");
    setNotes("");
    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="sticky top-0 z-20 border-b border-gray-300 bg-white/95 px-5 py-4 text-black backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <a href="/" className="text-xl font-extrabold text-black">
            Kline&apos;s Daily Meals
          </a>

          <div className="flex flex-wrap items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-sm text-black sm:inline">
                  {user.email}
                </span>

                <a
                  href="/account/orders"
                  className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 text-sm font-bold text-orange-900 hover:bg-orange-200"
                >
                  My Orders
                </a>

                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl border border-gray-400 bg-gray-100 px-4 py-2 text-sm font-bold text-black hover:bg-gray-200"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <span className="hidden text-sm text-black sm:inline">
                  Ordering as guest
                </span>

                <a
                  href="/login"
                  className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 text-sm font-bold text-orange-900 hover:bg-orange-200"
                >
                  Login / Create Account
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-orange-50 to-white px-5 py-12">
        <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
          <div>
            <p className="mb-3 inline-block rounded-full border border-orange-700 bg-orange-100 px-4 py-1 text-sm font-bold text-orange-900">
              Pre-order home-cooked meals
            </p>

            <h1 className="text-4xl font-extrabold leading-tight text-black md:text-5xl">
              Affordable rice meals and pasta for busy days.
            </h1>

            <p className="mt-4 max-w-xl text-lg text-black">
              Budget-friendly, filling, home-cooked meals made for students,
              workers, and busy people who need real food without spending too much.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#menu"
                className="rounded-xl border border-orange-700 bg-orange-600 px-5 py-3 font-bold text-white hover:bg-orange-700"
              >
                View Menu
              </a>

              <a
                href="#how-it-works"
                className="rounded-xl border border-gray-400 bg-white px-5 py-3 font-bold text-black hover:bg-gray-100"
              >
                How It Works
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-orange-200 bg-white p-5 shadow-sm">
            <div className="rounded-2xl bg-orange-100 p-6 text-center">
              <div className="text-7xl">🍱</div>
              <h2 className="mt-4 text-2xl font-bold text-black">
                Order one day before
              </h2>
              <p className="mt-2 text-black">
                Daily cut-off: <strong>8:00 PM</strong>. Payment first through
                GCash before confirmation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-black">Payment First</h3>
            <p className="mt-2 text-sm text-black">
              Orders are confirmed after GCash payment screenshot is sent.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-black">Delivery or Pickup</h3>
            <p className="mt-2 text-sm text-black">
              Delivery fee is shouldered by the customer. Pickup depends on availability.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-black">Guest Checkout</h3>
            <p className="mt-2 text-sm text-black">
              No account required. Login only if you want to track order history.
            </p>
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-extrabold text-black">Today&apos;s Menu</h2>
            <p className="mt-1 text-black">
              Choose your meals, add to cart, then submit your pre-order.
            </p>
          </div>

          <p className="rounded-full border border-orange-700 bg-orange-100 px-4 py-2 text-sm font-bold text-orange-900">
            Cut-off: 8:00 PM
          </p>
        </div>

        {loading ? (
          <p className="text-black">Loading meals...</p>
        ) : meals.length === 0 ? (
          <p className="rounded-xl border border-gray-300 bg-gray-50 p-5 text-black">
            No meals available right now.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm"
              >
                {meal.image_url ? (
                  <img
                    src={meal.image_url}
                    alt={meal.name}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-orange-100 text-5xl">
                    🍱
                  </div>
                )}

                <div className="p-5">
                  <p className="mb-2 inline-block rounded-full border border-orange-700 bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900">
                    {meal.category || "Meal"}
                  </p>

                  <h3 className="text-lg font-bold text-black">{meal.name}</h3>

                  <p className="mt-2 min-h-10 text-sm text-black">
                    {meal.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-2xl font-extrabold text-orange-900">
                      ₱{Number(meal.price)}
                    </p>

                    <button
                      onClick={() => addToCart(meal)}
                      className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 font-bold text-orange-900 hover:bg-orange-200"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-bold text-black">Your Order</h2>

          {cart.length === 0 ? (
            <p className="mt-4 rounded-xl border border-gray-300 bg-gray-50 p-4 text-black">
              Your cart is empty. Add a meal from the menu.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-300 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-black">{item.name}</h3>
                      <p className="text-sm text-black">
                        ₱{Number(item.price)} x {item.quantity} = ₱
                        {Number(item.price) * item.quantity}
                      </p>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="rounded-lg border border-red-700 bg-red-100 px-3 py-2 text-sm font-bold text-red-900 hover:bg-red-200"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => decreaseQuantity(item.id)}
                      className="rounded-lg border border-gray-400 bg-gray-100 px-3 py-1 font-bold text-black hover:bg-gray-200"
                    >
                      -
                    </button>

                    <span className="text-black">{item.quantity}</span>

                    <button
                      onClick={() => increaseQuantity(item.id)}
                      className="rounded-lg border border-gray-400 bg-gray-100 px-3 py-1 font-bold text-black hover:bg-gray-200"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-orange-300 bg-orange-50 p-4">
                <p className="text-right text-3xl font-extrabold text-orange-900">
                  Total: ₱{total}
                </p>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={submitOrder}
          className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm"
        >
          <h2 className="text-2xl font-bold text-black">Checkout</h2>

          <p className="mt-2 rounded-xl border border-gray-300 bg-gray-50 p-3 text-sm text-black">
            {user
              ? "You are logged in. This order will be saved to your order history."
              : "You are ordering as a guest. You can still submit an order, but login if you want to track your order history."}
          </p>

          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="font-semibold text-black">Full Name</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div>
                <label className="font-semibold text-black">Contact Number</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                  placeholder="09XXXXXXXXX"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="font-semibold text-black">Preferred Date</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black"
                  value={preferredDate}
                  onChange={(event) => setPreferredDate(event.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-black">Preferred Time</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black"
                  value={preferredTime}
                  onChange={(event) => setPreferredTime(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-black">Delivery Method</label>
              <select
                className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black"
                value={deliveryMethod}
                onChange={(event) => setDeliveryMethod(event.target.value)}
              >
                <option value="delivery">Delivery</option>
                <option value="pickup">Pickup</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-black">Address / Pickup Note</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Complete address, landmark, or pickup note"
              />
            </div>

            <div>
              <label className="font-semibold text-black">Special Instructions</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Example: no spicy sauce, extra rice request, etc."
              />
            </div>

            <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-black">
              <h3 className="font-bold text-black">Payment Instructions</h3>
              <p className="mt-1 text-sm text-black">
                After submitting, send payment through GCash and send your screenshot for confirmation.
              </p>
              <p className="mt-2 text-sm font-bold text-black">
                GCash: 09XX XXX XXXX
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl border border-orange-700 bg-orange-600 px-4 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Order"}
            </button>

            {successMessage && (
              <div className="rounded-xl border border-green-700 bg-green-100 p-4 text-green-900">
                {successMessage}
              </div>
            )}
          </div>
        </form>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="text-3xl font-extrabold text-black">How Ordering Works</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <p className="text-2xl font-extrabold text-orange-900">1</p>
            <h3 className="mt-2 font-bold text-black">Choose Meals</h3>
            <p className="mt-1 text-sm text-black">
              Add your preferred meals to your order.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <p className="text-2xl font-extrabold text-orange-900">2</p>
            <h3 className="mt-2 font-bold text-black">Submit Details</h3>
            <p className="mt-1 text-sm text-black">
              Enter your contact info, date, time, and address.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <p className="text-2xl font-extrabold text-orange-900">3</p>
            <h3 className="mt-2 font-bold text-black">Pay via GCash</h3>
            <p className="mt-1 text-sm text-black">
              Send payment screenshot for confirmation.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <p className="text-2xl font-extrabold text-orange-900">4</p>
            <h3 className="mt-2 font-bold text-black">Receive Meal</h3>
            <p className="mt-1 text-sm text-black">
              Pickup or delivery depending on your selected method.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="text-3xl font-extrabold text-black">FAQ</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-black">Do I need an account?</h3>
            <p className="mt-2 text-sm text-black">
              No. You can order as a guest. Login is only for tracking order history.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-black">Is payment required first?</h3>
            <p className="mt-2 text-sm text-black">
              Yes. Orders are confirmed after GCash payment screenshot is sent.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-black">Can I order for same day?</h3>
            <p className="mt-2 text-sm text-black">
              The default setup is pre-order. Same-day orders depend on availability.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-black">Who pays delivery fee?</h3>
            <p className="mt-2 text-sm text-black">
              The customer shoulders the delivery fee unless stated otherwise.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-300 bg-gray-50 px-5 py-8 text-center text-black">
        <p className="font-bold text-black">Kline&apos;s Daily Meals</p>
        <p className="mt-1 text-sm text-black">
          Home-cooked budget meals by pre-order.
        </p>
      </footer>
    </main>
  );
}