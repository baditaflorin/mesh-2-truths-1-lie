import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-2-truths-1-lie",
  description:
    "Submit two truths and a lie privately — commit-reveal so others can't peek before the deadline",
  accentHex: "#3aa8a1",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
