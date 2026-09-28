const params = new URLSearchParams(window.location.search);
const debug = params.get("debug");
const monitoring = params.get("monitoring");

export const TOOLING_FLAGS = {
  debug: debug ? debug === "true" : import.meta.env.DEV,
  monitoring: monitoring ? monitoring === "true" : import.meta.env.DEV,
};
