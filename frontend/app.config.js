module.exports = () => {
  const extras = {
    router: {},
    eas: {
      projectId: "2286e55a-f086-446f-bcb5-3e36b65a79f6",
    },
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || null,
    EXPO_PUBLIC_USE_LOCAL_API:
      typeof process.env.EXPO_PUBLIC_USE_LOCAL_API !== "undefined"
        ? process.env.EXPO_PUBLIC_USE_LOCAL_API
        : undefined,
    EXPO_PUBLIC_LOCAL_API_URL: process.env.EXPO_PUBLIC_LOCAL_API_URL || undefined,
  };

  return {
    expo: {
      name: "DevBits",
      slug: "frontend",
      version: "1.0.3",
      orientation: "portrait",
      icon: "./assets/images/Devbits_Icons.png",
      scheme: "myapp",
      userInterfaceStyle: "automatic",
      newArchEnabled: true,
      ios: {
        supportsTablet: true,
        icon: "./assets/images/Devbits_Icons.png",
        bundleIdentifier: "com.devbits.frontend",
        buildNumber: "18",
        infoPlist: {
          ITSAppUsesNonExemptEncryption: false,
          NSPhotoLibraryUsageDescription:
            "DevBits requests access to your photo library to let you pick images to attach to posts or save images from the app. Example: selecting a photo to upload when creating a byte.",
          NSPhotoLibraryAddUsageDescription:
            "DevBits may save images you create or download (for example, saving a snapshot of a post) to your photo library when you choose to do so.",
          NSCameraUsageDescription:
            "DevBits requests access to the camera so you can capture photos or videos to attach to posts. Example: taking a photo while creating a byte.",
          NSMicrophoneUsageDescription:
            "DevBits requests access to the microphone to record audio for posts or streams. Example: recording a short audio clip when creating content.",
        },
        associatedDomains: ["applinks:devbits.ddns.net"],
      },
      android: {
        icon: "./assets/images/Devbits_Icons1.png",
        versionCode: 18,
        adaptiveIcon: {
          foregroundImage: "./assets/images/adaptive-icon.png",
          backgroundColor: "#000000",
        },
        permissions: ["android.permission.RECORD_AUDIO"],
        package: "com.devbits.frontend",
      },
      web: {
        bundler: "metro",
        output: "static",
        favicon: "./assets/images/favicon.png",
      },
      splash: {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#000000",
      },
      plugins: [
        "expo-router",
        "expo-notifications",
        [
          "expo-image-picker",
          {
            photosPermission: "Allow DevBits to access your photos.",
          },
        ],
        [
          "expo-splash-screen",
          {
            image: "./assets/images/splash-icon.png",
            imageWidth: 200,
            resizeMode: "contain",
            backgroundColor: "#000000",
          },
        ],
        "expo-secure-store",
        "expo-video",
      ],
      experiments: {
        typedRoutes: true,
      },
      extra: extras,
    },
  };
};
