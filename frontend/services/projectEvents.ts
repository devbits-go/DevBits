import { UiProject } from "@/constants/Types";

type ProjectEvent =
  | { type: "updated"; projectId: number; patch: Partial<UiProject> }
  | { type: "deleted"; projectId: number }
  | {
      type: "stats";
      projectId: number;
      likes?: number;
      saves?: number;
      isLiked?: boolean;
    };

type ProjectEventListener = (event: ProjectEvent) => void;

const listeners = new Set<ProjectEventListener>();

export const subscribeToProjectEvents = (listener: ProjectEventListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const emit = (event: ProjectEvent) => {
  listeners.forEach((listener) => {
    listener(event);
  });
};

export const emitProjectUpdated = (
  projectId: number,
  patch: Partial<UiProject>,
) => {
  emit({ type: "updated", projectId, patch });
};

export const emitProjectDeleted = (projectId: number) => {
  emit({ type: "deleted", projectId });
};

export const emitProjectStats = (
  projectId: number,
  stats: { likes?: number; saves?: number; isLiked?: boolean },
) => {
  emit({ type: "stats", projectId, ...stats });
};

export const applyProjectEvent = (
  projects: UiProject[],
  event: ProjectEvent,
) => {
  if (event.type === "deleted") {
    return projects.filter((project) => project.id !== event.projectId);
  }
  if (event.type === "updated") {
    return projects.map((project) =>
      project.id === event.projectId
        ? { ...project, ...event.patch }
        : project,
    );
  }
  return projects.map((project) => {
    if (project.id !== event.projectId) {
      return project;
    }
    return {
      ...project,
      likes:
        typeof event.likes === "number" ? event.likes : project.likes,
      saves:
        typeof event.saves === "number" ? event.saves : project.saves,
    };
  });
};
