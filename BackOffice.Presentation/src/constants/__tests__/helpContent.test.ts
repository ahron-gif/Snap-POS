import { describe, expect, it } from "vitest";
import { helpContentByRoute } from "../helpContent";
import { getMissingSidebarHelpRoutes, getSidebarHelpRequiredRoutes } from "../sidebarHelpPolicy";

describe("sidebar help hints", () => {
  it("defines a ? hint for every required sidebar route", () => {
    const missing = getMissingSidebarHelpRoutes(helpContentByRoute);
    expect(missing).toEqual([]);
  });

  it("documents at least one required route (sanity check)", () => {
    expect(getSidebarHelpRequiredRoutes().length).toBeGreaterThan(10);
  });
});
