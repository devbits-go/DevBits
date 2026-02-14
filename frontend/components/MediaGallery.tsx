import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { WebView } from "react-native-webview";
import * as Linking from "expo-linking";
import { FadeInImage } from "@/components/FadeInImage";
import { LazyFadeIn } from "@/components/LazyFadeIn";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";
import { useDeferredRender } from "@/hooks/useDeferredRender";

type MediaGalleryProps = {
  media?: string[];
};

const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];
const videoExtensions = ["mp4", "mov", "webm", "avi", "m4v"];

const getExtension = (url: string) => {
  const clean = url.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 1].toLowerCase();
};

const isSvg = (url: string) => getExtension(url) === "svg";
const isImage = (url: string) => imageExtensions.includes(getExtension(url));
const isVideo = (url: string) => videoExtensions.includes(getExtension(url));
const ensureUrlScheme = (url: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;

type VideoItemProps = {
  source: string;
};

type SvgItemProps = {
  source: string;
  isReady: boolean;
};

function VideoItem({ source }: VideoItemProps) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
  });

  return (
    <VideoView
      player={player}
      style={[styles.media, styles.video]}
      contentFit="contain"
      nativeControls
    />
  );
}
import { resolveMediaUrl } from "@/services/api";

function SvgItem({ source, isReady }: SvgItemProps) {
  const colors = useAppColors();
  const [svgMarkup, setSvgMarkup] = React.useState<string | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setSvgMarkup(null);
    setIsLoaded(false);

    void fetch(source)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load SVG");
        }
        return response.text();
      })
      .then((text) => {
        if (active) {
          setSvgMarkup(text);
        }
      })
      .catch(() => {
        if (active) {
          setSvgMarkup(null);
        }
      });

    return () => {
      active = false;
    };
  }, [source]);

  const html = React.useMemo(() => {
    const content = svgMarkup
      ? svgMarkup
      : `<img src="${source}" style="max-width:100%;height:auto;" />`;
    return `<!doctype html><html><body style="margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center">${content}</body></html>`;
  }, [source, svgMarkup]);

  return (
    <LazyFadeIn visible={isReady}>
      {isReady ? (
        <View
          style={[
            styles.media,
            styles.svg,
            styles.svgContainer,
            { backgroundColor: colors.surfaceAlt },
          ]}
        >
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={[styles.svgWebView, !isLoaded && styles.hidden]}
            scrollEnabled={false}
            onLoadEnd={() => setIsLoaded(true)}
          />
          {!isLoaded ? (
            <View style={styles.svgLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.muted} />
            </View>
          ) : null}
        </View>
      ) : null}
    </LazyFadeIn>
  );
}

export function MediaGallery({ media }: MediaGalleryProps) {
  const colors = useAppColors();
  const isReady = useDeferredRender();
  const [expandedImage, setExpandedImage] = React.useState<string | null>(null);
  if (!media?.length) {
    return null;
  }

  const normalizedMedia = media
    .map((item) => resolveMediaUrl(item))
    .filter(Boolean);

  return (
    <View style={styles.container}>
      {normalizedMedia.map((item) => {
        if (isVideo(item)) {
          return (
            <LazyFadeIn key={item} visible={isReady}>
              {isReady ? <VideoItem source={item} /> : null}
            </LazyFadeIn>
          );
        }

        if (isSvg(item)) {
          return <SvgItem key={item} source={item} isReady={isReady} />;
        }

        if (isImage(item)) {
          return (
            <Pressable key={item} onPress={() => setExpandedImage(item)}>
              <LazyFadeIn visible={isReady}>
                {isReady ? (
                  <FadeInImage source={{ uri: item }} style={styles.media} />
                ) : null}
              </LazyFadeIn>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={item}
            onPress={() => Linking.openURL(ensureUrlScheme(item))}
            style={[styles.linkCard, { borderColor: colors.border }]}
          >
            <ThemedText type="caption" style={{ color: colors.tint }}>
              {item}
            </ThemedText>
          </Pressable>
        );
      })}
      <Modal
        visible={!!expandedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImage(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setExpandedImage(null)}
        >
          {expandedImage ? (
            <FadeInImage
              source={{ uri: expandedImage }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  media: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#000000",
  },
  video: {
    backgroundColor: "#000000",
  },
  svg: {
    height: 180,
    backgroundColor: "transparent",
  },
  svgContainer: {
    borderRadius: 12,
    overflow: "hidden",
  },
  svgWebView: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  svgLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  hidden: {
    opacity: 0,
  },
  linkCard: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
});
