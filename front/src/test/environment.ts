import { builtinEnvironments, type Environment } from "vitest/environments";

// React Router and Node's fetch must share the same AbortSignal implementation.
export default {
  ...builtinEnvironments.jsdom,
  async setup(global, options) {
    const nativeController = global.AbortController;
    const nativeSignal = global.AbortSignal;
    const environment = await builtinEnvironments.jsdom.setup(global, options);
    global.AbortController = nativeController;
    global.AbortSignal = nativeSignal;
    return environment;
  },
} satisfies Environment;
