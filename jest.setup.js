// Jest setup — mocks for native modules that cannot run in Node

// expo-file-system
jest.mock("expo-file-system", () => ({
  documentDirectory: "file:///mock-document-dir/",
  cacheDirectory: "file:///mock-cache-dir/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false, isDirectory: false }),
  readAsStringAsync: jest.fn().mockResolvedValue(""),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn().mockResolvedValue({ uri: "", status: 200 }),
}));

// @react-native-async-storage/async-storage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}));

// expo-media-library
jest.mock("expo-media-library", () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getAssetsAsync: jest.fn().mockResolvedValue({ assets: [], hasNextPage: false, totalCount: 0 }),
  getAssetInfoAsync: jest.fn().mockResolvedValue(null),
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
}));

// @react-native-community/netinfo
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn(() => jest.fn()),
  useNetInfo: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));
