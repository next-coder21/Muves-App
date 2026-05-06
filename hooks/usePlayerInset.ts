import { Platform } from "react-native";
import { usePlayer } from "@/context/PlayerContext";

const TAB_HEIGHT = Platform.OS === "ios" ? 85 : 65;
const MINI_PLAYER_HEIGHT = 72; // progress bar (2) + paddingVertical (22) + cover (42) + marginBottom (6)

export function usePlayerInset(): number {
  const { currentSong } = usePlayer();
  return TAB_HEIGHT + (currentSong ? MINI_PLAYER_HEIGHT : 0);
}
