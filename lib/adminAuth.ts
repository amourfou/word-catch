/** Compatibility re-export for routes left as on main (app/api/admin/push). Auth is session-based. */
export { getAdminCaller, readAdminUserId, getManagedUserIds, assertCanManageUser } from "@/lib/server/adminAuth";
export type { AdminCaller } from "@/lib/server/adminAuth";
