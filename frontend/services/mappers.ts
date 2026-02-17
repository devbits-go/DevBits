import { ApiPost, ApiProject, ApiUser, UiPost, UiProject } from "@/constants/Types";

export const mapProjectToUi = (
  project: ApiProject,
  contributors = 0,
): UiProject => {
  return {
    id: project.id,
    ownerId: project.owner,
    name: project.name,
    summary: project.description ?? "",
    about_md: project.about_md ?? "",
    stage: project.status === 2 ? "launch" : project.status === 1 ? "beta" : "alpha",
    likes: project.likes,
    saves: project.saves ?? 0,
    contributors,
    tags: project.tags ?? [],
    media: project.media ?? [],
    updated_on: project.creation_date,
  };
};

export const mapPostToUi = (
  post: ApiPost,
  user?: ApiUser | null,
  project?: ApiProject | null
): UiPost => {
  return {
    id: post.id,
    username: user?.username ?? `user-${post.user}`,
    userPicture: user?.picture ?? undefined,
    userId: post.user,
    projectId: post.project,
    projectName: project?.name ?? `Project ${post.project}`,
    projectStage:
      project?.status === 2 ? "launch" : project?.status === 1 ? "beta" : "alpha",
    likes: post.likes,
    saves: post.saves ?? 0,
    comments: 0,
    content: post.content,
    media: post.media ?? [],
    created_on: post.created_on,
    tags: project?.tags ?? [],
  };
};
