// Type definitions for the Olleik admin panel demo. Mock data only —
// no DB persistence yet, but the shapes mirror what the real Supabase
// schema will look like so swapping in a real backend later is mechanical.

export type ID = string;

export type Category = {
  id: ID;
  name: string;
  description?: string;
};

// "Unit" describes how the product is sold to restaurants — case, lb, gallon, etc.
export type ProductUnit =
  | "case"
  | "bag"
  | "lb"
  | "kg"
  | "gal"
  | "L"
  | "ea"
  | "box";

export type Product = {
  id: ID;
  sku: string;
  name: string;
  description?: string;
  categoryId: ID;
  unit: ProductUnit;
  unitSize: string;      // e.g. "25 lb", "50 ct", "1 gal"
  listPriceCents: number; // default/list price (per unit). Per-customer overrides on CustomerPricing.
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;     // ISO 8601
};

export type CustomerStatus = "active" | "pending" | "suspended";

export type Customer = {
  id: ID;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;       // single-line for demo
  status: CustomerStatus;
  paymentTerms: "net-15" | "net-30" | "card-on-file" | "cod";
  notes?: string;
  createdAt: string;
};

// Per-customer assigned products + negotiated prices. If a customer isn't
// in this table for a product, they don't see it. If they ARE in it but
// `priceCents` is null, they see the list price.
export type CustomerProduct = {
  customerId: ID;
  productId: ID;
  priceCents: number | null; // null = use product.listPriceCents
};

export type LeadStatus = "new" | "contacted" | "approved" | "rejected";

export type Lead = {
  id: ID;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  message?: string;
  status: LeadStatus;
  submittedAt: string;
};

export type AdminState = {
  categories: Category[];
  products: Product[];
  customers: Customer[];
  customerProducts: CustomerProduct[];
  leads: Lead[];
};
