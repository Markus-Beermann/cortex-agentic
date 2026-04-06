import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cortexagentic.app",
  appName: "Cortex",
  webDir: "../native/dist",
  server: { androidScheme: "https" },
  plugins: {
    SplashScreen: { launchShowDuration: 0 }
  }
};

export default config;
