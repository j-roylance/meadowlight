import { describe, expect, it } from "vitest";
import { PROJECTS, getProject } from "@/game/catalog/definitions";

describe("space_center project catalog", () => {
  it("resolves space_center as a hosted project", () => {
    expect(PROJECTS.space_center).toBeTruthy();
    expect(getProject("space_center").name).toBe("Space Center");
    expect(getProject("space_center").startResearch).toBe(10);
    expect(getProject("space_center").landmarkBlueprint).toBe(
      "landmark_space_center"
    );
  });
});
