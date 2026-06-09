/** Trace accent colors — tailwind.config.js oklch tokens: trace-gold, trace-blue, trace-green */

export const AGENT_HUES = ["trace-blue", "trace-green", "trace-gold"];

export const HUE_THEME = {
  "trace-blue": {
    shell: "rounded-[11px] border border-trace-blue/30 bg-trace-blue/[0.07]",
    shellOpen: "",
    rail: "border-trace-blue/35",
    head: "bg-trace-blue/[0.10] hover:bg-trace-blue/[0.14]",
    headOpen: "rounded-lg border border-trace-blue/30 bg-trace-blue/[0.12]",
    avatar: "bg-trace-blue text-white",
    roleTag: "bg-trace-blue/10 text-trace-blue border-trace-blue/25",
  },
  "trace-green": {
    shell: "rounded-[11px] border border-trace-green/30 bg-trace-green/[0.07]",
    shellOpen: "",
    rail: "border-trace-green/35",
    head: "bg-trace-green/[0.10] hover:bg-trace-green/[0.14]",
    headOpen: "rounded-lg border border-trace-green/30 bg-trace-green/[0.12]",
    avatar: "bg-trace-green text-white",
    roleTag: "bg-trace-green/10 text-trace-green border-trace-green/25",
  },
  "trace-gold": {
    shell: "rounded-[11px] border border-trace-gold-border bg-trace-gold-bg",
    shellOpen: "",
    rail: "border-trace-gold-border",
    head: "bg-trace-gold-bg hover:bg-trace-gold-bg/90",
    headOpen: "rounded-lg border border-trace-gold-border bg-trace-gold-bg",
    avatar: "bg-trace-gold text-white",
    roleTag: "bg-trace-gold/10 text-trace-gold border-trace-gold-border",
  },
};

export const NEUTRAL_RAIL = "border-base-300/35";

export const NEUTRAL_HEAD = "bg-gradient-to-r from-base-200/70 via-base-200/30 to-transparent hover:from-base-200/90";

export const NEUTRAL_HEAD_OPEN =
  "rounded-lg border border-base-300/30 bg-gradient-to-r from-base-200/80 via-base-200/40 to-transparent";

/** Stable fallback when registry has no hue (legacy data) */
export function resolveAgentHue(agentMeta, agentKey, stepHue) {
  if (stepHue && HUE_THEME[stepHue]) return stepHue;
  if (agentMeta?.role === "Orchestrator") return "trace-gold";
  if (agentMeta?.hue && HUE_THEME[agentMeta.hue]) return agentMeta.hue;
  let h = 0;
  for (let i = 0; i < String(agentKey || "").length; i++) h += agentKey.charCodeAt(i);
  return AGENT_HUES[h % AGENT_HUES.length];
}

export function agentInitials(name, glyph) {
  if (glyph) return glyph;
  return String(name || "A")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
