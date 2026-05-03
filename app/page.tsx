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
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchMeals();
    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

    if (!customerName || !contactNumber || !address) {
      alert("Please complete your name, contact number, and address/pickup note.");
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
      <section className="border-b border-gray-300 bg-white px-6 py-4 text-black">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <a href="/" className="text-xl font-bold text-black">
            Kline&apos;s Daily Meals
          </a>

          <div className="flex flex-wrap items-center gap-2">
            {user ? (
              <>
                <span className="text-sm text-black">{user.email}</span>

                <a
                  href="/account/orders"
                  className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 font-bold text-orange-900 hover:bg-orange-200"
                >
                  My Orders
                </a>

                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl border border-gray-400 bg-gray-100 px-4 py-2 font-bold text-black hover:bg-gray-200"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-black">Ordering as guest</span>

                <a
                  href="/login"
                  className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 font-bold text-orange-900 hover:bg-orange-200"
                >
                  Login / Create Account
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="bg-orange-600 px-6 py-10 text-center text-white">
        <h1 className="text-4xl font-bold">Kline&apos;s Daily Meals</h1>
        <p className="mx-auto mt-3 max-w-2xl">
          Affordable home-cooked rice meals and pasta by pre-order.
          Payment first. Limited slots daily.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="rounded-2xl border border-orange-300 bg-orange-50 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-black">Ordering Details</h2>
          <p className="mt-2 text-black">Cut-off: 8:00 PM daily for next-day orders.</p>
          <p className="text-black">Payment: GCash payment first before confirmation.</p>
          <p className="text-black">Delivery fee is shouldered by the customer.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-4">
        <h2 className="mb-4 text-2xl font-bold text-black">Menu</h2>

        {loading ? (
          <p className="text-black">Loading meals...</p>
        ) : meals.length === 0 ? (
          <p className="text-black">No meals available right now.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm"
              >
                {meal.image_url ? (
                  <img
                    src={meal.image_url}
                    alt={meal.name}
                    className="mb-4 h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mb-4 flex h-40 items-center justify-center rounded-xl bg-orange-100 text-4xl">
                    🍱
                  </div>
                )}

                <p className="mb-2 inline-block rounded-full border border-orange-700 bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900">
                  {meal.category || "Meal"}
                </p>

                <h3 className="text-lg font-bold text-black">{meal.name}</h3>

                <p className="mt-2 text-sm text-black">
                  {meal.description}
                </p>

                <p className="mt-3 text-xl font-bold text-orange-900">
                  ₱{Number(meal.price)}
                </p>

                <button
                  onClick={() => addToCart(meal)}
                  className="mt-4 w-full rounded-xl border border-orange-700 bg-orange-100 px-4 py-3 font-bold text-orange-900 hover:bg-orange-200"
                >
                  Add to Order
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-bold text-black">Your Order</h2>

          {cart.length === 0 ? (
            <p className="mt-4 text-black">Your cart is empty.</p>
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

              <p className="text-right text-2xl font-bold text-black">
                Total: ₱{total}
              </p>
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

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-3 font-bold text-orange-900 hover:bg-orange-200 disabled:opacity-60"
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
    </main>
  );
}