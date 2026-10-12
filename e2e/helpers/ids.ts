import { select } from "./db";
import { customerByKey } from "./data";

export async function dynamicRoutes() {
  const orders = await select<{ id: string; status: string }>("orders?select=id,status&order=created_at.desc&limit=200");
  const cl = await customerByKey("copperleaf");
  const em = await customerByKey("ember");
  const own = await select<{ id: string }>(`orders?select=id&customer_id=eq.${cl.id}&order=created_at.desc&limit=1`);
  const other = await select<{ id: string }>(`orders?select=id&customer_id=eq.${em.id}&order=created_at.desc&limit=1`);
  const tpl = await select<{ id: string }>("offer_templates?select=id&limit=1");
  return {
    completed: orders.find((o) => o.status === "completed")!.id,
    fresh: orders.find((o) => o.status === "new")!.id,
    customerId: cl.id,
    customerOrder: own[0].id,
    otherCustomerOrder: other[0].id,
    templateId: tpl[0].id,
  };
}
