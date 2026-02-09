import React from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { WebView } from "react-native-webview";
import * as Linking from "expo-linking";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";

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

export function MediaGallery({ media }: MediaGalleryProps) {
  const colors = useAppColors();
  const [expandedImage, setExpandedImage] = React.useState<string | null>(null);
  if (!media?.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      {media.map((item) => {
        if (isVideo(item)) {
          return <VideoItem key={item} source={item} />;
        }

        if (isSvg(item)) {
          const html = `<!doctype html><html><body style="margin:0;padding:0;background:transparent"><img src="${item}" style="max-width:100%;height:auto;" /></body></html>`;
          return (
            <WebView
              key={item}
              originWhitelist={["*"]}
              source={{ html }}
              style={[styles.media, styles.svg]}
              containerStyle={styles.svgContainer}
            />
          );
        }

        if (isImage(item)) {
          return (
            <Pressable key={item} onPress={() => setExpandedImage(item)}>
              <Image source={{ uri: item }} style={styles.media} />
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
            <Image
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
