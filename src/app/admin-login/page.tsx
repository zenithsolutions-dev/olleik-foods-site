import { getBusinessIdentity } from "@/lib/business";
import { AdminLoginForm } from "./login-form";

// Read the name per request: a build-time render would freeze whatever the settings row held that day.
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const business = await getBusinessIdentity();
  return <AdminLoginForm businessName={business.displayName} />;
}
