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
  Check,
  CircleUserRound,
  Clock3,
  Cpu,
  Gauge,
  Home as HomeIcon,
  Layers3,
  LoaderCircle,
  Menu,
  Network,
  PanelLeftClose,
  Search,
  SlidersHorizontal,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRef, useState } from "react";
import "./App.css";

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
  { label: "Playground", path: "/playground", icon: Sparkles },
  { label: "Models", path: "/models", icon: Layers3 },
  { label: "Routing", path: "/routing", icon: Network },
  { label: "History", path: "/history", icon: Clock3 },
  { label: "Analytics", path: "/analytics", icon: BarChart3 },
  { label: "Settings", path: "/settings", icon: SettingsIcon },
  { label: "About", path: "/about", icon: CircleUserRound },
  { label: "Home", path: "/", icon: HomeIcon },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-7 w-7">
        <span className="absolute left-0 top-3 h-3 w-3 rotate-45 border-l border-t border-sky-300" />
        <span className="absolute left-2 top-1 h-5 w-3 rotate-45 border-l border-t border-blue-400" />
        <span className="absolute left-4 top-3 h-3 w-3 rotate-45 border-l border-t border-violet-300" />
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
      className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/[.08] bg-[#06101c]/95 px-5 py-6 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
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
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
          Local runtime
        </div>
        <p className="font-mono text-[9px] leading-relaxed text-slate-600">
          Models stay close.
          <br />
          Requests stay yours.
        </p>
      </div>
    </aside>
  );
}

function Header({ onMenu }) {
  return (
    <header className="flex h-20 items-center justify-between border-b border-white/[.07] px-5 md:hidden">
      <button
        className="text-slate-300"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>
      <Logo />
      <div className="h-7 w-7 rounded-full border border-white/10 bg-white/[.04]" />
    </header>
  );
}

function Feature({ icon: Icon, title, children, accent }) {
  return (
    <div className="animate-rise border-t border-white/[.12] pt-5">
      <div
        className={`mb-4 flex h-9 w-9 items-center justify-center rounded-full border ${accent}`}
      >
        <Icon size={16} strokeWidth={1.5} />
      </div>
      <h3 className="font-display text-sm font-medium text-slate-100">
        {title}
      </h3>
      <p className="mt-2 max-w-[13rem] text-xs leading-relaxed text-slate-500">
        {children}
      </p>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  return (
    <main className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-10 md:px-14 md:pt-16">
      <div className="hero-grid pointer-events-none absolute inset-0 h-[38rem] opacity-70" />
      <div className="orb pointer-events-none" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-20 max-w-3xl animate-rise sm:mb-28">
          <div className="mb-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.28em] text-sky-300/70">
            <span className="h-px w-8 bg-sky-400/50" />
            Confidence-aware inference
          </div>
          <h1 className="max-w-3xl font-display text-[clamp(3.5rem,9vw,7.9rem)] font-medium leading-[.87] tracking-[-.06em] text-slate-50">
            INTELLIGENCE.
            <br />
            <span className="bg-gradient-to-r from-slate-100 via-blue-300 to-violet-400 bg-clip-text text-transparent">
              ROUTED SMARTER.
            </span>
          </h1>
          <p className="mt-8 max-w-md text-sm leading-7 text-slate-400 sm:text-base">
            Confidence-aware model cascading for faster, cost-efficient AI
            agents.
          </p>
          <button
            onClick={() => navigate("/playground")}
            className="group mt-9 inline-flex items-center gap-3 rounded-full border border-sky-300/40 bg-sky-300/[.08] px-5 py-3 text-xs font-medium text-sky-100 transition hover:border-sky-200/70 hover:bg-sky-300/[.15]"
          >
            Try Cascadia{" "}
            <ArrowUpRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </button>
        </div>
        <div className="grid gap-9 border-b border-white/[.08] pb-16 sm:grid-cols-3 sm:gap-5">
          <Feature
            icon={Gauge}
            title="Confidence-aware"
            accent="border-sky-300/30 text-sky-300"
          >
            Routes queries based on model confidence.
          </Feature>
          <Feature
            icon={Activity}
            title="Cost-efficient"
            accent="border-violet-300/30 text-violet-300"
          >
            Uses lightweight models whenever possible.
          </Feature>
          <Feature
            icon={Cpu}
            title="Local-first"
            accent="border-cyan-300/30 text-cyan-300"
          >
            Designed around local AI inference.
          </Feature>
        </div>
        <section className="mt-16 max-w-4xl animate-rise delay-2">
          <div className="mb-9 flex items-end justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.25em] text-slate-600">
                The cascade
              </p>
              <h2 className="mt-3 font-display text-2xl text-slate-100 sm:text-3xl">
                HOW CASCADIA THINKS
              </h2>
            </div>
            <span className="hidden font-mono text-[9px] uppercase tracking-widest text-slate-600 sm:block">
              01 / 04
            </span>
          </div>
          <div className="glass grid items-center gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1.2fr] sm:p-6">
            <FlowStep index="01" label="User Query" icon={CircleUserRound} />
            <ArrowUpRight
              className="hidden text-slate-600 sm:block"
              size={16}
            />
            <FlowStep index="02" label="Small Model" icon={Cpu} />
            <ArrowUpRight
              className="hidden text-slate-600 sm:block"
              size={16}
            />
            <FlowStep index="03" label="Confidence Check" icon={Gauge} />
            <ArrowUpRight
              className="hidden text-slate-600 sm:block"
              size={16}
            />
            <FlowStep index="04" label="Large Model" icon={Layers3} />
            <p className="col-span-full mt-2 border-t border-white/[.08] pt-4 font-mono text-[9px] text-slate-600">
              Escalates only when the answer needs more certainty.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function FlowStep({ index, label, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 sm:block">
      <div className="mb-0 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.035] text-sky-300 sm:mb-4">
        <Icon size={17} strokeWidth={1.5} />
      </div>
      <div>
        <span className="font-mono text-[9px] text-slate-600">{index}</span>
        <p className="mt-1 text-xs text-slate-300">{label}</p>
      </div>
    </div>
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

function Playground() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState("idle");
  const activeRequest = useRef(null);

  const submitQuery = async (event) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setErrorMessage("Type a question or choose one of the examples above.");
      setStatus("error");
      return;
    }

    setSubmittedQuery(trimmedQuery);
    setResult(null);
    setErrorMessage("");
    setStatus("loading");
    const controller = new AbortController();
    activeRequest.current = controller;
    let responseText = "";
    let completed = false;
    try {
      const response = await fetch("/api/query/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery }),
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
          setResult({
            response: responseText,
            ...eventData.data,
            timing: null,
          });
          setStatus("streaming");
        } else if (eventData.event === "token") {
          if (typeof eventData.data.token !== "string") {
            throw new Error("The response stream contained an invalid token.");
          }
          responseText += eventData.data.token;
          setResult((current) =>
            current ? { ...current, response: responseText } : current,
          );
        } else if (eventData.event === "complete") {
          setResult((current) =>
            current ? { ...current, timing: eventData.data.timing } : current,
          );
          completed = true;
          setStatus("success");
        } else if (eventData.event === "error") {
          throw new Error(
            eventData.data.error || "The response stream was interrupted.",
          );
        }
      }
      if (!completed && !controller.signal.aborted) {
        throw new Error("The response stream ended before generation completed.");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus("stopped");
      } else {
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

  const stopGeneration = () => {
    activeRequest.current?.abort();
    setStatus("stopped");
  };

  const selectExample = (example) => {
    setQuery(example);
    setErrorMessage("");
    setStatus("idle");
  };

  return (
    <main className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-10 md:px-14 md:pt-16">
      <div className="hero-grid pointer-events-none absolute inset-0 h-[38rem] opacity-50" />
      <div className="orb pointer-events-none" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-12 max-w-3xl animate-rise">
          <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.28em] text-sky-300/70">
            <span className="h-px w-8 bg-sky-400/50" />
            Local inference workspace
          </div>
          <h1 className="font-display text-4xl font-medium tracking-[-.045em] text-slate-50 sm:text-6xl">
            AI{" "}
            <span className="bg-gradient-to-r from-blue-300 to-violet-400 bg-clip-text text-transparent">
              PLAYGROUND
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400 sm:text-base">
            Ask anything. Your query is routed across local models.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
          <section className="min-w-0">
            <form
              onSubmit={submitQuery}
              className="glass rounded-2xl p-3 sm:p-4"
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
                rows={4}
                className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600"
              />
              <div className="flex items-center justify-between gap-3 border-t border-white/[.08] px-3 pt-3">
                <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Small model: qwen2.5:3b
                </span>
                {status === "loading" || status === "streaming" ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-300/30 bg-rose-300/[.08] px-4 py-2.5 text-xs font-medium text-rose-200 transition hover:border-rose-200/70 hover:bg-rose-300/[.14]"
                  >
                    <X size={14} />
                    Stop generation
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-300/35 bg-sky-300/[.1] px-4 py-2.5 text-xs font-medium text-sky-100 transition hover:border-sky-200/70 hover:bg-sky-300/[.16]"
                  >
                    <Send size={14} />
                    Send
                  </button>
                )}
              </div>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {exampleQueries.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => selectExample(example)}
                  disabled={status === "loading" || status === "streaming"}
                  className="rounded-full border border-white/[.1] bg-white/[.025] px-3 py-2 text-left text-[11px] text-slate-400 transition hover:border-sky-300/30 hover:text-slate-200"
                >
                  {example}
                </button>
              ))}
            </div>

            {status === "error" && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[.05] p-4 text-xs text-rose-200">
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
              <div className="mt-20 text-center sm:mt-24">
                <Sparkles size={20} className="mx-auto text-sky-300/50" />
                <p className="mt-4 font-display text-lg text-slate-300">
                  Your next answer starts here.
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Your question will be sent to the local model.
                </p>
              </div>
            )}
            {status === "loading" && (
              <div className="mt-16 text-center sm:mt-20">
                <LoaderCircle
                  size={22}
                  className="mx-auto animate-spin text-sky-300"
                />
                <p className="mt-4 font-display text-lg text-slate-300">
                  Routing your query locally...
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Your query is being processed locally.
                </p>
              </div>
            )}
            {status === "stopped" && !result && (
              <div className="mt-16 text-center sm:mt-20">
                <p className="font-display text-lg text-slate-300">
                  Generation stopped.
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  The local model request was cancelled.
                </p>
              </div>
            )}
            {(status === "streaming" ||
              status === "success" ||
              status === "stopped" ||
              (status === "error" && result?.response)) &&
              result && (
              <div className="mt-10 space-y-5 animate-rise">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[.24em] text-slate-600">
                      Inference details
                    </p>
                    <h2 className="mt-2 font-display text-xl text-slate-100">
                      {status === "streaming"
                        ? "Generating response..."
                        : status === "stopped"
                          ? "Generation stopped"
                          : status === "error"
                            ? "Response interrupted"
                            : "Response ready"}
                    </h2>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider ${
                      status === "success"
                        ? "border-emerald-300/20 bg-emerald-300/[.06] text-emerald-300"
                        : "border-sky-300/20 bg-sky-300/[.06] text-sky-200"
                    }`}
                  >
                    {status === "streaming"
                      ? "Generating"
                      : status === "stopped"
                        ? "Stopped"
                        : status === "error"
                          ? "Interrupted"
                          : "Complete"}
                  </span>
                </div>
                <div className="glass rounded-2xl p-5 sm:p-6">
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
                <div className="glass rounded-2xl p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <p className="font-mono text-[9px] uppercase tracking-[.2em] text-slate-600">
                      Response
                    </p>
                    <span className="max-w-[55%] truncate text-[10px] text-slate-600">
                      {submittedQuery}
                    </span>
                  </div>
                  <div className="markdown-content text-sm leading-7 text-slate-300">
                    {result.response ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {result.response}
                      </ReactMarkdown>
                    ) : status === "streaming" ? (
                      <p className="text-slate-500">
                        Generating the first tokens
                        <span className="ml-1 inline-flex gap-1 align-middle">
                          <span className="h-1 w-1 animate-bounce rounded-full bg-sky-300 [animation-delay:-.3s]" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-blue-300 [animation-delay:-.15s]" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-violet-300" />
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
                        aria-label="Generating"
                        className="ml-1 inline-block h-3 w-1 animate-pulse rounded-full bg-sky-300 align-middle"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
          <aside className="lg:pt-1">
            <PlaygroundFlow />
          </aside>
        </div>
      </div>
    </main>
  );
}

const demoModels = [
  {
    name: "Llama 3.2 3B",
    tier: "Small",
    size: "3B parameters",
    use: "Fast answers, classification, and everyday questions.",
    usage: "Low",
    accent: "text-cyan-300 border-cyan-300/25 bg-cyan-300/[.06]",
  },
  {
    name: "Phi-3 Mini",
    tier: "Small",
    size: "3.8B parameters",
    use: "Efficient reasoning and lightweight local tasks.",
    usage: "Low",
    accent: "text-sky-300 border-sky-300/25 bg-sky-300/[.06]",
  },
  {
    name: "Mistral 7B",
    tier: "Large",
    size: "7B parameters",
    use: "Complex reasoning and higher-accuracy responses.",
    usage: "Medium",
    accent: "text-violet-300 border-violet-300/25 bg-violet-300/[.06]",
  },
];

function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="mb-12 max-w-3xl animate-rise">
      <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.28em] text-sky-300/70">
        <span className="h-px w-8 bg-sky-400/50" />
        {eyebrow}
      </div>
      <h1 className="font-display text-4xl font-medium tracking-[-.045em] text-slate-50 sm:text-6xl">
        {title}
      </h1>
      {children}
    </div>
  );
}

function Models() {
  const [enabled, setEnabled] = useState(() => demoModels.map(() => true));

  const toggleModel = (index) => {
    setEnabled((current) =>
      current.map((isEnabled, itemIndex) =>
        itemIndex === index ? !isEnabled : isEnabled,
      ),
    );
  };

  return (
    <main className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-10 md:px-14 md:pt-16">
      <div className="hero-grid pointer-events-none absolute inset-0 h-[38rem] opacity-50" />
      <div className="orb pointer-events-none" />
      <div className="relative mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Model registry / demo configuration"
          title="AVAILABLE MODELS"
        >
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400 sm:text-base">
            Configure the local model options Cascadia can consider for each
            request.
          </p>
        </PageHeader>
        <div className="mb-7 flex items-center justify-between gap-4 border-b border-white/[.08] pb-4">
          <p className="font-mono text-[9px] uppercase tracking-[.2em] text-slate-600">
            Demo / configured models
          </p>
          <span className="rounded-full border border-amber-300/20 bg-amber-300/[.05] px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-amber-200/70">
            Not installed
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {demoModels.map((model, index) => (
            <article
              key={model.name}
              className={`glass rounded-2xl p-5 transition ${enabled[index] ? "" : "opacity-65"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border ${model.accent}`}
                >
                  <Cpu size={18} strokeWidth={1.5} />
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${enabled[index] ? "border-emerald-300/20 bg-emerald-300/[.05] text-emerald-300" : "border-slate-400/15 bg-white/[.03] text-slate-500"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${enabled[index] ? "bg-emerald-400" : "bg-slate-600"}`}
                  />
                  {enabled[index] ? "Ready" : "Offline"}
                </span>
              </div>
              <div className="mt-6 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg text-slate-100">
                    {model.name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">{model.size}</p>
                </div>
                <span className="rounded border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                  {model.tier} model
                </span>
              </div>
              <dl className="mt-7 space-y-4 border-t border-white/[.08] pt-5">
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                    Intended use
                  </dt>
                  <dd className="mt-1.5 text-xs leading-5 text-slate-400">
                    {model.use}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                    Resource usage
                  </dt>
                  <dd className="text-xs text-slate-300">{model.usage}</dd>
                </div>
              </dl>
              <button
                type="button"
                aria-pressed={enabled[index]}
                onClick={() => toggleModel(index)}
                className={`mt-7 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs transition ${enabled[index] ? "border-sky-300/25 bg-sky-300/[.07] text-sky-100 hover:bg-sky-300/[.13]" : "border-white/10 bg-white/[.025] text-slate-500 hover:text-slate-300"}`}
              >
                {enabled[index] && <Check size={14} />}
                {enabled[index] ? "Disable model" : "Enable model"}
              </button>
            </article>
          ))}
        </div>
        <p className="mt-6 font-mono text-[9px] leading-relaxed text-slate-600">
          These are demo configurations for the Cascadia interface. No model
          files have been installed or connected.
        </p>
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
  const [threshold, setThreshold] = useState(70);
  const [smallModel, setSmallModel] = useState("Llama 3.2 3B");
  const [largeModel, setLargeModel] = useState("Mistral 7B");
  const [automaticEscalation, setAutomaticEscalation] = useState(true);
  const [fallback, setFallback] = useState("Keep on small model");

  return (
    <main className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-10 md:px-14 md:pt-16">
      <div className="hero-grid pointer-events-none absolute inset-0 h-[38rem] opacity-50" />
      <div className="orb pointer-events-none" />
      <div className="relative mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Routing policy / local configuration"
          title="ROUTING CONFIGURATION"
        >
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400 sm:text-base">
            Tune how Cascadia decides when a request needs a larger model.
          </p>
        </PageHeader>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section className="space-y-5">
            <div className="glass rounded-2xl p-5 sm:p-7">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[.24em] text-slate-600">
                    Confidence threshold
                  </p>
                  <h2 className="mt-3 font-display text-3xl text-slate-100">
                    {threshold}%
                  </h2>
                </div>
                <SlidersHorizontal className="text-sky-300/60" size={20} />
              </div>
              <input
                aria-label="Confidence threshold"
                type="range"
                min="0"
                max="100"
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                className="mt-7 w-full accent-sky-300"
              />
              <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-600">
                <span>0%</span>
                <span>100%</span>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.04] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-emerald-300">
                    Confidence &gt;= {threshold}%
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    Keep request on Small Model
                  </p>
                </div>
                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-amber-200/80">
                    Confidence &lt; {threshold}%
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    Escalate to Large Model
                  </p>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-5 sm:p-7">
              <p className="mb-6 font-mono text-[9px] uppercase tracking-[.24em] text-slate-600">
                Model policy
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                    Small model
                  </span>
                  <select
                    value={smallModel}
                    onChange={(event) => setSmallModel(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#0a1725] px-3 py-2.5 text-xs text-slate-200 outline-none"
                  >
                    <option>Llama 3.2 3B</option>
                    <option>Phi-3 Mini</option>
                  </select>
                </label>
                <label className="block">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                    Large model
                  </span>
                  <select
                    value={largeModel}
                    onChange={(event) => setLargeModel(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#0a1725] px-3 py-2.5 text-xs text-slate-200 outline-none"
                  >
                    <option>Mistral 7B</option>
                    <option>Llama 3.2 3B</option>
                  </select>
                </label>
              </div>
              <div className="mt-6 border-t border-white/[.08] pt-5">
                <label className="flex cursor-pointer items-center justify-between gap-4">
                  <span>
                    <span className="block text-xs text-slate-300">
                      Automatic escalation
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-600">
                      Send low-confidence requests to the Large Model.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={automaticEscalation}
                    onChange={(event) =>
                      setAutomaticEscalation(event.target.checked)
                    }
                    className="h-4 w-4 accent-sky-300"
                  />
                </label>
                <label className="mt-6 block">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                    Fallback behavior
                  </span>
                  <select
                    value={fallback}
                    onChange={(event) => setFallback(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#0a1725] px-3 py-2.5 text-xs text-slate-200 outline-none"
                  >
                    <option>Keep on small model</option>
                    <option>Escalate to large model</option>
                    <option>Return a routing error</option>
                  </select>
                </label>
              </div>
            </div>
          </section>
          <aside>
            <RoutingDiagram />
          </aside>
        </div>
      </div>
    </main>
  );
}

const historyItems = [
  {
    id: 1,
    query: "Explain binary search in Java",
    model: "Llama 3.2 3B",
    confidence: 92,
    time: "0.9s",
    status: "Completed",
    at: "Today, 10:42 AM",
  },
  {
    id: 2,
    query: "What is photosynthesis?",
    model: "Llama 3.2 3B",
    confidence: 88,
    time: "0.7s",
    status: "Completed",
    at: "Today, 10:36 AM",
  },
  {
    id: 3,
    query: "Compare REST and GraphQL APIs",
    model: "Mistral 7B",
    confidence: 64,
    time: "2.4s",
    status: "Escalated",
    at: "Today, 10:18 AM",
  },
  {
    id: 4,
    query: "Convert 5 km to meters",
    model: "Phi-3 Mini",
    confidence: 98,
    time: "0.4s",
    status: "Completed",
    at: "Yesterday, 4:12 PM",
  },
  {
    id: 5,
    query: "Write a haiku about the Pacific Northwest",
    model: "Llama 3.2 3B",
    confidence: 84,
    time: "0.8s",
    status: "Completed",
    at: "Yesterday, 3:54 PM",
  },
];

function History() {
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("All models");
  const [confidenceFilter, setConfidenceFilter] = useState("All confidence");
  const [selected, setSelected] = useState(null);

  const filteredItems = historyItems.filter((item) => {
    const matchesSearch = item.query
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesModel =
      modelFilter === "All models" || item.model === modelFilter;
    const matchesConfidence =
      confidenceFilter === "All confidence" ||
      (confidenceFilter === "High"
        ? item.confidence >= 80
        : item.confidence < 80);
    return matchesSearch && matchesModel && matchesConfidence;
  });

  return (
    <main className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-10 md:px-14 md:pt-16">
      <div className="hero-grid pointer-events-none absolute inset-0 h-[38rem] opacity-50" />
      <div className="orb pointer-events-none" />
      <div className="relative mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Request log / local mock data"
          title="QUERY HISTORY"
        >
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400 sm:text-base">
            Review recent requests and how Cascadia routed each one.
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
              <option>Llama 3.2 3B</option>
              <option>Phi-3 Mini</option>
              <option>Mistral 7B</option>
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
                    onClick={() => setSelected(item)}
                    className={`cursor-pointer border-b border-white/[.06] text-xs transition hover:bg-white/[.035] ${selected?.id === item.id ? "bg-sky-300/[.05]" : ""}`}
                  >
                    <td className="max-w-[19rem] truncate px-3 py-4 pl-2 text-slate-200">
                      {item.query}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-slate-400">
                      {item.model}
                    </td>
                    <td className="px-3 py-4 text-sky-300">
                      {item.confidence}%
                    </td>
                    <td className="px-3 py-4 text-slate-400">{item.time}</td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full border px-2 py-1 font-mono text-[9px] ${item.status === "Escalated" ? "border-amber-300/20 text-amber-200/80" : "border-emerald-300/20 text-emerald-300"}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-slate-500">
                      {item.at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-600">
                No matching queries found.
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
                onClick={() => setSelected(null)}
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
                  {selected.confidence}%
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Response time
                </p>
                <p className="mt-2 text-xs text-slate-300">{selected.time}</p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Status
                </p>
                <p className="mt-2 text-xs text-emerald-300">
                  {selected.status}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

const usageBars = [
  { label: "Small Model", value: 78, color: "bg-sky-300" },
  { label: "Large Model", value: 22, color: "bg-violet-300" },
];
const confidenceBars = [
  { label: "90 - 100%", value: 42 },
  { label: "80 - 89%", value: 31 },
  { label: "70 - 79%", value: 18 },
  { label: "Below 70%", value: 9 },
];
const responseBars = [52, 68, 45, 72, 58, 82, 64, 48, 76, 60, 88, 70];

function AnalyticsCard({ title, children, className = "" }) {
  return (
    <section className={`glass rounded-2xl p-5 sm:p-6 ${className}`}>
      <div className="mb-7 flex items-center justify-between">
        <h2 className="font-display text-sm text-slate-100">{title}</h2>
        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
          Mock data
        </span>
      </div>
      {children}
    </section>
  );
}

function Analytics() {
  const metrics = [
    ["Total Queries", "1,248"],
    ["Small Model Usage", "78%"],
    ["Large Model Usage", "22%"],
    ["Average Confidence", "84%"],
    ["Average Response Time", "1.2s"],
    ["Escalation Rate", "22%"],
  ];
  return (
    <main className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-10 md:px-14 md:pt-16">
      <div className="hero-grid pointer-events-none absolute inset-0 h-[38rem] opacity-50" />
      <div className="orb pointer-events-none" />
      <div className="relative mx-auto max-w-6xl">
        <PageHeader
          eyebrow="System pulse / local mock data"
          title="PERFORMANCE"
        >
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400 sm:text-base">
            A quiet view of how Cascadia is routing requests across the model
            cascade.
          </p>
        </PageHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {metrics.map(([label, value]) => (
            <div key={label} className="glass rounded-xl p-4">
              <p className="font-mono text-[9px] uppercase leading-4 tracking-wider text-slate-600">
                {label}
              </p>
              <p className="mt-3 font-display text-xl text-slate-100">
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <AnalyticsCard title="Small vs Large Model Usage">
            <div className="space-y-6">
              {usageBars.map((bar) => (
                <div key={bar.label}>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-slate-400">{bar.label}</span>
                    <span className="text-slate-200">{bar.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[.07]">
                    <div
                      className={`h-2 rounded-full ${bar.color}`}
                      style={{ width: `${bar.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AnalyticsCard>
          <AnalyticsCard title="Confidence Distribution">
            <div className="space-y-3">
              {confidenceBars.map((bar) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 font-mono text-[9px] text-slate-600">
                    {bar.label}
                  </span>
                  <div className="h-6 flex-1 rounded bg-white/[.04]">
                    <div
                      className="h-6 rounded bg-gradient-to-r from-sky-300/70 to-sky-300/20"
                      style={{ width: `${bar.value * 2}%` }}
                    />
                  </div>
                  <span className="w-7 text-right text-[10px] text-slate-400">
                    {bar.value}%
                  </span>
                </div>
              ))}
            </div>
          </AnalyticsCard>
          <AnalyticsCard title="Response Time" className="lg:col-span-2">
            <div className="flex h-36 items-end gap-2 border-b border-l border-white/[.1] px-3 pb-0 pt-4">
              {responseBars.map((value, index) => (
                <div key={index} className="group relative flex-1">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-violet-300/60 to-sky-300/80 transition group-hover:from-violet-200 group-hover:to-sky-200"
                    style={{ height: `${value}%` }}
                  />
                  <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 font-mono text-[8px] text-slate-500 group-hover:block">
                    {(value / 55).toFixed(1)}s
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between font-mono text-[9px] text-slate-600">
              <span>Earlier</span>
              <span>Recent queries</span>
            </div>
          </AnalyticsCard>
        </div>
      </div>
    </main>
  );
}

function SettingsToggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5">
      <span>
        <span className="block text-xs text-slate-300">{label}</span>
        <span className="mt-1 block text-[11px] leading-5 text-slate-600">
          {description}
        </span>
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full border transition ${checked ? "border-sky-300/50 bg-sky-300/30" : "border-white/15 bg-white/[.04]"}`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition ${checked ? "left-[17px] bg-sky-100" : "left-0.5 bg-slate-500"}`}
        />
      </span>
    </label>
  );
}

function SettingsCard({ title, children }) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-7">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_10px_#7dd3fc]" />
        <h2 className="font-display text-base text-slate-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Settings() {
  const [timeout, setTimeoutValue] = useState(30);
  const [tokens, setTokens] = useState("1024");
  const [threshold, setThreshold] = useState(70);
  const [automaticEscalation, setAutomaticEscalation] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [theme, setTheme] = useState("Cascadia dark");
  const [fallback, setFallback] = useState("Keep on small model");

  return (
    <main className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-10 md:px-14 md:pt-16">
      <div className="hero-grid pointer-events-none absolute inset-0 h-[38rem] opacity-50" />
      <div className="orb pointer-events-none" />
      <div className="relative mx-auto max-w-4xl">
        <PageHeader eyebrow="Workspace / local preferences" title="SETTINGS">
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400 sm:text-base">
            Tune how this local Cascadia workspace behaves. Changes are saved
            for this session only.
          </p>
        </PageHeader>
        <div className="space-y-5">
          <SettingsCard title="Inference">
            <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-300/15 bg-emerald-300/[.04] p-4">
              <div>
                <p className="text-xs text-slate-300">Local inference status</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Ready for configured demo models
                </p>
              </div>
              <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Available
              </span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Response timeout
                </span>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    aria-label="Response timeout"
                    type="range"
                    min="5"
                    max="120"
                    value={timeout}
                    onChange={(event) =>
                      setTimeoutValue(Number(event.target.value))
                    }
                    className="flex-1 accent-sky-300"
                  />
                  <span className="w-12 text-right text-xs text-slate-300">
                    {timeout}s
                  </span>
                </div>
              </label>
              <label className="block">
                <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Maximum tokens
                </span>
                <select
                  value={tokens}
                  onChange={(event) => setTokens(event.target.value)}
                  className="mt-3 w-full rounded-lg border border-white/10 bg-[#0a1725] px-3 py-2.5 text-xs text-slate-300 outline-none"
                >
                  <option value="512">512 tokens</option>
                  <option value="1024">1,024 tokens</option>
                  <option value="2048">2,048 tokens</option>
                  <option value="4096">4,096 tokens</option>
                </select>
              </label>
            </div>
          </SettingsCard>
          <SettingsCard title="Routing">
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Confidence threshold
                </span>
                <span className="text-xs text-sky-300">{threshold}%</span>
              </div>
              <input
                aria-label="Settings confidence threshold"
                type="range"
                min="0"
                max="100"
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                className="mt-4 w-full accent-sky-300"
              />
              <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-600">
                <span>0%</span>
                <span>100%</span>
              </div>
            </label>
            <div className="mt-7 border-t border-white/[.08] pt-6">
              <SettingsToggle
                label="Automatic escalation"
                description="Move low-confidence requests to a larger model."
                checked={automaticEscalation}
                onChange={(event) =>
                  setAutomaticEscalation(event.target.checked)
                }
              />
            </div>
            <label className="mt-7 block">
              <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                Fallback behavior
              </span>
              <select
                value={fallback}
                onChange={(event) => setFallback(event.target.value)}
                className="mt-3 w-full rounded-lg border border-white/10 bg-[#0a1725] px-3 py-2.5 text-xs text-slate-300 outline-none"
              >
                <option>Keep on small model</option>
                <option>Escalate to large model</option>
                <option>Return a routing error</option>
              </select>
            </label>
          </SettingsCard>
          <SettingsCard title="Interface">
            <div className="space-y-6">
              <SettingsToggle
                label="Animations"
                description="Use subtle page entrance and interaction transitions."
                checked={animations}
                onChange={(event) => setAnimations(event.target.checked)}
              />
              <SettingsToggle
                label="Compact mode"
                description="Use tighter spacing across workspace surfaces."
                checked={compactMode}
                onChange={(event) => setCompactMode(event.target.checked)}
              />
              <label className="flex items-center justify-between gap-5">
                <span>
                  <span className="block text-xs text-slate-300">Theme</span>
                  <span className="mt-1 block text-[11px] text-slate-600">
                    Choose the workspace color treatment.
                  </span>
                </span>
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  className="rounded-lg border border-white/10 bg-[#0a1725] px-3 py-2.5 text-xs text-slate-300 outline-none"
                >
                  <option>Cascadia dark</option>
                  <option>Midnight blue</option>
                  <option>Low contrast</option>
                </select>
              </label>
            </div>
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
  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="md:pl-64">
        <Header onMenu={() => setMenuOpen(true)} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/models" element={<Models />} />
          <Route path="/routing" element={<Routing />} />
          <Route path="/history" element={<History />} />
          <Route path="/analytics" element={<Analytics />} />
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
