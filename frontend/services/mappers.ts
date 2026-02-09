import { ApiPost, ApiProject, ApiUser, UiPost, UiProject } from "@/constants/Types";

export const mapProjectToUi = (project: ApiProject): UiProject => {
  return {
    id: project.id,
    name: project.name,
    summary: project.description ?? "",
    about_md: project.about_md ?? "",
    stage: project.status === 2 ? "launch" : project.status === 1 ? "beta" : "alpha",
    likes: project.likes,
    contributors: 0,
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
    projectName: project?.name ?? `Project ${post.project}`,
    projectStage:
      project?.status === 2 ? "launch" : project?.status === 1 ? "beta" : "alpha",
    likes: post.likes,
    comments: 0,
    content: post.content,
    media: post.media ?? [],
    created_on: post.created_on,
    tags: project?.tags ?? [],
  };
};
