export const intervalOptions = [
  { label: "1m", value: 60000 },
  { label: "2m", value: 120000 },
  { label: "5m", value: 300000 },
];

export const textRenderOptions: Array<{
  label: string;
  value: "smooth" | "typewriter" | "wave" | "random" | "off";
}> = [
  { label: "Smooth", value: "smooth" },
  { label: "Typewriter", value: "typewriter" },
  { label: "Wave", value: "wave" },
  { label: "Random", value: "random" },
  { label: "Off", value: "off" },
];

export const imageRevealOptions: Array<{
  label: string;
  value: "smooth" | "off";
}> = [
  { label: "Smooth", value: "smooth" },
  { label: "Off", value: "off" },
];

export const pageTransitionOptions: Array<{
  label: string;
  value: "fade" | "default" | "none";
}> = [
  { label: "Fade", value: "fade" },
  { label: "Default", value: "default" },
  { label: "Off", value: "none" },
];

export const accentPresetOptions = [
  { label: "Default", color: "#00F329" },
  { label: "Aurora", color: "#4A8DFF" },
  { label: "Sunset", color: "#FF6B6B" },
  { label: "Violet", color: "#A855F7" },
  { label: "Amber", color: "#F59E0B" },
  { label: "Aqua", color: "#06B6D4" },
];

export const visualizationModeOptions: Array<{
  label: string;
  value:
    | "monoAccent"
    | "retro"
    | "classic"
    | "vivid"
    | "neon"
    | "cinematic"
    | "frost";
}> = [
  { label: "Monochrome + Accent", value: "monoAccent" },
  { label: "Retro", value: "retro" },
  { label: "Classic", value: "classic" },
  { label: "Vivid", value: "vivid" },
  { label: "Neon", value: "neon" },
  { label: "Cinematic", value: "cinematic" },
  { label: "Frost", value: "frost" },
];

export const parseLinks = (links: string[]) => {
  let website = "";
  let github = "";
  let twitter = "";
  let linkedin = "";
  const extraLinks: string[] = [];

  links.forEach((link) => {
    const value = link.trim();
    if (!value) {
      return;
    }
    const lower = value.toLowerCase();
    if (!github && lower.includes("github.com")) {
      github = value;
    } else if (
      !twitter &&
      (lower.includes("twitter.com") || lower.includes("x.com"))
    ) {
      twitter = value;
    } else if (!linkedin && lower.includes("linkedin.com")) {
      linkedin = value;
    } else if (
      !website &&
      (lower.startsWith("http") || lower.startsWith("www."))
    ) {
      website = value;
    } else {
      extraLinks.push(value);
    }
  });

  return { website, github, twitter, linkedin, extraLinks };
};

export const buildLinks = (fields: {
  website: string;
  github: string;
  twitter: string;
  linkedin: string;
  extraLinks: string;
}) => {
  const base = [fields.website, fields.github, fields.twitter, fields.linkedin]
    .map((item) => item.trim())
    .filter(Boolean);

  const extras = fields.extraLinks
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return [...base, ...extras];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const hsvToHex = (hue: number, saturation: number, value: number) => {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 1);
  const v = clamp(value, 0, 1);
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

export const hexToHsv = (hex: string) => {
  const normalized = hex.replace("#", "").trim();
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized.padEnd(6, "0");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
  }

  if (h < 0) {
    h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
};

export const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "").trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

export const rgbToHex = (red: number, green: number, blue: number) => {
  const toHex = (channel: number) =>
    clamp(channel, 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(Math.round(red))}${toHex(Math.round(green))}${toHex(Math.round(blue))}`.toUpperCase();
};