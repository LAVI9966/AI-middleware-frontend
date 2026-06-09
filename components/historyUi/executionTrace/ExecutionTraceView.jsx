"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Brackets, ChevronDown, ChevronRight, FileClock, SquareFunction } from "lucide-react";
import {
  HUE_THEME,
  NEUTRAL_HEAD,
  NEUTRAL_HEAD_OPEN,
  NEUTRAL_RAIL,
  TRACE_ROW_BORDER,
  agentInitials,
  resolveAgentHue,
} from "./traceTheme";

const TRACE_HIDDEN_VAR_KEYS = new Set(["_user_message"]);

const formatToolName = (name) =>
  String(name || "tool")
    .replace(/\(\)\s*$/, "")
    .trim();

function formatIoValue(value) {
  if (value == null) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "—";
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return value;
    }
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Reference: bordered INPUT / OUTPUT blocks */
function IoPanel({ label, value }) {
  return (
    <div className={`mx-2 mb-2 overflow-hidden rounded-lg ${TRACE_ROW_BORDER} bg-base-100`}>
      <div className="border-b border-base-content/20 bg-base-200/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
        {label}
      </div>
      <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words bg-[#f6f7f9] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-[#324049]">
        {formatIoValue(value)}
      </pre>
    </div>
  );
}

const RAIL_NODE_CLASS = "absolute z-[1] -left-[29px] top-1 flex h-5 w-5 items-center justify-center";

const TraceRailCtx = createContext({ railClass: NEUTRAL_RAIL });

function AgentBodyRail({ children, hue, className = "" }) {
  const railClass = hue ? HUE_THEME[hue]?.rail : NEUTRAL_RAIL;
  return (
    <TraceRailCtx.Provider value={{ railClass }}>
      <div className={`relative ml-[13px] border-l-2 py-1.5 pl-[22px] pr-1 ${railClass} ${className}`}>{children}</div>
    </TraceRailCtx.Provider>
  );
}

function TraceRow({ children, node, textRow = false }) {
  const nodeClasses = textRow
    ? "absolute z-[1] -left-[27px] top-[15px] h-[9px] w-[9px] rounded-full border-2 border-base-100 bg-base-content/40"
    : RAIL_NODE_CLASS;

  return (
    <div className="relative my-[7px]">
      {node ? <span className={nodeClasses}>{node}</span> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function FlatRow({ children, className = "" }) {
  return <div className={`my-1 pr-1 ${className}`}>{children}</div>;
}

function StepIconBox({ children, className = "" }) {
  return (
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border border-base-300/60 bg-base-200/80 text-base-content/60 ${className}`}
    >
      {children}
    </span>
  );
}

function CaretBox({ open }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center">
      <Caret open={open} />
    </span>
  );
}

function StepRowHeader({ open, inRail, icon, children, onClick, headerClass = "" }) {
  return (
    <div
      className={`flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${TRACE_ROW_BORDER} ${headerClass}`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick(e) : undefined}
      role="button"
      tabIndex={0}
    >
      <CaretBox open={open} />
      {!inRail && icon}
      {children}
    </div>
  );
}

const TraceCtx = createContext({
  detail: "medium",
  showMeta: true,
  onToolLogsClick: null,
  onToolDataClick: null,
  onAgentDataClick: null,
});

function AgentAvatar({ name, hue, glyph, large = false }) {
  const initials = agentInitials(name, glyph);
  const theme = hue ? HUE_THEME[hue] : null;
  const size = large ? "h-8 w-8 text-xs rounded-lg" : "h-6 w-6 text-[10px] rounded-md";
  const colors = theme ? theme.avatar : "border border-base-300/40 bg-base-300/50 text-base-content/70";

  return <span className={`grid shrink-0 place-items-center font-bold ${size} ${colors}`}>{initials}</span>;
}

function Meta({ latency, tokens, cost }) {
  const { showMeta } = useContext(TraceCtx);
  if (!showMeta) return null;
  const fmt = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : `${Math.round(ms)}ms`);
  return (
    <div className="flex shrink-0 gap-1.5">
      {latency != null && (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-base-content/50" title="latency">
          <span className="h-1 w-1 rounded-full bg-base-content/40" />
          {fmt(latency)}
        </span>
      )}
      {tokens != null && (
        <span className="text-[11px] font-mono text-base-content/50" title="tokens">
          {tokens.toLocaleString()} tok
        </span>
      )}
      {cost != null && (
        <span className="text-[11px] font-mono text-base-content/50" title="cost">
          ${Number(cost).toFixed(4)}
        </span>
      )}
    </div>
  );
}

function Caret({ open, className = "", style }) {
  return (
    <ChevronRight
      size={14}
      style={style}
      className={`shrink-0 text-base-content/40 transition-transform duration-150 ${open ? "rotate-90" : ""} ${className}`}
    />
  );
}

function KindTag({ children, className = "" }) {
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${className}`}>
      {children}
    </span>
  );
}

function TextStep({ step }) {
  const [open, setOpen] = useState(false);
  return (
    <TraceRow textRow>
      <div className="min-w-0">
        <StepRowHeader open={open} headerClass={NEUTRAL_HEAD} onClick={() => setOpen((o) => !o)}>
          <span className="text-xs font-medium text-base-content/70">Message</span>
        </StepRowHeader>
        {open && (
          <div
            className={`mt-1 rounded-lg ${TRACE_ROW_BORDER} bg-base-200/50 px-3 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-base-content`}
          >
            {step.text}
          </div>
        )}
      </div>
    </TraceRow>
  );
}

function ToolNodeIcon({ err = false, size = 12 }) {
  return (
    <StepIconBox className={err ? "border-error/30 bg-error/10 text-error" : ""}>
      {err ? <AlertTriangle size={size} /> : <SquareFunction size={size} />}
    </StepIconBox>
  );
}

function KbNodeIcon({ size = 12 }) {
  return (
    <StepIconBox className="border-trace-blue/25 bg-trace-blue/8 text-trace-blue">
      <BookOpen size={size} />
    </StepIconBox>
  );
}

function VarsNodeIcon({ size = 12 }) {
  return (
    <StepIconBox className="border-trace-gold/25 bg-trace-gold/8 text-trace-gold">
      <Brackets size={size} />
    </StepIconBox>
  );
}

function VariablesBlock({ vars, inRail = true }) {
  const entries = Object.entries(vars || {}).filter(([k]) => !TRACE_HIDDEN_VAR_KEYS.has(k));
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;

  const previewKeys = entries.slice(0, 4);
  const overflow = entries.length - previewKeys.length;
  const varsHead = "bg-gradient-to-r from-trace-gold/14 via-trace-gold/6 to-transparent hover:from-trace-gold/20";

  const body = (
    <div className="min-w-0">
      <StepRowHeader
        open={open}
        inRail={inRail}
        icon={<VarsNodeIcon />}
        headerClass={varsHead}
        onClick={() => setOpen((o) => !o)}
      >
        <KindTag className="inline-flex items-center gap-1 text-trace-gold">
          <Brackets size={12} /> variables
        </KindTag>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-trace-blue/20 bg-trace-blue/10 px-1.5 text-[11px] font-mono text-trace-blue">
          {entries.length}
        </span>
        {!open &&
          previewKeys.map(([k]) => (
            <span key={k} className="rounded-md bg-trace-gold/8 px-2 py-0.5 text-[11px] font-mono text-base-content/60">
              {k}
            </span>
          ))}
        {!open && overflow > 0 && <span className="text-[11px] font-mono text-base-content/50">+{overflow}</span>}
      </StepRowHeader>
      {open && (
        <div className={`mt-1.5 overflow-hidden rounded-lg ${TRACE_ROW_BORDER} bg-trace-blue/[0.06]`}>
          {entries.map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-[minmax(120px,180px)_1fr] gap-4 border-b border-base-content/15 px-4 py-2.5 text-xs last:border-0"
            >
              <span className="font-mono font-medium text-trace-blue break-words">{k}</span>
              <span className="font-mono text-base-content break-words">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!inRail) return <FlatRow>{body}</FlatRow>;
  return <TraceRow node={<VarsNodeIcon />}>{body}</TraceRow>;
}

function ToolActionButtons({ rawTool, isRag }) {
  const { onToolLogsClick, onToolDataClick } = useContext(TraceCtx);
  if (!rawTool) return null;

  return (
    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {!isRag && onToolLogsClick && (
        <button
          type="button"
          className="grid h-5 w-5 place-items-center rounded hover:bg-base-300/80 text-base-content/60 hover:text-base-content"
          title="function logs"
          onClick={(e) => onToolLogsClick(e, rawTool)}
        >
          <SquareFunction size={14} />
        </button>
      )}
      {onToolDataClick && (
        <button
          type="button"
          className="grid h-5 w-5 place-items-center rounded hover:bg-base-300/80 text-base-content/60 hover:text-base-content"
          title={isRag ? "knowledge base data" : "function data"}
          onClick={() => onToolDataClick(rawTool)}
        >
          <FileClock size={14} />
        </button>
      )}
    </div>
  );
}

function ToolStep({ step, inRail = true }) {
  const [open, setOpen] = useState(false);
  const err = step.status === "error";
  const toolKind = step.toolKind || "tool";
  const isPreFunction = toolKind === "pre_function";
  const isPostFunction = toolKind === "post_function";
  const toolHead = open
    ? "rounded-lg bg-gradient-to-r from-base-200/80 via-base-200/40 to-transparent"
    : isPreFunction
      ? "bg-gradient-to-r from-warning/14 via-warning/6 to-transparent hover:from-warning/20"
      : isPostFunction
        ? "bg-gradient-to-r from-info/14 via-info/6 to-transparent hover:from-info/20"
        : "bg-gradient-to-r from-base-200/60 via-base-200/25 to-transparent hover:from-base-200/80";

  const kindTag = isPreFunction ? (
    <KindTag className="border border-warning/25 bg-warning/10 text-warning">pre function</KindTag>
  ) : isPostFunction ? (
    <KindTag className="border border-info/25 bg-info/10 text-info">post function</KindTag>
  ) : (
    <KindTag className="bg-base-300/50 text-base-content/55">tool</KindTag>
  );

  const body = (
    <div className="min-w-0">
      <StepRowHeader
        open={open}
        inRail={inRail}
        icon={<ToolNodeIcon err={err} />}
        headerClass={toolHead}
        onClick={() => setOpen((o) => !o)}
      >
        {kindTag}
        <span
          className="max-w-[180px] truncate text-xs font-medium text-base-content"
          title={formatToolName(step.name)}
        >
          {formatToolName(step.name)}
        </span>
        {!err && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">ok</span>}
        {err && <span className="badge badge-xs badge-error">err</span>}
        <span className="min-w-0 flex-1 truncate text-xs text-base-content/60" title={step.summary}>
          {step.summary}
        </span>
        <Meta latency={step.latency} tokens={step.tokens} />
        <ToolActionButtons rawTool={step.rawTool} />
      </StepRowHeader>
      {open && (
        <div className="pb-1 pt-1">
          <IoPanel label="Input" value={step.input} />
          <IoPanel label="Output" value={step.output} />
        </div>
      )}
    </div>
  );

  if (!inRail) return <FlatRow>{body}</FlatRow>;
  return <TraceRow node={<ToolNodeIcon err={err} />}>{body}</TraceRow>;
}

function VarsStep({ step, inRail = true }) {
  return <VariablesBlock vars={step.vars} inRail={inRail} />;
}

function KbQueryBox({ query }) {
  if (!query) return null;
  return (
    <div className={`mx-2 mb-2 rounded-lg ${TRACE_ROW_BORDER} bg-trace-blue/[0.06] px-3 py-2`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">Query</div>
      <div className="mt-1 text-xs leading-relaxed text-base-content/80">{query}</div>
    </div>
  );
}

function KbChunkCard({ chunk, index }) {
  const scorePct = chunk.score != null ? Math.round(Number(chunk.score) * 100) : null;
  return (
    <div className={`mx-2 mb-2 overflow-hidden rounded-lg ${TRACE_ROW_BORDER} bg-base-100`}>
      <div className="flex items-center justify-between gap-2 border-b border-base-content/20 bg-base-200/50 px-3 py-1.5 text-[11px]">
        <span className="truncate text-base-content/55">{chunk.source || `chunk ${index + 1}`}</span>
        {scorePct != null && (
          <span className="shrink-0 rounded-full bg-trace-blue/10 px-2 py-0.5 font-mono text-[10px] text-trace-blue">
            {scorePct}%
          </span>
        )}
      </div>
      <div className="px-3 py-2 text-xs leading-relaxed text-base-content/75">{chunk.text}</div>
    </div>
  );
}

function KbStep({ step, inRail = true }) {
  const [open, setOpen] = useState(false);
  const chunks = step.chunks || [];
  const query = step.query || step.input?.query || "";
  const kbHead = open
    ? "rounded-lg bg-gradient-to-r from-trace-blue/14 via-trace-blue/6 to-transparent"
    : "bg-gradient-to-r from-trace-blue/10 via-trace-blue/4 to-transparent hover:from-trace-blue/16";

  const body = (
    <div className="min-w-0">
      <StepRowHeader
        open={open}
        inRail={inRail}
        icon={<KbNodeIcon />}
        headerClass={kbHead}
        onClick={() => setOpen((o) => !o)}
      >
        <KindTag className="border border-trace-blue/20 bg-trace-blue/10 text-trace-blue">knowledge base</KindTag>
        <span className="truncate text-xs font-medium text-base-content">{step.name}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-base-content/60" title={step.summary}>
          {step.summary}
        </span>
        <ToolActionButtons rawTool={step.rawTool} isRag />
      </StepRowHeader>
      {open && (
        <div className="pb-1 pt-1">
          <KbQueryBox query={query} />
          {chunks.length > 0 ? (
            chunks.map((c, i) => <KbChunkCard key={i} chunk={c} index={i} />)
          ) : (
            <>
              <IoPanel label="Input" value={step.input} />
              <IoPanel label="Output" value={step.output} />
            </>
          )}
        </div>
      )}
    </div>
  );

  if (!inRail) return <FlatRow>{body}</FlatRow>;
  return <TraceRow node={<KbNodeIcon />}>{body}</TraceRow>;
}

function MessageBubble({ text, align = "left", expandable = true }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const long = expandable && text.length > 180;
  const showClamp = long && !expanded;
  const isLeft = align === "left";

  return (
    <div className="relative my-[7px] min-w-0">
      <div
        className={`bg-base-200/55 px-3 py-2 text-xs leading-snug text-base-content/70 ${
          isLeft ? "rounded-[4px_12px_12px_12px] text-left" : "rounded-[12px_4px_12px_12px] text-right"
        }`}
      >
        <div className={`whitespace-pre-wrap ${showClamp ? "line-clamp-6" : ""}`}>{text}</div>
        {long && (
          <button
            type="button"
            className={`mt-1 flex items-center gap-0.5 text-[11px] text-primary hover:underline ${isLeft ? "" : "ml-auto"}`}
            onClick={() => setExpanded((o) => !o)}
          >
            <ChevronDown size={11} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

function QueryBubble({ text }) {
  return <MessageBubble text={text} align="left" expandable={false} />;
}

function ResponseBubble({ text }) {
  return <MessageBubble text={text} align="left" />;
}

function UserMessageBubble({ text }) {
  return <MessageBubble text={text} align="left" expandable />;
}

function AgentDataButton({ payload }) {
  const { onAgentDataClick } = useContext(TraceCtx);
  if (!onAgentDataClick || !payload) return null;
  return (
    <button
      type="button"
      className="grid h-5 w-5 shrink-0 place-items-center rounded text-base-content/60 hover:bg-base-300/50 hover:text-primary"
      title="View agent data"
      onClick={(e) => {
        e.stopPropagation();
        onAgentDataClick(payload);
      }}
    >
      <FileClock size={14} />
    </button>
  );
}

function buildAgentSliderPayload(node, agents, agentMeta) {
  const tools = (node.steps || [])
    .map((s) => {
      if (s.type === "tool") {
        return { name: s.name, functionData: s.rawTool || { args: s.input, data: s.output } };
      }
      if (s.type === "agent") {
        return {
          name: agents[s.agent]?.name || s.agent,
          nodeType: "agent",
          functionData: s.rawTool || { args: { query: s.question }, data: { response: s.responseText } },
        };
      }
      return null;
    })
    .filter(Boolean);

  if (node.rawTool) {
    return {
      name: agentMeta.name,
      functionData: {
        id: node.rawTool.id ?? node.rawTool.message_id ?? null,
        args: node.rawTool.args ?? {},
        data: node.rawTool.data ?? {},
      },
      tools,
    };
  }

  if (node.rawMessage) {
    return {
      name: agentMeta.name,
      functionData: {
        id: node.rawMessage.message_id ?? null,
        args: {
          user: node.rawMessage.user,
          variables: node.rawMessage.variables,
        },
        data: node.rawMessage,
      },
      tools,
    };
  }

  return { name: agentMeta.name, functionData: null, tools };
}

function HistoryExecutionSteps({ node, agents, inRail = false }) {
  const steps = node.steps || [];
  if (steps.length === 0) return null;

  const renderRootStep = (s, i) => {
    if (s.type === "text") return <TextStep key={i} step={s} />;
    if (s.type === "tool") return <ToolStep key={i} step={s} inRail={inRail} />;
    if (s.type === "variables") return <VarsStep key={i} step={s} inRail={inRail} />;
    if (s.type === "kb") return <KbStep key={i} step={s} inRail={inRail} />;
    if (s.type === "agent") return <AgentBlock key={i} node={s} agents={agents} embedded depth={1} />;
    return null;
  };

  return <div className="w-full space-y-1">{steps.map(renderRootStep)}</div>;
}

function countExecutionSteps(steps = []) {
  const c = { tool: 0, kb: 0, vars: 0, agent: 0 };
  steps.forEach((s) => {
    if (c[s.type] != null) c[s.type]++;
  });
  return c;
}

function StepCountBadges({ stepCounts, responsePreview }) {
  return (
    <span className="ml-0.5 flex min-w-0 flex-wrap gap-1">
      {stepCounts.tool > 0 && (
        <span className="shrink-0 rounded-full bg-base-300/40 px-1.5 py-0.5 text-[10px] text-base-content/70">
          {stepCounts.tool} tool{stepCounts.tool > 1 ? "s" : ""}
        </span>
      )}
      {stepCounts.kb > 0 && (
        <span className="shrink-0 rounded-full bg-base-300/40 px-1.5 py-0.5 text-[10px] text-base-content/70">
          {stepCounts.kb} KB
        </span>
      )}
      {stepCounts.agent > 0 && (
        <span className="shrink-0 rounded-full bg-base-300/40 px-1.5 py-0.5 text-[10px] text-base-content/70">
          {stepCounts.agent} agent{stepCounts.agent > 1 ? "s" : ""}
        </span>
      )}
      {responsePreview && (
        <span className="hidden max-w-[180px] truncate text-[11px] text-base-content/50 sm:inline">
          {responsePreview}
        </span>
      )}
    </span>
  );
}

/** Parent agent wrapper — gold shell/header, user message + colored rail for children */
function RootExecutionShell({ node, agents, userMessage }) {
  const [open, setOpen] = useState(false);
  const steps = node.steps || [];
  const hasUserMessage = Boolean(userMessage?.trim());
  if (steps.length === 0 && !hasUserMessage) return null;

  const a = agents[node.agent] || {
    name: node.agent,
    model: "—",
    role: "Orchestrator",
  };
  const stepCounts = useMemo(() => countExecutionSteps(steps), [steps]);
  const hasBody = steps.length > 0 || hasUserMessage;
  const hue = resolveAgentHue(a, node.agent);
  const theme = HUE_THEME[hue];
  const shellClass = !(open && hasBody) ? theme.shell : "";
  const headClass = open && hasBody ? theme.headOpen : theme.head;
  const sliderPayload = useMemo(() => buildAgentSliderPayload(node, agents, a), [node, agents, a]);

  return (
    <div className={`w-full overflow-hidden ${shellClass}`}>
      <div
        className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-colors ${headClass}`}
        onClick={() => setOpen((o) => !o)}
      >
        <CaretBox open={open} />
        <AgentAvatar name={a.name} hue={hue} glyph={a.glyph} large />
        <span className="truncate text-sm font-semibold text-base-content">{a.name}</span>
        {a.model && a.model !== "—" && (
          <span className="hidden truncate text-[11px] text-base-content/45 sm:inline">{a.model}</span>
        )}
        {!open && <StepCountBadges stepCounts={stepCounts} />}
        <span className="flex-1" />
        <Meta latency={node.latency} tokens={node.tokens} cost={node.cost} />
        <AgentDataButton payload={sliderPayload} />
      </div>
      {open && hasBody && (
        <AgentBodyRail hue={hue} className="pt-1">
          <UserMessageBubble text={userMessage} />
          <HistoryExecutionSteps node={node} agents={agents} inRail />
        </AgentBodyRail>
      )}
    </div>
  );
}

function AgentBlock({ node, agents, root, embedded, depth = 1 }) {
  const { detail: _detail } = useContext(TraceCtx);
  const a = agents[node.agent] || {
    name: node.agent,
    model: "—",
    role: "Sub-agent",
  };
  const [open, setOpen] = useState(false);
  const stepCounts = useMemo(() => countExecutionSteps(node.steps), [node.steps]);

  const question = node.question || node.reason;
  const hasVars = useMemo(() => {
    return Object.keys(node.vars || {}).filter((k) => !TRACE_HIDDEN_VAR_KEYS.has(k)).length > 0;
  }, [node.vars]);
  const hasBody = (node.steps?.length ?? 0) > 0 || question || node.responseText || hasVars;

  const hue = root && !embedded ? null : resolveAgentHue(a, node.agent, node.hue);
  const theme = hue ? HUE_THEME[hue] : null;
  const shellClass = theme && !(open && hasBody) ? theme.shell : "";

  const renderStep = (s, i) => {
    if (s.type === "text") return <TextStep key={i} step={s} />;
    if (s.type === "tool") return <ToolStep key={i} step={s} inRail />;
    if (s.type === "variables") return <VarsStep key={i} step={s} inRail />;
    if (s.type === "kb") return <KbStep key={i} step={s} inRail />;
    if (s.type === "agent")
      return <AgentBlock key={i} node={s} agents={agents} embedded={embedded} depth={depth + 1} />;
    return null;
  };

  const sliderPayload = useMemo(() => buildAgentSliderPayload(node, agents, a), [node, agents, a]);

  const stepCountBadges = <StepCountBadges stepCounts={stepCounts} responsePreview={node.responsePreview} />;

  const headClass = open && hasBody ? theme?.headOpen || NEUTRAL_HEAD_OPEN : theme?.head || NEUTRAL_HEAD;

  const renderAgentHeader = () => (
    <div
      className={`flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${headClass}`}
      onClick={() => setOpen((o) => !o)}
    >
      <CaretBox open={open} />
      <AgentAvatar name={a.name} hue={hue} glyph={a.glyph} large={root && !embedded} />
      <span className="truncate text-sm font-semibold text-base-content">{a.name}</span>
      <span
        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${theme?.roleTag || "border-base-300/40 bg-base-300/30 text-base-content/55"}`}
      >
        {a.role}
      </span>
      {a.model && a.model !== "—" && (
        <span className="hidden truncate text-[11px] text-base-content/45 sm:inline">{a.model}</span>
      )}
      {!open && stepCountBadges}
      <span className="flex-1" />
      <Meta latency={node.latency} tokens={node.tokens} cost={node.cost} />
      <AgentDataButton payload={sliderPayload} />
    </div>
  );

  const renderExpandedBody = () => {
    const hasInnerContent = (node.steps?.length ?? 0) > 0 || question || hasVars || node.responseText;
    if (!hasInnerContent) return null;

    return (
      <AgentBodyRail hue={hue}>
        <QueryBubble text={question} />
        {node.vars && <VariablesBlock vars={node.vars} inRail />}
        {node.steps?.map(renderStep)}
        <ResponseBubble text={node.responseText} />
      </AgentBodyRail>
    );
  };

  if (embedded) {
    return (
      <div className={`my-1.5 w-full overflow-hidden ${shellClass}`}>
        {renderAgentHeader()}
        {open && hasBody ? renderExpandedBody() : null}
      </div>
    );
  }

  return (
    <div className={`my-1.5 w-full overflow-hidden ${shellClass}`}>
      {renderAgentHeader()}
      {open && hasBody ? renderExpandedBody() : null}
    </div>
  );
}

export function MessageRunTrace({
  run,
  agents,
  embedded = true,
  userMessage,
  onToolLogsClick,
  onToolDataClick,
  onAgentDataClick,
}) {
  if (!run) return null;
  return (
    <TraceCtx.Provider
      value={{ detail: "compact", showMeta: true, onToolLogsClick, onToolDataClick, onAgentDataClick }}
    >
      {embedded ? (
        <RootExecutionShell node={run} agents={agents || {}} userMessage={userMessage} />
      ) : (
        <AgentBlock node={run} agents={agents || {}} root={true} embedded={false} />
      )}
    </TraceCtx.Provider>
  );
}

export default function ExecutionTraceView({
  trace,
  agents,
  detail = "medium",
  showMeta = true,
  embedded = false,
  onToolLogsClick,
  onToolDataClick,
  onAgentDataClick,
}) {
  if (!trace?.turns?.length) {
    return <div className="p-4 text-sm text-base-content/60">No execution trace available.</div>;
  }

  const turn = trace.turns[0];

  if (embedded) {
    return (
      <TraceCtx.Provider value={{ detail, showMeta, onToolLogsClick, onToolDataClick, onAgentDataClick }}>
        <MessageRunTrace
          run={turn.run}
          agents={agents}
          embedded
          onToolLogsClick={onToolLogsClick}
          onToolDataClick={onToolDataClick}
          onAgentDataClick={onAgentDataClick}
        />
      </TraceCtx.Provider>
    );
  }

  const meta = trace.meta || {};

  return (
    <TraceCtx.Provider value={{ detail, showMeta }}>
      <div className="bg-base-100 text-base-content">
        <div className="flex flex-wrap items-center gap-4 border-b border-base-300 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Execution Trace</div>
            {meta.started && <div className="mt-0.5 text-xs text-base-content/50">{meta.started}</div>}
          </div>
          <div className="ml-1 flex flex-wrap gap-4">
            {meta.totalLatency != null && (
              <div className="flex flex-col">
                <b className="text-sm">
                  {meta.totalLatency >= 1000
                    ? `${(meta.totalLatency / 1000).toFixed(1)}s`
                    : `${Math.round(meta.totalLatency)}ms`}
                </b>
                <span className="text-[11px] text-base-content/50">latency</span>
              </div>
            )}
            {meta.totalTokens != null && (
              <div className="flex flex-col">
                <b className="text-sm">{meta.totalTokens.toLocaleString()}</b>
                <span className="text-[11px] text-base-content/50">tokens</span>
              </div>
            )}
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-5">
          <MessageRunTrace run={turn.run} agents={agents} embedded={false} />
        </div>
      </div>
    </TraceCtx.Provider>
  );
}
