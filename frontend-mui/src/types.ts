export interface Product {
  Id: number;
  UserId: number;
  Name: string;
  Expire: string;
  Position: number;
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

export interface Recipe {
  Id: number;
  UserId: number;
  name: string;
  description: string;
  ingredients: Ingredient[];
  steps: string[];
  servings: number;
  CreatedAt: string;
  IsFavorite: boolean;
  Position: number;
}

export interface User {
  Id: number;
  Username: string;
  PasswordHash: string;
  Diet: string | null;
  IsAdmin: boolean;
}
