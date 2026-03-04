import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

export default function TerminalScreenRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams<{ chat?: string | string[] }>();

  useEffect(() => {
    const chatParam = Array.isArray(params.chat) ? params.chat[0] : params.chat;
    const username = (chatParam || "").trim();

    if (username) {
      router.replace({
        pathname: "/conversation/[username]",
        params: { username },
      });
      return;
    }

    router.replace("/message");
  }, [params.chat, router]);

  return null;
}
