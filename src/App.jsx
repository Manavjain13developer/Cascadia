import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CircleUserRound,
  Clock3,
  Cpu,
  Home as HomeIcon,
  Layers3,
  LoaderCircle,
  Menu,
  Network,
  Paperclip,
  PanelLeftClose,
  Search,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRef, useState } from "react";
import benchmarkRun from "../backend/benchmarks/results.json";
import "./App.css";

const SMALL_MODEL = "qwen2.5:3b";
const LARGE_MODEL = "qwen2.5:7b";

const configuredModels = [
  {
    name: SMALL_MODEL,
    size: "3B parameters",
    role: "Confidence preflight and direct responses",
  },
  {
    name: LARGE_MODEL,
    size: "7B parameters",
    role: "Escalation when confidence is below threshold",
  },
];

function formatDuration(milliseconds) {
  if (typeof milliseconds !== "number" || !Number.isFinite(milliseconds)) {
    return "—";
  }
  return milliseconds >= 1000
    ? `${(milliseconds / 1000).toFixed(2)} s`
    : `${milliseconds.toFixed(0)} ms`;
}

function formatBenchmarkDate(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

async function* readServerSentEvents(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parseFrame = (frame) => {
    let event = "message";
    const data = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data.push(line.slice(5).trimStart());
      }
    }
    return data.length ? { event, data: JSON.parse(data.join("\n")) } : null;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let separator;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const parsed = parseFrame(frame);
        if (parsed) yield parsed;
      }
      if (done) {
        if (buffer.trim()) {
          const parsed = parseFrame(buffer);
          if (parsed) yield parsed;
        }
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const navigation = [
  { label: "Overview", path: "/", icon: HomeIcon },
  { label: "Playground", path: "/playground", icon: Sparkles },
  { label: "Models", path: "/models", icon: Layers3 },
  { label: "Routing", path: "/routing", icon: Network },
  { label: "History", path: "/history", icon: Clock3 },
  { label: "Analytics", path: "/analytics", icon: BarChart3 },
  { label: "Settings", path: "/settings", icon: SettingsIcon },
  { label: "About", path: "/about", icon: CircleUserRound },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <span className="font-display text-sm font-medium tracking-[.18em] text-slate-100">
        CASCADIA
      </span>
    </div>
  );
}

function Sidebar({ open, onClose }) {
  return (
    <aside
      className={`app-sidebar fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/[.08] px-5 py-6 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="mb-14 flex items-center justify-between px-2">
        <Logo />
        <button
          className="text-slate-500 md:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>
      <p className="mb-4 px-3 font-mono text-[9px] uppercase tracking-[.24em] text-slate-600">
        Workspace
      </p>
      <nav className="space-y-1">
        {navigation.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            onClick={onClose}
            className={({ isActive }) =>
              `nav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] ${isActive ? "active" : ""}`
            }
          >
            <Icon size={16} strokeWidth={1.6} />
            <span>{label}</span>
            {label === "Playground" && (
              <span className="ml-auto rounded-full border border-emerald-400/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-emerald-300">
                Live
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-xl border border-white/[.08] bg-white/[.025] p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-300">
          <span className="status-beacon" />
          Local inference
        </div>
        <p className="font-mono text-[9px] leading-relaxed text-slate-600">
          Ollama runs locally.
          <br />
          Requests stay private.
        </p>
      </div>
    </aside>
  );
}

function Header({ onMenu }) {
  return (
    <header className="app-mobile-header flex h-20 items-center justify-between border-b border-white/[.07] px-5 md:hidden">
      <button
        className="text-slate-300"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>
      <Logo />
      <span className="mobile-runtime" aria-label="Local runtime">
        <span className="status-beacon" />
      </span>
    </header>
  );
}

function Home({ activity }) {
  const navigate = useNavigate();
  const successfulQueries = activity.length;
  const escalatedQueries = activity.filter((item) => item.escalated).length;
  const averageResponseTime = successfulQueries
    ? activity.reduce((total, item) => total + item.timing.total_ms, 0) /
      successfulQueries
    : null;
  const benchmarkSummary = benchmarkRun.summary;
  const benchmarkSamples = benchmarkRun.results.slice(-4).reverse();

  return (
    <main className="page-wrap">
      <div className="page-content max-w-6xl">
        <PageHeader eyebrow="LOCAL INFERENCE / OVERVIEW" title="Workspace">
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
            A live view of this session, your configured model cascade, and the
            latest recorded benchmark.
          </p>
        </PageHeader>

        <section className="dashboard-status glass mb-5 flex flex-wrap items-center justify-between gap-5 rounded-2xl p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="dashboard-status-icon">
              <Activity size={18} />
            </span>
            <div>
              <p className="eyebrow-label">System status</p>
              <h2 className="mt-2 font-display text-lg text-slate-100">
                {successfulQueries ? "Local inference responding" : "Awaiting a live request"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {successfulQueries
                  ? `${successfulQueries} completed request${successfulQueries === 1 ? "" : "s"} recorded in this session.`
                  : "Runtime availability is verified when a request reaches Ollama."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/playground")}
            className="button-primary group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium"
          >
            Open playground
            <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Session requests",
              value: successfulQueries,
              note: "Completed in this tab",
            },
            {
              label: "Escalation rate",
              value: successfulQueries
                ? `${((escalatedQueries / successfulQueries) * 100).toFixed(0)}%`
                : "—",
              note: successfulQueries ? `${escalatedQueries} routed to 7B` : "No session data yet",
            },
            {
              label: "Average response",
              value: averageResponseTime === null ? "—" : formatDuration(averageResponseTime),
              note: "Measured for this session",
            },
          ].map((metric) => (
            <div key={metric.label} className="glass metric-panel rounded-xl p-4">
              <p className="eyebrow-label">{metric.label}</p>
              <p className="mt-3 font-display text-2xl text-slate-100">{metric.value}</p>
              <p className="mt-1 text-[11px] text-slate-500">{metric.note}</p>
            </div>
          ))}
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <section className="glass rounded-2xl p-5 sm:p-6">
            <div className="section-heading">
              <div>
                <p className="eyebrow-label">Routing infrastructure</p>
                <h2 className="mt-2 font-display text-lg text-slate-100">Configured models</h2>
              </div>
              <button type="button" onClick={() => navigate("/models")} className="text-xs text-amber-200/80 transition hover:text-amber-100">
                View models <ArrowUpRight className="ml-1 inline" size={13} />
              </button>
            </div>
            <div className="mt-5 divide-y divide-white/[.07]">
              {configuredModels.map((model, index) => {
                const verified = activity.some(
                  (item) => item.model === model.name || (index === 0 && item.escalated),
                );
                return (
                  <div key={model.name} className="model-row flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                    <span className={`model-glyph ${index === 1 ? "model-glyph-large" : ""}`}>
                      <Cpu size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-100">{model.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{model.role}</p>
                    </div>
                    <span className="model-state">
                      <span className={verified ? "status-beacon status-beacon-active" : "status-beacon"} />
                      {verified ? "Verified this session" : "Configured"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 border-t border-white/[.07] pt-4 text-[11px] text-slate-500">
              Hardware utilization is not reported by the current Ollama API integration.
            </p>
          </section>

          <section className="glass rounded-2xl p-5 sm:p-6">
            <div className="section-heading">
              <div>
                <p className="eyebrow-label">Benchmark archive</p>
                <h2 className="mt-2 font-display text-lg text-slate-100">Latest recorded run</h2>
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                {formatBenchmarkDate(benchmarkRun.timestamp)}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ["Queries", benchmarkSummary.total_queries ?? benchmarkRun.total_queries],
                ["Succeeded", benchmarkSummary.successful_queries],
                ["Average", `${benchmarkSummary.average_response_time}s`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[.06] bg-white/[.02] p-3">
                  <p className="eyebrow-label">{label}</p>
                  <p className="mt-2 font-display text-lg text-slate-100">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-white/[.07] pt-4 text-xs">
              <span className="text-slate-400">3B / 7B routes</span>
              <span className="font-mono text-slate-300">
                {benchmarkSummary["3b_count"]} <span className="text-slate-600">/</span> {benchmarkSummary["7b_count"]}
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-5 text-slate-600">
              Recorded benchmark snapshot; this is not live session telemetry.
            </p>
          </section>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <section className="glass rounded-2xl p-5 sm:p-6">
            <div className="section-heading">
              <div>
                <p className="eyebrow-label">This browser session</p>
                <h2 className="mt-2 font-display text-lg text-slate-100">Recent requests</h2>
              </div>
              <button type="button" onClick={() => navigate("/analytics")} className="text-xs text-amber-200/80 transition hover:text-amber-100">
                Session analytics <ArrowUpRight className="ml-1 inline" size={13} />
              </button>
            </div>
            {activity.length ? (
              <div className="mt-5 divide-y divide-white/[.07]">
                {activity.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={`route-indicator ${item.escalated ? "route-indicator-escalated" : ""}`} />
                    <p className="min-w-0 flex-1 truncate text-xs text-slate-300">{item.query}</p>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">{item.model}</span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">{formatDuration(item.timing.total_ms)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-white/[.1] px-4 py-6 text-center text-xs text-slate-500">
                Completed prompts will appear here after your first Playground request.
              </p>
            )}
          </section>

          <section className="glass rounded-2xl p-5 sm:p-6">
            <div className="section-heading">
              <div>
                <p className="eyebrow-label">Verified benchmark data</p>
                <h2 className="mt-2 font-display text-lg text-slate-100">Recorded samples</h2>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                {benchmarkSamples.length} of {benchmarkRun.total_queries}
              </span>
            </div>
            <div className="mt-4 divide-y divide-white/[.07]">
              {benchmarkSamples.map((sample) => (
                <div key={`${sample.id}-${sample.category}`} className="flex items-center gap-3 py-3">
                  <span className="benchmark-category">{sample.category}</span>
                  <p className="min-w-0 flex-1 truncate text-xs text-slate-300">{sample.query}</p>
                  <span className="font-mono text-[10px] text-slate-500">{sample.response_time_seconds}s</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-600">
              Samples are from the recorded run dated {formatBenchmarkDate(benchmarkRun.timestamp)}.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

const exampleQueries = [
  "Explain binary search in Java",
  "What is photosynthesis?",
  "Convert 5 km to meters",
];

function PlaygroundFlow() {
  const steps = [
    ["01", "USER QUERY", CircleUserRound],
    ["02", "FLASK API", Network],
    ["03", "OLLAMA MODEL", Cpu],
    ["04", "RESPONSE", Sparkles],
  ];

  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <p className="mb-5 font-mono text-[9px] uppercase tracking-[.24em] text-slate-600">
        Local request path
      </p>
      <div className="space-y-4">
        {steps.map(([index, label, Icon], stepIndex) => (
          <div key={label}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/[.05] text-sky-300">
                <Icon size={15} strokeWidth={1.5} />
              </div>
              <div>
                <span className="font-mono text-[9px] text-slate-600">
                  {index}
                </span>
                <p className="mt-0.5 text-[11px] tracking-[.08em] text-slate-300">
                  {label}
                </p>
              </div>
            </div>
            {stepIndex < steps.length - 1 && (
              <div className="ml-[18px] h-4 border-l border-dashed border-sky-300/20" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Playground({ onRequestComplete }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [submittedAttachmentName, setSubmittedAttachmentName] = useState("");
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState("idle");
  const activeRequest = useRef(null);
  const attachmentInput = useRef(null);

  const selectAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!/\.(txt|md|csv|json|ya?ml|py|js|jsx|ts|tsx|html|css|xml|log)$/i.test(file.name)) {
      setErrorMessage("Choose a supported text, data, or source-code file.");
      setStatus("error");
      event.target.value = "";
      return;
    }
    if (file.size > 32 * 1024) {
      setErrorMessage("Text attachments must be 32 KB or smaller.");
      setStatus("error");
      event.target.value = "";
      return;
    }

    try {
      setAttachment({ name: file.name, text: await file.text() });
      setErrorMessage("");
      if (status === "error") setStatus("idle");
    } catch (error) {
      setErrorMessage(`Could not read the selected attachment: ${error.message}`);
      setStatus("error");
      event.target.value = "";
    }
  };

  const submitQuery = async (event) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setErrorMessage("Type a question or choose one of the examples above.");
      setStatus("error");
      return;
    }

    const prompt = attachment
      ? `${trimmedQuery}\n\n--- Attached text: ${attachment.name} ---\n${attachment.text}`
      : trimmedQuery;
    setSubmittedQuery(trimmedQuery);
    setSubmittedAttachmentName(attachment?.name ?? "");
    setResult(null);
    setErrorMessage("");
    setStatus("loading");
    const controller = new AbortController();
    activeRequest.current = controller;
    const markStoppedIfCurrent = () => {
      if (activeRequest.current === null || activeRequest.current === controller) {
        setStatus("stopped");
      }
    };
    let responseText = "";
    let completed = false;
    let routing = null;
    let timeToFirstTokenMs = null;
    const requestStartedAt = performance.now();
    try {
      const response = await fetch("/api/query/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: prompt }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error ||
            "Could not reach Flask. Make sure the local backend is running.",
        );
      }
      if (!response.body) {
        throw new Error("The browser could not open the response stream.");
      }

      for await (const eventData of readServerSentEvents(response.body)) {
        if (controller.signal.aborted) {
          break;
        }
        if (eventData.event === "routing") {
          routing = eventData.data;
          setResult({
            response: responseText,
            ...eventData.data,
            responseMode: eventData.data.response_mode,
            timing: null,
          });
          setStatus("streaming");
        } else if (eventData.event === "buffered") {
          if (typeof eventData.data.text !== "string") {
            throw new Error("The response stream contained invalid buffered text.");
          }
          responseText += eventData.data.text;
          if (timeToFirstTokenMs === null && eventData.data.text.length > 0) {
            timeToFirstTokenMs = performance.now() - requestStartedAt;
          }
          setResult((current) =>
            current ? { ...current, response: responseText } : current,
          );
        } else if (eventData.event === "token") {
          if (typeof eventData.data.token !== "string") {
            throw new Error("The response stream contained an invalid token.");
          }
          responseText += eventData.data.token;
          if (timeToFirstTokenMs === null && eventData.data.token.length > 0) {
            timeToFirstTokenMs = performance.now() - requestStartedAt;
          }
          setResult((current) =>
            current ? { ...current, response: responseText } : current,
          );
        } else if (eventData.event === "complete") {
          if (timeToFirstTokenMs === null) {
            throw new Error("The response stream completed without a generated token.");
          }
          const timing = {
            ...eventData.data.timing,
            total_ms: Math.round((performance.now() - requestStartedAt) * 100) / 100,
            time_to_first_token_ms:
              Math.round(timeToFirstTokenMs * 100) / 100,
          };
          onRequestComplete({
            id: `${Date.now()}-${trimmedQuery.length}`,
            query: trimmedQuery,
            model: routing?.model,
            confidence: routing?.confidence,
            escalated: routing?.escalated,
            timing,
            completedAt: new Date().toISOString(),
          });
          setAttachment(null);
          if (attachmentInput.current) attachmentInput.current.value = "";
          setResult((current) =>
            current ? { ...current, timing } : current,
          );
          completed = true;
          setStatus("success");
        } else if (eventData.event === "error") {
          throw new Error(
            eventData.data.error || "The response stream was interrupted.",
          );
        }
      }
      if (controller.signal.aborted) {
        markStoppedIfCurrent();
      } else if (!completed) {
        throw new Error("The response stream ended before generation completed.");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        markStoppedIfCurrent();
      } else {
        controller.abort();
        setErrorMessage(
          error instanceof TypeError
            ? "The connection to Cascadia was lost. Check that the local backend is running."
            : error.message,
        );
        setStatus("error");
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    }
  };

  const stopGeneration = (event) => {
    event.preventDefault();
    const controller = activeRequest.current;
    activeRequest.current = null;
    setStatus("stopped");
    controller?.abort();
  };

  const selectExample = (example) => {
    setQuery(example);
    setErrorMessage("");
    setStatus("idle");
  };

  return (
    <main className="page-wrap">
      <div className="page-content max-w-6xl">
        <PageHeader eyebrow="PRIVATE BY DESIGN / LOCAL INFERENCE" title="Playground">
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
            One workspace for thoughtful answers, routed across your local
            Qwen models.
          </p>
        </PageHeader>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem] xl:items-start">
          <section className="min-w-0">
            <form
              onSubmit={submitQuery}
              className="chat-composer glass rounded-2xl p-3 sm:p-4"
            >
              <label htmlFor="playground-query" className="sr-only">
                Ask Cascadia anything
              </label>
              <textarea
                id="playground-query"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (status === "error") {
                    setErrorMessage("");
                    setStatus("idle");
                  }
                }}
                rows={3}
                placeholder="Message Cascadia…"
                className="chat-input w-full resize-none bg-transparent px-3 py-3 text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600"
              />
              {attachment && (
                <div className="attachment-chip">
                  <Paperclip size={13} />
                  <span>{attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachment(null);
                      if (attachmentInput.current) attachmentInput.current.value = "";
                    }}
                    aria-label={`Remove ${attachment.name}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-white/[.08] px-3 pt-3">
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    ref={attachmentInput}
                    type="file"
                    accept=".txt,.md,.csv,.json,.yaml,.yml,.py,.js,.jsx,.ts,.tsx,.html,.css,.xml,.log"
                    onChange={selectAttachment}
                    className="sr-only"
                    aria-label="Choose a text attachment"
                  />
                  <button
                    type="button"
                    onClick={() => attachmentInput.current?.click()}
                    disabled={status === "loading" || status === "streaming"}
                    className="composer-tool inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px]"
                  >
                    <Paperclip size={13} />
                    Attach text
                  </button>
                  <span className="hidden font-mono text-[9px] uppercase tracking-wider text-slate-600 sm:inline">
                    Local cascade <span className="mx-1 text-slate-700">/</span>{" "}
                    3B → 7B
                  </span>
                </div>
                {status === "loading" || status === "streaming" ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    className="button-stop inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium"
                  >
                    <X size={14} />
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium"
                  >
                    <Send size={14} />
                    Send
                  </button>
                )}
              </div>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 font-mono text-[9px] uppercase tracking-wider text-slate-600">
                Try
              </span>
              {exampleQueries.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => selectExample(example)}
                  disabled={status === "loading" || status === "streaming"}
                  className="suggestion-chip rounded-full px-3 py-2 text-left text-[11px] text-slate-400"
                >
                  {example}
                </button>
              ))}
            </div>

            {submittedQuery && status !== "idle" && (
              <article className="chat-message chat-message-user animate-rise mt-8">
                <span
                  className="message-avatar message-avatar-user"
                  aria-hidden="true"
                >
                  <CircleUserRound size={16} />
                </span>
                <div className="min-w-0">
                  <p className="message-author">You</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                    {submittedQuery}
                  </p>
                  {submittedAttachmentName && (
                    <span className="attachment-chip mt-3">
                      <Paperclip size={13} />
                      {submittedAttachmentName}
                    </span>
                  )}
                </div>
              </article>
            )}

            {status === "error" && (
              <div className="error-banner mt-5 flex items-start gap-3 rounded-xl p-4 text-xs">
                <PanelLeftClose size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">
                    The request could not be completed.
                  </p>
                  <p className="mt-1 text-rose-200/60">{errorMessage}</p>
                </div>
              </div>
            )}

            {status === "idle" && (
              <div className="chat-welcome mt-10">
                <span className="welcome-glyph">
                  <Sparkles size={18} />
                </span>
                <p className="mt-4 font-display text-lg text-slate-200">
                  What would you like to explore?
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Your prompt stays on your machine and is routed locally.
                </p>
              </div>
            )}
            {status === "loading" && (
              <div className="assistant-message mt-8 animate-rise">
                <span
                  className="message-avatar message-avatar-assistant"
                  aria-hidden="true"
                >
                  <Sparkles size={15} />
                </span>
                <div>
                  <p className="message-author">Cascadia</p>
                  <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-400">
                    <LoaderCircle
                      size={14}
                      className="animate-spin text-amber-300"
                    />
                    Evaluating the local model response…
                  </div>
                </div>
              </div>
            )}
            {status === "stopped" && !result && (
              <div className="mt-8 rounded-xl border border-white/[.08] bg-white/[.02] p-4">
                <p className="font-display text-lg text-slate-300">
                  Generation stopped.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  The local model request was cancelled.
                </p>
              </div>
            )}
            {(status === "streaming" ||
              status === "success" ||
              status === "stopped" ||
              (status === "error" && result?.response)) &&
              result && (
              <div className="assistant-response mt-8 space-y-4 animate-rise">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[.24em] text-slate-600">
                      Cascadia
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {result.model}
                    </p>
                  </div>
                  <span className={`response-state ${status === "success" ? "response-state-complete" : ""}`}>
                    <span className="status-beacon" />
                    {status === "streaming"
                      ? result.responseMode === "buffered"
                        ? "Buffered replay"
                        : "Streaming"
                      : status === "stopped"
                        ? "Stopped"
                        : status === "error"
                          ? "Interrupted"
                          : "Complete"}
                  </span>
                </div>
                <details className="glass inference-details rounded-2xl">
                  <summary>
                    <span>Inference telemetry</span>
                    <span className="telemetry-summary">
                      {(result.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </summary>
                  <div className="telemetry-grid">
                    <div className="grid gap-5 sm:grid-cols-3">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                        Selected model
                      </p>
                      <p className="mt-2 text-sm text-slate-100">
                        {result.model}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                        Confidence
                      </p>
                      <p className="mt-2 text-sm text-sky-300">
                        {(result.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                        Response time
                      </p>
                      <p className="mt-2 text-sm text-slate-100">
                        {!result.timing
                          ? "—"
                          : result.timing.total_ms >= 1000
                          ? `${(result.timing.total_ms / 1000).toFixed(2)} s`
                          : `${result.timing.total_ms.toFixed(0)} ms`}
                      </p>
                      <p className="mt-1 text-[10px] leading-5 text-slate-500">
                        {!result.timing
                          ? "Measured through generation completion"
                          : result.timing.model_loading_ms === null ||
                        result.timing.prompt_processing_ms === null ||
                        result.timing.token_generation_ms === null
                            ? "Stage timings unavailable"
                          : `Load ${(result.timing.model_loading_ms / 1000).toFixed(2)}s · Prompt ${(result.timing.prompt_processing_ms / 1000).toFixed(2)}s · Generate ${(result.timing.token_generation_ms / 1000).toFixed(2)}s`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/[.08] pt-4 sm:grid-cols-3">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                        Generated tokens
                      </p>
                      <p className="mt-2 text-sm text-slate-100">
                        {result.timing?.generated_tokens ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                        Generation speed
                      </p>
                      <p className="mt-2 text-sm text-slate-100">
                        {result.timing?.tokens_per_second == null
                          ? "—"
                          : `${result.timing.tokens_per_second.toFixed(2)} tokens/s`}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                        Time to first token
                      </p>
                      <p className="mt-2 text-sm text-slate-100">
                        {result.timing?.time_to_first_token_ms == null
                          ? "—"
                          : result.timing.time_to_first_token_ms >= 1000
                            ? `${(result.timing.time_to_first_token_ms / 1000).toFixed(2)} s`
                            : `${result.timing.time_to_first_token_ms.toFixed(0)} ms`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 border-t border-white/[.08] pt-4">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                      Routing status
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {result.escalated ? "Escalated" : "Direct"}
                    </p>
                  </div>
                </div>
                </details>
                <div className="assistant-answer glass rounded-2xl p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <p className="font-mono text-[9px] uppercase tracking-[.2em] text-slate-600">
                    Response
                  </p>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    {status === "streaming"
                      ? result.responseMode === "buffered"
                        ? "Buffered replay"
                        : "Live generation"
                      : "Model output"}
                  </span>
                  </div>
                  <div className="markdown-content text-sm leading-7 text-slate-300">
                    {result.response ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {result.response}
                      </ReactMarkdown>
                    ) : status === "streaming" ? (
                      <p className="text-slate-500">
                        {result.responseMode === "buffered"
                          ? "Displaying the buffered response"
                          : "Generating the first tokens"}
                        <span className="stream-dots" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      </p>
                    ) : (
                      <p className="text-slate-500">
                        {status === "stopped"
                          ? "Generation stopped before a response arrived."
                          : "No response text was received."}
                      </p>
                    )}
                    {result.response && status === "streaming" && (
                      <span
                        aria-label={
                          result.responseMode === "buffered"
                            ? "Displaying buffered response"
                            : "Generating"
                        }
                        className="stream-caret"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
          <aside className="xl:sticky xl:top-8">
            <PlaygroundFlow />
          </aside>
        </div>
      </div>
    </main>
  );
}

function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="page-header animate-rise">
      <div className="eyebrow-label mb-5 flex items-center gap-3">
        <span className="eyebrow-line" />
        {eyebrow}
      </div>
      <h1 className="font-display text-4xl font-medium tracking-[-.045em] text-slate-50 sm:text-5xl">
        {title}
      </h1>
      {children}
    </div>
  );
}

function Models({ activity }) {
  return (
    <main className="page-wrap">
      <div className="page-content max-w-6xl">
        <PageHeader eyebrow="LOCAL REGISTRY / ROUTER CONFIGURATION" title="Models">
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
            The models currently configured in Cascadia’s local inference
            pipeline.
          </p>
        </PageHeader>

        <div className="model-grid grid gap-4 lg:grid-cols-2">
          {configuredModels.map((model, index) => {
            const selectedCount = activity.filter(
              (item) => item.model === model.name,
            ).length;
            const verified =
              index === 0
                ? activity.length > 0
                : selectedCount > 0;
            const benchmarkCount =
              index === 0
                ? benchmarkRun.summary["3b_count"]
                : benchmarkRun.summary["7b_count"];
            return (
              <article key={model.name} className="glass model-card rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <span className={`model-glyph ${index === 1 ? "model-glyph-large" : ""}`}>
                    <Cpu size={19} strokeWidth={1.5} />
                  </span>
                  <span className={`model-state ${verified ? "model-state-verified" : ""}`}>
                    <span className={`status-beacon ${verified ? "status-beacon-active" : ""}`} />
                    {verified ? "Verified this session" : "Configured · not exercised"}
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl text-slate-100">{model.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">{model.size}</p>
                  </div>
                  <span className="role-chip">
                    {index === 0 ? "Primary · preflight" : "Escalation"}
                  </span>
                </div>

                <p className="mt-5 min-h-10 text-sm leading-6 text-slate-400">
                  {model.role}
                </p>

                <dl className="model-facts mt-5 grid grid-cols-2 gap-3 border-t border-white/[.07] pt-4">
                  <div>
                    <dt className="eyebrow-label">Selected this session</dt>
                    <dd>{selectedCount}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow-label">Recorded benchmark</dt>
                    <dd>{benchmarkCount} responses</dd>
                  </div>
                  <div>
                    <dt className="eyebrow-label">CPU utilization</dt>
                    <dd>Not reported</dd>
                  </div>
                  <div>
                    <dt className="eyebrow-label">Memory usage</dt>
                    <dd>Not reported</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>

        <section className="glass mt-5 rounded-2xl p-5 sm:p-6">
          <div className="section-heading">
            <div>
              <p className="eyebrow-label">Routing behavior</p>
              <h2 className="mt-2 font-display text-lg text-slate-100">Selection is managed by the backend</h2>
            </div>
            <span className="role-chip">3B → confidence check → 7B if needed</span>
          </div>
          <p className="mt-4 max-w-3xl text-xs leading-6 text-slate-500">
            Model enablement and the confidence threshold are controlled by the
            Flask router. Availability is confirmed only when a live request
            completes; hardware utilization is not part of the current API
            response.
          </p>
          <p className="mt-3 text-[10px] text-slate-600">
            Benchmark counts are from the recorded run dated {formatBenchmarkDate(benchmarkRun.timestamp)}.
          </p>
        </section>
      </div>
    </main>
  );
}

function RoutingDiagram() {
  return (
    <div className="glass rounded-2xl p-5 sm:p-7">
      <p className="mb-7 font-mono text-[9px] uppercase tracking-[.24em] text-slate-600">
        Decision path
      </p>
      <div className="mx-auto max-w-sm font-mono text-[10px] uppercase tracking-[.16em] text-slate-300">
        <div className="flex flex-col items-center">
          <span className="rounded-lg border border-white/10 bg-white/[.03] px-4 py-3">
            Query
          </span>
          <span className="py-2 text-sky-300/60">↓</span>
          <span className="rounded-lg border border-sky-300/20 bg-sky-300/[.06] px-4 py-3 text-sky-200">
            Small Model
          </span>
          <span className="py-2 text-sky-300/60">↓</span>
          <span className="rounded-lg border border-violet-300/20 bg-violet-300/[.06] px-4 py-3 text-violet-200">
            Confidence Check
          </span>
        </div>
        <div className="relative mt-3 grid grid-cols-2 gap-10 pt-7 text-center">
          <div className="absolute left-1/2 top-0 h-7 w-1/2 -translate-x-1/2 border-l border-t border-sky-300/20" />
          <div className="absolute left-1/2 top-0 h-7 w-1/2 border-r border-t border-sky-300/20" />
          <div>
            <p className="mb-3 text-[9px] text-emerald-300">High</p>
            <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/[.05] px-3 py-2 text-emerald-200">
              Response
            </span>
          </div>
          <div>
            <p className="mb-3 text-[9px] text-amber-200/80">Low</p>
            <span className="rounded-lg border border-amber-300/20 bg-amber-300/[.05] px-3 py-2 text-amber-100">
              Large Model
            </span>
            <span className="block py-2 text-sky-300/60">↓</span>
            <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/[.05] px-3 py-2 text-emerald-200">
              Response
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Routing() {
  return (
    <main className="page-wrap">
      <div className="page-content max-w-6xl">
        <PageHeader eyebrow="ROUTER POLICY / BACKEND CONTROLLED" title="Routing">
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
            A transparent view of the active two-stage model path.
          </p>
        </PageHeader>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section className="space-y-4">
            <article className="glass rounded-2xl p-5 sm:p-6">
              <p className="eyebrow-label">Confidence threshold</p>
              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-3xl text-slate-100">70%</h2>
                <span className="role-chip">Default · backend configurable</span>
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                The router keeps responses at or above the configured
                confidence threshold on 3B and escalates lower-confidence
                responses to 7B. Set{" "}
                <code className="text-amber-100/80">CASCADIA_CONFIDENCE_THRESHOLD</code>{" "}
                in the backend environment to override the default.
              </p>
            </article>
            <article className="glass rounded-2xl p-5 sm:p-6">
              <p className="eyebrow-label">Configured models</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {configuredModels.map((model, index) => (
                  <div key={model.name} className="route-model-card">
                    <span className={`model-glyph ${index === 1 ? "model-glyph-large" : ""}`}>
                      <Cpu size={16} />
                    </span>
                    <div className="mt-3">
                      <p className="text-sm text-slate-100">{model.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{model.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <p className="px-1 text-[10px] leading-5 text-slate-600">
              Model selection and threshold controls are intentionally
              read-only here: the current frontend has no API for changing the
              Flask router’s runtime configuration.
            </p>
          </section>
          <aside>
            <RoutingDiagram />
          </aside>
        </div>
      </div>
    </main>
  );
}

function History({ activity }) {
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("All models");
  const [confidenceFilter, setConfidenceFilter] = useState("All confidence");
  const [selectedId, setSelectedId] = useState(null);
  const selected = activity.find((item) => item.id === selectedId);

  const filteredItems = activity.filter((item) => {
    const matchesSearch = item.query
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesModel =
      modelFilter === "All models" || item.model === modelFilter;
    const matchesConfidence =
      confidenceFilter === "All confidence" ||
      (confidenceFilter === "High"
        ? item.confidence >= 0.8
        : item.confidence < 0.8);
    return matchesSearch && matchesModel && matchesConfidence;
  });

  return (
    <main className="page-wrap">
      <div className="page-content max-w-6xl">
        <PageHeader eyebrow="LOCAL SESSION / COMPLETED REQUESTS" title="Query history">
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
            Requests and routing decisions captured in this browser session.
            History is not persisted after a reload.
          </p>
        </PageHeader>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search history</span>
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search queries..."
                className="w-full rounded-lg border border-white/10 bg-white/[.025] py-2.5 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-300/30"
              />
            </label>
            <select
              value={modelFilter}
              onChange={(event) => setModelFilter(event.target.value)}
              aria-label="Filter by model"
              className="rounded-lg border border-white/10 bg-[#0a1725] px-3 py-2.5 text-xs text-slate-300 outline-none"
            >
              <option>All models</option>
              {configuredModels.map((model) => (
                <option key={model.name}>{model.name}</option>
              ))}
            </select>
            <select
              value={confidenceFilter}
              onChange={(event) => setConfidenceFilter(event.target.value)}
              aria-label="Filter by confidence"
              className="rounded-lg border border-white/10 bg-[#0a1725] px-3 py-2.5 text-xs text-slate-300 outline-none"
            >
              <option>All confidence</option>
              <option>High</option>
              <option>Low</option>
            </select>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[.08] font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  {[
                    "Query",
                    "Selected Model",
                    "Confidence",
                    "Response Time",
                    "Status",
                    "Time",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-3 pb-3 font-normal first:pl-2"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(item.id);
                      }
                    }}
                    tabIndex={0}
                    className={`cursor-pointer border-b border-white/[.06] text-xs transition hover:bg-white/[.035] ${selectedId === item.id ? "bg-sky-300/[.05]" : ""}`}
                  >
                    <td className="max-w-[19rem] truncate px-3 py-4 pl-2 text-slate-200">
                      {item.query}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-slate-400">
                      {item.model}
                    </td>
                    <td className="px-3 py-4 text-sky-300">
                      {(item.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-4 text-slate-400">
                      {formatDuration(item.timing.total_ms)}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full border px-2 py-1 font-mono text-[9px] ${item.escalated ? "border-amber-300/20 text-amber-200/80" : "border-emerald-300/20 text-emerald-300"}`}
                      >
                        {item.escalated ? "Escalated" : "Direct"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-slate-500">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(item.completedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">
                {activity.length
                  ? "No requests match these filters."
                  : "Completed requests from this session will appear here."}
              </div>
            )}
          </div>
        </div>
        {selected && (
          <div className="glass mt-5 rounded-2xl p-5 animate-rise sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[.24em] text-slate-600">
                  Query details
                </p>
                <h2 className="mt-3 font-display text-xl text-slate-100">
                  {selected.query}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-xs text-slate-600 transition hover:text-slate-300"
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-4 border-t border-white/[.08] pt-5 sm:grid-cols-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Selected model
                </p>
                <p className="mt-2 text-xs text-slate-300">{selected.model}</p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Confidence
                </p>
                <p className="mt-2 text-xs text-sky-300">
                  {(selected.confidence * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Response time
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  {formatDuration(selected.timing.total_ms)}
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Status
                </p>
                <p className="mt-2 text-xs text-emerald-300">
                  {selected.escalated ? "Escalated" : "Direct"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function AnalyticsCard({ title, meta, children, className = "" }) {
  return (
    <section className={`glass analytics-card rounded-2xl p-5 sm:p-6 ${className}`}>
      <div className="section-heading mb-6">
        <h2 className="font-display text-sm text-slate-100">{title}</h2>
        {meta && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
            {meta}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Analytics({ activity }) {
  const sessionTotal = activity.length;
  const sessionEscalated = activity.filter((item) => item.escalated).length;
  const sessionAverageConfidence = sessionTotal
    ? activity.reduce((total, item) => total + item.confidence, 0) / sessionTotal
    : null;
  const sessionAverageDuration = sessionTotal
    ? activity.reduce((total, item) => total + item.timing.total_ms, 0) /
      sessionTotal
    : null;
  const benchmarkSamples = benchmarkRun.results.filter(
    (item) => item.status === "success",
  );
  const benchmarkConfidence = benchmarkSamples.filter(
    (item) => typeof item.confidence === "number",
  );
  const confidenceBands = [
    { label: "90–100%", min: 90, max: 101 },
    { label: "80–89%", min: 80, max: 90 },
    { label: "70–79%", min: 70, max: 80 },
    { label: "Below 70%", min: 0, max: 70 },
  ].map((band) => ({
    ...band,
    count: benchmarkConfidence.filter((item) => {
      const confidence = item.confidence * 100;
      return confidence >= band.min && confidence < band.max;
    }).length,
  }));
  const benchmarkModelCounts = [
    { label: SMALL_MODEL, count: benchmarkRun.summary["3b_count"] },
    { label: LARGE_MODEL, count: benchmarkRun.summary["7b_count"] },
  ];
  const responseSamples = benchmarkSamples.slice(-12).reverse();
  const maxResponseTime = Math.max(
    ...responseSamples.map((sample) => sample.response_time_seconds),
    1,
  );

  return (
    <main className="page-wrap">
      <div className="page-content max-w-6xl">
        <PageHeader eyebrow="MEASURED OUTPUT / SESSION + ARCHIVE" title="Analytics">
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
            Live figures are collected from completed requests in this browser
            session. Archived charts use the latest recorded benchmark run.
          </p>
        </PageHeader>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow-label">Current session</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {sessionTotal} completed request{sessionTotal === 1 ? "" : "s"} · resets when this page reloads
            </p>
          </div>
          <span className="role-chip">Live data</span>
        </div>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Requests", sessionTotal],
            [
              "3B selected",
              activity.filter((item) => item.model === SMALL_MODEL).length,
            ],
            [
              "7B selected",
              activity.filter((item) => item.model === LARGE_MODEL).length,
            ],
            [
              "Avg. confidence",
              sessionAverageConfidence === null
                ? "—"
                : `${(sessionAverageConfidence * 100).toFixed(0)}%`,
            ],
            ["Avg. response", formatDuration(sessionAverageDuration)],
            [
              "Escalation rate",
              sessionTotal
                ? `${((sessionEscalated / sessionTotal) * 100).toFixed(0)}%`
                : "—",
            ],
          ].map(([label, value]) => (
            <div key={label} className="glass metric-panel rounded-xl p-4">
              <p className="eyebrow-label">{label}</p>
              <p className="mt-3 font-display text-xl text-slate-100">{value}</p>
            </div>
          ))}
        </section>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow-label">Recorded benchmark snapshot</p>
            <h2 className="mt-2 font-display text-lg text-slate-100">
              {formatBenchmarkDate(benchmarkRun.timestamp)}
            </h2>
          </div>
          <p className="text-[11px] text-slate-500">
            {benchmarkRun.summary.successful_queries} successful · {benchmarkRun.summary.failed_queries} failed
          </p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <AnalyticsCard title="Model selection" meta={`${benchmarkRun.total_queries} benchmark queries`}>
            <div className="space-y-5">
              {benchmarkModelCounts.map((model) => {
                const percentage = benchmarkRun.total_queries
                  ? (model.count / benchmarkRun.total_queries) * 100
                  : 0;
                return (
                  <div key={model.label}>
                    <div className="mb-2 flex justify-between gap-3 text-xs">
                      <span className="text-slate-400">{model.label}</span>
                      <span className="font-mono text-slate-300">
                        {model.count} <span className="text-slate-600">/</span> {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="metric-track">
                      <div className="metric-fill" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </AnalyticsCard>

          <AnalyticsCard title="Confidence distribution" meta={`${benchmarkConfidence.length} measured responses`}>
            {benchmarkConfidence.length ? (
              <div className="space-y-4">
                {confidenceBands.map((band) => {
                  const percentage = (band.count / benchmarkConfidence.length) * 100;
                  return (
                    <div key={band.label} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 font-mono text-[9px] text-slate-500">
                        {band.label}
                      </span>
                      <div className="metric-track flex-1">
                        <div className="metric-fill" style={{ width: `${percentage}%` }} />
                      </div>
                      <span className="w-14 text-right font-mono text-[10px] text-slate-400">
                        {band.count} <span className="text-slate-600">/</span> {percentage.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-slate-500">
                Confidence values are not present in the recorded benchmark.
              </p>
            )}
          </AnalyticsCard>

          <AnalyticsCard
            title="Response time samples"
            meta={`${responseSamples.length} of ${benchmarkSamples.length} successful queries`}
            className="lg:col-span-2"
          >
            {responseSamples.length ? (
              <>
                <div className="benchmark-chart" role="img" aria-label="Recorded response times for benchmark queries">
                  {responseSamples.map((sample, index) => (
                    <div
                      key={`${sample.category}-${sample.id}-${index}`}
                      className="benchmark-bar"
                      style={{
                        height: `${Math.max(4, (sample.response_time_seconds / maxResponseTime) * 100)}%`,
                      }}
                      title={`${sample.category}: ${sample.response_time_seconds}s`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex justify-between font-mono text-[9px] text-slate-500">
                  <span>Recorded sample</span>
                  <span>Response time · seconds</span>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-xs text-slate-500">
                No successful response-time samples in the recorded benchmark.
              </p>
            )}
          </AnalyticsCard>
        </div>
      </div>
    </main>
  );
}

function SettingsCard({ title, children }) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-7">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d69a55] shadow-[0_0_10px_rgba(214,154,85,.5)]" />
        <h2 className="font-display text-base text-slate-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Settings() {
  return (
    <main className="page-wrap">
      <div className="page-content max-w-4xl">
        <PageHeader eyebrow="Workspace / local configuration" title="Settings">
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
            A read-only view of the runtime and routing configuration exposed by
            the current local API.
          </p>
        </PageHeader>
        <div className="grid gap-5 md:grid-cols-2">
          <SettingsCard title="Inference">
            <dl className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs text-slate-400">Runtime health</dt>
                <dd className="max-w-48 text-right text-xs leading-5 text-slate-300">
                  No standalone health endpoint
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs text-slate-400">Configured models</dt>
                <dd className="text-right font-mono text-xs text-slate-200">
                  qwen2.5:3b · qwen2.5:7b
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs text-slate-400">Timeout / token limits</dt>
                <dd className="max-w-48 text-right text-xs leading-5 text-slate-300">
                  Controlled by the backend
                </dd>
              </div>
            </dl>
          </SettingsCard>
          <SettingsCard title="Confidence routing">
            <dl className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs text-slate-400">Default threshold</dt>
                <dd className="font-mono text-xs text-[#e8cba7]">70%</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs text-slate-400">First pass</dt>
                <dd className="font-mono text-xs text-slate-200">qwen2.5:3b</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs text-slate-400">Escalation</dt>
                <dd className="font-mono text-xs text-slate-200">qwen2.5:7b</dd>
              </div>
            </dl>
            <p className="mt-5 border-t border-white/[.08] pt-4 text-xs leading-6 text-slate-400">
              Routing settings are managed by Flask. The current API does not
              expose frontend controls for changing them.
            </p>
          </SettingsCard>
          <SettingsCard title="Interface">
            <dl className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs text-slate-400">Theme</dt>
                <dd className="text-xs text-slate-200">Cascadia black &amp; amber</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs text-slate-400">Motion</dt>
                <dd className="max-w-48 text-right text-xs leading-5 text-slate-300">
                  Respects reduced-motion preference
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs text-slate-400">Request history</dt>
                <dd className="text-right text-xs text-slate-300">
                  Current browser session
                </dd>
              </div>
            </dl>
          </SettingsCard>
        </div>
      </div>
    </main>
  );
}

function About() {
  const topics = [
    [
      "Problem",
      "Large models are capable, but many requests do not need their full compute cost. Cascadia starts with a lighter path and treats escalation as a deliberate decision.",
    ],
    [
      "Solution",
      "A confidence-aware model cascading framework that routes queries between lightweight and larger AI models based on the confidence of the current response.",
    ],
    [
      "How It Works",
      "A request is handled by a small model first. Cascadia evaluates confidence, keeps a useful high-confidence answer on that path, or escalates when a larger model is warranted.",
    ],
    [
      "Research Direction",
      "Explore transparent routing policies, local inference workflows, confidence signals, and practical ways to make model selection easier to understand and tune.",
    ],
  ];
  return (
    <main className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-10 md:px-14 md:pt-16">
      <div className="hero-grid pointer-events-none absolute inset-0 h-[38rem] opacity-50" />
      <div className="orb pointer-events-none" />
      <div className="relative mx-auto max-w-5xl">
        <PageHeader
          eyebrow="Project / research direction"
          title={
            <>
              BUILT FOR EFFICIENT
              <br />
              <span className="bg-gradient-to-r from-slate-100 via-blue-300 to-violet-400 bg-clip-text text-transparent">
                AND INTELLIGENT AI.
              </span>
            </>
          }
        >
          <p className="mt-7 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Cascadia is a confidence-aware model cascading framework designed to
            route queries between lightweight and larger AI models based on
            confidence, helping reduce unnecessary computation while maintaining
            useful responses.
          </p>
        </PageHeader>
        <div className="grid gap-x-10 gap-y-12 border-t border-white/[.08] pt-10 md:grid-cols-[1fr_1.5fr]">
          {topics.map(([title, copy], index) => (
            <section
              key={title}
              className="animate-rise"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <p className="mb-4 font-mono text-[9px] uppercase tracking-[.24em] text-sky-300/70">
                0{index + 1} / {title}
              </p>
              <p className="max-w-xl text-sm leading-7 text-slate-400">
                {copy}
              </p>
            </section>
          ))}
        </div>
        <section className="mt-16 glass rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.24em] text-slate-600">
                Technology stack
              </p>
              <h2 className="mt-3 font-display text-2xl text-slate-100">
                Built to stay close to the work.
              </h2>
            </div>
            <div className="flex max-w-sm flex-wrap gap-2 sm:justify-end">
              {[
                "React",
                "Vite",
                "Tailwind CSS",
                "React Router",
                "Lucide React",
                "Local-first AI",
              ].map((technology) => (
                <span
                  key={technology}
                  className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-[10px] text-slate-400"
                >
                  {technology}
                </span>
              ))}
            </div>
          </div>
        </section>
        <div className="mt-10 flex flex-col gap-3 border-t border-white/[.08] pt-6 font-mono text-[9px] uppercase tracking-wider text-slate-600 sm:flex-row sm:justify-between">
          <span>Cascadia / confidence-aware model cascading</span>
          <span>Early project foundation</span>
        </div>
      </div>
    </main>
  );
}

function Placeholder() {
  const location = useLocation();
  const label =
    navigation.find((item) => item.path === location.pathname)?.label || "Page";
  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 md:min-h-screen">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-300/[.06] text-sky-300">
          <PanelLeftClose size={20} />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[.28em] text-slate-600">
          {label}
        </p>
        <h1 className="mt-4 font-display text-3xl text-slate-100">
          Coming soon
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          This part of Cascadia is still taking shape.
        </p>
      </div>
    </main>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const recordRequest = (request) => {
    setActivity((current) => [request, ...current].slice(0, 20));
  };
  const updateAmbientPosition = (event) => {
    if (event.pointerType !== "mouse") return;
    event.currentTarget.style.setProperty(
      "--pointer-x",
      `${event.clientX}px`,
    );
    event.currentTarget.style.setProperty(
      "--pointer-y",
      `${event.clientY}px`,
    );
  };

  return (
    <div className="app-shell" onPointerMove={updateAmbientPosition}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="md:pl-64">
        <Header onMenu={() => setMenuOpen(true)} />
        <Routes>
          <Route path="/" element={<Home activity={activity} />} />
          <Route
            path="/playground"
            element={<Playground onRequestComplete={recordRequest} />}
          />
          <Route path="/models" element={<Models activity={activity} />} />
          <Route path="/routing" element={<Routing />} />
          <Route path="/history" element={<History activity={activity} />} />
          <Route path="/analytics" element={<Analytics activity={activity} />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Placeholder />} />
        </Routes>
      </div>
      {menuOpen && (
        <button
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}
    </div>
  );
}

export default App;
