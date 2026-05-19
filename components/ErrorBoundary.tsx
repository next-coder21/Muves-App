/**
 * ErrorBoundary — class component that catches render-time errors anywhere in
 * its subtree and shows a friendly fallback instead of a white/blank screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeScreen />
 *   </ErrorBoundary>
 *
 * Or with a custom fallback:
 *   <ErrorBoundary fallback={<Text>Oops, something broke.</Text>}>
 *     <SomeScreen />
 *   </ErrorBoundary>
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  children: React.ReactNode;
  /** Optional custom fallback UI. Receives `reset` so users can retry. */
  fallback?: (reset: () => void) => React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    // Log to console in dev; swap for a crash-reporting SDK (Sentry, etc.) here.
    console.error("[ErrorBoundary] Caught render error:", error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(this.reset);
    }

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message} numberOfLines={4}>
          {this.state.errorMessage}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
          onPress={this.reset}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#111",
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f5f5f5",
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 18,
  },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: "#C8FF00",
  },
  retryBtnPressed: {
    opacity: 0.75,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
});
