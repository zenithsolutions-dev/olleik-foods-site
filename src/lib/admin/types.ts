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
  categoryId: ID | null; // null = uncategorized (e.g. after its category was deleted)
  unit: ProductUnit;
  unitSize: string;      // e.g. "25 lb", "50 ct", "1 gal"
  listPriceCents: number; // default/list price (per unit). Per-customer overrides on CustomerPricing.
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;     // ISO 8601
};

// "archived" = soft-deleted: hidden from the main list and dashboard count, but
// the row + its customer_products + customer_offers are preserved and restorable.
export type CustomerStatus = "active" | "pending" | "suspended" | "archived";

export type PaymentTerms = "net-15" | "net-30" | "card-on-file" | "cod";

export type Customer = {
  id: ID;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;       // single-line for demo
  status: CustomerStatus;
  paymentTerms: PaymentTerms;
  notes?: string;
  createdAt: string;
  // Linked Supabase Auth user once the customer is invited to the portal
  // (Phase D). null/undefined = not yet invited. Admin-only field.
  userId?: string | null;
};

// How an offer's discount_value is interpreted (informational in Phase C —
// stored but not applied to pricing yet):
//   percent     -> whole percent off          (10   = 10% off)
//   fixed_price -> flat replacement price, cents (1999 = $19.99)
//   amount_off  -> fixed amount off, cents     (500  = $5.00 off)
export type OfferDiscountKind = "percent" | "fixed_price" | "amount_off";

export type Offer = {
  id: ID;
  customerId: ID;
  title: string;
  description?: string;
  productId?: ID | null;          // optional linked product (null = account-wide)
  discountKind?: OfferDiscountKind | null;
  discountValue?: number | null;
  startsAt?: string | null;       // ISO 8601 or null = open start
  endsAt?: string | null;         // ISO 8601 or null = open end
  isActive: boolean;
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
