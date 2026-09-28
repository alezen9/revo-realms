const params = new URLSearchParams(window.location.search);

const readFlag = (name: string) => {
  const value = params.get(name);
  if (!value) return import.meta.env.DEV;
  return value === "true";
};

export const TOOLING_FLAGS = {
  debug: readFlag("debug"),
  monitoring: readFlag("monitoring"),
};
