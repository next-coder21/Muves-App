import { Tabs } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import { HapticTab } from "@/components/haptic-tab";
import MiniPlayer from "@/components/MiniPlayer";
import { usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/context/ThemeContext";

const LIME = "#C8FF00";
const TAB_HEIGHT = Platform.OS === "ios" ? 85 : 65;

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

function TabIcon({ icon, label, focused }: { icon: IconName; label: string; focused: boolean }) {
  const c = useColors();
  return (
    <View style={styles.tabSlot}>
      {focused ? (
        <View style={styles.activePill}>
          <MaterialIcons name={icon} size={18} color="#000" />
          <Text style={styles.activeLabel}>{label}</Text>
        </View>
      ) : (
        <MaterialIcons name={icon} size={24} color={c.muted} />
      )}
    </View>
  );
}

function TabBarBackground() {
  const c = useColors();
  return <BlurView intensity={50} tint={c.tint} style={StyleSheet.absoluteFill} />;
}

export default function TabLayout() {
  const { currentSong } = usePlayer();
  const c = useColors();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarShowLabel: false,
          tabBarStyle: {
            height: TAB_HEIGHT,
            backgroundColor: c.isDark ? "rgba(13,13,13,0.85)" : "rgba(245,245,245,0.85)",
            borderTopColor: c.cardBorder,
            borderTopWidth: 1,
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 0,
          },
          tabBarBackground: () => <TabBarBackground />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="home" label="Home" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="search" label="Search" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="library-music" label="Library" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="account-circle" label="Profile" focused={focused} />
            ),
          }}
        />
      </Tabs>

      {/* MiniPlayer sits above the tab bar when a song is playing */}
      {currentSong && (
        <View style={[styles.miniPlayerContainer, { bottom: TAB_HEIGHT }]}>
          <MiniPlayer />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabSlot: {
    width: 80,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: LIME,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
    maxWidth: 78,
  },
  activeLabel: { fontSize: 12, fontWeight: "800", color: "#000" },
  miniPlayerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
