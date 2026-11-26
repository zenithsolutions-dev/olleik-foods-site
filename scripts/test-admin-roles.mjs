// Owner level: cost and profit are for owners only. Admins are ADMIN_EMAILS; owners are the subset in
// OWNER_EMAILS. An unset OWNER_EMAILS means every admin is an owner (a one-person business needs no setup).
//   node scripts/test-local.mjs admin-roles
import { isAllowedAdmin, isOwner } from "../src/lib/admin/auth.ts";

let failed = 0;
const check = (name, ok) => {
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
};
const withEnv = (admins, owners, fn) => {
  process.env.ADMIN_EMAILS = admins;
  if (owners == null) delete process.env.OWNER_EMAILS;
  else process.env.OWNER_EMAILS = owners;
  return fn();
};

withEnv("dad@x.test, son@x.test", "Dad@X.test", () => {
  check("a listed owner is an owner (case-insensitive)", isOwner("dad@x.test") === true);
  check("an admin who is not listed as owner is not an owner", isOwner("son@x.test") === false);
  check("that admin is still an admin", isAllowedAdmin("son@x.test") === true);
  check("a stranger is neither", isOwner("eve@x.test") === false && isAllowedAdmin("eve@x.test") === false);
  check("no email is never an owner", isOwner(null) === false && isOwner(undefined) === false);
});
withEnv("dad@x.test", "eve@x.test", () => {
  check("being in OWNER_EMAILS without being an admin grants nothing", isOwner("eve@x.test") === false);
});
withEnv("dad@x.test, son@x.test", null, () => {
  check("OWNER_EMAILS unset: every admin is an owner", isOwner("son@x.test") === true);
  check("OWNER_EMAILS unset: a stranger is still not an owner", isOwner("eve@x.test") === false);
});
withEnv("dad@x.test", "   ", () => {
  check("OWNER_EMAILS blank counts as unset", isOwner("dad@x.test") === true);
});
withEnv("", "dad@x.test", () => {
  check("no admins configured: nobody is an owner (fail closed)", isOwner("dad@x.test") === false);
});

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exitCode = failed ? 1 : 0;
