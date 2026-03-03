import { database } from "../firebase.js";
import { cache } from "../cache.js";
import type { Product } from "../../types/models.js";
import { ProductCategory } from "../../types/enums.js";

type ProductCacheKey =
  | "productsCodes"
  | "productsId"
  | "productsPopularity"
  | "productsSubs";

const categoryToCacheKey: Record<ProductCategory, ProductCacheKey> = {
  [ProductCategory.CODES]: "productsCodes",
  [ProductCategory.ID]: "productsId",
  [ProductCategory.POPULARITY]: "productsPopularity",
  [ProductCategory.SUBS]: "productsSubs",
};

const categoryToFirebaseKey: Record<ProductCategory, string> = {
  [ProductCategory.CODES]: "productsCodes",
  [ProductCategory.ID]: "productsId",
  [ProductCategory.POPULARITY]: "productsPopularity",
  [ProductCategory.SUBS]: "productsSubs",
};

export function getProducts(category: ProductCategory): Product[] {
  const key = categoryToCacheKey[category];
  return cache[key] as Product[];
}

export async function setProducts(
  category: ProductCategory,
  products: Product[]
): Promise<void> {
  const cacheKey = categoryToCacheKey[category];
  const firebaseKey = categoryToFirebaseKey[category];

  (cache[cacheKey] as Product[]) = products;
  await database.ref(firebaseKey).set(products);
}

export async function addProduct(
  category: ProductCategory,
  product: Product
): Promise<void> {
  const products = getProducts(category);
  products.push(product);
  products.sort((a, b) => parseInt(a.label, 10) - parseInt(b.label, 10));
  await setProducts(category, products);
}

export async function deleteProduct(
  category: ProductCategory,
  label: string
): Promise<boolean> {
  const products = getProducts(category);
  const index = products.findIndex((p) => p.label === label);

  if (index === -1) return false;

  products.splice(index, 1);
  await setProducts(category, products);
  return true;
}

export async function updateProductPrice(
  category: ProductCategory,
  label: string,
  newPrice: number
): Promise<boolean> {
  const products = getProducts(category);
  const product = products.find((p) => p.label === label);

  if (!product) return false;

  product.price = newPrice;
  await setProducts(category, products);
  return true;
}