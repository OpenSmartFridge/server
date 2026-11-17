import type { Product, Recipe, User } from "./types";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getProducts: () => request<Product[]>("/api/get_products"),

  createProduct: (userId: number, name: string, expire: string) =>
    request<{ message: string }>("/api/create_product", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, name, expire }),
    }),

  createProductByBarcode: (barcode: string, expire: string) =>
    request<{ message: string }>("/api/create_product_barcode", {
      method: "POST",
      body: JSON.stringify({ barcode, expire }),
    }),

  updateProduct: (id: number, name: string, expire: string, position: number) =>
    request<{ message: string }>("/api/update_product", {
      method: "POST",
      body: JSON.stringify({ id, name, expire, position }),
    }),

  deleteProduct: (id: number) =>
    request<{ message: string }>("/api/delete_product", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  getRecipes: () => request<Recipe[]>("/api/get_recipes"),

  generateRecipe: () => request<Recipe>("/api/generate_recipe"),

  updateDiet: (diet: string) =>
    request<{ message: string }>("/api/update_diet", {
      method: "POST",
      body: JSON.stringify({ diet }),
    }),

  updatePassword: (password: string, newPassword: string) =>
    request<{ message: string }>("/api/update_password", {
      method: "POST",
      body: JSON.stringify({ password, new_password: newPassword }),
    }),

  createApiKey: () => request<{ key: string }>("/api/create_key"),

  deleteUser: (id: number) =>
    request<{ message: string }>("/api/delete_user", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  getUsers: () => request<User[]>("/api/get_users"),
};
