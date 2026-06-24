import React, { useState } from "react";
import { Image } from "expo-image";
import { View, Text, StyleSheet, ViewStyle } from "react-native";

function titleHue(str = ""): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

function initials(title = ""): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";
}

interface AlbumArtProps {
  uri?: string | null;
  title?: string;
  size: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * AlbumArt — shows the cover image if available, otherwise a colored
 * placeholder with the first two initials of the title. No server request
 * is made when the image is missing.
 */
export default function AlbumArt({
  uri,
  title = "",
  size,
  borderRadius = 8,
  style,
}: AlbumArtProps) {
  const [failed, setFailed] = useState(false);

  const hue      = titleHue(title);
  const bg       = `hsl(${hue}, 40%, 22%)`;
  const fg       = `hsl(${hue}, 80%, 72%)`;
  const label    = initials(title);
  const fontSize = typeof size === "number" ? Math.round(size * 0.35) : 20;

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius,
    overflow: "hidden",
    ...style,
  };

  if (uri && !failed) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={title}
        />
      </View>
    );
  }

  return (
    <View style={[containerStyle, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ color: fg, fontWeight: "700", fontSize, lineHeight: fontSize * 1.1 }}>
        {label}
      </Text>
    </View>
  );
}
