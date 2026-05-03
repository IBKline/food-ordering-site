"use client";

import AdminGuard from "@/components/AdminGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Meal = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_available: boolean;
  created_at: string;
};

export default function AdminMealsPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("rice meal");
  const [imageUrl, setImageUrl] = useState("");
const [imageFile, setImageFile] = useState<File | null>(null);
const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchMeals();
  }, []);

  async function fetchMeals() {
    setLoading(true);

    const { data, error } = await supabase
      .from("meals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Meals error:", error);
      alert(`Failed to load meals: ${error.message}`);
    } else {
      setMeals((data || []) as Meal[]);
    }

    setLoading(false);
  }

  function resetForm() {
    setEditingMealId(null);
    setName("");
    setDescription("");
    setPrice("");
    setCategory("rice meal");
    setImageUrl("");
    setImageFile(null);
  }

  function startEdit(meal: Meal) {
    setEditingMealId(meal.id);
    setName(meal.name);
    setDescription(meal.description || "");
    setPrice(String(Number(meal.price)));
    setCategory(meal.category || "rice meal");
    setImageUrl(meal.image_url || "");
    setImageFile(null);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }
async function uploadMealImage() {
  if (!imageFile) {
    return imageUrl.trim() || null;
  }

  setUploadingImage(true);

  const fileExtension = imageFile.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2)}.${fileExtension}`;

  const filePath = `meals/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("meal-images")
    .upload(filePath, imageFile);

  if (uploadError) {
    console.error("Image upload error:", uploadError);
    alert(`Failed to upload image: ${uploadError.message}`);
    setUploadingImage(false);
    return null;
  }

  const { data } = supabase.storage
    .from("meal-images")
    .getPublicUrl(filePath);

  setUploadingImage(false);

  return data.publicUrl;
}
  async function saveMeal(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      alert("Meal name is required.");
      return;
    }

    const numericPrice = Number(price);

    if (!price || Number.isNaN(numericPrice) || numericPrice <= 0) {
      alert("Please enter a valid price.");
      return;
    }

    setSaving(true); const finalImageUrl = await uploadMealImage();

if (imageFile && !finalImageUrl) {
  setSaving(false);
  return;
}

    if (editingMealId) {
      const { error } = await supabase
        .from("meals")
        .update({
  name: name.trim(),
  description: description.trim(),
  price: numericPrice,
  category,
  image_url: finalImageUrl,
})
        .eq("id", editingMealId);

      if (error) {
        console.error("Update meal error:", error);
        alert(`Failed to update meal: ${error.message}`);
        setSaving(false);
        return;
      }

      alert("Meal updated.");
    } else {
      const { error } = await supabase.from("meals").insert({
  name: name.trim(),
  description: description.trim(),
  price: numericPrice,
  category,
  image_url: finalImageUrl,
  is_available: true,
});

      if (error) {
        console.error("Add meal error:", error);
        alert(`Failed to add meal: ${error.message}`);
        setSaving(false);
        return;
      }

      alert("Meal added.");
    }

    resetForm();
    await fetchMeals();
    setSaving(false);
  }

  async function toggleAvailability(meal: Meal) {
    const { error } = await supabase
      .from("meals")
      .update({ is_available: !meal.is_available })
      .eq("id", meal.id);

    if (error) {
      console.error("Availability error:", error);
      alert(`Failed to update availability: ${error.message}`);
      return;
    }

    await fetchMeals();
  }

  async function deleteMeal(mealId: string) {
    const confirmed = confirm(
      "Are you sure you want to delete this meal? If customers already ordered it before, it is safer to mark it as sold out instead."
    );

    if (!confirmed) return;

    const { error } = await supabase.from("meals").delete().eq("id", mealId);

    if (error) {
      console.error("Delete meal error:", error);
      alert(`Failed to delete meal: ${error.message}`);
      return;
    }

    await fetchMeals();
  }

  return (
  <AdminGuard>
    <main className="min-h-screen bg-white p-5 text-black">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-black">Admin Meals</h1>
            <p className="mt-1 text-gray-900">
              Add meals, edit prices, and mark items as available or sold out.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              className="rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 font-bold text-orange-900 hover:bg-orange-200"
            >
              Customer Page
            </a>

            <a
              href="/admin/orders"
              className="rounded-xl border border-gray-500 bg-gray-100 px-4 py-2 font-bold text-black hover:bg-gray-200"
            >
              View Orders
            </a>
          </div>
        </div>

        <form
          onSubmit={saveMeal}
          className="mt-6 rounded-2xl border border-gray-300 bg-white p-5 shadow-sm"
        >
          <h2 className="text-2xl font-bold text-black">
            {editingMealId ? "Edit Meal" : "Add New Meal"}
          </h2>

          <div className="mt-4 grid gap-4">
            <div>
              <label className="font-semibold text-black">Meal Name</label>
              <input
                className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Example: Chicken Adobo Rice Meal"
              />
            </div>

            <div>
              <label className="font-semibold text-black">Description</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short description of the meal"
              />
            </div>
            <div>
  <label className="font-semibold text-black">Meal Photo</label>

  <input
    type="file"
    accept="image/*"
    className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black"
    onChange={(event) => {
      const file = event.target.files?.[0] || null;
      setImageFile(file);
    }}
  />

  {imageUrl && !imageFile && (
    <img
      src={imageUrl}
      alt="Current meal"
      className="mt-3 h-40 w-full rounded-xl border border-gray-300 object-cover"
    />
  )}

  {imageFile && (
    <p className="mt-2 text-sm font-semibold text-black">
      Selected: {imageFile.name}
    </p>
  )}
</div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="font-semibold text-black">Price</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black placeholder:text-gray-500"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="89"
                />
              </div>

              <div>
                <label className="font-semibold text-black">Category</label>
                <select
                  className="mt-1 w-full rounded-xl border border-gray-400 bg-white p-3 text-black"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="rice meal">Rice Meal</option>
                  <option value="budget meal">Budget Meal</option>
                  <option value="pasta">Pasta</option>
                  <option value="soup meal">Soup Meal</option>
                  <option value="meatless">Meatless</option>
                  <option value="special">Special</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl border border-orange-700 bg-orange-100 px-5 py-3 font-bold text-orange-900 hover:bg-orange-200 disabled:opacity-60"
              >
                {saving || uploadingImage
                ? "Saving..."
                : editingMealId
                ? "Save Changes"
                : "Add Meal"}
              </button>

              {editingMealId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-gray-500 bg-gray-100 px-5 py-3 font-bold text-black hover:bg-gray-200"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </form>

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-black">Menu List</h2>

            <button
              onClick={fetchMeals}
              className="rounded-xl border border-gray-500 bg-gray-100 px-4 py-2 font-bold text-black hover:bg-gray-200"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-6 text-black">Loading meals...</p>
          ) : meals.length === 0 ? (
            <p className="mt-6 rounded-xl border border-gray-300 bg-white p-5 text-black shadow-sm">
              No meals yet.
            </p>
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {meals.map((meal) => (
                <div
                  key={meal.id}
                  className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm"
                >
                    {meal.image_url ? (
  <img
    src={meal.image_url}
    alt={meal.name}
    className="mb-4 h-40 w-full rounded-xl border border-gray-300 object-cover"
  />
) : (
  <div className="mb-4 flex h-40 items-center justify-center rounded-xl border border-gray-300 bg-gray-100 text-4xl">
    🍱
  </div>
)}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p
                        className={`mb-2 inline-block rounded-full border px-3 py-1 text-xs font-bold ${
                          meal.is_available
                            ? "border-green-700 bg-green-100 text-green-900"
                            : "border-red-700 bg-red-100 text-red-900"
                        }`}
                      >
                        {meal.is_available ? "Available" : "Sold Out"}
                      </p>

                      <h3 className="text-lg font-bold text-black">{meal.name}</h3>

                      <p className="mt-1 text-sm text-gray-900">
                        {meal.category || "meal"}
                      </p>
                    </div>

                    <p className="text-xl font-bold text-orange-900">
                      ₱{Number(meal.price)}
                    </p>
                  </div>

                  <p className="mt-3 text-sm text-black">
                    {meal.description || "No description."}
                  </p>

                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(meal)}
                      className="w-full rounded-xl border border-orange-700 bg-orange-100 px-4 py-2 font-bold text-orange-900 hover:bg-orange-200"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleAvailability(meal)}
                      className="w-full rounded-xl border border-blue-700 bg-blue-100 px-4 py-2 font-bold text-blue-900 hover:bg-blue-200"
                    >
                      {meal.is_available ? "Mark as Sold Out" : "Mark as Available"}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteMeal(meal.id)}
                      className="w-full rounded-xl border border-red-700 bg-red-100 px-4 py-2 font-bold text-red-900 hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
     </main>
  </AdminGuard>
  );
}