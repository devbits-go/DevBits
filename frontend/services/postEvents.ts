type PostEvent =
  | { type: "updated"; postId: number; content: string; media?: string[] }
  | { type: "deleted"; postId: number }
  | {
      type: "stats";
      postId: number;
      likes?: number;
      comments?: number;
      isLiked?: boolean;
    };

type PostEventListener = (event: PostEvent) => void;

const listeners = new Set<PostEventListener>();

export const subscribeToPostEvents = (listener: PostEventListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const emit = (event: PostEvent) => {
  listeners.forEach((listener) => {
    listener(event);
  });
};

export const emitPostUpdated = (
  postId: number,
  content: string,
  media?: string[],
) => {
  emit({ type: "updated", postId, content, media });
};

export const emitPostDeleted = (postId: number) => {
  emit({ type: "deleted", postId });
};

export const emitPostStats = (
  postId: number,
  stats: { likes?: number; comments?: number; isLiked?: boolean },
) => {
  emit({ type: "stats", postId, ...stats });
};
