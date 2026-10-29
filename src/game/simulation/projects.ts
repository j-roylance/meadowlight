import { tryGetProject } from "@/game/catalog/definitions";
import type { HostedProject } from "@/game/types";

export function projectStage(project: HostedProject): {
  stage: "groundworks" | "structure" | "finishing" | "complete" | "untouched";
  label: string;
} {
  if (project.status === "complete") return { stage: "complete", label: "Complete" };
  const def = tryGetProject(project.definitionId);
  if (!def) return { stage: "untouched", label: "Unavailable project type" };
  if (project.status === "untouched" || project.workCurrent === 0) {
    return { stage: "untouched", label: "Untouched site" };
  }
  const total = def.workRequired;
  const t1 = Math.ceil(total / 3);
  const t2 = Math.ceil((2 * total) / 3);
  if (project.workCurrent < t1) return { stage: "groundworks", label: "Groundworks" };
  if (project.workCurrent < t2) return { stage: "structure", label: "Structure / planting" };
  return { stage: "finishing", label: "Finishing" };
}

export function canContribute(project: HostedProject): boolean {
  return project.status !== "complete";
}

export function applyWork(
  project: HostedProject,
  amount: number,
  contributor: { cityId: string; cityName: string }
): { project: HostedProject; completed: boolean; accepted: number } {
  if (project.status === "complete") {
    return { project, completed: false, accepted: 0 };
  }
  const def = tryGetProject(project.definitionId);
  if (!def) return { project, completed: false, accepted: 0 };
  const total = def.workRequired;
  const room = total - project.workCurrent;
  if (room <= 0) return { project, completed: false, accepted: 0 };
  const accepted = Math.min(amount, room);
  const workCurrent = project.workCurrent + accepted;
  const contributors = [...project.contributors];
  const existing = contributors.find((c) => c.cityId === contributor.cityId);
  if (existing) existing.work += accepted;
  else contributors.push({ ...contributor, work: accepted });

  const completed = workCurrent >= total;
  return {
    project: {
      ...project,
      workCurrent,
      contributors,
      status: completed ? "complete" : "active",
      completedAt: completed ? Date.now() : project.completedAt,
    },
    completed,
    accepted,
  };
}
