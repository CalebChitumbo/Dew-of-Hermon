import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { getSessionCaller, type SessionCaller } from "@/lib/server-auth";
import { MEAL_FEATURE_SERVE } from "@/lib/camp-meals";

export interface MealCapabilities {
  /** Can scan badges at the serving line and undo a mis-scan. */
  serve: boolean;
  /** Can see the camp register (existing camp-registration permission). */
  campAdmin: boolean;
}

export interface MealCaller extends SessionCaller {
  can: MealCapabilities;
}

/** Resolve the caller plus what they're allowed to do at the serving line. */
export async function getMealCaller(): Promise<MealCaller | null> {
  const caller = await getSessionCaller();
  if (!caller) return null;

  const check = (featureKey: string) =>
    serverCheckFeatureAccess(
      featureKey,
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );

  const [serve, campAdmin] = await Promise.all([
    check(MEAL_FEATURE_SERVE),
    check("manage_camp_registrations"),
  ]);

  return { ...caller, can: { serve, campAdmin } };
}
