"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/AdminNav";

type Meal = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_available: boolean;
};

type MealForm = {
  name: string;
  description: string;
  price: string;
  image_url: string;
  category: string;
  is_available: boolean;
};

const emptyForm: MealForm = {
  name: "",
  description: "",
  price: "",
  image_url: "",
  category: "",
  is_available: true,
};

export default function AdminMealsPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<MealForm>(emptyForm);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");

  useEffect(() => {
    fetchMeals();
  }, []);

  async function fetchMeals() {
    setLoading(true);

    const { data, error } = await supabase
      .from("meals")
      .select("id, name, description, price, image_url, category, is_available");

    if (error) {
      console.error("Admin meals error:", error);
      alert(`Failed to load meals: ${error.message}`);
      setLoading(false);
      return;
    }

    setMeals((data || []) as Meal[]);
    setLoading(false);
  }

  function updateForm(field: keyof MealForm, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingMealId(null);
  }

  function editMeal(meal: Meal) {
    setEditingMealId(meal.id);

    setForm({
      name: meal.name || "",
      description: meal.description || "",
      price: String(meal.price || ""),
      image_url: meal.image_url || "",
      category: meal.category || "",
      is_available: meal.is_available,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveMeal(event: React.FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      alert("Please enter the meal name.");
      return;
    }

    if (!form.price.trim()) {
      alert("Please enter the meal price.");
      return;
    }

    const priceNumber = Number(form.price);

    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      alert("Please enter a valid price.");
      return;
    }

    setSaving(true);

    const mealPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: priceNumber,
      image_url: form.image_url.trim() || null,
      category: form.category.trim() || null,
      is_available: form.is_available,
    };

    if (editingMealId) {
      const { error } = await supabase
        .from("meals")
        .update(mealPayload)
        .eq("id", editingMealId);

      if (error) {
        console.error("Update meal error:", error);
        alert(`Failed to update meal: ${error.message}`);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("meals").insert({
        id: crypto.randomUUID(),
        ...mealPayload,
      });

      if (error) {
        console.error("Create meal error:", error);
        alert(`Failed to create meal: ${error.message}`);
        setSaving(false);
        return;
      }
    }

    resetForm();
    await fetchMeals();
    setSaving(false);
  }

  async function toggleAvailability(meal: Meal) {
    const { error } = await supabase
      .from("meals")
      .update({
        is_available: !meal.is_available,
      })
      .eq("id", meal.id);

    if (error) {
      console.error("Toggle meal availability error:", error);
      alert(`Failed to update availability: ${error.message}`);
      return;
    }

    setMeals((currentMeals) =>
      currentMeals.map((currentMeal) =>
        currentMeal.id === meal.id
          ? {
              ...currentMeal,
              is_available: !currentMeal.is_available,
            }
          : currentMeal
      )
    );
  }

  async function deleteMeal(meal: Meal) {
    const confirmed = confirm(
      `Delete "${meal.name}"? This removes it from the menu. Existing order records will still keep their saved meal name.`
    );

    if (!confirmed) return;

    const { error } = await supabase.from("meals").delete().eq("id", meal.id);

    if (error) {
      console.error("Delete meal error:", error);
      alert(`Failed to delete meal: ${error.message}`);
      return;
    }

    if (editingMealId === meal.id) {
      resetForm();
    }

    setMeals((currentMeals) =>
      currentMeals.filter((currentMeal) => currentMeal.id !== meal.id)
    );
  }

  function formatPeso(amount: number) {
    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  const categories = useMemo(() => {
    const list = meals
      .map((meal) => meal.category || "Uncategorized")
      .filter(Boolean);

    return ["all", ...Array.from(new Set(list))];
  }, [meals]);

  const summary = useMemo(() => {
    const availableMeals = meals.filter((meal) => meal.is_available);
    const hiddenMeals = meals.filter((meal) => !meal.is_available);

    const averagePrice =
      meals.length > 0
        ? meals.reduce((sum, meal) => sum + Number(meal.price), 0) / meals.length
        : 0;

    return {
      totalMeals: meals.length,
      availableMeals: availableMeals.length,
      hiddenMeals: hiddenMeals.length,
      averagePrice,
      categoryCount: categories.filter((category) => category !== "all").length,
    };
  }, [meals, categories]);

  const filteredMeals = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return meals.filter((meal) => {
      const category = meal.category || "Uncategorized";

      const matchesCategory =
        categoryFilter === "all" ? true : category === categoryFilter;

      const matchesAvailability =
        availabilityFilter === "all"
          ? true
          : availabilityFilter === "available"
          ? meal.is_available
          : !meal.is_available;

      if (!searchValue) {
        return matchesCategory && matchesAvailability;
      }

      const matchesSearch =
        meal.name.toLowerCase().includes(searchValue) ||
        (meal.description || "").toLowerCase().includes(searchValue) ||
        category.toLowerCase().includes(searchValue) ||
        String(meal.price).includes(searchValue);

      return matchesCategory && matchesAvailability && matchesSearch;
    });
  }, [meals, search, categoryFilter, availabilityFilter]);

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
            grid-template-columns: repeat(5, 1fr);
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
            font-size: clamp(26px, 3vw, 38px);
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

          .layout {
            display: grid;
            grid-template-columns: 420px 1fr;
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

          .sticky-card {
            position: sticky;
            top: 22px;
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
            gap: 14px;
          }

          .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #0f172a;
            font-size: 13px;
            font-weight: 1000;
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
            min-height: 110px;
            resize: vertical;
          }

          .field:focus,
          .select:focus,
          .textarea:focus {
            border-color: #0f766e;
            box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
          }

          .check-row {
            display: flex;
            align-items: center;
            gap: 10px;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            background: #f8fafc;
            padding: 13px;
            font-weight: 950;
          }

          .check-row input {
            width: 18px;
            height: 18px;
          }

          .button-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
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

          .button-orange {
            background: linear-gradient(135deg, #ea580c, #f59e0b);
          }

          .button-red {
            background: linear-gradient(135deg, #be123c, #ef4444);
          }

          .button-soft {
            border: 1px solid rgba(15, 23, 42, 0.12);
            background: white;
            color: #0f172a;
          }

          .preview-card {
            overflow: hidden;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 24px;
            background: #f8fafc;
          }

          .preview-image-wrap {
            position: relative;
            height: 220px;
            overflow: hidden;
            background:
              radial-gradient(circle at top right, rgba(20, 184, 166, 0.18), transparent 14rem),
              linear-gradient(135deg, #fef3c7, #ccfbf1);
          }

          .preview-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }

          .preview-fallback {
            display: grid;
            width: 100%;
            height: 100%;
            place-items: center;
            font-size: 64px;
          }

          .preview-body {
            padding: 16px;
          }

          .preview-title {
            margin: 0;
            color: #0f172a;
            font-size: 22px;
            line-height: 1.1;
            letter-spacing: -0.04em;
            font-weight: 1000;
          }

          .preview-desc {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
            font-weight: 700;
          }

          .preview-price {
            display: inline-flex;
            margin-top: 12px;
            border-radius: 999px;
            background: #ccfbf1;
            color: #0f766e;
            padding: 8px 11px;
            font-size: 14px;
            font-weight: 1000;
          }

          .toolbar {
            display: grid;
            grid-template-columns: 1fr 210px 190px auto;
            gap: 10px;
            margin-bottom: 16px;
          }

          .meals-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
          }

          .meal-card {
            overflow: hidden;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 24px;
            background: #f8fafc;
          }

          .meal-image-wrap {
            position: relative;
            height: 190px;
            overflow: hidden;
            background:
              radial-gradient(circle at top right, rgba(245, 158, 11, 0.18), transparent 14rem),
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
            width: 100%;
            height: 100%;
            place-items: center;
            font-size: 58px;
          }

          .category-chip {
            position: absolute;
            left: 12px;
            top: 12px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.92);
            color: #0f766e;
            padding: 7px 10px;
            font-size: 11px;
            font-weight: 1000;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
          }

          .availability-chip {
            position: absolute;
            right: 12px;
            top: 12px;
            border-radius: 999px;
            padding: 7px 10px;
            font-size: 11px;
            font-weight: 1000;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
          }

          .availability-chip.available {
            background: #dcfce7;
            color: #166534;
          }

          .availability-chip.hidden {
            background: #ffe4e6;
            color: #be123c;
          }

          .meal-body {
            padding: 16px;
          }

          .meal-top {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }

          .meal-title {
            margin: 0;
            color: #0f172a;
            font-size: 20px;
            line-height: 1.15;
            letter-spacing: -0.04em;
            font-weight: 1000;
          }

          .meal-price {
            flex-shrink: 0;
            height: fit-content;
            border-radius: 14px;
            background: #ccfbf1;
            color: #0f766e;
            padding: 8px 10px;
            font-size: 14px;
            font-weight: 1000;
          }

          .meal-desc {
            min-height: 44px;
            margin: 9px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
            font-weight: 700;
          }

          .meal-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 14px;
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

          @media (max-width: 1200px) {
            .summary-grid {
              grid-template-columns: repeat(3, 1fr);
            }

            .layout {
              grid-template-columns: 1fr;
            }

            .sticky-card {
              position: static;
            }

            .meals-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 800px) {
            .admin-page {
              padding: 14px;
            }

            .summary-grid,
            .toolbar,
            .meals-grid {
              grid-template-columns: 1fr;
            }

            .button-row,
            .meal-actions {
              grid-template-columns: 1fr;
            }

            .button {
              width: 100%;
            }
          }
        `}</style>

        <div className="admin-container">
          <AdminNav
            title="Meals Manager"
            description="Create, edit, hide, and organize meals shown on the customer ordering page."
          />

          <div className="content">
            <section className="summary-grid">
              <div className="metric-card dark">
                <p className="metric-label">Total Meals</p>
                <p className="metric-value">{summary.totalMeals}</p>
                <p className="metric-note">All meals in your menu database</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Available</p>
                <p className="metric-value">{summary.availableMeals}</p>
                <p className="metric-note">Visible to customers</p>
              </div>

              <div className="metric-card red">
                <p className="metric-label">Hidden</p>
                <p className="metric-value">{summary.hiddenMeals}</p>
                <p className="metric-note">Not visible on customer menu</p>
              </div>

              <div className="metric-card orange">
                <p className="metric-label">Categories</p>
                <p className="metric-value">{summary.categoryCount}</p>
                <p className="metric-note">Menu groups currently used</p>
              </div>

              <div className="metric-card">
                <p className="metric-label">Average Price</p>
                <p className="metric-value">{formatPeso(summary.averagePrice)}</p>
                <p className="metric-note">Average menu item price</p>
              </div>
            </section>

            <div className="layout">
              <section className="section-card sticky-card">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">
                      {editingMealId ? "Edit Meal" : "New Meal"}
                    </p>
                    <h2 className="section-title">
                      {editingMealId ? "Update Menu Item" : "Create Menu Item"}
                    </h2>
                    <p className="section-desc">
                      Add a meal name, price, category, description, and image URL.
                    </p>
                  </div>
                </div>

                <form className="form-grid" onSubmit={saveMeal}>
                  <div className="form-group">
                    <label>Meal Name</label>
                    <input
                      className="field"
                      value={form.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      placeholder="Example: Chicken Rice Bowl"
                    />
                  </div>

                  <div className="form-group">
                    <label>Price</label>
                    <input
                      className="field"
                      type="number"
                      min="1"
                      step="0.01"
                      value={form.price}
                      onChange={(event) => updateForm("price", event.target.value)}
                      placeholder="Example: 99"
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <input
                      className="field"
                      value={form.category}
                      onChange={(event) =>
                        updateForm("category", event.target.value)
                      }
                      placeholder="Example: Rice Bowl, Pasta, Snacks"
                    />
                  </div>

                  <div className="form-group">
                    <label>Image URL</label>
                    <input
                      className="field"
                      value={form.image_url}
                      onChange={(event) =>
                        updateForm("image_url", event.target.value)
                      }
                      placeholder="Paste image URL here"
                    />
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      className="textarea"
                      value={form.description}
                      onChange={(event) =>
                        updateForm("description", event.target.value)
                      }
                      placeholder="Short description shown to customers"
                    />
                  </div>

                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={form.is_available}
                      onChange={(event) =>
                        updateForm("is_available", event.target.checked)
                      }
                    />
                    Show this meal on customer menu
                  </label>

                  <div className="preview-card">
                    <div className="preview-image-wrap">
                      {form.image_url.trim() ? (
                        <img
                          className="preview-image"
                          src={form.image_url.trim()}
                          alt={form.name || "Meal preview"}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="preview-fallback">🍱</div>
                      )}
                    </div>

                    <div className="preview-body">
                      <h3 className="preview-title">
                        {form.name || "Meal Preview"}
                      </h3>
                      <p className="preview-desc">
                        {form.description || "Your meal description appears here."}
                      </p>
                      <span className="preview-price">
                        {form.price ? formatPeso(Number(form.price)) : "₱0"}
                      </span>
                    </div>
                  </div>

                  <div className="button-row">
                    <button
                      type="submit"
                      disabled={saving}
                      className="button button-teal"
                    >
                      {saving
                        ? "Saving..."
                        : editingMealId
                        ? "Save Changes"
                        : "Add Meal"}
                    </button>

                    {editingMealId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        disabled={saving}
                        className="button button-soft"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section className="section-card">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Menu Control</p>
                    <h2 className="section-title">Meal List</h2>
                    <p className="section-desc">
                      Search, filter, edit, hide, or delete meals.
                    </p>
                  </div>
                </div>

                <div className="toolbar">
                  <input
                    className="field"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search meals..."
                  />

                  <select
                    className="select"
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category === "all" ? "All Categories" : category}
                      </option>
                    ))}
                  </select>

                  <select
                    className="select"
                    value={availabilityFilter}
                    onChange={(event) =>
                      setAvailabilityFilter(event.target.value)
                    }
                  >
                    <option value="all">All Status</option>
                    <option value="available">Available</option>
                    <option value="hidden">Hidden</option>
                  </select>

                  <button
                    type="button"
                    onClick={fetchMeals}
                    className="button button-teal"
                  >
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="empty-state">Loading meals...</div>
                ) : filteredMeals.length === 0 ? (
                  <div className="empty-state">No meals found.</div>
                ) : (
                  <div className="meals-grid">
                    {filteredMeals.map((meal) => (
                      <article className="meal-card" key={meal.id}>
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

                          <span className="category-chip">
                            {meal.category || "Uncategorized"}
                          </span>

                          <span
                            className={`availability-chip ${
                              meal.is_available ? "available" : "hidden"
                            }`}
                          >
                            {meal.is_available ? "Available" : "Hidden"}
                          </span>
                        </div>

                        <div className="meal-body">
                          <div className="meal-top">
                            <div>
                              <h3 className="meal-title">{meal.name}</h3>
                              <p className="meal-desc">
                                {meal.description || "No description added."}
                              </p>
                            </div>

                            <span className="meal-price">
                              {formatPeso(Number(meal.price))}
                            </span>
                          </div>

                          <div className="meal-actions">
                            <button
                              type="button"
                              onClick={() => editMeal(meal)}
                              className="button button-soft"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleAvailability(meal)}
                              className={
                                meal.is_available
                                  ? "button button-orange"
                                  : "button button-teal"
                              }
                            >
                              {meal.is_available ? "Hide" : "Show"}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteMeal(meal)}
                              className="button button-red"
                              style={{ gridColumn: "1 / -1" }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}