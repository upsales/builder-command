"use client";

import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { RefreshCw, ExternalLink, Loader2, GitPullRequest, CircleDot, User, Calendar, Tag, ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, AlertCircle, XCircle, CheckCircle, MessageSquare, Send, Hash, X, Clock, MapPin, Video, Users, Bot, ArrowUp, Sparkles, PanelLeftClose, PanelLeft, Settings, Zap, Plus, Trash2, Square, CheckSquare, Play, Pause, EyeOff, Search, Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function useLocalStorage<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  // Listen for external "force open" events (e.g. scroll-to-item expanding collapsed sections)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key === key) {
        const next = detail.value as T;
        localStorage.setItem(key, JSON.stringify(next));
        setValue(next);
      }
    };
    window.addEventListener("ls-force", handler);
    return () => window.removeEventListener("ls-force", handler);
  }, [key]);
  return [value, set];
}

// Common Slack emoji shortcodes → unicode
const EMOJI_MAP: Record<string, string> = {
  // Faces — smileys
  grinning: "\u{1F600}", grin: "\u{1F601}", smile: "\u{1F604}", smiley: "\u{1F603}",
  laughing: "\u{1F606}", satisfied: "\u{1F606}", sweat_smile: "\u{1F605}",
  rolling_on_the_floor_laughing: "\u{1F923}", rofl: "\u{1F923}",
  joy: "\u{1F602}", slightly_smiling_face: "\u{1F642}", upside_down_face: "\u{1F643}",
  wink: "\u{1F609}", blush: "\u{1F60A}", innocent: "\u{1F607}", relieved: "\u{1F60C}",
  heart_eyes: "\u{1F60D}", kissing_heart: "\u{1F618}", kissing: "\u{1F617}",
  yum: "\u{1F60B}", stuck_out_tongue: "\u{1F61B}", stuck_out_tongue_winking_eye: "\u{1F61C}",
  stuck_out_tongue_closed_eyes: "\u{1F61D}", money_mouth_face: "\u{1F911}",
  hugging_face: "\u{1F917}", hug: "\u{1F917}", thinking_face: "\u{1F914}", thinking: "\u{1F914}",
  zipper_mouth_face: "\u{1F910}", face_with_raised_eyebrow: "\u{1F928}",
  neutral_face: "\u{1F610}", expressionless: "\u{1F611}", no_mouth: "\u{1F636}",
  smirk: "\u{1F60F}", unamused: "\u{1F612}", roll_eyes: "\u{1F644}",
  grimacing: "\u{1F62C}", lying_face: "\u{1F925}",
  // Faces — negative
  pensive: "\u{1F614}", worried: "\u{1F61F}", confused: "\u{1F615}", confounded: "\u{1F616}",
  disappointed: "\u{1F61E}", cry: "\u{1F622}", sob: "\u{1F62D}", tired_face: "\u{1F62B}",
  weary: "\u{1F629}", angry: "\u{1F620}", rage: "\u{1F621}", face_with_symbols_on_mouth: "\u{1F92C}",
  scream: "\u{1F631}", flushed: "\u{1F633}", cold_sweat: "\u{1F630}",
  fearful: "\u{1F628}", anguished: "\u{1F627}", skull: "\u{1F480}",
  // Faces — accessories
  sunglasses: "\u{1F60E}", nerd_face: "\u{1F913}", partying_face: "\u{1F973}",
  cowboy_hat_face: "\u{1F920}", disguised_face: "\u{1F978}", clown_face: "\u{1F921}",
  shushing_face: "\u{1F92B}", face_with_monocle: "\u{1F9D0}",
  // Gestures
  thumbsup: "\u{1F44D}", "+1": "\u{1F44D}", thumbsdown: "\u{1F44E}", "-1": "\u{1F44E}",
  wave: "\u{1F44B}", clap: "\u{1F44F}", ok_hand: "\u{1F44C}", pinched_fingers: "\u{1F90C}",
  v: "\u{270C}\u{FE0F}", crossed_fingers: "\u{1F91E}", metal: "\u{1F918}",
  call_me_hand: "\u{1F919}", muscle: "\u{1F4AA}", raised_hands: "\u{1F64C}",
  handshake: "\u{1F91D}", pray: "\u{1F64F}", writing_hand: "\u{270D}\u{FE0F}",
  point_up: "\u{261D}\u{FE0F}", point_down: "\u{1F447}", point_left: "\u{1F448}",
  point_right: "\u{1F449}", middle_finger: "\u{1F595}",
  // Monkeys
  see_no_evil: "\u{1F648}", hear_no_evil: "\u{1F649}", speak_no_evil: "\u{1F64A}",
  // Hearts & love
  heart: "\u{2764}\u{FE0F}", orange_heart: "\u{1F9E1}", yellow_heart: "\u{1F49B}",
  green_heart: "\u{1F49A}", blue_heart: "\u{1F499}", purple_heart: "\u{1F49C}",
  black_heart: "\u{1F5A4}", white_heart: "\u{1F90D}", broken_heart: "\u{1F494}",
  sparkling_heart: "\u{1F496}", heartpulse: "\u{1F497}", two_hearts: "\u{1F495}",
  // Objects & symbols
  eyes: "\u{1F440}", fire: "\u{1F525}", rocket: "\u{1F680}", tada: "\u{1F389}",
  white_check_mark: "\u{2705}", x: "\u{274C}", warning: "\u{26A0}\u{FE0F}",
  star: "\u{2B50}", sparkles: "\u{2728}", zap: "\u{26A1}",
  100: "\u{1F4AF}", boom: "\u{1F4A5}", collision: "\u{1F4A5}",
  check: "\u{2714}\u{FE0F}", heavy_check_mark: "\u{2714}\u{FE0F}",
  arrow_up: "\u{2B06}\u{FE0F}", arrow_down: "\u{2B07}\u{FE0F}",
  arrow_right: "\u{27A1}\u{FE0F}", arrow_left: "\u{2B05}\u{FE0F}",
  memo: "\u{1F4DD}", bulb: "\u{1F4A1}", gear: "\u{2699}\u{FE0F}",
  link: "\u{1F517}", lock: "\u{1F512}", key: "\u{1F511}",
  bell: "\u{1F514}", mega: "\u{1F4E3}", loudspeaker: "\u{1F4E2}",
  no_entry: "\u{26D4}", rotating_light: "\u{1F6A8}", construction: "\u{1F6A7}",
  hourglass: "\u{231B}", stopwatch: "\u{23F1}\u{FE0F}", calendar: "\u{1F4C5}",
  package: "\u{1F4E6}", truck: "\u{1F69A}", ship: "\u{1F6A2}",
  computer: "\u{1F4BB}", keyboard: "\u{2328}\u{FE0F}", desktop_computer: "\u{1F5A5}\u{FE0F}",
  robot_face: "\u{1F916}", robot: "\u{1F916}", ghost: "\u{1F47B}", alien: "\u{1F47E}",
  // Nature
  dog: "\u{1F436}", cat: "\u{1F431}", tiger: "\u{1F42F}", bear: "\u{1F43B}",
  unicorn_face: "\u{1F984}", unicorn: "\u{1F984}", bee: "\u{1F41D}", bug: "\u{1F41B}",
  // Food & drink
  pizza: "\u{1F355}", beer: "\u{1F37A}", beers: "\u{1F37B}", wine_glass: "\u{1F377}",
  coffee: "\u{2615}", tea: "\u{1F375}", cake: "\u{1F370}", cookie: "\u{1F36A}",
  // Weather
  sunny: "\u{2600}\u{FE0F}", cloud: "\u{2601}\u{FE0F}", umbrella: "\u{2602}\u{FE0F}",
  snowflake: "\u{2744}\u{FE0F}", rainbow: "\u{1F308}",
  // Misc
  trophy: "\u{1F3C6}", medal: "\u{1F3C5}", crown: "\u{1F451}", gem: "\u{1F48E}",
  money_bag: "\u{1F4B0}", dollar: "\u{1F4B5}", chart_with_upwards_trend: "\u{1F4C8}",
  chart_with_downwards_trend: "\u{1F4C9}", clipboard: "\u{1F4CB}", pushpin: "\u{1F4CC}",
  paperclip: "\u{1F4CE}", scissors: "\u{2702}\u{FE0F}", wastebasket: "\u{1F5D1}\u{FE0F}",
  flag_white: "\u{1F3F3}\u{FE0F}", checkered_flag: "\u{1F3C1}",
  bangbang: "\u{203C}\u{FE0F}", interrobang: "\u{2049}\u{FE0F}",
  question: "\u{2753}", exclamation: "\u{2757}", grey_question: "\u{2754}",
};

function parseSlackEmojis(text: string): string {
  return text.replace(/:([a-z0-9_+-]+):/g, (_m, code) => EMOJI_MAP[code] ?? `:${code}:`);
}

// Expand collapsed sections and scroll to an item
function scrollToSourceItem(source: string, sourceId: string) {
  const elementId = `item-${source}-${sourceId}`;
  // Force-open the parent section(s) via custom event
  const sectionLabel = source === "linear" ? "Linear" : source === "github" ? "GitHub" : source === "slack" ? "Slack" : "Calendar";
  window.dispatchEvent(new CustomEvent("ls-force", { detail: { key: `__cg_${sectionLabel}`, value: true } }));

  const highlightEl = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-accent/50", "rounded-lg");
    setTimeout(() => el.classList.remove("ring-2", "ring-accent/50", "rounded-lg"), 2000);
  };

  // Small delay to let React re-render the expanded section
  setTimeout(() => {
    const el = document.getElementById(elementId);
    if (el) { highlightEl(el); return; }
    // Element not found — force-open all nested CollapsibleGroup sections
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("__cg_") && key !== `__cg_${sectionLabel}`) {
        try { if (!JSON.parse(localStorage.getItem(key)!)) window.dispatchEvent(new CustomEvent("ls-force", { detail: { key, value: true } })); } catch {}
      }
    }
    // Retry after nested groups expand
    setTimeout(() => {
      const el2 = document.getElementById(elementId);
      if (el2) highlightEl(el2);
    }, 150);
  }, 100);
}

// Fix inline bullets/bold patterns that should be on separate lines
function formatAgentText(text: string): string {
  return text
    .replace(/ • /g, "\n• ")           // inline bullets → newlines
    .replace(/ \* /g, "\n* ")           // inline asterisk bullets
    .replace(/([.!?:]) {1,2}\*\*/g, "$1\n\n**"); // bold headers after sentences → paragraph break
}

interface Profile {
  github_username: string | null;
  linear_email: string | null;
  slack_user_id: string | null;
  slack_connected?: boolean;
  google_connected?: boolean;
}

interface TodoItem {
  id: string;
  source: "linear" | "slack" | "github" | "calendar";
  source_id: string;
  title: string;
  url: string | null;
  raw_data: string | null;
}

interface GithubUser {
  username: string;
  name: string;
}

interface LinearUser {
  email: string;
  name: string;
}

const SOURCE_STYLE: Record<string, string> = {
  linear: "bg-violet-500/20 text-violet-400",
  slack: "bg-emerald-500/20 text-emerald-400",
  github: "bg-orange-500/20 text-orange-400",
  calendar: "bg-blue-500/20 text-blue-400",
};

// ─── Custom Actions Menu ──────────────────────────────────────
interface CustomAction {
  id: string;
  name: string;
  emoji: string;
  prompt: string;
  source: "linear" | "github" | "both";
  repo?: string; // optional repo filter (e.g. "owner/repo")
  createTask?: boolean; // if true, creates a todo + triggers agent instead of chat
}

const DEFAULT_ACTIONS: CustomAction[] = [
  { id: "1", name: "Summarize", emoji: "📋", prompt: "Summarize this ticket concisely: [{identifier}] {title}\n\n{description}", source: "both" },
  { id: "2", name: "Plan implementation", emoji: "🛠️", prompt: "Create an implementation plan for: [{identifier}] {title}\n\n{description}", source: "both" },
];

function CustomActionsMenu({ source, context, onAction, onAgentAction, onCreateTaskAction, size = 12 }: {
  source: "linear" | "github";
  context: Record<string, string>;
  onAction: (prompt: string) => void;
  onAgentAction?: (prompt: string) => void;
  onCreateTaskAction?: (taskText: string, agentPrompt: string) => void;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actions, setActions] = useLocalStorage<CustomAction[]>("ui:customActions", DEFAULT_ACTIONS);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("⚡");
  const [newPrompt, setNewPrompt] = useState("");
  const [newSource, setNewSource] = useState<"linear" | "github" | "both">("both");
  const [newRepo, setNewRepo] = useState("");
  const [newCreateTask, setNewCreateTask] = useState(false);

  const repo = context.repo ?? "";
  const applicable = actions.filter((a) => {
    if (a.source !== "both" && a.source !== source) return false;
    if (a.repo && a.repo !== repo) return false;
    return true;
  });

  const fillTemplate = (template: string) => {
    let result = template;
    for (const [key, val] of Object.entries(context)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), val ?? "");
    }
    return result;
  };

  if (applicable.length === 0 && !open) return null;

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-violet-400/50 hover:text-violet-400 transition-colors p-1"
        title="Custom Actions"
      >
        <Zap size={size} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
          {applicable.map((a) => (
            <div key={a.id} className="flex items-center">
              {a.createTask && onCreateTaskAction ? (
                <button
                  onClick={() => {
                    const taskText = `${a.emoji} ${a.name}: ${context.identifier || context.title}`;
                    onCreateTaskAction(taskText, fillTemplate(a.prompt));
                    setOpen(false);
                  }}
                  className="flex-1 text-left px-3 py-1.5 text-xs hover:bg-card-hover transition-colors flex items-center gap-2"
                  title="Creates a task and runs agent"
                >
                  <span>{a.emoji}</span> {a.name}
                  <Bot size={9} className="text-purple-400/40 ml-auto" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { onAction(fillTemplate(a.prompt)); setOpen(false); }}
                    className="flex-1 text-left px-3 py-1.5 text-xs hover:bg-card-hover transition-colors flex items-center gap-2"
                  >
                    <span>{a.emoji}</span> {a.name}
                  </button>
                  {onAgentAction && !editing && (
                    <button
                      onClick={() => { onAgentAction(fillTemplate(a.prompt)); setOpen(false); }}
                      className="text-purple-400/50 hover:text-purple-400 px-2 text-xs flex items-center gap-0.5"
                      title="Run with Agent"
                    >
                      <Bot size={10} />
                    </button>
                  )}
                </>
              )}
              {editing && (
                <button onClick={() => setActions(actions.filter((x) => x.id !== a.id))} className="text-red-400/50 hover:text-red-400 px-2 text-xs">×</button>
              )}
            </div>
          ))}
          <div className="border-t border-border/50 mt-1 pt-1">
            {!editing ? (
              <button onClick={() => setEditing(true)} className="w-full text-left px-3 py-1.5 text-[10px] text-muted/60 hover:text-muted hover:bg-card-hover transition-colors">
                + Edit actions...
              </button>
            ) : (
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex gap-1">
                  <input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} className="w-8 bg-background border border-border rounded px-1 py-0.5 text-xs text-center" placeholder="⚡" />
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-xs" placeholder="Action name" />
                </div>
                <textarea value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1 text-xs h-32 resize-none" placeholder="Prompt template... Use {title}, {identifier}, {description}, {repo}" />
                <div className="flex gap-1">
                  <select value={newSource} onChange={(e) => setNewSource(e.target.value as "linear" | "github" | "both")} className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-xs">
                    <option value="both">Both</option>
                    <option value="linear">Linear</option>
                    <option value="github">GitHub</option>
                  </select>
                  <input value={newRepo} onChange={(e) => setNewRepo(e.target.value)} className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-xs" placeholder="Repo (optional)" />
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-muted cursor-pointer">
                  <input type="checkbox" checked={newCreateTask} onChange={(e) => setNewCreateTask(e.target.checked)} className="rounded" />
                  Create task + run agent
                </label>
                <div className="flex gap-1">
                  <button onClick={() => {
                    if (!newName.trim() || !newPrompt.trim()) return;
                    setActions([...actions, { id: String(Date.now()), name: newName, emoji: newEmoji || "⚡", prompt: newPrompt, source: newSource, repo: newRepo.trim() || undefined, createTask: newCreateTask || undefined }]);
                    setNewName(""); setNewEmoji("⚡"); setNewPrompt(""); setNewSource("both"); setNewRepo(""); setNewCreateTask(false);
                  }} className="flex-1 px-2 py-1 rounded bg-accent text-white text-xs hover:bg-accent-hover transition-colors">Add</button>
                  <button onClick={() => setEditing(false)} className="px-2 py-1 rounded border border-border text-xs text-muted hover:bg-card-hover transition-colors">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Snooze Button ───────────────────────────────────────────
function SnoozeButton({ source, sourceId, onDone, size = 12 }: { source: string; sourceId: string; onDone?: () => void; size?: number }) {
  const [open, setOpen] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  const handleSnooze = async (duration: string) => {
    setSnoozing(true);
    try {
      await fetch("/api/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, source_id: sourceId, duration }),
      });
      setOpen(false);
      onDone?.();
    } finally {
      setSnoozing(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-muted hover:text-yellow-400 transition-colors p-1"
        title="Snooze"
      >
        <Clock size={size} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
          {[
            ["1h", "1 hour"],
            ["2h", "2 hours"],
            ["4h", "4 hours"],
            ["tomorrow", "Tomorrow 9am"],
            ["next_week", "Next Monday 9am"],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => handleSnooze(val)}
              disabled={snoozing}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-card-hover transition-colors disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Prediction Badge ────────────────────────────────────────
function PredictionBadge({ prediction }: { prediction?: { predicted_action: string; confidence: number; reason: string } }) {
  if (!prediction || prediction.confidence < 0.5) return null;
  const colors = {
    dismiss: "bg-red-500/10 text-red-400 border-red-500/20",
    snooze: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    focus: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    act: "bg-green-500/10 text-green-400 border-green-500/20",
  };
  const labels = { dismiss: "Skip", snooze: "Snooze", focus: "Focus", act: "Act" };
  const color = colors[prediction.predicted_action as keyof typeof colors] ?? "bg-muted/10 text-muted border-border";
  const label = labels[prediction.predicted_action as keyof typeof labels] ?? prediction.predicted_action;
  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] border ${color}`} title={prediction.reason}>
      <Sparkles size={8} />
      <span>{label}</span>
      <span className="opacity-50">{Math.round(prediction.confidence * 100)}%</span>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface CodeContext {
  repo: string;
  prNumber: number;
  diff: string;
  files: { path: string; content: string }[];
  baseBranch: string;
  headBranch: string;
}

export interface ChatPanelHandle {
  injectPrompt: (text: string, context?: CodeContext, displayText?: string) => void;
  openAgentSession: (sessionId: string) => void;
}

const ChatPanel = forwardRef<ChatPanelHandle>(function ChatPanel(_props, ref) {
  const [chatTab, setChatTab] = useState<"chat" | "agent">("chat");
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [agentSessionData, setAgentSessionData] = useState<{ id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; messages?: string; tool_calls?: string; started_at?: string; completed_at?: string; todoText?: string; todo_source?: string; todo_source_id?: string; source_url?: string; source_identifier?: string; agent_prompt?: string } | null>(null);
  const [agentSessions, setAgentSessions] = useState<{ id: string; todo_id: string; status: string; summary?: string; todo_text?: string; started_at?: string; completed_at?: string }[]>([]);
  const [loadingAgentSession, setLoadingAgentSession] = useState(false);

  // Poll for agent sessions list
  useEffect(() => {
    if (chatTab !== "agent") return;
    const load = () => fetch("/api/agent/sessions").then(r => r.json()).then(setAgentSessions).catch(() => {});
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [chatTab]);

  const loadAgentSession = useCallback(async (sessionId: string) => {
    setLoadingAgentSession(true);
    setAgentSessionId(sessionId);
    try {
      const res = await fetch(`/api/agent/sessions?session_id=${sessionId}`);
      const data = await res.json();
      if (data) {
        setAgentSessionData({ ...data, todoText: data.todo_text ?? data.todoText });
      }
    } finally {
      setLoadingAgentSession(false);
    }
  }, []);

  // Poll active session for real-time updates
  useEffect(() => {
    if (!agentSessionId || agentSessionData?.status !== "running") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/agent/sessions?session_id=${agentSessionId}`);
        const data = await res.json();
        if (data) {
          setAgentSessionData(prev => ({ ...data, todoText: prev?.todoText }));
          // Stop polling if done
          if (data.status !== "running") clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [agentSessionId, agentSessionData?.status]);

  // Auto-open a running session when switching to agent tab (but not if user just pressed back)
  const dismissedAgentSession = useRef(false);
  useEffect(() => {
    if (chatTab !== "agent" || agentSessionId) return;
    if (dismissedAgentSession.current) return;
    const running = agentSessions.find(s => s.status === "running");
    if (running) loadAgentSession(running.id);
  }, [chatTab, agentSessions, agentSessionId, loadAgentSession]);
  // Reset dismiss flag when switching tabs
  useEffect(() => {
    dismissedAgentSession.current = false;
  }, [chatTab]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatSessionList, setChatSessionList] = useState<{ id: string; title: string; updated_at: string }[]>([]);
  const [showChatSessions, setShowChatSessions] = useState(false);

  // Load chat sessions list
  useEffect(() => {
    if (chatTab !== "chat") return;
    fetch("/api/chat/sessions").then(r => r.json()).then(setChatSessionList).catch(() => {});
  }, [chatTab, messages.length]);

  // Auto-save chat session after each assistant message
  useEffect(() => {
    if (messages.length < 2 || streaming) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return;
    const title = messages.find(m => m.role === "user")?.content?.slice(0, 60) ?? "Chat";
    fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: chatSessionId, title, messages }),
    }).then(r => r.json()).then(data => {
      if (data.id && !chatSessionId) setChatSessionId(data.id);
    }).catch(() => {});
  }, [messages, streaming, chatSessionId]);

  const loadChatSession = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/chat/sessions?id=${sessionId}`);
    const data = await res.json();
    if (data?.messages) {
      setMessages(typeof data.messages === "string" ? JSON.parse(data.messages) : data.messages);
      setChatSessionId(sessionId);
      setShowChatSessions(false);
    }
  }, []);

  const newChatSession = useCallback(() => {
    setMessages([]);
    setChatSessionId(null);
    setShowChatSessions(false);
    codeSessionIdRef.current = null;
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingTextRef = useRef("");
  const [streamingText, setStreamingText] = useState("");
  const [codeContext, setCodeContext] = useState<CodeContext | null>(null);
  const injectedContextRef = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);

  const checkIfNearBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const scrollToBottom = () => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(scrollToBottom, [messages, streamingText]);

  const codeSessionIdRef = useRef<string | null>(null);

  const sendText = useCallback(async (text: string, currentMessages: ChatMessage[], ctx?: CodeContext | null, displayText?: string) => {
    // displayText is what the user sees in the chat; text is what's sent to the API
    const uiMessages: ChatMessage[] = [...currentMessages, { role: "user", content: displayText ?? text, timestamp: Date.now() }];
    setMessages(uiMessages);
    setStreaming(true);
    streamingTextRef.current = "";
    setStreamingText("");
    // User just sent a message — always scroll to bottom
    isNearBottomRef.current = true;

    // For the API, always send the full text (not the shortened display text)
    const apiMessages: ChatMessage[] = [...currentMessages, { role: "user", content: text, timestamp: Date.now() }];

    const activeContext = ctx ?? codeContext;

    // Use Agent SDK endpoint for code-related chat
    const useCodeChat = !!activeContext?.repo;

    try {
      const res = useCodeChat
        ? await fetch("/api/chat/code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: text,
              repo: activeContext!.repo,
              prNumber: activeContext!.prNumber,
              sessionId: codeSessionIdRef.current,
            }),
          })
        : await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: apiMessages, codeContext: activeContext }),
          });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                streamingTextRef.current += data.text;
                setStreamingText(streamingTextRef.current);
              } else if (data.sessionId) {
                // Capture Agent SDK session ID for resumption
                codeSessionIdRef.current = data.sessionId;
              } else if (data.tool) {
                // Tool use event — show inline status
                const label = data.label ?? (data.status === "running" ? `Running ${data.tool}...` : data.result);
                if (data.status === "running") {
                  streamingTextRef.current += `\n> *${label}*\n`;
                  setStreamingText(streamingTextRef.current);
                } else if (data.status === "done") {
                  // Show tool name with check, collapse full result
                  streamingTextRef.current += `> ✓ ${data.tool}\n\n`;
                  setStreamingText(streamingTextRef.current);
                } else {
                  // Agent SDK tool events (no status field)
                  streamingTextRef.current += `\n> *${label}*\n`;
                  setStreamingText(streamingTextRef.current);
                }
              } else if (data.error) {
                streamingTextRef.current += `\n**Error:** ${data.error}\n`;
                setStreamingText(streamingTextRef.current);
              }
            } catch { /* skip */ }
          }
        }
      }
      setMessages([...uiMessages, { role: "assistant", content: streamingTextRef.current, timestamp: Date.now() }]);
    } finally {
      setStreaming(false);
      streamingTextRef.current = "";
      setStreamingText("");
    }
  }, [codeContext]);


  useImperativeHandle(ref, () => ({
    injectPrompt: (text: string, context?: CodeContext, displayText?: string) => {
      if (streaming) return;
      setChatTab("chat");
      if (context) {
        setCodeContext(context);
      }
      const userMsg: ChatMessage = { role: "user", content: displayText ?? text, timestamp: Date.now() };
      const asstMsg: ChatMessage = { role: "assistant", content: "Got it. What would you like to know?", timestamp: Date.now() };
      injectedContextRef.current = text;
      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    openAgentSession: (sessionId: string) => {
      setChatTab("agent");
      loadAgentSession(sessionId);
    },
  }), [streaming, loadAgentSession]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    // If there's injected context from a "chat about" action, prepend it to the API message
    const ctx = injectedContextRef.current;
    if (ctx) {
      injectedContextRef.current = null;
      sendText(`Context:\n${ctx}\n\nUser request: ${text}`, messages, undefined, text);
    } else {
      sendText(text, messages);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header with tabs */}
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-3">
        <div className="flex items-center gap-0.5 border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setChatTab("chat")}
            className={`px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
              chatTab === "chat" ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            <Sparkles size={10} /> Chat
          </button>
          <button
            onClick={() => setChatTab("agent")}
            className={`px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
              chatTab === "agent" ? "bg-purple-500/20 text-purple-400" : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            <Bot size={10} /> Agent
          </button>
        </div>
        {chatTab === "chat" && (
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            {messages.length > 0 && (
              <button onClick={newChatSession} className="text-[10px] text-muted hover:text-foreground transition-colors flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-card-hover">
                <Plus size={9} /> New
              </button>
            )}
            <button onClick={() => { const next = !showChatSessions; setShowChatSessions(next); if (next) fetch("/api/chat/sessions").then(r => r.json()).then(setChatSessionList).catch(() => {}); }} className={`text-[10px] transition-colors flex items-center gap-0.5 px-1.5 py-0.5 rounded ${showChatSessions ? "text-accent bg-accent/10" : "text-muted hover:text-foreground hover:bg-card-hover"}`}>
              <Clock size={9} /> History
            </button>
          </div>
        )}
      </div>

      {/* Chat tab */}
      {chatTab === "chat" && (<>
        <div ref={messagesContainerRef} onScroll={checkIfNearBottom} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 relative">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/20 to-violet-500/20 flex items-center justify-center">
                <Bot size={24} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium">Work assistant</p>
                <p className="text-xs text-muted mt-1 max-w-[240px]">I can see all your items. Ask me to prioritize, summarize, draft replies, or help you plan your day.</p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                {["What should I focus on?", "Summarize my PRs", "Any urgent slack?", "Plan my day"].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg bg-card border border-border hover:bg-card-hover hover:border-accent/30 transition-all text-muted hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              {/* Recent sessions */}
              {chatSessionList.length > 0 && (
                <div className="mt-4 w-full max-w-[300px]">
                  <p className="text-[10px] text-muted/50 uppercase tracking-wider mb-1.5">Recent chats</p>
                  <div className="space-y-1">
                    {chatSessionList.slice(0, 5).map(s => (
                      <button key={s.id} onClick={() => loadChatSession(s.id)} className="w-full text-left px-2.5 py-1.5 rounded-lg bg-card border border-border hover:bg-card-hover hover:border-accent/30 transition-all text-xs truncate flex items-center gap-2">
                        <MessageSquare size={10} className="text-muted/40 shrink-0" />
                        <span className="truncate">{s.title}</span>
                        <span className="text-[9px] text-muted/30 shrink-0">{new Date(s.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
          {/* Session history overlay */}
          {showChatSessions && (
            <div className="absolute inset-0 bg-background/95 z-10 overflow-y-auto px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium">Chat History</p>
                <button onClick={() => setShowChatSessions(false)} className="text-muted hover:text-foreground transition-colors"><X size={14} /></button>
              </div>
              <div className="space-y-1">
                {chatSessionList.map(s => (
                  <button key={s.id} onClick={() => loadChatSession(s.id)} className="w-full text-left px-3 py-2 rounded-lg bg-card border border-border hover:bg-card-hover hover:border-accent/30 transition-all text-xs flex items-center gap-2">
                    <MessageSquare size={11} className="text-muted/40 shrink-0" />
                    <span className="truncate flex-1">{s.title}</span>
                    <span className="text-[9px] text-muted/30 shrink-0">{new Date(s.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </button>
                ))}
                {chatSessionList.length === 0 && <p className="text-xs text-muted/50 text-center py-4">No saved chats yet</p>}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent text-white rounded-br-md whitespace-pre-wrap"
                  : "bg-card border border-border rounded-bl-md chat-markdown"
              }`}>
                {msg.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown> : msg.content}
              </div>
              {msg.timestamp && (
                <span className="text-[9px] text-muted/40 mt-0.5 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
              )}
            </div>
          ))}
          {streaming && streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed bg-card border border-border rounded-bl-md chat-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                <span className="inline-block w-1.5 h-4 bg-accent/60 ml-0.5 animate-pulse rounded-sm" />
              </div>
            </div>
          )}
          {streaming && !streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm bg-card border border-border rounded-bl-md">
                <span className="inline-block w-1.5 h-4 bg-accent/60 animate-pulse rounded-sm" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-3 border-t border-border">
          {codeContext && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <GitPullRequest size={9} />
                {codeContext.repo}{codeContext.prNumber ? `#${codeContext.prNumber}` : ""} — Agent SDK
              </span>
              <span className="text-[9px] text-muted/40">Claude can explore the full repo</span>
              <button onClick={() => { setCodeContext(null); codeSessionIdRef.current = null; }} className="text-muted/40 hover:text-muted text-[10px]">
                <X size={10} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 bg-card border border-border rounded-xl px-3 py-2 focus-within:border-accent/50 transition-colors">
            <textarea
              ref={inputRef}
              id="chat-input"
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your work..."
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted/50 max-h-[120px]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-colors disabled:opacity-30 shrink-0"
            >
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </>)}

      {/* Agent tab */}
      {chatTab === "agent" && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Session detail view */}
          {agentSessionId && agentSessionData ? (
            <div className="flex flex-col h-full">
              {/* Session header */}
              <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-2">
                <button onClick={() => { dismissedAgentSession.current = true; setAgentSessionId(null); setAgentSessionData(null); }} className="text-muted hover:text-foreground transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => {
                      const el = document.getElementById(`todo-${agentSessionData.todo_id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.classList.add("ring-2", "ring-accent/50", "rounded");
                        setTimeout(() => el.classList.remove("ring-2", "ring-accent/50", "rounded"), 2000);
                      }
                    }}
                    className="text-xs font-medium truncate hover:text-accent transition-colors text-left w-full"
                    title="Scroll to task"
                  >
                    {agentSessionData.todoText ?? "Task"}
                  </button>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {agentSessionData.status === "running" && <span className="text-[9px] text-purple-400 flex items-center gap-0.5"><Loader2 size={8} className="animate-spin" /> Running</span>}
                    {agentSessionData.status === "completed" && <span className="text-[9px] text-green-400 flex items-center gap-0.5"><CheckCircle size={8} /> Done</span>}
                    {agentSessionData.status === "failed" && <span className="text-[9px] text-red-400 flex items-center gap-0.5"><XCircle size={8} /> Failed</span>}
                    {agentSessionData.status === "incomplete" && <span className="text-[9px] text-amber-400 flex items-center gap-0.5"><AlertCircle size={8} /> Incomplete</span>}
                    {agentSessionData.started_at && <span className="text-[9px] text-muted/40">{new Date(agentSessionData.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>}
                    {agentSessionData.todo_source === "linear" && agentSessionData.todo_source_id && (
                      <button
                        onClick={() => scrollToSourceItem("linear", agentSessionData.todo_source_id!)}
                        className="text-[9px] text-accent/60 hover:text-accent flex items-center gap-0.5 transition-colors"
                        title="Scroll to Linear issue"
                      >
                        <CircleDot size={8} /> {agentSessionData.source_identifier ?? agentSessionData.todo_source_id}
                      </button>
                    )}
                    {agentSessionData.todo_source === "github" && agentSessionData.todo_source_id && (
                      <button
                        onClick={() => scrollToSourceItem("github", agentSessionData.todo_source_id!)}
                        className="text-[9px] text-accent/60 hover:text-accent flex items-center gap-0.5 transition-colors"
                        title="Scroll to GitHub PR"
                      >
                        <GitPullRequest size={8} /> {agentSessionData.source_identifier ?? "PR"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* Chat-style conversation */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {(() => {
                  // Parse messages into chat bubbles with inline tool calls
                  const chatBubbles: { role: "user" | "agent"; text: string; toolNames?: string[]; timestamp?: string }[] = [];
                  const allToolCalls: { tool: string; timestamp?: string }[] = agentSessionData.tool_calls ? JSON.parse(agentSessionData.tool_calls) : [];
                  let toolCallIndex = 0;
                  if (agentSessionData.messages) {
                    try {
                      const msgs = JSON.parse(agentSessionData.messages);
                      for (const msg of msgs) {
                        if (msg.role === "user") {
                          if (typeof msg.content === "string") {
                            chatBubbles.push({ role: "user", text: msg.content });
                          } else if (Array.isArray(msg.content)) {
                            const hasToolResults = msg.content.some((b: { type: string }) => b.type === "tool_result");
                            if (!hasToolResults) {
                              for (const block of msg.content) {
                                if (block.type === "text") chatBubbles.push({ role: "user", text: block.text });
                              }
                            }
                          }
                        } else if (msg.role === "assistant") {
                          const texts: string[] = [];
                          let toolCount = 0;
                          if (Array.isArray(msg.content)) {
                            for (const block of msg.content) {
                              if (block.type === "text" && block.text?.trim()) texts.push(block.text);
                              if (block.type === "tool_use") toolCount++;
                            }
                          } else if (typeof msg.content === "string" && msg.content.trim()) {
                            texts.push(msg.content);
                          }
                          const msgToolCalls = allToolCalls.slice(toolCallIndex, toolCallIndex + toolCount);
                          toolCallIndex += toolCount;
                          const toolNames = msgToolCalls.map(tc => tc.tool);
                          const timestamp = msgToolCalls[0]?.timestamp;
                          if (texts.length > 0) {
                            chatBubbles.push({ role: "agent", text: texts.join("\n\n"), toolNames: toolNames.length > 0 ? toolNames : undefined, timestamp });
                          } else if (toolNames.length > 0) {
                            // Tool-only turn — attach to previous agent bubble if possible
                            const prev = chatBubbles[chatBubbles.length - 1];
                            if (prev && prev.role === "agent") {
                              prev.toolNames = [...(prev.toolNames ?? []), ...toolNames];
                            } else {
                              chatBubbles.push({ role: "agent", text: "", toolNames, timestamp });
                            }
                          }
                        }
                      }
                    } catch { /* ignore */ }
                  }
                  if (chatBubbles.length === 0 && (agentSessionData.summary || agentSessionData.failure_reason)) {
                    chatBubbles.push({ role: "user", text: agentSessionData.todoText ?? "Task" });
                    if (agentSessionData.summary) chatBubbles.push({ role: "agent", text: agentSessionData.summary, timestamp: agentSessionData.completed_at });
                    if (agentSessionData.failure_reason) chatBubbles.push({ role: "agent", text: agentSessionData.failure_reason, timestamp: agentSessionData.completed_at });
                  }
                  // Assign timestamps: use started_at for first bubble, completed_at for last
                  if (chatBubbles.length > 0 && !chatBubbles[0].timestamp && agentSessionData.started_at) {
                    chatBubbles[0].timestamp = agentSessionData.started_at;
                  }
                  if (chatBubbles.length > 1 && !chatBubbles[chatBubbles.length - 1].timestamp && agentSessionData.completed_at) {
                    chatBubbles[chatBubbles.length - 1].timestamp = agentSessionData.completed_at;
                  }

                  // Group tool names by count (not consecutive — total)
                  const groupTools = (names: string[]) => {
                    const map = new Map<string, number>();
                    for (const n of names) map.set(n, (map.get(n) ?? 0) + 1);
                    return Array.from(map, ([name, count]) => ({ name, count }));
                  };

                  // Inject custom prompt after the initial task message (not follow-ups)
                  if (agentSessionData.agent_prompt && chatBubbles.length > 0) {
                    const firstUserIdx = chatBubbles.findIndex(b => b.role === "user");
                    if (firstUserIdx >= 0 && chatBubbles[firstUserIdx].text.startsWith("Work on this task:")) {
                      chatBubbles.splice(firstUserIdx + 1, 0, { role: "user", text: `**Custom instructions:** ${agentSessionData.agent_prompt}` });
                    }
                  }

                  let lastDay = "";
                  return (
                    <>
                      {chatBubbles.map((bubble, i) => {
                        // Day divider
                        let dayDivider: React.ReactNode = null;
                        if (bubble.timestamp) {
                          const day = new Date(bubble.timestamp).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                          if (day !== lastDay) {
                            lastDay = day;
                            dayDivider = (
                              <div className="flex items-center gap-2 py-2">
                                <div className="flex-1 border-t border-border/30" />
                                <span className="text-[9px] text-foreground/50 font-medium">{day}</span>
                                <div className="flex-1 border-t border-border/30" />
                              </div>
                            );
                          }
                        }
                        const ts = bubble.timestamp ? new Date(bubble.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : null;
                        return (
                          <React.Fragment key={i}>
                            {dayDivider}
                            <div className={`flex ${bubble.role === "user" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[85%]`}>
                                {(bubble.text || bubble.role === "user" || (bubble.toolNames && bubble.toolNames.length > 0)) && (
                                  <div className={`rounded-2xl px-3.5 py-2.5 ${
                                    bubble.role === "user"
                                      ? "bg-accent/15 text-foreground/90 rounded-br-md"
                                      : "bg-card border border-border rounded-bl-md"
                                  }`}>
                                    {bubble.text && (
                                      <div className="text-xs leading-relaxed chat-markdown">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{bubble.role === "agent" ? formatAgentText(bubble.text) : bubble.text}</ReactMarkdown>
                                      </div>
                                    )}
                                    {bubble.toolNames && bubble.toolNames.length > 0 && (
                                      <div className={`flex flex-wrap gap-1 ${bubble.text ? "mt-1.5 pt-1.5 border-t border-border/30" : ""}`}>
                                        {groupTools(bubble.toolNames).map((g, j) => (
                                          <span key={j} className="inline-flex items-center gap-0.5 text-[9px] text-purple-400/60 bg-purple-500/5 border border-purple-500/10 rounded px-1.5 py-0.5">
                                            <Wrench size={7} className="shrink-0" />{g.name}{g.count > 1 && <span className="text-purple-400/40 ml-0.5">{g.count}x</span>}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {ts && <p className={`text-[9px] text-foreground/40 mt-0.5 ${bubble.role === "user" ? "text-right" : "text-left"}`}>{ts}</p>}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                      {agentSessionData.status === "running" && (
                        <div className="flex justify-start">
                          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                            <div className="flex items-center gap-1.5 text-xs text-purple-400">
                              <Loader2 size={10} className="animate-spin" />
                              <span>Working...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {agentSessionData.status === "completed" && (
                        <div className="flex items-center gap-2 py-2">
                          <div className="flex-1 border-t border-green-500/20" />
                          <span className="text-[9px] text-green-400/60 font-medium flex items-center gap-1"><CheckCircle size={8} /> Session complete</span>
                          <div className="flex-1 border-t border-green-500/20" />
                        </div>
                      )}
                      {agentSessionData.status === "failed" && (
                        <div className="flex items-center gap-2 py-2">
                          <div className="flex-1 border-t border-red-500/20" />
                          <span className="text-[9px] text-red-400/60 font-medium flex items-center gap-1"><XCircle size={8} /> Session failed</span>
                          <div className="flex-1 border-t border-red-500/20" />
                        </div>
                      )}
                      {agentSessionData.status === "incomplete" && (
                        <div className="flex items-center gap-2 py-2">
                          <div className="flex-1 border-t border-amber-500/20" />
                          <span className="text-[9px] text-amber-400/60 font-medium flex items-center gap-1"><AlertCircle size={8} /> Ran out of rounds — send a follow-up to continue</span>
                          <div className="flex-1 border-t border-amber-500/20" />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              {/* Follow-up input */}
              {agentSessionData.status !== "running" && (
                <AgentFollowUpInput sessionId={agentSessionData.id} onSent={(msg) => {
                  // Optimistically add user message and set status to running
                  const prevMessages = agentSessionData.messages ? JSON.parse(agentSessionData.messages) : [];
                  prevMessages.push({ role: "user", content: msg });
                  setAgentSessionData(prev => prev ? {
                    ...prev,
                    status: "running",
                    messages: JSON.stringify(prevMessages),
                  } : prev);
                }} />
              )}
            </div>
          ) : loadingAgentSession ? (
            <div className="flex items-center justify-center h-full text-muted">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            /* Session list */
            <div className="px-4 py-3 space-y-1">
              {agentSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    <Bot size={24} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Agent Sessions</p>
                    <p className="text-xs text-muted mt-1 max-w-[240px]">Toggle the robot icon on any task to have the AI agent work on it autonomously.</p>
                  </div>
                </div>
              ) : (
                <>
                  <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wide">Recent Sessions</h4>
                  {agentSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadAgentSession(s.id)}
                      className={`w-full text-left rounded-lg transition-colors ${
                        s.status === "running"
                          ? "bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10"
                          : s.status === "failed"
                            ? "bg-card border border-red-500/15 hover:bg-card-hover"
                            : "bg-card border border-border hover:bg-card-hover"
                      }`}
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        {s.status === "running" && <Loader2 size={10} className="text-purple-400 animate-spin shrink-0" />}
                        {s.status === "completed" && <CheckCircle size={10} className="text-green-400/50 shrink-0" />}
                        {s.status === "incomplete" && <AlertCircle size={10} className="text-amber-400/50 shrink-0" />}
                        {s.status === "failed" && <XCircle size={10} className="text-red-400/50 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-medium truncate block ${s.status === "running" ? "text-purple-300" : ""}`}>{s.todo_text ?? s.summary?.slice(0, 60) ?? "Processing..."}</span>
                          {s.status === "running" && <span className="text-[9px] text-purple-400/50">Running...</span>}
                        </div>
                        <span className="text-[9px] text-muted/30 shrink-0">
                          {s.started_at ? new Date(s.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : ""}
                        </span>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─── Image Lightbox ───────────────────────────────────────────
function ImageLightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"><X size={24} /></button>
      <img src={src} alt={alt ?? ""} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────
export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [showSlackConnect, setShowSlackConnect] = useState(false);
  const [slackToken, setSlackToken] = useState("");
  const [slackConnecting, setSlackConnecting] = useState(false);
  const [slackError, setSlackError] = useState("");
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [repoStatuses, setRepoStatuses] = useState<Record<string, string>>({});
  const [watchedChannels, setWatchedChannels] = useLocalStorage<string[]>("slack:watchedChannels", []);
  const [availableChannels, setAvailableChannels] = useState<{ id: string; name: string; isDm: boolean; memberCount?: number }[]>([]);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useLocalStorage("ui:chatCollapsed", false);
  const [chatWidth, setChatWidth] = useLocalStorage("ui:chatWidth", 520);
  const [githubMode, setGithubMode] = useLocalStorage<"author" | "assignee">("filter:githubMode", "author");

  // Image lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Quick replies (loaded from DB settings)
  const [quickReplies, setQuickReplies] = useState<string[]>(["Kollar på det!"]);
  useEffect(() => {
    fetch("/api/settings/quick-replies").then(r => r.json()).then(d => { if (d.replies?.length) setQuickReplies(d.replies); }).catch(() => {});
  }, []);

  // Chat ref for injecting prompts
  const chatRef = useRef<ChatPanelHandle>(null);
  const handleChatAbout = useCallback((prompt: string, prInfo?: { repo: string; prNumber: number }) => {
    setChatCollapsed(false);
    // Extract a short display text — first line or first 80 chars
    const firstLine = prompt.split("\n")[0];
    const displayText = firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
    if (prInfo) {
      // Fetch code context first, then inject
      setTimeout(async () => {
        try {
          const res = await fetch("/api/github/code-context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(prInfo),
          });
          const ctx = await res.json();
          if (ctx.error) {
            chatRef.current?.injectPrompt(prompt + "\n\n(Note: could not load code context: " + ctx.error + ")", undefined, displayText);
          } else {
            chatRef.current?.injectPrompt(prompt, { ...prInfo, ...ctx }, displayText);
          }
        } catch {
          chatRef.current?.injectPrompt(prompt, undefined, displayText);
        }
      }, 100);
    } else {
      setTimeout(() => chatRef.current?.injectPrompt(prompt, undefined, displayText), 100);
    }
  }, [setChatCollapsed]);

  // Daily todos
  const [dailyTodos, setDailyTodos] = useState<{ id: string; text: string; done: number; date: string; deadline?: string | null; image?: string | null; note?: string | null; agent_enabled?: number; source?: string | null; source_id?: string | null; completed_at?: string | null }[]>([]);
  const [agentStatus, setAgentStatus] = useState<{ running: boolean; currentTodoId: string | null; currentTodoText: string | null; queueLength: number } | null>(null);
  const [agentSessions, setAgentSessions] = useState<Record<string, { id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; tool_calls?: string }>>({});
  const refreshTodos = useCallback(() => {
    fetch("/api/todos?mode=queue").then((r) => r.json()).then((todos) => {
      setDailyTodos(todos);
      // Fetch agent sessions for agent-enabled todos
      const agentTodoIds = todos.filter((t: { agent_enabled?: number }) => t.agent_enabled).map((t: { id: string }) => t.id);
      if (agentTodoIds.length > 0) {
        fetch(`/api/agent/sessions?todo_id=${agentTodoIds.join(",")}`).then(r => r.json()).then((sessions: { id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; tool_calls?: string }[]) => {
          const sessionsMap: Record<string, { id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; tool_calls?: string }> = {};
          for (const s of sessions) {
            // Keep the latest session per todo (results are ordered by created_at DESC)
            if (!sessionsMap[s.todo_id]) sessionsMap[s.todo_id] = s;
          }
          setAgentSessions(sessionsMap);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshTodos();
  }, [refreshTodos]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "k") {
          e.preventDefault();
          setChatCollapsed(false);
          setTimeout(() => (document.getElementById("chat-input") as HTMLTextAreaElement)?.focus(), 100);
        }
        if (e.key === "n") {
          e.preventDefault();
          // Focus the todo input
          setTimeout(() => (document.getElementById("todo-input") as HTMLInputElement)?.focus(), 100);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setChatCollapsed]);

  const handleConnectSlack = async () => {
    setSlackConnecting(true);
    setSlackError("");
    try {
      const res = await fetch("/api/slack/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: slackToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSlackError(data.error);
        return;
      }
      setShowSlackConnect(false);
      setSlackToken("");
      const p = await fetch("/api/profile").then((r) => r.json());
      setProfile(p);
    } finally {
      setSlackConnecting(false);
    }
  };

  const handleOpenChannelPicker = async () => {
    setShowChannelPicker(true);
    if (availableChannels.length === 0) {
      setLoadingChannels(true);
      try {
        const res = await fetch("/api/slack/channels");
        if (res.ok) setAvailableChannels(await res.json());
      } finally {
        setLoadingChannels(false);
      }
    }
  };

  const toggleWatchedChannel = (id: string) => {
    setWatchedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        setProfile(p);
        setProfileLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (profile) {
      fetch("/api/items")
        .then((r) => r.json())
        .then(setItems);
    }
  }, [profile]);

  const handleSync = async (quick = false) => {
    setSyncing(true);
    if (!quick) setSyncErrors([]);
    setSyncStatus(null);
    try {
      // On quick sync, pass active DM channel IDs so they get refreshed
      let activeDmChannelIds: string[] | undefined;
      if (quick) {
        const dmChannels = new Set<string>();
        for (const item of items) {
          if (item.source !== "slack") continue;
          const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
          if (raw.channelName?.startsWith("DM:") && raw.channel) {
            dmChannels.add(raw.channel);
          }
        }
        activeDmChannelIds = [...dmChannels];
      }
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubMode,
          // Quick sync: DMs + mentions (phases 1-2)
          // Full sync adds thread mentions + subscribed threads (phases 3-4)
          ...(quick ? { slackPhases: [1, 2] } : {}),
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (eventType === "items") {
                setItems(payload);
              } else if (eventType === "error") {
                setSyncErrors((prev) => [...prev, `${payload.source}: ${payload.message}`]);
              } else if (eventType === "status") {
                const src = payload.source ? `[${payload.source}] ` : "";
                setSyncStatus(`${src}${payload.state}`);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } finally {
      setSyncing(false);
      setSyncStatus(null);
    }
  };

  // Auto-sync: full on load + every 5min, quick (DMs+mentions) every 60s
  const syncingRef = useRef(false);
  syncingRef.current = syncing;
  const hasInitialSynced = useRef(false);
  const [nextSyncIn, setNextSyncIn] = useState<number>(60);
  const [nextFullSyncIn, setNextFullSyncIn] = useState<number>(300);
  const quickCountdownRef = useRef(60);
  const fullCountdownRef = useRef(300);
  useEffect(() => {
    if (!profile) return;
    if (!hasInitialSynced.current) {
      hasInitialSynced.current = true;
      handleSync(false);
    }
    quickCountdownRef.current = 60;
    fullCountdownRef.current = 300;
    // Tick every second for countdown
    const tick = setInterval(() => {
      quickCountdownRef.current -= 1;
      fullCountdownRef.current -= 1;
      setNextSyncIn(quickCountdownRef.current);
      setNextFullSyncIn(fullCountdownRef.current);
      if (quickCountdownRef.current <= 0) {
        quickCountdownRef.current = 60;
        if (!syncingRef.current) handleSync(true);
      }
      if (fullCountdownRef.current <= 0) {
        fullCountdownRef.current = 300;
        quickCountdownRef.current = 60; // reset quick too since full covers everything
        if (!syncingRef.current) handleSync(false);
      }
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Lightweight poll for webhook-triggered changes (every 2s, just checks a counter)
  const lastChangeRef = useRef(0);
  useEffect(() => {
    if (!profile) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/changes");
        const data = await res.json();
        if (data.agentStatus) setAgentStatus(data.agentStatus);
        if (data.v !== lastChangeRef.current) {
          lastChangeRef.current = data.v;
          const itemsRes = await fetch("/api/items");
          const newItems = await itemsRes.json();
          setItems(newItems);
          refreshTodos();
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [profile, refreshTodos]);

  // Background clone repos from GitHub PRs and poll status
  useEffect(() => {
    const repos = new Set<string>();
    for (const item of items) {
      if (item.source === "github") {
        const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
        if (raw.repo) repos.add(raw.repo);
      }
    }
    if (repos.size === 0) return;

    // Trigger cloning for all PR repos
    fetch("/api/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repos: Array.from(repos) }),
    }).then(r => r.json()).then(data => setRepoStatuses(data.statuses ?? {})).catch(() => {});

    // Poll status while any are cloning
    const poll = setInterval(() => {
      fetch("/api/repos").then(r => r.json()).then(statuses => {
        setRepoStatuses(statuses);
        if (!Object.values(statuses).includes("cloning")) clearInterval(poll);
      }).catch(() => {});
    }, 5000);

    return () => clearInterval(poll);
  }, [items]);

  const onDismiss = useCallback((item: TodoItem) => {
    fetch("/api/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: item.source, source_id: item.source_id }),
    });
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }, []);

  if (!profileLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <ProfileSetup onDone={setProfile} />;
  }

  // Source counts for the header badges
  const linearCount = items.filter((i) => i.source === "linear").length;
  const githubCount = items.filter((i) => i.source === "github").length;
  const slackCount = items.filter((i) => i.source === "slack").length;
  const calendarCount = items.filter((i) => i.source === "calendar").length;

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* ─── Top Bar ─── */}
      <header className="border-b border-border px-4 py-2.5 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatCollapsed(!chatCollapsed)}
            className="text-muted hover:text-foreground transition-colors p-1 rounded hover:bg-card-hover"
            title={chatCollapsed ? "Show chat" : "Hide chat"}
          >
            {chatCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <h1 className="text-sm font-bold">Builder Command</h1>
        </div>

        {/* Socket status */}
        {/* Agent status */}
        {agentStatus?.running && (
          <div className="flex items-center gap-1.5" title={agentStatus.currentTodoText ? `Working on: ${agentStatus.currentTodoText}` : "Agent processing..."}>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 bg-purple-500/10 text-purple-400">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              Agent
            </span>
          </div>
        )}

        {/* Sync status / countdown */}
        {syncing ? (
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Loader2 size={10} className="animate-spin" />
            <span className="truncate max-w-[200px]">{syncStatus ?? "Syncing..."}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-muted/50">
            <span>quick {nextSyncIn}s</span>
            <span>·</span>
            <span>full {Math.floor(nextFullSyncIn / 60)}:{String(nextFullSyncIn % 60).padStart(2, "0")}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {!profile.google_connected && (
            <a href="/api/google/auth" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-[11px] transition-colors">
              <Calendar size={12} /> Calendar
            </a>
          )}
          {!profile.slack_connected && (
            <button onClick={() => setShowSlackConnect(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] transition-colors">
              <MessageSquare size={12} /> Slack
            </button>
          )}
          <button onClick={() => setShowSettings(!showSettings)} className="text-muted hover:text-foreground transition-colors p-1.5 rounded hover:bg-card-hover">
            <Settings size={14} />
          </button>
        </div>
      </header>

      {/* Sync errors */}
      {syncErrors.length > 0 && (
        <div className="px-4 py-1.5 space-y-1 shrink-0">
          {syncErrors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2.5 py-1.5">
              <XCircle size={10} /> <span className="flex-1">{err}</span>
              <button onClick={() => setSyncErrors(prev => prev.filter((_, j) => j !== i))} className="shrink-0 hover:text-red-300 transition-colors"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Main Split Layout ─── */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Claude Chat */}
        {!chatCollapsed && (
          <div className="shrink-0 bg-background flex" style={{ width: chatWidth }}>
            <div className="flex-1 min-w-0 border-r border-border">
              <ChatPanel ref={chatRef} />
            </div>
            <div
              className="w-1 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 transition-colors shrink-0"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = chatWidth;
                const maxWidth = window.innerWidth * 0.5;
                const onMove = (ev: MouseEvent) => {
                  const newWidth = Math.min(maxWidth, Math.max(320, startWidth + ev.clientX - startX));
                  setChatWidth(newWidth);
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
          </div>
        )}

        {/* Center: Dashboard */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-4 pb-16">
            {items.length === 0 ? (
              <div className="text-center py-20 text-muted">
                <p className="text-lg mb-2">No items yet</p>
                <p className="text-sm">Hit Sync to pull from your integrations</p>
              </div>
            ) : (
              <ItemList items={items} setItems={setItems} onDismiss={onDismiss} dailyTodos={dailyTodos} onRefreshTodos={refreshTodos} onChatAbout={handleChatAbout} repoStatuses={repoStatuses} slackUserId={profile?.slack_user_id ?? undefined} agentSessions={agentSessions} onOpenAgentSession={(sessionId) => { setChatCollapsed(false); setTimeout(() => chatRef.current?.openAgentSession(sessionId), 50); }} onImageClick={setLightboxSrc} quickReplies={quickReplies} />
            )}
          </div>
        </div>

      </div>

      {/* ─── Image Lightbox ─── */}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* ─── Modals ─── */}
      {showSlackConnect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSlackConnect(false)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold mb-1">Connect Slack</h2>
            <p className="text-xs text-muted mb-4">
              Go to your <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Slack App</a> → OAuth & Permissions.
              Copy the <strong>User OAuth Token</strong> (starts with <code className="bg-background px-1 rounded">xoxp-</code>).
            </p>
            <input type="password" value={slackToken} onChange={(e) => setSlackToken(e.target.value)} placeholder="xoxp-..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-accent font-mono" />
            {slackError && <p className="text-xs text-danger mb-3">{slackError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSlackConnect(false)} className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground transition-colors">Cancel</button>
              <button onClick={handleConnectSlack} disabled={slackConnecting || !slackToken.startsWith("xoxp-")}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm transition-colors disabled:opacity-50">
                {slackConnecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChannelPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowChannelPicker(false)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold mb-1">Watch Slack Channels</h2>
            <p className="text-xs text-muted mb-4">Select channels to fetch messages from (last 24h). All DMs are always included.</p>
            {loadingChannels ? (
              <div className="flex items-center justify-center py-8 text-muted"><Loader2 size={16} className="animate-spin mr-2" /> Loading channels...</div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                {availableChannels.map((ch) => (
                  <label key={ch.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-card-hover rounded px-2 py-1.5 transition-colors">
                    <input type="checkbox" checked={watchedChannels.includes(ch.id)} onChange={() => toggleWatchedChannel(ch.id)} className="accent-accent" />
                    <Hash size={12} className="text-muted shrink-0" />
                    <span className="truncate">{ch.name}</span>
                    {ch.memberCount != null && <span className="text-[10px] text-muted/50 ml-auto shrink-0">{ch.memberCount}</span>}
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
              <span className="text-xs text-muted">{watchedChannels.length} channels selected</span>
              <button onClick={() => setShowChannelPicker(false)} className="px-4 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover text-sm transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function CustomActionsSettings() {
  const [actions, setActions] = useLocalStorage<CustomAction[]>("ui:customActions", DEFAULT_ACTIONS);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", emoji: "⚡", prompt: "", source: "both" as "linear" | "github" | "both", repo: "", createTask: false });

  const startEdit = (a: CustomAction) => {
    setEditId(a.id);
    setForm({ name: a.name, emoji: a.emoji, prompt: a.prompt, source: a.source, repo: a.repo ?? "", createTask: a.createTask ?? false });
  };

  const save = () => {
    if (!form.name.trim() || !form.prompt.trim()) return;
    const action: CustomAction = { id: editId ?? String(Date.now()), name: form.name, emoji: form.emoji || "⚡", prompt: form.prompt, source: form.source, repo: form.repo.trim() || undefined, createTask: form.createTask || undefined };
    if (editId) {
      setActions(actions.map((a) => a.id === editId ? action : a));
    } else {
      setActions([...actions, action]);
    }
    setEditId(null);
    setAdding(false);
    setForm({ name: "", emoji: "⚡", prompt: "", source: "both", repo: "", createTask: false });
  };

  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5">Custom Actions</h3>
      <p className="text-[10px] text-muted/40 mb-2">Actions appear on Linear tickets and GitHub PRs. Use template variables: {"{title}"}, {"{identifier}"}, {"{description}"}, {"{repo}"}, {"{state}"}, {"{assignee}"}, {"{labels}"}</p>
      <div className="space-y-1.5">
        {actions.map((a) => (
          editId === a.id ? (
            <ActionForm key={a.id} form={form} setForm={setForm} onSave={save} onCancel={() => { setEditId(null); setForm({ name: "", emoji: "⚡", prompt: "", source: "both", repo: "", createTask: false }); }} />
          ) : (
            <div key={a.id} className="flex items-center gap-2 group/action py-1 px-2 rounded hover:bg-card-hover transition-colors">
              <span className="text-sm">{a.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{a.name}</div>
                <div className="flex items-center gap-1.5 text-[9px] text-muted/50">
                  <span className={a.source === "github" ? "text-orange-400/60" : a.source === "linear" ? "text-violet-400/60" : "text-muted/40"}>{a.source}</span>
                  {a.repo && <span className="font-mono">{a.repo}</span>}
                  {a.createTask && <span className="text-purple-400/60 flex items-center gap-0.5"><Bot size={7} /> task+agent</span>}
                </div>
              </div>
              <button onClick={() => startEdit(a)} className="opacity-0 group-hover/action:opacity-100 text-[10px] text-accent hover:underline transition-opacity">edit</button>
              <button onClick={() => setActions(actions.filter((x) => x.id !== a.id))} className="opacity-0 group-hover/action:opacity-100 text-[10px] text-red-400/50 hover:text-red-400 transition-opacity">×</button>
            </div>
          )
        ))}
        {adding ? (
          <ActionForm form={form} setForm={setForm} onSave={save} onCancel={() => { setAdding(false); setForm({ name: "", emoji: "⚡", prompt: "", source: "both", repo: "", createTask: false }); }} />
        ) : (
          <button onClick={() => setAdding(true)} className="text-[10px] text-accent hover:underline">+ Add action</button>
        )}
      </div>
    </div>
  );
}

function ActionForm({ form, setForm, onSave, onCancel }: {
  form: { name: string; emoji: string; prompt: string; source: "linear" | "github" | "both"; repo: string; createTask: boolean };
  setForm: (f: typeof form) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-background border border-border rounded-lg p-2.5 space-y-1.5">
      <div className="flex gap-1">
        <input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="w-8 bg-card border border-border rounded px-1 py-0.5 text-xs text-center" />
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="flex-1 bg-card border border-border rounded px-2 py-0.5 text-xs" placeholder="Action name (e.g. Review, Test)" />
      </div>
      <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} className="w-full bg-card border border-border rounded px-2 py-1 text-xs h-32 resize-none font-mono" placeholder="Prompt template..." />
      <div className="flex gap-1">
        <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as "linear" | "github" | "both" })} className="flex-1 bg-card border border-border rounded px-2 py-0.5 text-xs">
          <option value="both">Both</option>
          <option value="linear">Linear only</option>
          <option value="github">GitHub only</option>
        </select>
        <input value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value })} className="flex-1 bg-card border border-border rounded px-2 py-0.5 text-xs font-mono" placeholder="Repo filter (optional)" />
      </div>
      <label className="flex items-center gap-1.5 text-[10px] text-muted cursor-pointer">
        <input type="checkbox" checked={form.createTask} onChange={(e) => setForm({ ...form, createTask: e.target.checked })} className="rounded" />
        Create task + run agent automatically
      </label>
      <div className="flex gap-1">
        <button onClick={onSave} className="flex-1 px-2 py-1 rounded bg-accent text-white text-xs hover:bg-accent-hover transition-colors">Save</button>
        <button onClick={onCancel} className="px-2 py-1 rounded border border-border text-xs text-muted hover:bg-card-hover transition-colors">Cancel</button>
      </div>
    </div>
  );
}

function QuickRepliesSettings() {
  const [replies, setReplies] = useState<string[]>([]);
  const [newReply, setNewReply] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings/quick-replies").then(r => r.json()).then(d => { setReplies(d.replies ?? []); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const save = async (updated: string[]) => {
    setReplies(updated);
    await fetch("/api/settings/quick-replies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replies: updated }) });
  };

  if (!loaded) return null;

  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5">Quick Replies</h3>
      <p className="text-[10px] text-muted/40 mb-2">Random reply picked when using the quick reply button on Slack messages.</p>
      <div className="space-y-1 mb-2">
        {replies.map((r, i) => (
          <div key={i} className="flex items-center gap-2 group/qr">
            <span className="text-[11px] flex-1 truncate">{r}</span>
            <button onClick={() => save(replies.filter((_, j) => j !== i))} className="opacity-0 group-hover/qr:opacity-100 text-[10px] text-red-400 hover:text-red-300 transition-opacity">remove</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={newReply}
          onChange={(e) => setNewReply(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && newReply.trim()) { save([...replies, newReply.trim()]); setNewReply(""); } }}
          placeholder="Add a reply..."
          className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-accent"
        />
        <button onClick={() => { if (newReply.trim()) { save([...replies, newReply.trim()]); setNewReply(""); } }} className="text-[10px] text-accent hover:underline">Add</button>
      </div>
    </div>
  );
}

function LocalReposSettings() {
  const [found, setFound] = useState<{ repo: string; localPath: string }[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/settings/local-repos").then(r => r.json()).then(d => {
      setFound(d.found ?? []);
      setSaved(d.saved ?? {});
      setScanned(true);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = async (repo: string, localPath: string) => {
    const updated = { ...saved };
    if (updated[repo]) {
      delete updated[repo];
    } else {
      updated[repo] = localPath;
    }
    setSaved(updated);
    await fetch("/api/settings/local-repos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repos: updated }) });
  };

  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5">Local Repositories</h3>
      <p className="text-[10px] text-muted/40 mb-2">Git repos found on disk. Enabled repos give the AI agent direct read access instead of cloning.</p>
      {loading && <p className="text-[10px] text-muted/40">Scanning...</p>}
      {scanned && found.length === 0 && <p className="text-[10px] text-muted/40">No GitHub repos found in home directory.</p>}
      {found.length > 0 && (
        <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
          {found.map(({ repo, localPath }) => (
            <label key={repo} className="flex items-center gap-2 py-0.5 cursor-pointer group/lr hover:bg-background/50 rounded px-1 -mx-1">
              <input type="checkbox" checked={!!saved[repo]} onChange={() => toggle(repo, localPath)} className="accent-accent" />
              <span className="text-[11px] flex-1 truncate">{repo}</span>
              <span className="text-[9px] text-muted/30 truncate max-w-[150px] group-hover/lr:text-muted/50">{localPath.replace(/^\/Users\/[^/]+/, "~")}</span>
            </label>
          ))}
        </div>
      )}
      {scanned && <button onClick={load} className="text-[10px] text-accent hover:underline mt-1">Rescan</button>}
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"general" | "actions">("general");
  const [settings, setSettings] = useState<{ env: Record<string, { set: boolean; preview: string }>; webhooks: Record<string, string> } | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(setSettings);
  }, []);

  const saveKey = async (key: string) => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: editValue }),
    });
    // Refresh
    const res = await fetch("/api/settings");
    setSettings(await res.json());
    setEditingKey(null);
    setEditValue("");
    setSaving(false);
  };

  const envGroups: { label: string; keys: string[] }[] = [
    { label: "AI", keys: ["ANTHROPIC_API_KEY"] },
    { label: "GitHub", keys: ["GITHUB_TOKEN"] },
    { label: "Linear", keys: ["LINEAR_API_KEY", "LINEAR_TEAM_ID"] },
    { label: "Slack", keys: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"] },
    { label: "Google", keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"] },
    { label: "App", keys: ["PORT"] },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold">Settings</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground"><X size={14} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-border/50 pb-2">
          <button onClick={() => setTab("general")} className={`px-3 py-1 rounded-md text-xs transition-colors ${tab === "general" ? "bg-accent/15 text-accent font-medium" : "text-muted hover:text-foreground"}`}>
            General
          </button>
          <button onClick={() => setTab("actions")} className={`px-3 py-1 rounded-md text-xs transition-colors flex items-center gap-1 ${tab === "actions" ? "bg-accent/15 text-accent font-medium" : "text-muted hover:text-foreground"}`}>
            <Zap size={10} /> Actions
          </button>
        </div>

        {tab === "actions" ? (
          <CustomActionsSettings />
        ) : !settings ? (
          <div className="flex items-center justify-center py-8 text-muted"><Loader2 size={16} className="animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {/* Environment Variables */}
            {envGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5">{group.label}</h3>
                <div className="space-y-1">
                  {group.keys.map((key) => {
                    const info = settings.env[key];
                    const isEditing = editingKey === key;
                    return (
                      <div key={key} className="flex items-center gap-2 group/setting">
                        <span className="text-[11px] font-mono text-muted w-48 shrink-0 truncate">{key}</span>
                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveKey(key); if (e.key === "Escape") setEditingKey(null); }}
                              autoFocus
                              className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-[11px] font-mono focus:outline-none focus:border-accent"
                              placeholder="Enter value..."
                            />
                            <button onClick={() => saveKey(key)} disabled={saving} className="text-[10px] text-accent hover:underline">
                              {saving ? "..." : "Save"}
                            </button>
                            <button onClick={() => setEditingKey(null)} className="text-[10px] text-muted hover:text-foreground">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center gap-2">
                            <span className={`text-[11px] font-mono ${info?.set ? "text-green-400" : "text-muted/30"}`}>
                              {info?.set ? info.preview : "not set"}
                            </span>
                            <button
                              onClick={() => { setEditingKey(key); setEditValue(""); }}
                              className="opacity-0 group-hover/setting:opacity-100 text-[10px] text-accent hover:underline transition-opacity"
                            >
                              {info?.set ? "change" : "set"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Local Repos */}
            <LocalReposSettings />

            {/* Quick Replies */}
            <QuickRepliesSettings />

            {/* Webhook URLs */}
            <div>
              <h3 className="text-[10px] uppercase tracking-wider text-muted/60 mb-1.5">Webhook URLs</h3>
              <p className="text-[10px] text-muted/40 mb-2">Configure these in your integration settings for real-time updates. Use a tunnel (ngrok, cloudflare) for external access.</p>
              {Object.entries(settings.webhooks).map(([name, url]) => (
                <div key={name} className="flex items-center gap-2 py-0.5">
                  <span className="text-[11px] font-semibold text-muted w-16 capitalize">{name}</span>
                  <code className="text-[10px] font-mono text-muted/60 bg-background px-2 py-0.5 rounded flex-1 truncate">{url}</code>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Action Queue: filter to urgent/actionable items ──────────────
// Returns item IDs that need attention, grouped by urgency tier
interface UrgentSection {
  label: string;
  urgency: number;
  source: "calendar" | "github" | "linear" | "slack";
  itemIds: Set<string>;
  // For slack: channel names that are urgent
  slackChannels?: Set<string>;
}

function buildUrgentSections(items: TodoItem[], slackUserId?: string): UrgentSection[] {
  const sections: UrgentSection[] = [];
  const now = Date.now();

  // Calendar: meetings needing RSVP or starting soon
  const urgentCalIds = new Set<string>();
  for (const item of items) {
    if (item.source !== "calendar") continue;
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    if (raw.allDay) continue;
    const startMs = new Date(raw.start).getTime();
    const endMs = new Date(raw.end).getTime();
    if (endMs < now - 60 * 60 * 1000) continue;
    const minsUntilStart = (startMs - now) / 60000;
    if (raw.responseStatus === "needsAction" || (minsUntilStart > -30 && minsUntilStart < 15)) {
      urgentCalIds.add(item.id);
    }
  }
  if (urgentCalIds.size > 0) {
    sections.push({ label: "Meetings needing attention", urgency: 100, source: "calendar", itemIds: urgentCalIds });
  }

  // Slack: channels with unread messages
  const slackByChannel = new Map<string, TodoItem[]>();
  for (const item of items) {
    if (item.source !== "slack") continue;
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    const ch = raw.channelName ?? "unknown";
    if (!slackByChannel.has(ch)) slackByChannel.set(ch, []);
    slackByChannel.get(ch)!.push(item);
  }
  const urgentSlackIds = new Set<string>();
  const urgentSlackChannels = new Set<string>();
  for (const [channel, channelItems] of slackByChannel) {
    // Sort by timestamp to find the latest message
    channelItems.sort((a, b) => {
      const aTs = parseFloat(JSON.parse(a.raw_data ?? "{}").timestamp ?? "0");
      const bTs = parseFloat(JSON.parse(b.raw_data ?? "{}").timestamp ?? "0");
      return aTs - bTs;
    });
    const latestRaw = channelItems[channelItems.length - 1]?.raw_data
      ? JSON.parse(channelItems[channelItems.length - 1].raw_data!)
      : {};

    // For DMs: skip if the user sent the last message (they've already attended to it)
    const isDm = channel.startsWith("DM:");
    if (isDm && slackUserId && latestRaw.sender === slackUserId) continue;

    // For channels: check if there are messages from others
    const hasRelevant = channelItems.some((i) => {
      const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
      return raw.isUnread !== false;
    });
    if (hasRelevant) {
      urgentSlackChannels.add(channel);
      for (const item of channelItems.slice(-5)) {
        urgentSlackIds.add(item.id);
      }
    }
  }
  if (urgentSlackIds.size > 0) {
    sections.push({ label: "Unread messages", urgency: 70, source: "slack", itemIds: urgentSlackIds, slackChannels: urgentSlackChannels });
  }

  // GitHub: PRs needing action
  const urgentGhIds = new Set<string>();
  for (const item of items) {
    if (item.source !== "github") continue;
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    if (raw.draft) continue;
    const isReview = item.source_id.startsWith("review-");
    const mergeable = raw.mergeable === true;
    const failingChecks = (raw.checks ?? []).filter((c: { conclusion: string }) => c.conclusion === "failure");
    const hasConflicts = raw.mergeableState === "dirty" || raw.mergeable === false;
    if (isReview && raw.reviewRequested) urgentGhIds.add(item.id);
    else if (!isReview && mergeable && failingChecks.length === 0 && !hasConflicts) urgentGhIds.add(item.id);
    else if (!isReview && (hasConflicts || failingChecks.length > 0)) urgentGhIds.add(item.id);
  }
  if (urgentGhIds.size > 0) {
    sections.push({ label: "PRs needing action", urgency: 60, source: "github", itemIds: urgentGhIds });
  }

  // Linear: urgent/high priority or in progress
  const urgentLinearIds = new Set<string>();
  for (const item of items) {
    if (item.source !== "linear") continue;
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    const state = raw.state as string | undefined;
    if (state === "Done" || state === "Canceled" || state === "Cancelled") continue;
    const priority = raw.priority as number | undefined;
    if (priority === 1 || priority === 2 || state === "In Progress") {
      urgentLinearIds.add(item.id);
    }
  }
  if (urgentLinearIds.size > 0) {
    sections.push({ label: "Issues to work on", urgency: 40, source: "linear", itemIds: urgentLinearIds });
  }

  sections.sort((a, b) => b.urgency - a.urgency);
  return sections;
}

// ─── Calendar Timeline ──────────────────────────────────────
function CalendarTimeline({ items, onDismiss, hiddenCalendars, onToggleCalendar }: {
  items: TodoItem[];
  onDismiss: (item: TodoItem) => void;
  hiddenCalendars: Set<string>;
  onToggleCalendar: (calName: string) => void;
}) {
  const now = new Date();

  // Collect all calendar names from items
  const allCalendarNames = new Set<string>();
  items.filter((i) => i.source === "calendar").forEach((i) => {
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    if (raw.calendarName) allCalendarNames.add(raw.calendarName);
  });

  const isCalVisible = (raw: Record<string, unknown>) => !hiddenCalendars.has(raw.calendarName as string);

  const calItems = items.filter((i) => {
    if (i.source !== "calendar") return false;
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    if (!isCalVisible(raw)) return false;
    if (raw.allDay) return false;
    const endMs = new Date(raw.end).getTime();
    if (endMs < now.getTime() - 60 * 60 * 1000) return false;
    const startDate = new Date(raw.start);
    if (startDate.toDateString() !== now.toDateString()) return false;
    return true;
  }).sort((a, b) => {
    const aRaw = JSON.parse(a.raw_data ?? "{}");
    const bRaw = JSON.parse(b.raw_data ?? "{}");
    return new Date(aRaw.start).getTime() - new Date(bRaw.start).getTime();
  });

  const allDayItems = items.filter((i) => {
    if (i.source !== "calendar") return false;
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    if (!isCalVisible(raw)) return false;
    return raw.allDay;
  });

  if (calItems.length === 0 && allDayItems.length === 0 && allCalendarNames.size === 0) return null;

  // Timeline from 1h ago to end of day
  const timelineStart = new Date(now);
  timelineStart.setMinutes(0, 0, 0);
  timelineStart.setHours(timelineStart.getHours() - 1);
  const timelineEnd = new Date(now);
  timelineEnd.setHours(23, 59, 59, 999);
  const totalMs = timelineEnd.getTime() - timelineStart.getTime();

  const getPosition = (date: Date) => {
    const ms = date.getTime() - timelineStart.getTime();
    return Math.max(0, Math.min(100, (ms / totalMs) * 100));
  };

  // Generate hour markers
  const hourMarkers: { hour: number; pos: number }[] = [];
  for (let h = timelineStart.getHours(); h <= 23; h++) {
    const d = new Date(now);
    d.setHours(h, 0, 0, 0);
    if (d.getTime() >= timelineStart.getTime()) {
      hourMarkers.push({ hour: h, pos: getPosition(d) });
    }
  }

  const nowPos = getPosition(now);

  return (
    <div className="mb-4">
      {/* Calendar filter pills */}
      {allCalendarNames.size > 1 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {Array.from(allCalendarNames).sort().map((calName) => (
            <button
              key={calName}
              onClick={() => onToggleCalendar(calName)}
              className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                hiddenCalendars.has(calName)
                  ? "bg-card text-muted/30 line-through"
                  : "bg-card-hover text-muted border border-border"
              }`}
            >
              {calName}
            </button>
          ))}
        </div>
      )}

      {/* All-day events */}
      {allDayItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {allDayItems.map((item) => {
            const raw = JSON.parse(item.raw_data ?? "{}");
            return (
              <span key={item.id} className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {raw.title}
              </span>
            );
          })}
        </div>
      )}

      {/* Timeline bar */}
      <div className="relative h-28 bg-card border border-border rounded-lg overflow-hidden">
        {/* Hour markers */}
        {hourMarkers.map(({ hour, pos }) => (
          <div key={hour} className="absolute top-0 bottom-0" style={{ left: `${pos}%` }}>
            <div className="h-full border-l border-border/30" />
            <span className="absolute top-0.5 left-1 text-[9px] text-muted/40 font-mono">{hour}:00</span>
          </div>
        ))}

        {/* Now indicator */}
        <div className="absolute top-0 bottom-0 z-20" style={{ left: `${nowPos}%` }}>
          <div className="h-full border-l-2 border-red-500/70" />
          <div className="absolute -top-0 left-[-3px] w-2 h-2 rounded-full bg-red-500" />
        </div>

        {/* Events */}
        {calItems.map((item, idx) => {
          const raw = JSON.parse(item.raw_data ?? "{}");
          const startPos = getPosition(new Date(raw.start));
          const endPos = getPosition(new Date(raw.end));
          const width = Math.max(endPos - startPos, 2);
          const isPast = new Date(raw.end).getTime() < now.getTime();
          const isNow = new Date(raw.start).getTime() <= now.getTime() && new Date(raw.end).getTime() > now.getTime();
          const needsRsvp = raw.responseStatus === "needsAction";

          return (
            <div
              key={item.id}
              className={`absolute rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer transition-all hover:z-30 hover:scale-y-110 ${
                isNow ? "bg-blue-500/40 text-blue-200 border border-blue-400/50 ring-1 ring-blue-400/30" :
                isPast ? "bg-card-hover/80 text-muted/60" :
                needsRsvp ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" :
                "bg-accent/20 text-accent border border-accent/20"
              }`}
              style={{
                left: `${startPos}%`,
                width: `${width}%`,
                top: `${24 + (idx % 2) * 18}px`,
                height: "16px",
              }}
              title={`${raw.title} — ${new Date(raw.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} to ${new Date(raw.end).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}${raw.calendarName ? ` (${raw.calendarName})` : ""}`}
            >
              {raw.title}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AutoTodo {
  id: string;
  text: string;
  source: "linear" | "github" | "slack" | "calendar";
  sourceItemId: string; // maps to TodoItem.id for dismissing
  url?: string | null;
}

function buildAutoTodos(items: TodoItem[]): AutoTodo[] {
  const autoTodos: AutoTodo[] = [];

  for (const item of items) {
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};

    if (item.source === "linear") {
      const state = raw.state as string;
      if (state === "In Progress") {
        autoTodos.push({ id: `auto-${item.id}`, text: `Work on ${raw.identifier}: ${raw.title}`, source: "linear", sourceItemId: item.id, url: item.url });
      } else if (state === "In Review") {
        autoTodos.push({ id: `auto-${item.id}`, text: `Follow up on ${raw.identifier} (in review)`, source: "linear", sourceItemId: item.id, url: item.url });
      } else if (state === "Todo" && raw.priority != null && raw.priority <= 2) {
        autoTodos.push({ id: `auto-${item.id}`, text: `Start ${raw.identifier}: ${raw.title}`, source: "linear", sourceItemId: item.id, url: item.url });
      }
    }

    if (item.source === "github") {
      if (raw.reviewRequested) {
        autoTodos.push({ id: `auto-${item.id}`, text: `Review PR: ${raw.title} (${raw.repo}#${raw.id})`, source: "github", sourceItemId: item.id, url: item.url });
      } else {
        const checks = raw.checks ?? [];
        const failing = checks.filter((c: { conclusion: string }) => c.conclusion === "failure").length;
        const hasConflicts = raw.mergeableState === "dirty" || raw.mergeable === false;
        if (hasConflicts) {
          autoTodos.push({ id: `auto-${item.id}`, text: `Fix conflicts on ${raw.repo}#${raw.id}: ${raw.title}`, source: "github", sourceItemId: item.id, url: item.url });
        } else if (failing > 0) {
          autoTodos.push({ id: `auto-${item.id}`, text: `Fix ${failing} failing check(s) on ${raw.repo}#${raw.id}`, source: "github", sourceItemId: item.id, url: item.url });
        } else if (raw.mergeable && failing === 0 && checks.length > 0) {
          autoTodos.push({ id: `auto-${item.id}`, text: `Merge ${raw.repo}#${raw.id}: ${raw.title}`, source: "github", sourceItemId: item.id, url: item.url });
        }
      }
    }

    // Slack handled below (grouped by channel)


    if (item.source === "calendar") {
      if (raw.responseStatus === "needsAction") {
        const time = raw.allDay ? "" : ` at ${new Date(raw.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
        autoTodos.push({ id: `auto-${item.id}`, text: `RSVP to ${raw.title}${time}`, source: "calendar", sourceItemId: item.id, url: item.url });
      }
    }
  }

  // Group Slack by channel — one todo per channel with unread messages
  const slackByChannel = new Map<string, { count: number; lastItem: TodoItem; lastText: string }>();
  for (const item of items) {
    if (item.source !== "slack") continue;
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    const ch = raw.channelName as string ?? "";
    if (!raw.isUnread) continue;
    const existing = slackByChannel.get(ch);
    if (!existing) {
      slackByChannel.set(ch, { count: 1, lastItem: item, lastText: raw.text ?? "" });
    } else {
      existing.count++;
      // Keep the most recent
      if (parseFloat(raw.timestamp ?? "0") > parseFloat(JSON.parse(existing.lastItem.raw_data ?? "{}").timestamp ?? "0")) {
        existing.lastItem = item;
        existing.lastText = raw.text ?? "";
      }
    }
  }
  for (const [ch, { count, lastItem }] of slackByChannel) {
    const isDm = ch.startsWith("DM:");
    const label = isDm ? ch.slice(4) : `#${ch}`;
    autoTodos.push({
      id: `auto-slack-${ch}`,
      text: `Reply to ${label}${count > 1 ? ` (${count} messages)` : ""}`,
      source: "slack",
      sourceItemId: lastItem.id,
      url: lastItem.url,
    });
  }

  return autoTodos;
}

function TodoSection({ todos, onRefresh, focusedTodoIds, onToggleFocusTodo, agentSessions, onOpenAgentSession, onImageClick }: {
  todos: { id: string; text: string; done: number; date: string | null; deadline?: string | null; image?: string | null; note?: string | null; agent_enabled?: number; source?: string | null; source_id?: string | null; completed_at?: string | null }[];
  onRefresh: () => void;
  focusedTodoIds?: string[];
  onToggleFocusTodo?: (id: string) => void;
  agentSessions?: Record<string, { id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; tool_calls?: string }>;
  onOpenAgentSession?: (sessionId: string) => void;
  onImageClick?: (src: string) => void;
}) {
  const [newTodo, setNewTodo] = useState("");
  const [noDate, setNoDate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [doneLimit, setDoneLimit] = useState(15);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const addPendingImage = (dataUrl: string) => {
    setPendingImages(prev => [...prev, dataUrl]);
    if (!newTodo.trim()) setNewTodo("Screenshot");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => addPendingImage(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => addPendingImage(reader.result as string);
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  };



  const addTodo = async () => {
    const text = newTodo.trim();
    if (!text && pendingImages.length === 0) return;
    setNewTodo("");
    const images = [...pendingImages];
    setPendingImages([]);
    // Store as JSON array if multiple, or single string for backward compat
    const image = images.length > 1 ? JSON.stringify(images) : images[0] ?? null;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text || "Screenshot", date: noDate ? null : undefined, image }),
    });
    onRefresh();
  };

  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [agentPromptModal, setAgentPromptModal] = useState<{ todoId: string; todoText: string; source?: string; sourceId?: string } | null>(null);
  const [agentPromptText, setAgentPromptText] = useState("");

  const toggleAgent = async (id: string, enabled: boolean) => {
    if (enabled) {
      // Show modal to optionally add a task-specific prompt
      const todo = todos.find(t => t.id === id);
      setAgentPromptText("");
      setAgentPromptModal({ todoId: id, todoText: todo?.text ?? "", source: todo?.source ?? undefined, sourceId: todo?.source_id ?? undefined });
    } else {
      await fetch("/api/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, agent_enabled: false }),
      });
      onRefresh();
    }
  };

  const submitAgentPrompt = async (skipPrompt?: boolean) => {
    if (!agentPromptModal) return;
    const prompt = skipPrompt ? undefined : agentPromptText.trim() || undefined;
    await fetch("/api/agent/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todo_id: agentPromptModal.todoId, agent_prompt: prompt }),
    });
    setAgentPromptModal(null);
    setAgentPromptText("");
    onRefresh();
  };

  const startClanker = async () => {
    if (!agentPromptModal) return;
    const extra = agentPromptText.trim();
    const prompt = extra ? `${extra}\n\n${agentPromptModal.todoText}` : agentPromptModal.todoText;
    const res = await fetch("/api/clanker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        source: agentPromptModal.source,
        sourceId: agentPromptModal.sourceId,
      }),
    });
    const data = await res.json();
    setAgentPromptModal(null);
    setAgentPromptText("");
    if (data?.id) {
      window.open(`${window.location.protocol}//${window.location.hostname}:3001/sessions/${data.id}`, "_blank");
    }
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const handleDragEnd = async () => {
    if (dragId && dragOverId && dragId !== dragOverId) {
      const undone = todos.filter((t) => !t.done);
      const fromIdx = undone.findIndex((t) => t.id === dragId);
      const toIdx = undone.findIndex((t) => t.id === dragOverId);
      if (fromIdx >= 0 && toIdx >= 0) {
        const reordered = [...undone];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        const order = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
        await fetch("/api/todos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        });
        onRefresh();
      }
    }
    setDragId(null);
    setDragOverId(null);
  };

  const toggleTodo = async (id: string, done: boolean, note?: string) => {
    if (done) {
      setCompletingIds((prev) => new Set(prev).add(id));
      await fetch("/api/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done, ...(note ? { note } : {}) }),
      });
      setTimeout(() => {
        setCompletingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
        onRefresh();
      }, 400);
    } else {
      await fetch("/api/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done }),
      });
      onRefresh();
    }
  };

  const startNoting = (id: string) => {
    setNotingId(id);
    setNoteText("");
  };

  const submitNote = (id: string) => {
    const note = noteText.trim();
    setNotingId(null);
    setNoteText("");
    toggleTodo(id, true, note || undefined);
  };

  const deleteTodo = async (id: string) => {
    await fetch("/api/todos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onRefresh();
  };

  const saveEdit = async (id: string) => {
    if (editText.trim()) {
      await fetch("/api/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, text: editText.trim() }),
      });
    }
    setEditingId(null);
    onRefresh();
  };

  const undoneTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done).reverse();

  return (
    <div className="divide-y divide-border/40">
      {/* Undone todos */}
      {undoneTodos.map((todo) => (
        <div
          key={todo.id}
          id={`todo-${todo.id}`}
          draggable
          onDragStart={() => handleDragStart(todo.id)}
          onDragOver={(e) => handleDragOver(e, todo.id)}
          onDragEnd={handleDragEnd}
          className={`group/todo py-1.5 transition-all duration-400 ${completingIds.has(todo.id) ? "opacity-40 line-through scale-95 translate-x-2" : ""} ${dragId === todo.id ? "opacity-30" : ""} ${dragOverId === todo.id && dragId !== todo.id ? "border-t-2 border-accent" : ""} cursor-grab active:cursor-grabbing`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleTodo(todo.id, true)}
              className={`shrink-0 transition-colors ${completingIds.has(todo.id) ? "text-green-400" : "text-muted/40 hover:text-muted"}`}
            >
              {completingIds.has(todo.id) ? <CheckSquare size={14} /> : <Square size={14} />}
            </button>
            <button
              onClick={() => startNoting(todo.id)}
              className="shrink-0 opacity-0 group-hover/todo:opacity-100 text-muted/30 hover:text-green-400 transition-all -ml-1"
              title="Complete with note"
            >
              <MessageSquare size={11} />
            </button>
            {editingId === todo.id ? (
              <textarea
                ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                value={editText}
                onChange={(e) => { setEditText(e.target.value); const el = e.target; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                onBlur={() => saveEdit(todo.id)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(todo.id); } if (e.key === "Escape") setEditingId(null); }}
                autoFocus
                rows={1}
                className="flex-1 bg-transparent text-xs focus:outline-none border-b border-accent/50 resize-none"
              />
            ) : (
              <span
                className="flex-1 text-xs whitespace-pre-wrap"
                onDoubleClick={() => { setEditingId(todo.id); setEditText(todo.text); }}
              >
                {todo.text}
              </span>
            )}
          {focusedTodoIds?.includes(todo.id) && (
            <span className="text-[9px] text-sky-400 font-medium shrink-0 flex items-center gap-0.5"><Play size={8} fill="currentColor" /> Focused</span>
          )}
          {todo.source && todo.source_id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (todo.source && todo.source_id) scrollToSourceItem(todo.source, todo.source_id);
              }}
              className={`text-[9px] shrink-0 flex items-center gap-0.5 hover:underline cursor-pointer ${todo.source === "linear" ? "text-violet-400/60 hover:text-violet-400" : todo.source === "github" ? "text-orange-400/60 hover:text-orange-400" : "text-muted/40 hover:text-muted"}`}
              title={`Scroll to ${todo.source} item`}
            >
              {todo.source === "linear" ? <CircleDot size={8} /> : todo.source === "github" ? <GitPullRequest size={8} /> : null}
              {todo.source}
            </button>
          )}
          {todo.date === null && <span className="text-[9px] text-muted/30 shrink-0">persistent</span>}
          {/* Agent session status badge */}
          {agentSessions?.[todo.id] && (() => {
            const session = agentSessions[todo.id];
            if (session.status === "running") return <span className="text-[9px] text-purple-400 font-medium shrink-0 flex items-center gap-0.5"><Loader2 size={8} className="animate-spin" /> Agent</span>;
            if (session.status === "completed") return <span className="text-[9px] text-green-400 font-medium shrink-0 flex items-center gap-0.5"><CheckCircle size={8} /> Done</span>;
            if (session.status === "incomplete") return <span className="text-[9px] text-amber-400 font-medium shrink-0 flex items-center gap-0.5"><AlertCircle size={8} /> Incomplete</span>;
            if (session.status === "failed") return <span className="text-[9px] text-red-400 font-medium shrink-0 flex items-center gap-0.5"><XCircle size={8} /> Failed</span>;
            return null;
          })()}
          {onToggleFocusTodo && (
            <button
              onClick={() => onToggleFocusTodo(todo.id)}
              className={`opacity-0 group-hover/todo:opacity-100 transition-all p-1 ${focusedTodoIds?.includes(todo.id) ? "text-sky-400 hover:text-muted !opacity-100" : "text-muted/50 hover:text-sky-400"}`}
              title={focusedTodoIds?.includes(todo.id) ? "Remove focus" : "Focus"}
            >
              {focusedTodoIds?.includes(todo.id) ? <Pause size={13} /> : <Play size={13} />}
            </button>
          )}
          <button
            onClick={() => toggleAgent(todo.id, !todo.agent_enabled)}
            className={`opacity-0 group-hover/todo:opacity-100 transition-all p-1 ${todo.agent_enabled ? "text-purple-400 hover:text-muted !opacity-100" : "text-muted/50 hover:text-purple-400"}`}
            title={todo.agent_enabled ? "Disable AI agent" : "Run with AI agent"}
          >
            <Bot size={13} />
          </button>
          <button
            onClick={() => deleteTodo(todo.id)}
            className="opacity-0 group-hover/todo:opacity-100 text-muted/50 hover:text-red-400 transition-all p-1"
          >
            <Trash2 size={13} />
          </button>
          </div>
          {notingId === todo.id && (
            <div className="ml-5 mt-1 flex items-center gap-1.5">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitNote(todo.id); } if (e.key === "Escape") setNotingId(null); }}
                placeholder="Add a note..."
                autoFocus
                rows={3}
                className="flex-1 bg-card border border-border rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-accent/50 resize-y min-h-[60px]"
              />
              <button onClick={() => submitNote(todo.id)} className="text-green-400 hover:text-green-300 text-[10px] font-medium">Done</button>
              <button onClick={() => setNotingId(null)} className="text-muted/50 hover:text-muted text-[10px]">Cancel</button>
            </div>
          )}
          {todo.image && (
            <div className="ml-5 mt-0.5 mb-1 flex gap-1 flex-wrap">
              {(todo.image.startsWith("[") ? JSON.parse(todo.image) as string[] : [todo.image]).map((img, idx) => (
                <img key={idx} src={img} alt="" className="h-16 rounded border border-border/50 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onImageClick?.(img)} />
              ))}
            </div>
          )}
          {/* Agent session — collapsible chat brief + follow-up */}
          {agentSessions?.[todo.id] && (
            <AgentSessionInline
              session={agentSessions[todo.id]}
              onOpenChat={onOpenAgentSession}
              onRefresh={onRefresh}
            />
          )}
        </div>
      ))}

      {/* Add new todo */}
      <div
        className={`py-1 transition-colors ${dragOver ? "bg-accent/10 rounded border border-dashed border-accent/30" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {pendingImages.length > 0 && (
          <div className="flex items-center gap-2 mb-1 ml-5 flex-wrap">
            {pendingImages.map((img, idx) => (
              <div key={idx} className="relative">
                <img src={img} alt="preview" className="h-12 rounded border border-border/50" />
                <button onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-background rounded-full text-muted/50 hover:text-red-400 text-[10px]"><X size={10} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-start gap-2">
          <Plus size={14} className="text-muted/30 shrink-0 mt-0.5" />
          <textarea
            ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
            value={newTodo}
            onChange={(e) => { setNewTodo(e.target.value); const el = e.target; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTodo(); } }}
            onPaste={handlePaste}
            placeholder={dragOver ? "Drop image here..." : "Add a task..."}
            id="todo-input"
            rows={1}
            className="flex-1 bg-transparent text-xs placeholder:text-muted/30 focus:outline-none resize-none"
          />
          <button
            onClick={() => setNoDate(!noDate)}
            className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${noDate ? "bg-accent/20 text-accent" : "text-muted/30 hover:text-muted/50"}`}
            title={noDate ? "Persistent (no date)" : "Today only"}
          >
            {noDate ? "persistent" : "today"}
          </button>
        </div>
      </div>

      {/* Done items */}
      {doneTodos.length > 0 && (
        <div className="pt-1 border-t border-border/30">
          <button
            onClick={() => setShowDone(!showDone)}
            className="flex items-center gap-1.5 text-[10px] text-muted/50 hover:text-muted/80 transition-colors py-0.5 w-full"
          >
            {showDone ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {doneTodos.length} completed
          </button>
          {showDone && (<>
            {doneTodos.slice(0, doneLimit).map((todo) => (
              <div key={todo.id} id={`todo-${todo.id}`} className="group/todo py-0.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTodo(todo.id, false)}
                    className="shrink-0 text-green-400/60 transition-colors"
                  >
                    <CheckSquare size={14} />
                  </button>
                  <span className="flex-1 text-xs line-through text-muted decoration-muted/30" data-tooltip={todo.note || undefined}>{todo.text}</span>
                  {todo.completed_at && (
                    <span className="text-[9px] text-muted/40 shrink-0">{new Date(todo.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                  {todo.note && (
                    <span className="text-accent/50 hover:text-accent transition-colors" data-tooltip={todo.note}><MessageSquare size={11} /></span>
                  )}
                  {agentSessions?.[todo.id] && onOpenAgentSession && (
                    <button
                      onClick={() => onOpenAgentSession(agentSessions[todo.id].id)}
                      className="text-[9px] text-purple-400/50 hover:text-purple-400 transition-colors flex items-center gap-0.5"
                      title="View agent session"
                    >
                      <Bot size={9} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover/todo:opacity-100 text-muted/30 hover:text-red-400 transition-all p-0.5"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
            {doneTodos.length > doneLimit && (
              <button
                onClick={() => setDoneLimit((prev) => prev + 15)}
                className="text-[10px] text-muted/50 hover:text-muted/80 transition-colors py-1 w-full text-center"
              >
                Load more ({doneTodos.length - doneLimit} remaining)
              </button>
            )}
          </>)}
        </div>
      )}

      {/* Agent prompt modal */}
      {agentPromptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setAgentPromptModal(null)}>
          <div className="bg-card border border-border rounded-lg p-4 w-[440px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-1">Run with AI Agent</h3>
            <p className="text-[11px] text-muted mb-3 truncate">{agentPromptModal.todoText}</p>
            <textarea
              autoFocus
              value={agentPromptText}
              onChange={(e) => setAgentPromptText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitAgentPrompt(); }
                if (e.key === "Escape") setAgentPromptModal(null);
              }}
              placeholder="Optional: Add specific instructions for this task..."
              rows={3}
              className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-accent resize-y min-h-[60px]"
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-[10px] text-muted/50">{agentPromptText.trim() ? "\u2318+Enter to run" : "\u2318+Enter or click Run"}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAgentPromptModal(null)} className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors">Cancel</button>
                <button onClick={() => startClanker()} className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors flex items-center gap-1.5">
                  <Zap size={12} />
                  Clanker
                </button>
                <button onClick={() => submitAgentPrompt()} className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-1.5">
                  <Bot size={12} />
                  {agentPromptText.trim() ? "Run with instructions" : "Run"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemList({ items, setItems, onDismiss, dailyTodos, onRefreshTodos, onChatAbout, repoStatuses, slackUserId, agentSessions, onOpenAgentSession, onImageClick, quickReplies }: {
  items: TodoItem[];
  setItems: React.Dispatch<React.SetStateAction<TodoItem[]>>;
  onDismiss: (item: TodoItem) => void;
  dailyTodos: { id: string; text: string; done: number; date: string; deadline?: string | null; image?: string | null; note?: string | null; agent_enabled?: number; source?: string | null; source_id?: string | null; completed_at?: string | null }[];
  onRefreshTodos: () => void;
  onChatAbout: (prompt: string, prInfo?: { repo: string; prNumber: number }) => void;
  repoStatuses: Record<string, string>;
  slackUserId?: string;
  agentSessions: Record<string, { id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; tool_calls?: string }>;
  onOpenAgentSession?: (sessionId: string) => void;
  onImageClick?: (src: string) => void;
  quickReplies?: string[];
}) {
  const [hideDrafts, setHideDrafts] = useLocalStorage("filter:hideDrafts", true);
  const [hiddenStatesArr, setHiddenStatesArr] = useLocalStorage<string[]>("filter:hiddenStates", ["Done", "Canceled", "Cancelled"]);
  const hiddenStates = new Set(hiddenStatesArr);
  const [hiddenReposArr, setHiddenReposArr] = useLocalStorage<string[]>("filter:hiddenRepos", []);
  const hiddenRepos = new Set(hiddenReposArr);
  const [hiddenCalendarsArr, setHiddenCalendarsArr] = useLocalStorage<string[]>("filter:hiddenCalendars", []);
  const [hiddenSlackSendersArr, setHiddenSlackSendersArr] = useLocalStorage<string[]>("filter:hiddenSlackSenders", []);
  const hiddenSlackSenders = new Set(hiddenSlackSendersArr);
  const hiddenCalendars = new Set(hiddenCalendarsArr);
  const [activeWorkCollapsed, setActiveWorkCollapsed] = useLocalStorage("ui:activeWorkCollapsed", false);
  const [myTasksCollapsed, setMyTasksCollapsed] = useLocalStorage("ui:myTasksCollapsed", false);
  const [calendarCollapsed, setCalendarCollapsed] = useLocalStorage("ui:calendarCollapsed", false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [calendarHeight, setCalendarHeight] = useState(0);
  useEffect(() => {
    if (!calendarRef.current) return;
    const ro = new ResizeObserver(() => setCalendarHeight(calendarRef.current?.offsetHeight ?? 0));
    ro.observe(calendarRef.current);
    return () => ro.disconnect();
  }, []);
  const toggleCalendar = (calName: string) => {
    setHiddenCalendarsArr((prev) => {
      const s = new Set(prev);
      if (s.has(calName)) s.delete(calName);
      else s.add(calName);
      return [...s];
    });
  };
  const [linearStates, setLinearStates] = useState<{ id: string; name: string; type: string }[]>([]);
  const [linearMembers, setLinearMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // Focused items (pinned to Active Work section)
  const [focusedKeysArr, setFocusedKeysArr] = useLocalStorage<string[]>("ui:focusedKeys", []);
  const focusedKeys = new Set(focusedKeysArr);
  const focusedItems = items.filter((i) => focusedKeys.has(`${i.source}:${i.source_id}`));
  const focusedTodoIds = focusedKeysArr.filter(k => k.startsWith("todo:")).map(k => k.slice(5));
  const [fadingOutKey, setFadingOutKey] = useState<string | null>(null);
  const toggleFocus = useCallback((item: TodoItem) => {
    const key = `${item.source}:${item.source_id}`;
    const isFocused = focusedKeys.has(key);
    // Log focus/unfocus behavior
    fetch("/api/behavior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: isFocused ? "unfocus" : "focus",
        source: item.source,
        source_id: item.source_id,
        item_title: item.title,
        item_context: (() => { try { const r = JSON.parse(item.raw_data ?? "{}"); return { source: item.source, ...(item.source === "github" ? { author: r.author, repo: r.repo } : item.source === "slack" ? { channel: r.channelName, sender: r.senderName } : item.source === "linear" ? { state: r.state, priority: r.priority } : {}) }; } catch { return { source: item.source }; } })(),
      }),
    }).catch(() => {});
    if (isFocused) {
      setFocusedKeysArr(prev => prev.filter(k => k !== key));
    } else {
      setFadingOutKey(key);
      setTimeout(() => {
        setFocusedKeysArr(prev => [...prev, key]);
        setFadingOutKey(null);
      }, 300);
    }
  }, [focusedKeys, setFocusedKeysArr]);
  const toggleFocusTodo = useCallback((todoId: string) => {
    const key = `todo:${todoId}`;
    setFocusedKeysArr(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, [setFocusedKeysArr]);

  // Chat about + set focus: returns an onChatAbout wrapper for a specific item
  const chatAboutItem = useCallback((item: TodoItem) => (prompt: string, prInfo?: { repo: string; prNumber: number }) => {
    const key = `${item.source}:${item.source_id}`;
    setFocusedKeysArr(prev => prev.includes(key) ? prev : [...prev, key]);
    onChatAbout(prompt, prInfo);
  }, [setFocusedKeysArr, onChatAbout]);

  const agentActionForItem = useCallback((item: TodoItem) => async (prompt: string) => {
    await fetch("/api/agent/start-from-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, source: item.source, source_id: item.source_id }),
    });
    onRefreshTodos();
  }, [onRefreshTodos]);

  const createTaskActionForItem = useCallback((item: TodoItem) => async (taskText: string, agentPrompt: string) => {
    await fetch("/api/agent/start-from-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `${taskText}\n\n${agentPrompt}`, source: item.source, source_id: item.source_id }),
    });
    onRefreshTodos();
  }, [onRefreshTodos]);

  const [createTaskModal, setCreateTaskModal] = useState<{ source: string; sourceId: string; defaultText: string } | null>(null);
  const createTaskFromItem = useCallback((source: string, sourceId: string, text: string) => {
    setCreateTaskModal({ source, sourceId, defaultText: text.length > 120 ? text.slice(0, 120) + "..." : text });
  }, []);
  const submitCreateTask = useCallback(async (text: string) => {
    if (!createTaskModal || !text.trim()) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), source: createTaskModal.source, source_id: createTaskModal.sourceId }),
    });
    setCreateTaskModal(null);
    onRefreshTodos();
  }, [createTaskModal, onRefreshTodos]);

  // Recently hidden
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissedItems, setDismissedItems] = useState<TodoItem[]>([]);
  const loadDismissed = async () => {
    const res = await fetch("/api/dismiss");
    setDismissedItems(await res.json());
  };
  const handleUndismiss = async (item: TodoItem) => {
    await fetch("/api/dismiss", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: item.source, source_id: item.source_id }),
    });
    setDismissedItems((prev) => prev.filter((d) => d.id !== item.id));
    setItems((prev) => [...prev, item]);
  };

  // AI features
  const [aiPriorities, setAiPriorities] = useState<{ id: string; priority: number; reason: string; action: string }[]>([]);
  const [aiPrioritizing, setAiPrioritizing] = useState(false);
  const [standupText, setStandupText] = useState("");
  const [standupLoading, setStandupLoading] = useState(false);
  const standupRef = useRef("");

  // Behavior learning
  const [behaviorStats, setBehaviorStats] = useState<{ total: number; byAction: Record<string, number>; bySource: Record<string, number>; since: string | null } | null>(null);
  const [learnedPatterns, setLearnedPatterns] = useState<{ id: string; pattern: string; category: string; confidence: number; evidence_count: number }[]>([]);
  const [predictions, setPredictions] = useState<{ source: string; source_id: string; predicted_action: string; confidence: number; reason: string }[]>([]);
  const [analyzingBehavior, setAnalyzingBehavior] = useState(false);
  const [predictingBehavior, setPredictingBehavior] = useState(false);

  // Load behavior stats on mount
  useEffect(() => {
    fetch("/api/behavior").then(r => r.json()).then(data => {
      setBehaviorStats(data.stats);
      setLearnedPatterns(data.patterns ?? []);
    }).catch(() => {});
  }, []);

  const handleAnalyzeBehavior = async () => {
    setAnalyzingBehavior(true);
    try {
      const res = await fetch("/api/behavior/analyze", { method: "POST" });
      const data = await res.json();
      if (data.patterns) setLearnedPatterns(data.patterns);
      if (data.stats) setBehaviorStats(data.stats);
    } finally {
      setAnalyzingBehavior(false);
    }
  };

  const handlePredictBehavior = async () => {
    setPredictingBehavior(true);
    try {
      const res = await fetch("/api/behavior/predict", { method: "POST" });
      const data = await res.json();
      if (data.predictions) setPredictions(data.predictions);
    } finally {
      setPredictingBehavior(false);
    }
  };

  // Build prediction lookup map
  const predictionMap = new Map(predictions.map(p => [`${p.source}:${p.source_id}`, p]));

  const handlePrioritize = async () => {
    setAiPrioritizing(true);
    try {
      const res = await fetch("/api/ai/prioritize", { method: "POST" });
      const data = await res.json();
      setAiPriorities(data);
    } finally {
      setAiPrioritizing(false);
    }
  };

  const handleStandup = async () => {
    setStandupLoading(true);
    standupRef.current = "";
    setStandupText("");
    try {
      const res = await fetch("/api/ai/standup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hiddenCalendars: hiddenCalendarsArr,
          hiddenStates: hiddenStatesArr,
          hiddenRepos: hiddenReposArr,
          hideDrafts,
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const { text: chunk } = JSON.parse(line.slice(6));
              standupRef.current += chunk;
              setStandupText(standupRef.current);
            } catch { /* skip */ }
          }
        }
      }
    } finally {
      setStandupLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/linear/states").then((r) => r.json()).then(setLinearStates).catch(() => {});
    fetch("/api/linear/members").then((r) => r.json()).then(setLinearMembers).catch(() => {});
  }, []);

  // Filter items by user preferences (used for urgent sections and browse tabs)
  const filteredItems = items.filter((i) => {
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    if (i.source === "calendar" && hiddenCalendars.has(raw.calendarName)) return false;
    if (i.source === "linear" && hiddenStates.has(raw.state)) return false;
    if (i.source === "github" && hiddenRepos.has(raw.repo)) return false;
    if (i.source === "github" && hideDrafts && raw.draft) return false;
    if (i.source === "slack" && hiddenSlackSenders.size > 0) {
      const senderName = (raw.senderName ?? raw.sender ?? "").toLowerCase();
      for (const hidden of hiddenSlackSenders) {
        if (senderName.includes(hidden.toLowerCase())) return false;
      }
    }
    return true;
  }).filter((i) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (i.title.toLowerCase().includes(q)) return true;
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    if (raw.identifier?.toLowerCase().includes(q)) return true;
    if (raw.description?.toLowerCase().includes(q)) return true;
    if (raw.body?.toLowerCase().includes(q)) return true;
    if (raw.repo?.toLowerCase().includes(q)) return true;
    if (raw.project?.toLowerCase().includes(q)) return true;
    if (raw.channelName?.toLowerCase().includes(q)) return true;
    if (raw.senderName?.toLowerCase().includes(q)) return true;
    if (raw.state?.toLowerCase().includes(q)) return true;
    return false;
  });

  // Filter todos by search
  const searchedTodos = searchQuery.trim()
    ? dailyTodos.filter(t => t.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : dailyTodos;

  // Update a Linear item's raw_data locally after a state/assignee change
  const onUpdateItem = useCallback((itemId: string, updates: Record<string, unknown>) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
      const newRaw = { ...raw, ...updates };
      return { ...item, raw_data: JSON.stringify(newRaw) };
    }));
  }, [setItems]);

  // Build urgent sections for the action queue
  const urgentSections = buildUrgentSections(filteredItems, slackUserId);
  const totalUrgent = urgentSections.reduce((sum, s) => sum + s.itemIds.size, 0);

  // Helper: is this item focused? (exclude from regular sections, but allow fading items through)
  const isItemFocused = (i: TodoItem) => focusedKeys.has(`${i.source}:${i.source_id}`) && fadingOutKey !== `${i.source}:${i.source_id}`;
  const isItemFadingOut = (i: TodoItem) => fadingOutKey === `${i.source}:${i.source_id}`;

  // Build map: source+source_id -> agent tasks (todos with agent sessions linked to this item)
  const itemAgentTasks = new Map<string, typeof dailyTodos>();
  for (const todo of dailyTodos) {
    if (!todo.source || !todo.source_id) continue;
    if (!agentSessions[todo.id]) continue;
    const key = `${todo.source}:${todo.source_id}`;
    if (!itemAgentTasks.has(key)) itemAgentTasks.set(key, []);
    itemAgentTasks.get(key)!.push(todo);
  }

  // Filtered items for browse tabs
  const linearItems = filteredItems.filter((i) => {
    if (i.source !== "linear") return false;
    if (isItemFocused(i)) return false;
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    if (hiddenStates.has(raw.state)) return false;
    return true;
  });

  const githubItems = filteredItems.filter((i) => {
    if (i.source !== "github") return false;
    if (isItemFocused(i)) return false;
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    if (hideDrafts && raw.draft) return false;
    if (hiddenRepos.has(raw.repo)) return false;
    return true;
  });

  // All repos for filter
  const allRepos = new Set<string>();
  items.filter((i) => i.source === "github").forEach((i) => {
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    if (raw.repo) allRepos.add(raw.repo);
  });

  const toggleRepo = (repo: string) => {
    setHiddenReposArr((prev) => {
      const s = new Set(prev);
      if (s.has(repo)) s.delete(repo);
      else s.add(repo);
      return [...s];
    });
  };

  const slackItems = filteredItems.filter((i) => {
    if (i.source !== "slack") return false;
    if (isItemFocused(i)) return false;
    if (hiddenSlackSenders.size === 0) return true;
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    const senderName = (raw.senderName ?? raw.sender ?? "").toLowerCase();
    for (const hidden of hiddenSlackSenders) {
      if (senderName.includes(hidden.toLowerCase())) return false;
    }
    return true;
  });

  const [githubGroupBy, setGithubGroupBy] = useLocalStorage<"repo" | "author" | "assignee" | "status">("filter:githubGroupBy", "repo");
  const [githubGroupBy2, setGithubGroupBy2] = useLocalStorage<"none" | "repo" | "author" | "assignee" | "status">("filter:githubGroupBy2", "none");

  function getGithubGroupKey(raw: Record<string, unknown>, mode: string): string {
    if (mode === "author") return (raw.author as string) ?? "unknown";
    if (mode === "assignee") {
      const assignees = (raw.assignees as string[]) ?? [];
      return assignees.length > 0 ? assignees.join(", ") : "unassigned";
    }
    if (mode === "status") {
      const failing = ((raw.checks as Array<{ conclusion: string }>) ?? []).filter(c => c.conclusion === "failure").length;
      const conflicts = raw.mergeableState === "dirty";
      return raw.draft ? "Draft" : failing > 0 ? "Failing checks" : conflicts ? "Has conflicts" : raw.mergeable ? "Ready to merge" : "Open";
    }
    return (raw.repo as string) ?? "unknown";
  }

  const githubGrouped = new Map<string, TodoItem[]>();
  for (const item of githubItems) {
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    const key = getGithubGroupKey(raw, githubGroupBy);
    if (!githubGrouped.has(key)) githubGrouped.set(key, []);
    githubGrouped.get(key)!.push(item);
  }

  const [linearGroupBy, setLinearGroupBy] = useLocalStorage<"state" | "project" | "initiative" | "repo">("filter:linearGroupBy", "state");
  const [linearGroupBy2, setLinearGroupBy2] = useLocalStorage<"none" | "state" | "project" | "initiative" | "repo">("filter:linearGroupBy2", "none");

  function getLinearGroupKey(raw: Record<string, unknown>, mode: string): string {
    if (mode === "repo") {
      const ghAttachment = ((raw.attachments as Array<{ sourceType?: string; url?: string }>) ?? []).find(a => a.sourceType === "github" && a.url);
      if (ghAttachment) {
        const match = ghAttachment.url.match(/github\.com\/([^/]+\/[^/]+)/);
        return match ? match[1] : "No Repo";
      }
      return "No Repo";
    }
    if (mode === "project") return (raw.project as string) ?? "No Project";
    if (mode === "initiative") return (raw.initiative as string) ?? "No Initiative";
    return (raw.state as string) ?? "Unknown";
  }

  const linearGrouped = new Map<string, TodoItem[]>();
  for (const item of linearItems) {
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    const key = getLinearGroupKey(raw, linearGroupBy);
    if (!linearGrouped.has(key)) linearGrouped.set(key, []);
    linearGrouped.get(key)!.push(item);
  }

  // Slack by channel
  const slackByChannel = new Map<string, TodoItem[]>();
  for (const item of slackItems) {
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    const ch = raw.channelName ?? "unknown";
    if (!slackByChannel.has(ch)) slackByChannel.set(ch, []);
    slackByChannel.get(ch)!.push(item);
  }
  for (const [, channelItems] of slackByChannel) {
    channelItems.sort((a, b) => {
      const aRaw = a.raw_data ? JSON.parse(a.raw_data) : {};
      const bRaw = b.raw_data ? JSON.parse(b.raw_data) : {};
      return parseFloat(aRaw.timestamp ?? "0") - parseFloat(bRaw.timestamp ?? "0");
    });
  }
  const sortedChannels = Array.from(slackByChannel.entries()).sort((a, b) => {
    // Sort channels by most recent message (last item, since messages are chronological)
    const aLatest = a[1][a[1].length - 1];
    const bLatest = b[1][b[1].length - 1];
    const aTs = aLatest?.raw_data ? parseFloat(JSON.parse(aLatest.raw_data).timestamp ?? "0") : 0;
    const bTs = bLatest?.raw_data ? parseFloat(JSON.parse(bLatest.raw_data).timestamp ?? "0") : 0;
    return bTs - aTs;
  });

  const linearCount = items.filter((i) => i.source === "linear").length;
  const githubCount = items.filter((i) => i.source === "github").length;
  const slackCount = slackItems.length;

  return (<>
    <div>
      {/* Calendar Timeline — sticky + collapsible */}
      <div ref={calendarRef} className="sticky top-0 z-10 bg-background pb-3 pt-4">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setCalendarCollapsed(!calendarCollapsed)} className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1">
            {calendarCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            <span className="uppercase tracking-wide font-medium">Calendar</span>
          </button>
          <div className="flex-1" />
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-40 bg-card border border-border rounded pl-6 pr-6 py-1 text-[11px] focus:outline-none focus:border-accent/50 focus:w-64 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted/40 hover:text-foreground">
                <X size={10} />
              </button>
            )}
          </div>
        </div>
        {!calendarCollapsed && <CalendarTimeline items={items} onDismiss={onDismiss} hiddenCalendars={hiddenCalendars} onToggleCalendar={toggleCalendar} />}
      </div>

      {/* Main content + Filters sidebar */}
      <div className="flex gap-4" style={{ "--sticky-top": `${calendarHeight}px` } as React.CSSProperties}>
      <div className="flex-1 min-w-0">
        <div className="space-y-4">
          {/* Active Work — focused items + agent tasks */}
          {(() => {
            // Agent tasks: todos with running/completed agent sessions (not yet marked done)
            const agentTasks = dailyTodos.filter(t => !t.done && agentSessions[t.id]);
            // Focused todos (manual, no agent)
            const focusedTodos = dailyTodos.filter(t => !t.done && focusedTodoIds.includes(t.id) && !agentSessions[t.id]);
            const hasActiveWork = focusedItems.length > 0 || focusedTodos.length > 0 || agentTasks.length > 0;
            if (!hasActiveWork) return null;
            return (
              <div className="space-y-1">
                <button onClick={() => setActiveWorkCollapsed(!activeWorkCollapsed)} className="w-full flex items-center gap-2 text-xs text-muted mb-1 px-1 hover:text-foreground transition-colors sticky bg-background z-[5] py-1 relative before:content-[''] before:absolute before:inset-x-0 before:-top-3 before:h-3 before:bg-background" style={{ top: "var(--sticky-top)" }}>
                  {activeWorkCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <Play size={10} className="text-sky-400" />
                  <span>Active Work</span>
                  <span className="text-muted/50">{focusedItems.length + focusedTodos.length + agentTasks.length}</span>
                </button>
                {!activeWorkCollapsed && <div className="space-y-1.5">
                  {/* Focused items — full cards */}
                  {focusedItems.map(item => (
                    <div key={`${item.source}:${item.source_id}`} className="bg-sky-500/5 border border-sky-500/30 rounded-lg relative cursor-pointer">
                      <div className="absolute top-0 left-0 w-1 h-full bg-sky-400 rounded-l-lg" />
                      {item.source === "linear" && (
                        <LinearCard item={item} states={linearStates} members={linearMembers} onDismiss={onDismiss} onChatAbout={chatAboutItem(item)} onAgentAction={agentActionForItem(item)} onCreateTaskAction={createTaskActionForItem(item)} onUpdateItem={onUpdateItem} hiddenStates={hiddenStates} isInProgress onToggleInProgress={() => toggleFocus(item)} onCreateTask={createTaskFromItem} />
                      )}
                      {item.source === "github" && (
                        <GithubCard item={item} onDismiss={onDismiss} onChatAbout={chatAboutItem(item)} onAgentAction={agentActionForItem(item)} onCreateTaskAction={createTaskActionForItem(item)} repoStatus={repoStatuses[(item.raw_data ? JSON.parse(item.raw_data) : {}).repo]} isInProgress onToggleInProgress={() => toggleFocus(item)} onCreateTask={createTaskFromItem} />
                      )}
                      {item.source === "calendar" && (
                        <CalendarCard item={item} onDismiss={onDismiss} onChatAbout={chatAboutItem(item)} isInProgress onToggleInProgress={() => toggleFocus(item)} />
                      )}
                      {item.source === "slack" && (
                        <SlackMessage item={item} onDismiss={onDismiss} onImageClick={onImageClick} quickReplies={quickReplies} />
                      )}
                      {/* Agent tasks linked to this item */}
                      {itemAgentTasks.get(`${item.source}:${item.source_id}`)?.map(todo => {
                        const session = agentSessions[todo.id];
                        if (!session) return null;
                        const isFailed = session.status === "failed";
                        const isIncomplete = session.status === "incomplete";
                        const isRunning = session.status === "running";
                        return (
                          <div key={todo.id} className="mx-3 mb-2 border-t border-sky-500/20 pt-2">
                            <div className="flex items-center gap-2">
                              <button onClick={async () => { await fetch("/api/todos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: todo.id, done: true }) }); onRefreshTodos(); }} className="shrink-0 text-muted/40 hover:text-green-400 transition-colors" title="Mark as done"><Square size={12} /></button>
                              <span className="flex-1 text-[11px] truncate">{todo.text}</span>
                              {isRunning ? <span className="text-[9px] text-purple-400 flex items-center gap-0.5"><Loader2 size={9} className="animate-spin" /> Running</span>
                                : isFailed ? <span className="text-[9px] text-red-400 flex items-center gap-0.5"><XCircle size={9} /> Failed</span>
                                : isIncomplete ? <span className="text-[9px] text-amber-400 flex items-center gap-0.5"><AlertCircle size={9} /> Incomplete</span>
                                : <span className="text-[9px] text-green-400 flex items-center gap-0.5"><CheckCircle size={9} /> Done</span>}
                            </div>
                            <AgentSessionInline session={session} onOpenChat={onOpenAgentSession} onRefresh={onRefreshTodos} />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {/* Focused todos (manual, not linked to items) */}
                  {focusedTodos.map(todo => (
                    <div key={todo.id} className="bg-sky-500/5 border border-sky-500/30 rounded-lg relative px-4 py-2.5">
                      <div className="absolute top-0 left-0 w-1 h-full bg-sky-400 rounded-l-lg" />
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-xs font-medium">{todo.text}</span>
                        <button onClick={() => toggleFocusTodo(todo.id)} className="text-sky-400 hover:text-muted transition-colors p-1" title="Remove focus"><Pause size={12} /></button>
                      </div>
                    </div>
                  ))}
                  {/* Agent tasks NOT linked to a focused item (standalone or linked to unfocused items) */}
                  {agentTasks.filter(t => {
                    // Skip if this task is already shown under a focused item above
                    if (t.source && t.source_id) {
                      const parentKey = `${t.source}:${t.source_id}`;
                      if (focusedKeys.has(parentKey)) return false;
                    }
                    return true;
                  }).map(todo => {
                    const session = agentSessions[todo.id];
                    const isFailed = session.status === "failed";
                    const isIncomplete = session.status === "incomplete";
                    const isRunning = session.status === "running";
                    const parentItem = todo.source && todo.source_id ? items.find(i => i.source === todo.source && i.source_id === todo.source_id) : null;
                    const toggleRef = { current: null } as React.MutableRefObject<(() => void) | null>;
                    return (
                      <div key={todo.id} onClick={() => toggleRef.current?.()} className={`border rounded-lg p-2.5 cursor-pointer hover:brightness-110 transition-all ${isRunning ? "bg-purple-500/5 border-purple-500/20" : isFailed ? "bg-red-500/5 border-red-500/20" : isIncomplete ? "bg-amber-500/5 border-amber-500/20" : "bg-green-500/5 border-green-500/20"}`}>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); (async () => { await fetch("/api/todos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: todo.id, done: true }) }); onRefreshTodos(); })(); }} className="shrink-0 text-muted/40 hover:text-green-400 transition-colors" title="Mark as done"><Square size={14} /></button>
                          <span className="flex-1 text-xs font-medium truncate">{todo.text}</span>
                          {parentItem && (
                            <button onClick={(e) => { e.stopPropagation(); scrollToSourceItem(parentItem.source, parentItem.source_id); }} className={`text-[9px] shrink-0 flex items-center gap-0.5 hover:underline ${todo.source === "linear" ? "text-violet-400/60 hover:text-violet-400" : "text-orange-400/60 hover:text-orange-400"}`}>
                              {todo.source === "linear" ? <CircleDot size={8} /> : <GitPullRequest size={8} />}
                              {todo.source_id}
                            </button>
                          )}
                          {isRunning ? <span className="text-[9px] text-purple-400 flex items-center gap-0.5"><Loader2 size={9} className="animate-spin" /> Running</span>
                            : isFailed ? <span className="text-[9px] text-red-400 flex items-center gap-0.5"><XCircle size={9} /> Failed</span>
                            : isIncomplete ? <span className="text-[9px] text-amber-400 flex items-center gap-0.5"><AlertCircle size={9} /> Incomplete</span>
                            : <span className="text-[9px] text-green-400 flex items-center gap-0.5"><CheckCircle size={9} /> Done</span>}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <AgentSessionInline session={session} onOpenChat={onOpenAgentSession} onRefresh={onRefreshTodos} toggleRef={toggleRef} />
                        </div>
                      </div>
                    );
                  })}
                </div>}
              </div>
            );
          })()}

          {/* My Tasks section — manual todos only (agent tasks shown in Active Work) */}
          <div className="space-y-1">
            <button onClick={() => setMyTasksCollapsed(!myTasksCollapsed)} className="w-full flex items-center gap-2 text-xs text-muted mb-1 px-1 hover:text-foreground transition-colors sticky bg-background z-[5] py-1 relative before:content-[''] before:absolute before:inset-x-0 before:-top-3 before:h-3 before:bg-background" style={{ top: "var(--sticky-top)" }}>
              {myTasksCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <CheckSquare size={10} className="text-yellow-400" />
              <span>My Tasks</span>
            </button>
            {!myTasksCollapsed && <div className="bg-card border border-border rounded-lg px-3 py-2">
              <TodoSection todos={searchedTodos.filter(t => !agentSessions[t.id] || t.done)} onRefresh={() => { onRefreshTodos(); }} focusedTodoIds={focusedTodoIds} onToggleFocusTodo={toggleFocusTodo} agentSessions={agentSessions} onOpenAgentSession={onOpenAgentSession} onImageClick={onImageClick} />
            </div>}
          </div>

          {/* Slack section — grouped by channel */}
          {slackItems.length > 0 && (() => {
            const dmChannels = sortedChannels.filter(([ch]) => ch.startsWith("DM: ") || ch.startsWith("DM:"));
            const regularChannels = sortedChannels.filter(([ch]) => !ch.startsWith("DM:") && !ch.startsWith("DM: "));
            const totalDmMessages = dmChannels.reduce((sum, [, items]) => sum + items.length, 0);

            const renderSlackChannel = ([channel, channelItems]: [string, TodoItem[]]) => {
              const isDm = channel.startsWith("DM:");
              const label = isDm ? channel.replace(/^DM:\s*/, "") : channel;
              const dismissAll = () => channelItems.forEach((i) => onDismiss(i));
              return (
                <CollapsibleGroup key={channel} label={label} icon={isDm ? <User size={10} /> : <Hash size={10} />} count={channelItems.length} defaultOpen onDismissAll={dismissAll} nested>
                  <div className="bg-card border border-border rounded-lg divide-y divide-border/50">
                    {(() => {
                      let lastOtherIdx = -1;
                      if (isDm && slackUserId) {
                        for (let i = channelItems.length - 1; i >= 0; i--) {
                          const r = channelItems[i].raw_data ? JSON.parse(channelItems[i].raw_data!) : {};
                          if (r.sender !== slackUserId) { lastOtherIdx = i; break; }
                        }
                      }
                      // Find boundary between read and unread for "New" divider
                      let firstUnreadIdx = -1;
                      for (let i = 0; i < channelItems.length; i++) {
                        const r = channelItems[i].raw_data ? JSON.parse(channelItems[i].raw_data!) : {};
                        if (r.isUnread) { firstUnreadIdx = i; break; }
                      }
                      return channelItems.map((item, idx) => (
                        <SlackMessage
                          key={item.id}
                          item={item}
                          onDismiss={onDismiss}
                          isLast={idx === channelItems.length - 1}
                          onDismissChannel={dismissAll}
                          isContext={isDm && lastOtherIdx >= 0 && idx < lastOtherIdx}
                          showNewDivider={firstUnreadIdx > 0 && idx === firstUnreadIdx}
                          onImageClick={onImageClick}
                          quickReplies={quickReplies}
                        />
                      ));
                    })()}
                  </div>
                </CollapsibleGroup>
              );
            };

            return (
              <CollapsibleGroup label="Slack" icon={<MessageSquare size={10} className="text-emerald-400" />} count={slackItems.length} defaultOpen>
                <div className="space-y-1 ml-3 border-l border-border/30 pl-2">
                  {regularChannels.map(renderSlackChannel)}
                  {dmChannels.length > 0 && (
                    <CollapsibleGroup label="Direct Messages" icon={<User size={10} />} count={totalDmMessages} defaultOpen nested>
                      <div className="space-y-1 ml-3 border-l border-border/30 pl-2">
                        {dmChannels.map(renderSlackChannel)}
                      </div>
                    </CollapsibleGroup>
                  )}
                </div>
              </CollapsibleGroup>
            );
          })()}

          {/* GitHub section — grouped by repo/author/assignee, click twice for nested grouping */}
          {githubItems.length > 0 && (
            <CollapsibleGroup label="GitHub" icon={<GitPullRequest size={10} className="text-orange-400" />} count={githubItems.length} defaultOpen>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1 mb-1 sticky bg-background py-1" style={{ top: "calc(var(--sticky-top, 0px) + 24px)", zIndex: 4 }}>
                  <span className="text-[10px] text-muted/60">Group:</span>
                  {(["repo", "author", "assignee", "status"] as const).map((mode) => {
                    const isPrimary = githubGroupBy === mode;
                    const isSecondary = githubGroupBy2 === mode;
                    return (
                      <button key={mode} onClick={() => {
                        if (isPrimary) {
                          if (githubGroupBy2 !== "none") { setGithubGroupBy(githubGroupBy2 as typeof githubGroupBy); setGithubGroupBy2("none"); }
                        } else if (isSecondary) {
                          setGithubGroupBy2("none");
                        } else {
                          setGithubGroupBy2(mode);
                        }
                      }}
                        className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                          isPrimary ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                          isSecondary ? "bg-amber-500/15 text-amber-400/80 border border-amber-500/25" :
                          "text-muted/50 hover:text-muted"
                        }`}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
                <div className="ml-3 border-l border-border/30 pl-2 space-y-1">
                  {Array.from(githubGrouped.entries()).map(([group, groupItems]) => (
                    <CollapsibleGroup key={group} label={group} count={groupItems.length} mono={githubGroupBy === "repo"} defaultOpen stickyOffset={2}>
                      {githubGroupBy2 !== "none" ? (() => {
                        const subGrouped = new Map<string, TodoItem[]>();
                        for (const item of groupItems) {
                          const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
                          const subKey = getGithubGroupKey(raw, githubGroupBy2);
                          if (!subGrouped.has(subKey)) subGrouped.set(subKey, []);
                          subGrouped.get(subKey)!.push(item);
                        }
                        return (<div className="ml-3 border-l border-border/30 pl-2 space-y-1">{Array.from(subGrouped.entries()).map(([subGroup, subItems]) => (
                          <CollapsibleGroup key={subGroup} label={subGroup} count={subItems.length} mono={githubGroupBy2 === "repo"} defaultOpen stickyOffset={3}>
                            {subItems.map((item) => (
                              <div key={item.id} id={`item-${item.source}-${item.source_id}`} className={`transition-all duration-300 relative ${isItemFadingOut(item) ? "opacity-0 scale-95 -translate-x-2" : ""}`}>
                                {predictionMap.has(`${item.source}:${item.source_id}`) && <div className="absolute -top-1 right-2 z-10"><PredictionBadge prediction={predictionMap.get(`${item.source}:${item.source_id}`)} /></div>}
                                <GithubCard item={item} onDismiss={onDismiss} onChatAbout={chatAboutItem(item)} onAgentAction={agentActionForItem(item)} onCreateTaskAction={createTaskActionForItem(item)} repoStatus={repoStatuses[(item.raw_data ? JSON.parse(item.raw_data) : {}).repo]} isInProgress={focusedKeys.has(`${item.source}:${item.source_id}`)} onToggleInProgress={() => toggleFocus(item)} onCreateTask={createTaskFromItem} agentTasks={itemAgentTasks.get(`${item.source}:${item.source_id}`)?.map(t => ({ text: t.text, status: agentSessions[t.id]?.status ?? "unknown" }))} />
                              </div>
                            ))}
                          </CollapsibleGroup>
                        ))}</div>);
                      })() : groupItems.map((item) => (
                        <div key={item.id} id={`item-${item.source}-${item.source_id}`} className={`transition-all duration-300 relative ${isItemFadingOut(item) ? "opacity-0 scale-95 -translate-x-2" : ""}`}>
                                {predictionMap.has(`${item.source}:${item.source_id}`) && <div className="absolute -top-1 right-2 z-10"><PredictionBadge prediction={predictionMap.get(`${item.source}:${item.source_id}`)} /></div>}
                          <GithubCard item={item} onDismiss={onDismiss} onChatAbout={chatAboutItem(item)} onAgentAction={agentActionForItem(item)} onCreateTaskAction={createTaskActionForItem(item)} repoStatus={repoStatuses[(item.raw_data ? JSON.parse(item.raw_data) : {}).repo]} isInProgress={focusedKeys.has(`${item.source}:${item.source_id}`)} onToggleInProgress={() => toggleFocus(item)} onCreateTask={createTaskFromItem} agentTasks={itemAgentTasks.get(`${item.source}:${item.source_id}`)?.map(t => ({ text: t.text, status: agentSessions[t.id]?.status ?? "unknown" }))} />
                        </div>
                      ))}
                    </CollapsibleGroup>
                  ))}
                </div>
              </div>
            </CollapsibleGroup>
          )}

          {/* Linear section — grouped by state/project/initiative, click twice for nested grouping */}
          {linearItems.length > 0 && (
            <CollapsibleGroup label="Linear" icon={<CircleDot size={10} className="text-violet-400" />} count={linearItems.length} defaultOpen>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1 mb-1 sticky bg-background py-1" style={{ top: "calc(var(--sticky-top, 0px) + 24px)", zIndex: 4 }}>
                  <span className="text-[10px] text-muted/60">Group:</span>
                  {(["state", "project", "initiative", "repo"] as const).map((mode) => {
                    const isPrimary = linearGroupBy === mode;
                    const isSecondary = linearGroupBy2 === mode;
                    return (
                      <button key={mode} onClick={() => {
                        if (isPrimary) {
                          if (linearGroupBy2 !== "none") { setLinearGroupBy(linearGroupBy2 as typeof linearGroupBy); setLinearGroupBy2("none"); }
                        } else if (isSecondary) {
                          setLinearGroupBy2("none");
                        } else {
                          setLinearGroupBy2(mode);
                        }
                      }}
                        className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                          isPrimary ? "bg-violet-500/20 text-violet-400 border border-violet-500/30" :
                          isSecondary ? "bg-fuchsia-500/15 text-fuchsia-400/80 border border-fuchsia-500/25" :
                          "text-muted/50 hover:text-muted"
                        }`}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
                <div className="ml-3 border-l border-border/30 pl-2 space-y-1">
                  {Array.from(linearGrouped.entries()).map(([group, groupItems]) => (
                    <CollapsibleGroup key={group} label={group} icon={<CircleDot size={10} />} count={groupItems.length} defaultOpen stickyOffset={2}>
                      {linearGroupBy2 !== "none" ? (() => {
                        const subGrouped = new Map<string, TodoItem[]>();
                        for (const item of groupItems) {
                          const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
                          const subKey = getLinearGroupKey(raw, linearGroupBy2);
                          if (!subGrouped.has(subKey)) subGrouped.set(subKey, []);
                          subGrouped.get(subKey)!.push(item);
                        }
                        return (<div className="ml-3 border-l border-border/30 pl-2 space-y-1">{Array.from(subGrouped.entries()).map(([subGroup, subItems]) => (
                          <CollapsibleGroup key={subGroup} label={subGroup} count={subItems.length} defaultOpen stickyOffset={3}>
                            {subItems.map((item) => (
                              <div key={item.id} id={`item-${item.source}-${item.source_id}`} className={`transition-all duration-300 relative ${isItemFadingOut(item) ? "opacity-0 scale-95 -translate-x-2" : ""}`}>
                                {predictionMap.has(`${item.source}:${item.source_id}`) && <div className="absolute -top-1 right-2 z-10"><PredictionBadge prediction={predictionMap.get(`${item.source}:${item.source_id}`)} /></div>}
                                <LinearCard item={item} states={linearStates} members={linearMembers} onDismiss={onDismiss} onChatAbout={chatAboutItem(item)} onAgentAction={agentActionForItem(item)} onCreateTaskAction={createTaskActionForItem(item)} onUpdateItem={onUpdateItem} hiddenStates={hiddenStates} isInProgress={focusedKeys.has(`${item.source}:${item.source_id}`)} onToggleInProgress={() => toggleFocus(item)} onCreateTask={createTaskFromItem} agentTasks={itemAgentTasks.get(`${item.source}:${item.source_id}`)?.map(t => ({ text: t.text, status: agentSessions[t.id]?.status ?? "unknown" }))} />
                              </div>
                            ))}
                          </CollapsibleGroup>
                        ))}</div>);
                      })() : groupItems.map((item) => (
                        <div key={item.id} id={`item-${item.source}-${item.source_id}`} className={`transition-all duration-300 relative ${isItemFadingOut(item) ? "opacity-0 scale-95 -translate-x-2" : ""}`}>
                                {predictionMap.has(`${item.source}:${item.source_id}`) && <div className="absolute -top-1 right-2 z-10"><PredictionBadge prediction={predictionMap.get(`${item.source}:${item.source_id}`)} /></div>}
                          <LinearCard item={item} states={linearStates} members={linearMembers} onDismiss={onDismiss} onChatAbout={chatAboutItem(item)} onAgentAction={agentActionForItem(item)} onCreateTaskAction={createTaskActionForItem(item)} onUpdateItem={onUpdateItem} hiddenStates={hiddenStates} isInProgress={focusedKeys.has(`${item.source}:${item.source_id}`)} onToggleInProgress={() => toggleFocus(item)} onCreateTask={createTaskFromItem} agentTasks={itemAgentTasks.get(`${item.source}:${item.source_id}`)?.map(t => ({ text: t.text, status: agentSessions[t.id]?.status ?? "unknown" }))} />
                        </div>
                      ))}
                    </CollapsibleGroup>
                  ))}
                </div>
              </div>
            </CollapsibleGroup>
          )}

          {/* Recently Hidden */}
          <div>
            <div className="flex items-center gap-2 text-xs text-muted mb-1 px-1 group/header sticky bg-background z-[5] py-1 relative before:content-[''] before:absolute before:inset-x-0 before:-top-3 before:h-3 before:bg-background" style={{ top: "var(--sticky-top)" }}>
              <button onClick={() => { const next = !showDismissed; setShowDismissed(next); if (next) loadDismissed(); }} className="flex items-center gap-2 hover:text-foreground transition-colors">
                {showDismissed ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <EyeOff size={10} className="text-muted/50" />
                <span>Recently Hidden</span>
                <span className="text-muted/50">{dismissedItems.length}</span>
              </button>
            </div>
            {showDismissed && (
              <div className="space-y-1">
                {dismissedItems.length === 0 ? (
                  <div className="px-3 py-4 text-[11px] text-muted/50 text-center">No recently hidden items</div>
                ) : (
                  <div className="divide-y divide-border/20 ml-3 border-l border-border/30 pl-2">
                    {dismissedItems.map((item) => (
                      <div key={item.id} className="px-2 py-1.5 flex items-center gap-2 hover:bg-card-hover transition-colors group/dismissed rounded">
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          item.source === "slack" ? "bg-emerald-500/10 text-emerald-400" :
                          item.source === "github" ? "bg-orange-500/10 text-orange-400" :
                          item.source === "linear" ? "bg-violet-500/10 text-violet-400" :
                          "bg-sky-500/10 text-sky-400"
                        }`}>{item.source}</span>
                        <span className="flex-1 text-[11px] text-muted truncate">{item.title}</span>
                        <button
                          onClick={() => handleUndismiss(item)}
                          className="opacity-0 group-hover/dismissed:opacity-100 text-[10px] text-accent hover:underline transition-opacity shrink-0"
                        >
                          restore
                        </button>
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover/dismissed:opacity-100 text-muted hover:text-accent transition-opacity shrink-0">
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {linearItems.length === 0 && githubItems.length === 0 && slackItems.length === 0 && dailyTodos.filter(t => !t.done).length === 0 && focusedItems.length === 0 && (
            <div className="text-center py-8 text-muted">
              <CheckCircle size={32} className="mx-auto mb-3 text-green-400/50" />
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs text-muted/60 mt-1">No items need your attention right now</p>
            </div>
          )}
        </div>
      </div>

      {/* Filters sidebar */}
      <div className="w-48 shrink-0 space-y-3 sticky self-start overflow-y-auto" style={{ top: "var(--sticky-top)", maxHeight: `calc(100vh - 5rem - ${calendarHeight}px)` }}>
        <h4 className="text-[10px] uppercase tracking-wider text-muted font-semibold">Filters</h4>

        {/* Linear state filters */}
        {linearStates.length > 0 && (
          <div>
            <h5 className="text-[10px] text-muted mb-1">Linear States</h5>
            <div className="flex flex-wrap gap-1">
              {linearStates.map((state) => (
                <button
                  key={state.id}
                  onClick={() => setHiddenStatesArr(prev => {
                    const s = new Set(prev);
                    if (s.has(state.name)) s.delete(state.name); else s.add(state.name);
                    return [...s];
                  })}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                    hiddenStates.has(state.name)
                      ? "bg-card text-muted/30 line-through"
                      : "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                  }`}
                >
                  {state.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GitHub repo filters */}
        {(() => {
          const repos = new Set<string>();
          items.filter(i => i.source === "github").forEach(i => {
            const r = JSON.parse(i.raw_data ?? "{}");
            if (r.repo) repos.add(r.repo);
          });
          if (repos.size === 0) return null;
          return (
            <div>
              <h5 className="text-[10px] text-muted mb-1">GitHub Repos</h5>
              <div className="flex flex-wrap gap-1">
                {Array.from(repos).sort().map(repo => (
                  <button
                    key={repo}
                    onClick={() => setHiddenReposArr(prev => {
                      const s = new Set(prev);
                      if (s.has(repo)) s.delete(repo); else s.add(repo);
                      return [...s];
                    })}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                      hiddenRepos.has(repo)
                        ? "bg-card text-muted/30 line-through"
                        : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                    }`}
                  >
                    {repo.split("/").pop()}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => setHideDrafts(!hideDrafts)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                    hideDrafts
                      ? "bg-card text-muted/30 line-through"
                      : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                  }`}
                >
                  Drafts
                </button>
              </div>
            </div>
          );
        })()}

        {/* Calendar filters */}
        {(() => {
          const cals = new Set<string>();
          items.filter(i => i.source === "calendar").forEach(i => {
            const r = JSON.parse(i.raw_data ?? "{}");
            if (r.calendarName) cals.add(r.calendarName);
          });
          if (cals.size === 0) return null;
          return (
            <div>
              <h5 className="text-[10px] text-muted mb-1">Calendars</h5>
              <div className="flex flex-wrap gap-1">
                {Array.from(cals).sort().map(cal => (
                  <button
                    key={cal}
                    onClick={() => toggleCalendar(cal)}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                      hiddenCalendars.has(cal)
                        ? "bg-card text-muted/30 line-through"
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}
                  >
                    {cal}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Slack sender filters */}
        {(() => {
          const senders = new Map<string, number>();
          items.filter(i => i.source === "slack").forEach(i => {
            const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
            const name = raw.senderName ?? raw.sender ?? "unknown";
            senders.set(name, (senders.get(name) ?? 0) + 1);
          });
          // Known bots to always show if present
          const knownBots = ["GitHub", "Linear", "Jira", "Notion", "Asana", "Figma", "Sentry"];
          const botSenders = Array.from(senders.entries())
            .filter(([name]) => knownBots.some(b => name.toLowerCase().includes(b.toLowerCase())))
            .sort((a, b) => b[1] - a[1]);
          if (botSenders.length === 0) return null;
          return (
            <div>
              <h5 className="text-[10px] text-muted mb-1">Hide Slack Senders</h5>
              <div className="flex flex-wrap gap-1">
                {botSenders.map(([name, count]) => (
                  <button
                    key={name}
                    onClick={() => setHiddenSlackSendersArr(prev => {
                      const s = new Set(prev);
                      if (s.has(name)) s.delete(name); else s.add(name);
                      return [...s];
                    })}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                      hiddenSlackSenders.has(name)
                        ? "bg-card text-muted/30 line-through"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {name} <span className="opacity-50">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Behavior Learning */}
        <div className="border-t border-border pt-3 mt-2">
          <h4 className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2 flex items-center gap-1">
            <Sparkles size={10} className="text-amber-400" />
            Learning
          </h4>
          {behaviorStats && (
            <div className="text-[10px] text-muted/70 mb-2 space-y-0.5">
              <div>{behaviorStats.total} decisions tracked</div>
              {behaviorStats.since && <div className="text-[9px]">Since {new Date(behaviorStats.since).toLocaleDateString()}</div>}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={handleAnalyzeBehavior}
              disabled={analyzingBehavior}
              className="w-full px-2 py-1.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {analyzingBehavior ? <><Loader2 size={10} className="animate-spin" /> Analyzing...</> : "Analyze Patterns"}
            </button>
            {learnedPatterns.length > 0 && (
              <button
                onClick={handlePredictBehavior}
                disabled={predictingBehavior}
                className="w-full px-2 py-1.5 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {predictingBehavior ? <><Loader2 size={10} className="animate-spin" /> Predicting...</> : "Predict Actions"}
              </button>
            )}
          </div>
          {learnedPatterns.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="text-[10px] text-muted/50">{learnedPatterns.length} patterns learned</div>
              {learnedPatterns.slice(0, 5).map((p, i) => (
                <div key={i} className="text-[10px] p-1.5 rounded bg-card border border-border">
                  <div className="text-foreground/80 leading-tight">{p.pattern}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1 py-0.5 rounded text-[8px] ${
                      p.confidence >= 0.8 ? "bg-green-500/10 text-green-400" :
                      p.confidence >= 0.5 ? "bg-amber-500/10 text-amber-400" :
                      "bg-muted/10 text-muted"
                    }`}>
                      {Math.round(p.confidence * 100)}%
                    </span>
                    <span className="text-muted/40">{p.evidence_count} examples</span>
                    <span className="text-muted/30 capitalize">{p.category}</span>
                  </div>
                </div>
              ))}
              {learnedPatterns.length > 5 && (
                <div className="text-[9px] text-muted/40 text-center">+{learnedPatterns.length - 5} more</div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>

    {/* Create Task Modal */}
    {createTaskModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCreateTaskModal(null)}>
        <div className="bg-card border border-border rounded-lg p-4 w-[400px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold mb-3">Create Task</h3>
          <form onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.elements.namedItem("taskText") as HTMLInputElement; submitCreateTask(input.value); }}>
            <input
              name="taskText"
              autoFocus
              defaultValue={createTaskModal.defaultText}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="Task description..."
            />
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setCreateTaskModal(null)} className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors">Cancel</button>
              <button type="submit" className="px-3 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent/80 transition-colors">Create</button>
            </div>
          </form>
        </div>
      </div>
    )}
  </>);
}

function CollapsibleGroup({ label, icon, count, mono, defaultOpen = false, onDismissAll, children, storageKey, nested, stickyOffset }: {
  label: string; icon?: React.ReactNode; count: number; mono?: boolean; defaultOpen?: boolean; onDismissAll?: () => void; children: React.ReactNode; storageKey?: string; nested?: boolean; stickyOffset?: number;
}) {
  const [open, setOpen] = useLocalStorage(storageKey ?? `__cg_${label}`, defaultOpen);
  const level = stickyOffset ?? (nested ? 1 : 0);
  const zIndex = Math.max(5 - level, 1);
  const topPx = `calc(var(--sticky-top, 0px) + ${level * 24}px)`;
  return (
    <div>
      <div className={`flex items-center gap-2 text-xs text-muted mb-1 px-1 group/header sticky bg-background py-1 ${level === 0 ? "relative before:content-[''] before:absolute before:inset-x-0 before:-top-3 before:h-3 before:bg-background" : ""}`} style={{ top: topPx, zIndex }}>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 hover:text-foreground transition-colors">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {icon}
          <span className={mono ? "font-mono" : ""}>{label}</span>
          <span className="text-muted/50">{count}</span>
        </button>
        {onDismissAll && (
          <button onClick={onDismissAll} className="opacity-0 group-hover/header:opacity-100 text-red-400/50 hover:text-red-400 transition-all px-1.5 py-0.5 rounded hover:bg-red-500/10 flex items-center gap-1 text-[10px]" title="Dismiss all">
            <X size={12} /> Dismiss all
          </button>
        )}
      </div>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  );
}

function ExpandableCard({ item, summary, children, onDismiss, onChatAbout, onAgentAction, onCreateTaskAction, isInProgress, onToggleInProgress, onCreateTask }: {
  item: TodoItem; summary?: React.ReactNode; children: React.ReactNode; onDismiss?: (item: TodoItem) => void; onChatAbout?: (prompt: string) => void; onAgentAction?: (prompt: string) => void; onCreateTaskAction?: (taskText: string, agentPrompt: string) => void; isInProgress?: boolean; onToggleInProgress?: () => void; onCreateTask?: (source: string, sourceId: string, text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
  return (
    <div className="bg-card border border-border rounded-lg hover:bg-card-hover transition-colors group cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <button className="text-muted shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{item.title}</span>
          {summary && <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">{summary}</div>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onCreateTask && (
            <button onClick={(e) => { e.stopPropagation(); onCreateTask(item.source, item.source_id, item.title); }} className="text-muted hover:text-accent transition-colors p-1" title="Create task from this item">
              <Plus size={12} />
            </button>
          )}
          {onToggleInProgress && (
            <button onClick={(e) => { e.stopPropagation(); onToggleInProgress(); }} className={`transition-colors p-1 ${isInProgress ? "text-sky-400 hover:text-muted" : "text-muted hover:text-sky-400"}`} title={isInProgress ? "Stop working" : "Set In Progress"}>
              {isInProgress ? <Pause size={12} /> : <Play size={12} />}
            </button>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent/50 hover:text-accent transition-colors p-1">
              <ExternalLink size={12} />
            </a>
          )}
          {onChatAbout && (item.source === "github" || item.source === "linear") && (
            <div onClick={(e) => e.stopPropagation()}>
              <CustomActionsMenu source={item.source === "github" ? "github" : "linear"} context={{ identifier: raw.identifier ?? item.source_id, title: raw.title ?? item.title ?? "", description: raw.body ?? raw.description ?? "", url: item.url ?? "", state: raw.state ?? "", assignee: raw.assignee ?? "", labels: (raw.labels ?? []).join(", "), repo: raw.repo ?? "", author: raw.author ?? "", pr_number: String(raw.id ?? ""), reviewers: (raw.reviewers ?? []).join(", ") }} onAction={onChatAbout} onAgentAction={onAgentAction} onCreateTaskAction={onCreateTaskAction} />
            </div>
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 pt-2.5 text-xs space-y-2" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}

const PRIORITY_STYLES: Record<number, string> = {
  1: "bg-red-500/20 text-red-400",
  2: "bg-orange-500/20 text-orange-400",
  3: "bg-yellow-500/20 text-yellow-400",
  4: "bg-blue-500/20 text-blue-400",
};
const PRIORITY_LABELS: Record<number, string> = { 1: "Urgent", 2: "High", 3: "Medium", 4: "Low" };

const STATE_ICONS: Record<string, string> = {
  "Backlog": "text-muted/50",
  "Todo": "text-muted",
  "In Progress": "text-blue-400",
  "In Review": "text-violet-400",
  "Done": "text-green-400",
  "Canceled": "text-red-400/50",
  "Cancelled": "text-red-400/50",
  "Waiting for Customer": "text-yellow-400",
};

function LinearCard({ item, states, members, onDismiss, onChatAbout, onAgentAction, onCreateTaskAction, onUpdateItem, hiddenStates, isInProgress, onToggleInProgress, onCreateTask, agentTasks }: {
  item: TodoItem;
  states: { id: string; name: string; type: string }[];
  members: { id: string; name: string; email: string }[];
  onDismiss: (item: TodoItem) => void;
  onChatAbout: (prompt: string) => void;
  onAgentAction?: (prompt: string) => void;
  onCreateTaskAction?: (taskText: string, agentPrompt: string) => void;
  onUpdateItem: (itemId: string, updates: Record<string, unknown>) => void;
  hiddenStates: Set<string>;
  isInProgress?: boolean;
  onToggleInProgress?: () => void;
  onCreateTask?: (source: string, sourceId: string, text: string) => void;
  agentTasks?: { text: string; status: string }[];
}) {
  const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
  const [updating, setUpdating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const handleUpdate = async (updates: Record<string, string | null>) => {
    setUpdating(true);
    try {
      await fetch("/api/linear/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: raw.id, ...updates }),
      });
      // Update local state: resolve state name from stateId
      if (updates.stateId) {
        const newState = states.find(s => s.id === updates.stateId);
        if (newState) {
          // If the new state is hidden, fade out then update
          if (hiddenStates.has(newState.name)) {
            setFadingOut(true);
            setTimeout(() => onUpdateItem(item.id, { state: newState.name, stateId: newState.id }), 300);
          } else {
            onUpdateItem(item.id, { state: newState.name, stateId: newState.id });
          }
        }
      }
      if (updates.assigneeId !== undefined) {
        const member = members.find(m => m.id === updates.assigneeId);
        onUpdateItem(item.id, { assignee: member?.name ?? null, assigneeId: updates.assigneeId });
      }
    } finally {
      setUpdating(false);
    }
  };

  const doneState = states.find(s => s.type === "completed");
  const handleMarkDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!doneState) return;
    handleUpdate({ stateId: doneState.id });
  };

  const stateColor = STATE_ICONS[raw.state] ?? "text-muted";
  const priorityNum = raw.priority as number | undefined;

  return (
    <div className={`bg-card border border-border rounded-lg hover:bg-card-hover transition-all duration-300 group ${fadingOut ? "opacity-0 scale-95 -translate-x-2" : ""}`}>
      <div className="flex items-center gap-2.5 px-3 py-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* State dot */}
        <CircleDot size={14} className={`shrink-0 ${stateColor}`} />

        {/* Identifier */}
        <span className="text-[11px] font-mono text-muted/60 shrink-0">{raw.identifier}</span>

        {/* Title */}
        <span className="text-sm font-medium truncate flex-1">{raw.title}</span>

        {/* Inline metadata */}
        <div className="flex items-center gap-1.5 shrink-0">
          {priorityNum != null && priorityNum > 0 && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_STYLES[priorityNum] ?? "bg-card-hover text-muted"}`}>
              {PRIORITY_LABELS[priorityNum] ?? "P" + priorityNum}
            </span>
          )}
          {raw.labels?.length > 0 && raw.labels.slice(0, 2).map((l: string) => (
            <span key={l} className="text-[10px] bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded">{l}</span>
          ))}
          {raw.attachments?.some((a: { sourceType?: string }) => a.sourceType === "github") && (
            <span className="text-[10px] text-orange-400/60 flex items-center gap-0.5"><GitPullRequest size={9} /> PR</span>
          )}
          {raw.project && <span className="text-[10px] text-cyan-400/50">{raw.project}</span>}
          {raw.assignee && <span className="text-[10px] text-muted/50">{raw.assignee.split(" ")[0]}</span>}
          {(raw.updatedAt || raw.createdAt) && <span className="text-[10px] text-muted/40">{formatDate(raw.updatedAt ?? raw.createdAt)}</span>}
          {agentTasks && agentTasks.length > 0 && agentTasks.map((t, i) => (
            <span key={i} className={`text-[9px] flex items-center gap-0.5 px-1.5 py-0.5 rounded ${t.status === "running" ? "bg-purple-500/10 text-purple-400" : t.status === "completed" ? "bg-green-500/10 text-green-400" : t.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
              {t.status === "running" ? <Loader2 size={8} className="animate-spin" /> : t.status === "completed" ? <CheckCircle size={8} /> : <AlertCircle size={8} />}
              {t.text.slice(0, 20)}{t.text.length > 20 ? "..." : ""}
            </span>
          ))}
        </div>

        {/* Actions on hover */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onCreateTask && (
            <button onClick={(e) => { e.stopPropagation(); onCreateTask(item.source, item.source_id, item.title); }} className="text-muted hover:text-accent transition-colors p-1" title="Create task from this ticket">
              <Plus size={12} />
            </button>
          )}
          {onToggleInProgress && (
            <button onClick={(e) => { e.stopPropagation(); onToggleInProgress(); }} className={`transition-colors p-1 ${isInProgress ? "text-sky-400 hover:text-muted" : "text-muted hover:text-sky-400"}`} title={isInProgress ? "Remove focus" : "Focus"}>
              {isInProgress ? <Pause size={12} /> : <Play size={12} />}
            </button>
          )}
          {doneState && raw.state !== doneState.name && (
            <button onClick={handleMarkDone} disabled={updating} className="text-green-400/50 hover:text-green-400 transition-colors p-1 disabled:opacity-50" title="Mark as Done">
              <CheckCircle size={12} />
            </button>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent/50 hover:text-accent transition-colors p-1">
              <ExternalLink size={12} />
            </a>
          )}
          <CustomActionsMenu source="linear" context={{ identifier: raw.identifier ?? "", title: raw.title ?? "", description: (raw.description ?? "").slice(0, 500), state: raw.state ?? "", assignee: raw.assignee ?? "", project: raw.project ?? "", url: item.url ?? "" }} onAction={(prompt) => onChatAbout(prompt)} onAgentAction={onAgentAction} onCreateTaskAction={onCreateTaskAction} />
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 pt-2.5 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          {/* Metadata grid */}
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px]">
            <span className="text-muted/60">Status</span>
            <div className="flex items-center gap-1.5">
              <CircleDot size={10} className={stateColor} />
              <select
                defaultValue={raw.stateId ?? ""}
                onChange={(e) => handleUpdate({ stateId: e.target.value })}
                disabled={updating}
                className="bg-background border border-border rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-accent disabled:opacity-50 cursor-pointer"
              >
                {states.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <span className="text-muted/60">Assignee</span>
            <div className="flex items-center gap-1.5">
              <User size={10} className="text-muted/50" />
              <select
                defaultValue={raw.assigneeId ?? ""}
                onChange={(e) => handleUpdate({ assigneeId: e.target.value || null })}
                disabled={updating}
                className="bg-background border border-border rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-accent disabled:opacity-50 cursor-pointer"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {updating && <Loader2 size={12} className="animate-spin text-muted" />}
            </div>

            {priorityNum != null && priorityNum > 0 && (<>
              <span className="text-muted/60">Priority</span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded w-fit text-[10px] font-semibold ${PRIORITY_STYLES[priorityNum] ?? ""}`}>
                {PRIORITY_LABELS[priorityNum] ?? "P" + priorityNum}
              </span>
            </>)}

            {raw.labels?.length > 0 && (<>
              <span className="text-muted/60">Labels</span>
              <div className="flex flex-wrap gap-1">
                {raw.labels.map((l: string) => (
                  <span key={l} className="px-1.5 py-0.5 rounded text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/20">{l}</span>
                ))}
              </div>
            </>)}

            {raw.project && (<>
              <span className="text-muted/60">Project</span>
              <span className="text-cyan-400">{raw.project}</span>
            </>)}

            {raw.initiative && (<>
              <span className="text-muted/60">Initiative</span>
              <span className="text-amber-400">{raw.initiative}</span>
            </>)}

            {raw.branchName && (<>
              <span className="text-muted/60">Branch</span>
              <span className="text-green-400 font-mono text-[10px]">{raw.branchName}</span>
            </>)}

            {raw.attachments?.length > 0 && (<>
              <span className="text-muted/60">Links</span>
              <div className="flex flex-col gap-0.5">
                {(raw.attachments as { title: string; url: string; sourceType?: string }[]).map((a, i: number) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:underline">
                    {a.sourceType === "github" ? <GitPullRequest size={10} /> : <ExternalLink size={10} />}
                    {a.title || a.url}
                  </a>
                ))}
              </div>
            </>)}

            {raw.cycle && (<>
              <span className="text-muted/60">Cycle</span>
              <span className="text-teal-400">{raw.cycle}</span>
            </>)}

            {(raw.createdAt || raw.updatedAt) && (<>
              <span className="text-muted/60">Updated</span>
              <span className="text-muted/80">{formatDate(raw.updatedAt ?? raw.createdAt)}</span>
            </>)}
          </div>

          {/* Description */}
          {raw.description && (
            <div className="bg-background/50 rounded-md border border-border/30 p-2.5">
              <p className="text-xs text-muted/80 leading-relaxed whitespace-pre-wrap line-clamp-6">
                {raw.description.length > 400 ? raw.description.slice(0, 400) + "..." : raw.description}
              </p>
            </div>
          )}

          {/* Chat about this */}
          <button
            onClick={() => onChatAbout(`Tell me about this Linear ticket: [${raw.identifier}] ${raw.title}\n\nStatus: ${raw.state}\nPriority: ${["None", "Urgent", "High", "Medium", "Low"][raw.priority ?? 0]}\nAssignee: ${raw.assignee ?? "Unassigned"}${raw.labels?.length ? `\nLabels: ${raw.labels.join(", ")}` : ""}${raw.description ? `\n\nDescription:\n${raw.description.slice(0, 500)}` : ""}\n\nWhat should I know about this? Any suggestions for how to approach it?`)}
            className="flex items-center gap-1.5 text-[11px] text-accent hover:underline"
          >
            <MessageSquare size={10} />
            Chat about this
          </button>
        </div>
      )}
    </div>
  );
}

function GithubCard({ item, onDismiss, onChatAbout, onAgentAction, onCreateTaskAction, repoStatus, isInProgress, onToggleInProgress, onCreateTask, agentTasks }: { item: TodoItem; onDismiss: (item: TodoItem) => void; onChatAbout: (prompt: string, prInfo?: { repo: string; prNumber: number }) => void; onAgentAction?: (prompt: string) => void; onCreateTaskAction?: (taskText: string, agentPrompt: string) => void; repoStatus?: string; isInProgress?: boolean; onToggleInProgress?: () => void; onCreateTask?: (source: string, sourceId: string, text: string) => void; agentTasks?: { text: string; status: string }[] }) {
  const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);
  const [autoMerging, setAutoMerging] = useState(false);
  const [autoMergeResult, setAutoMergeResult] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [addingReviewer, setAddingReviewer] = useState(false);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [loadingCollabs, setLoadingCollabs] = useState(false);
  const [aiReview, setAiReview] = useState<string | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);

  const handleAiReview = async () => {
    setAiReviewLoading(true);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: raw.repo, prNumber: raw.id, title: raw.title, body: raw.body }),
      });
      const data = await res.json();
      setAiReview(data.review);
    } finally {
      setAiReviewLoading(false);
    }
  };

  const checks: { name: string; status: string; conclusion: string | null }[] = raw.checks ?? [];
  const comments: { author: string; body: string; createdAt: string; url: string; path?: string; line?: number }[] = raw.comments ?? [];
  const reviewers: string[] = raw.reviewers ?? [];

  const failingChecks = checks.filter((c) => c.conclusion === "failure");
  const pendingChecks = checks.filter((c) => c.status !== "completed");
  const passingChecks = checks.filter((c) => c.conclusion === "success");

  // Extract alpha environment URL from bot comments
  const alphaUrl = (() => {
    for (const c of comments) {
      if (c.body?.includes("Alpha environment") || c.body?.includes("alpha.upsales.io")) {
        const match = c.body.match(/https?:\/\/[^\s)]+\.alpha\.upsales\.io[^\s)"]*/);
        if (match) return match[0];
      }
    }
    return null;
  })();

  const canMerge = raw.mergeable === true && failingChecks.length === 0;
  const hasConflicts = raw.mergeableState === "dirty" || raw.mergeable === false;

  const handleMerge = async () => {
    setMerging(true);
    try {
      const res = await fetch("/api/github/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "merge", repo: raw.repo, prNumber: raw.id }),
      });
      const data = await res.json();
      setMergeResult(data.success ? "Merged!" : data.message);
    } finally {
      setMerging(false);
    }
  };

  const handleAutoMerge = async () => {
    setAutoMerging(true);
    try {
      const res = await fetch("/api/github/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_merge", repo: raw.repo, prNumber: raw.id }),
      });
      const data = await res.json();
      setAutoMergeResult(data.success ? "Auto-merge enabled!" : data.message);
    } finally {
      setAutoMerging(false);
    }
  };

  const handleLoadCollaborators = async () => {
    setLoadingCollabs(true);
    try {
      const res = await fetch("/api/github/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "collaborators", repo: raw.repo }),
      });
      setCollaborators(await res.json());
      setAddingReviewer(true);
    } finally {
      setLoadingCollabs(false);
    }
  };

  const handleAddReviewer = async (reviewer: string) => {
    await fetch("/api/github/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_reviewer", repo: raw.repo, prNumber: raw.id, reviewers: [reviewer] }),
    });
    setAddingReviewer(false);
  };

  return (
    <ExpandableCard item={item} onDismiss={onDismiss} onChatAbout={onChatAbout} onAgentAction={onAgentAction} onCreateTaskAction={onCreateTaskAction} isInProgress={isInProgress} onToggleInProgress={onToggleInProgress} onCreateTask={onCreateTask} summary={
      <>
        {raw.author && <span className="text-[11px] text-muted flex items-center gap-1"><User size={10} /> {raw.author}</span>}
        {raw.reviewRequested && <span className="text-[11px] text-accent flex items-center gap-1"><GitPullRequest size={10} /> review requested</span>}
        {raw.draft && <span className="text-[11px] text-yellow-500">draft</span>}
        {hasConflicts && <span className="text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> conflicts</span>}
        {failingChecks.length > 0 && <span className="text-[11px] text-red-400 flex items-center gap-1"><XCircle size={10} /> {failingChecks.length} failing</span>}
        {pendingChecks.length > 0 && <span className="text-[11px] text-yellow-400">{pendingChecks.length} pending</span>}
        {checks.length > 0 && failingChecks.length === 0 && pendingChecks.length === 0 && (
          <span className="text-[11px] text-green-400 flex items-center gap-1"><CheckCircle size={10} /> checks pass</span>
        )}
        {alphaUrl && <a href={alphaUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-500/10 px-1.5 py-0.5 rounded"><ExternalLink size={9} /> Alpha</a>}
        {comments.length > 0 && <span className="text-[11px] text-muted flex items-center gap-1"><MessageSquare size={10} /> {comments.length}</span>}
        {(raw.updatedAt || raw.createdAt) && <span className="text-[11px] text-muted flex items-center gap-1"><Calendar size={10} /> {formatDate(raw.updatedAt ?? raw.createdAt)}</span>}
        {agentTasks && agentTasks.length > 0 && agentTasks.map((t, i) => (
          <span key={i} className={`text-[9px] flex items-center gap-0.5 px-1.5 py-0.5 rounded ${t.status === "running" ? "bg-purple-500/10 text-purple-400" : t.status === "completed" ? "bg-green-500/10 text-green-400" : t.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
            {t.status === "running" ? <Loader2 size={8} className="animate-spin" /> : t.status === "completed" ? <CheckCircle size={8} /> : <AlertCircle size={8} />}
            {t.text.slice(0, 20)}{t.text.length > 20 ? "..." : ""}
          </span>
        ))}
      </>
    }>
      {/* Reviewers */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-muted w-16 shrink-0">Reviewers</span>
        {reviewers.length > 0 ? reviewers.map((r) => (
          <span key={r} className="bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded">{r}</span>
        )) : <span className="text-muted/50">none</span>}
        {!addingReviewer ? (
          <button
            onClick={handleLoadCollaborators}
            disabled={loadingCollabs}
            className="text-[11px] text-accent hover:underline disabled:opacity-50"
          >
            {loadingCollabs ? "Loading..." : "+ Add"}
          </button>
        ) : (
          <select
            onChange={(e) => { if (e.target.value) handleAddReviewer(e.target.value); }}
            className="bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-accent"
            defaultValue=""
          >
            <option value="">Select...</option>
            {collaborators.filter((c) => !reviewers.includes(c)).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Merge status */}
      <div className="flex items-center gap-2">
        <span className="text-muted w-16 shrink-0">Merge</span>
        {hasConflicts ? (
          <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> Has merge conflicts</span>
        ) : canMerge ? (
          <button
            onClick={handleMerge}
            disabled={merging}
            className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-xs transition-colors disabled:opacity-50"
          >
            {merging ? "Merging..." : "Merge PR"}
          </button>
        ) : (
          <span className="text-muted/50">Not ready to merge</span>
        )}
        {!canMerge && !hasConflicts && (
          <button
            onClick={handleAutoMerge}
            disabled={autoMerging || autoMergeResult !== null}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs transition-colors disabled:opacity-50"
          >
            {autoMerging ? "Enabling..." : "Auto-merge"}
          </button>
        )}
        {canMerge && (
          <button
            onClick={handleAutoMerge}
            disabled={autoMerging || autoMergeResult !== null}
            className="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-[11px] transition-colors disabled:opacity-50"
          >
            {autoMerging ? "..." : "Auto-merge"}
          </button>
        )}
        {mergeResult && <span className={`text-xs ${mergeResult === "Merged!" ? "text-green-400" : "text-red-400"}`}>{mergeResult}</span>}
        {autoMergeResult && <span className={`text-xs ${autoMergeResult === "Auto-merge enabled!" ? "text-blue-400" : "text-red-400"}`}>{autoMergeResult}</span>}
      </div>

      {/* Checks */}
      {checks.length > 0 && (
        <div>
          <span className="text-muted block mb-1">Checks ({passingChecks.length}/{checks.length} passing)</span>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  c.conclusion === "success" ? "bg-green-400" :
                  c.conclusion === "failure" ? "bg-red-400" :
                  "bg-yellow-400"
                }`} />
                <span className="truncate">{c.name}</span>
                <span className="text-muted/50">{c.conclusion ?? c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      {raw.body && (
        <div className="mt-2 text-muted leading-relaxed whitespace-pre-wrap">
          {raw.body.length > 500 ? raw.body.slice(0, 500) + "..." : raw.body}
        </div>
      )}

      {/* AI Review */}
      <div className="mt-2">
        {!aiReview ? (
          <button
            onClick={handleAiReview}
            disabled={aiReviewLoading}
            className="flex items-center gap-1.5 text-[11px] text-accent hover:underline disabled:opacity-50"
          >
            {aiReviewLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
            {aiReviewLoading ? "Analyzing diff..." : "AI Review Summary"}
          </button>
        ) : (
          <div className="bg-accent/5 border border-accent/20 rounded p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={10} className="text-accent" />
              <span className="text-[10px] font-semibold text-accent">AI Review</span>
              <button onClick={() => setAiReview(null)} className="ml-auto text-muted/30 hover:text-muted"><X size={10} /></button>
            </div>
            <div className="text-[11px] text-muted/80 leading-relaxed whitespace-pre-wrap">{aiReview}</div>
          </div>
        )}
      </div>

      {/* Chat about this (with code context) — only when repo is cloned */}
      {repoStatus === "cloning" && (
        <span className="flex items-center gap-1.5 text-[11px] text-muted/50 mt-2">
          <Loader2 size={10} className="animate-spin" />
          Cloning repo...
        </span>
      )}
      {repoStatus === "ready" && <button
        onClick={() => onChatAbout(
          `Review this PR with full code context: ${raw.title} (${raw.repo}#${raw.id})\n\nAuthor: ${raw.author}\nStatus: ${raw.mergeable ? "mergeable" : "not mergeable"}${hasConflicts ? " (has conflicts)" : ""}${raw.draft ? " (draft)" : ""}\nChecks: ${passingChecks.length}/${checks.length} passing${failingChecks.length > 0 ? ` (${failingChecks.length} failing: ${failingChecks.map((c: { name: string }) => c.name).join(", ")})` : ""}\nReviewers: ${reviewers.length > 0 ? reviewers.join(", ") : "none"}${comments.length > 0 ? `\n\nRecent comments:\n${comments.slice(-3).map((c: { author: string; body: string }) => `- ${c.author}: ${c.body.slice(0, 150)}`).join("\n")}` : ""}${raw.body ? `\n\nDescription:\n${raw.body.slice(0, 500)}` : ""}\n\nYou have the full diff and source code. Give me a thorough review: what does this PR do, any issues, and what should I focus on?`,
          { repo: raw.repo, prNumber: raw.id },
        )}
        className="flex items-center gap-1.5 text-[11px] text-accent hover:underline mt-2"
      >
        <MessageSquare size={10} />
        Chat about this (with code)
      </button>}

      {/* Comments */}
      {comments.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowComments(!showComments)}
            className="text-accent text-[11px] hover:underline flex items-center gap-1"
          >
            {showComments ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </button>
          {showComments && (
            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
              {comments.map((c, i) => (
                <div key={i} className="bg-background rounded p-2 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{c.author}</span>
                    <span className="text-muted/50">{formatDate(c.createdAt)}</span>
                    {c.path && (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-accent/70 hover:text-accent font-mono truncate max-w-[200px]">
                        {c.path}{c.line ? `:${c.line}` : ""}
                      </a>
                    )}
                  </div>
                  <p className="text-muted whitespace-pre-wrap leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ExpandableCard>
  );
}

function CalendarCard({ item, onDismiss, onChatAbout, isInProgress, onToggleInProgress }: { item: TodoItem; onDismiss: (item: TodoItem) => void; onChatAbout?: (prompt: string) => void; isInProgress?: boolean; onToggleInProgress?: () => void }) {
  const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
  const [fading, setFading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const startTime = raw.allDay
    ? "All day"
    : new Date(raw.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const endTime = raw.allDay
    ? ""
    : new Date(raw.end).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const duration = raw.allDay ? "" : (() => {
    const mins = Math.round((new Date(raw.end).getTime() - new Date(raw.start).getTime()) / 60000);
    return mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}` : `${mins}m`;
  })();

  const isToday = (() => {
    const d = new Date(raw.start);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  })();

  const handleRespond = async (response: string) => {
    setFading(true);
    setTimeout(() => onDismiss(item), 300);
    try {
      const res = await fetch("/api/google/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "respond", eventId: raw.id, response, calendarId: raw.calendarId }),
      });
      if (!res.ok) setFading(false);
    } catch {
      setFading(false);
    }
  };

  const responseColors: Record<string, string> = {
    accepted: "text-green-400",
    declined: "text-red-400",
    tentative: "text-yellow-400",
    needsAction: "text-muted",
  };

  return (
    <div className={`bg-card border border-border rounded-lg hover:bg-card-hover transition-all duration-300 group ${fading ? "opacity-0 max-h-0 py-0 overflow-hidden" : "opacity-100"}`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex flex-col items-center text-xs text-muted w-14 shrink-0">
          <span className="font-mono font-medium text-foreground">{startTime}</span>
          {duration && <span className="text-[10px]">{duration}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium block truncate">
            {!isToday && <span className="text-muted text-xs mr-1.5">Tomorrow</span>}
            {raw.title}
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {raw.organizer && (
              <span className="text-[11px] text-muted flex items-center gap-1"><User size={10} /> {raw.organizer}</span>
            )}
            {raw.location && (
              <span className="text-[11px] text-muted flex items-center gap-1 truncate max-w-[200px]"><MapPin size={10} /> {raw.location}</span>
            )}
            {raw.conferenceLink && (
              <a href={raw.conferenceLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-accent flex items-center gap-1 hover:underline">
                <Video size={10} /> Join
              </a>
            )}
            {raw.attendees?.length > 0 && (
              <span className="text-[11px] text-muted flex items-center gap-1"><Users size={10} /> {raw.attendees.length}</span>
            )}
            {raw.responseStatus && raw.responseStatus !== "accepted" && (
              <span className={`text-[11px] ${responseColors[raw.responseStatus] ?? "text-muted"}`}>
                {raw.responseStatus === "needsAction" ? "Needs response" : raw.responseStatus}
              </span>
            )}
            {raw.calendarName && (
              <span className="text-[10px] text-muted/50 flex items-center gap-1"><Calendar size={9} /> {raw.calendarName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {raw.responseStatus === "needsAction" && (
            <>
              <button onClick={() => handleRespond("accepted")}
                className="cursor-pointer text-green-400 hover:scale-110 transition-all p-1 text-xs" title="Accept">
                <CheckCircle size={14} />
              </button>
              <button onClick={() => handleRespond("declined")}
                className="cursor-pointer text-red-400 hover:scale-110 transition-all p-1 text-xs" title="Decline">
                <XCircle size={14} />
              </button>
            </>
          )}
          {onToggleInProgress && (
            <button onClick={onToggleInProgress} className={`transition-colors p-1 ${isInProgress ? "text-sky-400 hover:text-muted" : "text-muted hover:text-sky-400"}`} title={isInProgress ? "Stop working" : "Set In Progress"}>
              {isInProgress ? <Pause size={14} /> : <Play size={14} />}
            </button>
          )}
          {raw.htmlLink && (
            <a href={raw.htmlLink} target="_blank" rel="noopener noreferrer" className="text-accent/50 hover:text-accent transition-colors p-1">
              <ExternalLink size={14} />
            </a>
          )}
          <SnoozeButton source={item.source} sourceId={item.source_id} onDone={() => onDismiss(item)} size={14} />
          <button onClick={() => onDismiss(item)} className="text-red-400/50 hover:text-red-400 transition-colors p-1" title="Dismiss">
            <X size={14} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 ml-[68px] border-t border-border/50 pt-3 text-xs space-y-2">
          {raw.location && (
            <div className="flex gap-2">
              <span className="text-muted w-16 shrink-0">Location</span>
              <span>{raw.location}</span>
            </div>
          )}
          {raw.organizer && (
            <div className="flex gap-2">
              <span className="text-muted w-16 shrink-0">Organizer</span>
              <span>{raw.organizer}</span>
            </div>
          )}
          {raw.attendees?.length > 0 && (
            <div className="flex gap-2">
              <span className="text-muted w-16 shrink-0">Attendees</span>
              <div className="flex flex-wrap gap-1">
                {raw.attendees.map((a: { name: string; responseStatus: string }, i: number) => (
                  <span key={i} className={`px-1.5 py-0.5 rounded text-[11px] ${
                    a.responseStatus === "accepted" ? "bg-green-500/10 text-green-400" :
                    a.responseStatus === "declined" ? "bg-red-500/10 text-red-400" :
                    a.responseStatus === "tentative" ? "bg-yellow-500/10 text-yellow-400" :
                    "bg-card-hover text-muted"
                  }`}>{a.name}</span>
                ))}
              </div>
            </div>
          )}
          {raw.description && (
            <div className="mt-2 text-muted leading-relaxed whitespace-pre-wrap">
              {raw.description.length > 500 ? raw.description.slice(0, 500) + "..." : raw.description}
            </div>
          )}
          {/* RSVP buttons when expanded */}
          {raw.responseStatus !== "accepted" && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleRespond("accepted")}
                className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 text-xs transition-colors">
                Accept
              </button>
              <button onClick={() => handleRespond("tentative")}
                className="px-3 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-700 text-xs transition-colors">
                Maybe
              </button>
              <button onClick={() => handleRespond("declined")}
                className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-xs transition-colors">
                Decline
              </button>
            </div>
          )}
          {/* Chat about this */}
          {onChatAbout && (
            <button
              onClick={() => onChatAbout(`I have this calendar event and need help preparing:\n\nEvent: ${raw.title}\nTime: ${startTime}${endTime ? ` – ${endTime}` : ""}${duration ? ` (${duration})` : ""}\nOrganizer: ${raw.organizer ?? "unknown"}${raw.attendees?.length ? `\nAttendees: ${raw.attendees.map((a: { name: string }) => a.name).join(", ")}` : ""}${raw.location ? `\nLocation: ${raw.location}` : ""}${raw.description ? `\n\nDescription:\n${raw.description.slice(0, 500)}` : ""}\n\nHelp me prepare for this meeting. What should I think about?`)}
              className="flex items-center gap-1.5 text-[11px] text-accent hover:underline mt-2"
            >
              <Bot size={10} />
              Chat about this
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Fallback cleanup for any remaining Slack markup in text (plain string version for non-rendered contexts)
function cleanSlackMarkup(text: string): string {
  let cleaned = text.replace(/<@[A-Z0-9]+\|([^>]+)>/g, "@$1");
  cleaned = cleaned.replace(/<@([A-Z0-9]+)>/g, "@$1");
  cleaned = cleaned.replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1");
  cleaned = cleaned.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2");
  cleaned = cleaned.replace(/<(https?:\/\/[^>]+)>/g, "$1");
  cleaned = parseSlackEmojis(cleaned);
  return cleaned;
}

// Rich Slack text renderer with highlighted @mentions, clickable links, and better emoji support
function SlackText({ text }: { text: string }) {
  // First pass: parse emojis
  const withEmojis = parseSlackEmojis(text);

  // Split on Slack markup patterns and render rich elements
  // Pattern matches: <@U123|name>, <@U123>, <#C123|channel>, <url|label>, <url>, *bold*, _italic_, `code`, ~strike~
  const parts: React.ReactNode[] = [];
  let remaining = withEmojis;
  let key = 0;

  const patterns = [
    // @mention with name
    { regex: /<@[A-Z0-9]+\|([^>]+)>/g, render: (_m: string, name: string) => (
      <span key={key++} className="text-white font-semibold">@{name}</span>
    )},
    // @mention without name
    { regex: /<@([A-Z0-9]+)>/g, render: (_m: string, uid: string) => (
      <span key={key++} className="text-white font-semibold">@{uid}</span>
    )},
    // #channel
    { regex: /<#[A-Z0-9]+\|([^>]+)>/g, render: (_m: string, ch: string) => (
      <span key={key++} className="text-accent">#{ch}</span>
    )},
    // mailto with label
    { regex: /<(mailto:[^|>]+)\|([^>]+)>/g, render: (_m: string, url: string, label: string) => (
      <a key={key++} href={url} className="text-accent hover:underline">{label}</a>
    )},
    // bare mailto
    { regex: /<(mailto:[^>]+)>/g, render: (_m: string, url: string) => (
      <a key={key++} href={url} className="text-accent hover:underline">{url.replace("mailto:", "")}</a>
    )},
    // link with label
    { regex: /<(https?:\/\/[^|>]+)\|([^>]+)>/g, render: (_m: string, url: string, label: string) => (
      <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{label}</a>
    )},
    // bare link
    { regex: /<(https?:\/\/[^>]+)>/g, render: (_m: string, url: string) => (
      <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all">{url.length > 50 ? url.slice(0, 50) + "..." : url}</a>
    )},
  ];

  // Process each pattern sequentially
  function processText(input: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let str = input;

    // Find the first matching pattern
    while (str.length > 0) {
      let earliestIdx = str.length;
      let earliestMatch: RegExpExecArray | null = null;
      let earliestPattern: typeof patterns[0] | null = null;

      for (const p of patterns) {
        p.regex.lastIndex = 0;
        const m = p.regex.exec(str);
        if (m && m.index < earliestIdx) {
          earliestIdx = m.index;
          earliestMatch = m;
          earliestPattern = p;
        }
      }

      if (!earliestMatch || !earliestPattern) {
        // No more patterns, add remaining as inline-formatted text
        nodes.push(...formatInline(str));
        break;
      }

      // Add text before match
      if (earliestIdx > 0) {
        nodes.push(...formatInline(str.slice(0, earliestIdx)));
      }

      // Add the rendered match
      nodes.push(earliestPattern.render(earliestMatch[0], earliestMatch[1], earliestMatch[2]));

      str = str.slice(earliestIdx + earliestMatch[0].length);
    }

    return nodes;
  }

  // Format inline markdown: *bold*, _italic_, `code`, ~strikethrough~, and plain URLs
  function formatInline(input: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    // Match inline code and plain URLs
    const inlineRegex = /`([^`]+)`|(https?:\/\/[^\s<>]+)/g;
    let lastIdx = 0;
    let match;
    while ((match = inlineRegex.exec(input)) !== null) {
      if (match.index > lastIdx) nodes.push(<span key={key++}>{input.slice(lastIdx, match.index)}</span>);
      if (match[1] !== undefined) {
        // Inline code
        nodes.push(<code key={key++} className="bg-background px-1 py-0.5 rounded text-[0.9em] font-mono text-accent/80">{match[1]}</code>);
      } else {
        // Plain URL
        const url = match[0];
        nodes.push(<a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all">{url.length > 60 ? url.slice(0, 60) + "..." : url}</a>);
      }
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < input.length) {
      if (lastIdx === 0) {
        nodes.push(<span key={key++}>{input}</span>);
      } else {
        nodes.push(<span key={key++}>{input.slice(lastIdx)}</span>);
      }
    }
    return nodes;
  }

  return <>{processText(remaining)}</>;
}

function AgentFollowUpInput({ sessionId, onSent }: { sessionId: string; onSent: (text: string) => void }) {
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    const msg = text.trim();
    setText("");
    // Notify parent immediately so UI shows the message + working state
    onSent(msg);
    // Fire the request — don't block on it
    fetch("/api/agent/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, follow_up: msg }),
    });
  };

  return (
    <div className="border-t border-border/50 px-4 py-2.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Send a follow-up..."
          className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="cursor-pointer px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700 text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <Send size={10} />
        </button>
      </div>
    </div>
  );
}

function AgentSessionInline({ session, onOpenChat, onRefresh, toggleRef }: {
  session: { id: string; status: string; summary?: string; failure_reason?: string; tool_calls?: string };
  onOpenChat?: (sessionId: string) => void;
  onRefresh?: () => void;
  toggleRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (toggleRef) toggleRef.current = () => setExpanded(v => !v); }, [toggleRef]);
  const [fullData, setFullData] = useState<{ messages?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [sending, setSending] = useState(false);
  const [clankerModal, setClankerModal] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [optimisticRunning, setOptimisticRunning] = useState(false);
  const isRunning = session.status === "running" || optimisticRunning;

  // Fetch full session data when expanded
  useEffect(() => {
    if (!expanded || fullData) return;
    setLoading(true);
    fetch(`/api/agent/sessions?session_id=${session.id}`)
      .then(r => r.json())
      .then(data => setFullData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [expanded, fullData, session.id]);

  // Poll while running
  useEffect(() => {
    if (!expanded || !isRunning) return;
    const interval = setInterval(() => {
      fetch(`/api/agent/sessions?session_id=${session.id}`)
        .then(r => r.json())
        .then(data => setFullData(data))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [expanded, isRunning, session.id]);

  // Parse messages into a clean Q&A view: user prompts + agent final answers only
  const chatMessages: { role: "user" | "agent"; text: string }[] = [];
  const summaryText = (fullData as Record<string, unknown>)?.summary as string | undefined ?? session.summary;
  const failureText = (fullData as Record<string, unknown>)?.failure_reason as string | undefined ?? session.failure_reason;
  const sessionStatus = (fullData as Record<string, unknown>)?.status as string | undefined ?? session.status;
  const todoText = (fullData as Record<string, unknown>)?.todo_text as string | undefined ??
    (fullData as Record<string, unknown>)?.todoText as string | undefined;

  if (fullData?.messages) {
    try {
      const msgs = JSON.parse(fullData.messages);
      // Collect user text messages and the last agent text per round
      // A "round" starts with each user text message
      const rounds: { user: string; agentTexts: string[] }[] = [];
      let currentRound: { user: string; agentTexts: string[] } | null = null;

      for (const msg of msgs) {
        if (msg.role === "user") {
          let text: string | null = null;
          if (typeof msg.content === "string") {
            text = msg.content;
          } else if (Array.isArray(msg.content)) {
            const hasToolResults = msg.content.some((b: { type: string }) => b.type === "tool_result");
            if (!hasToolResults) {
              const texts = msg.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text);
              if (texts.length > 0) text = texts.join("\n");
            }
          }
          if (text) {
            if (currentRound) rounds.push(currentRound);
            currentRound = { user: text, agentTexts: [] };
          }
        } else if (msg.role === "assistant") {
          const texts: string[] = [];
          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === "text" && block.text?.trim()) texts.push(block.text);
            }
          } else if (typeof msg.content === "string" && msg.content.trim()) {
            texts.push(msg.content);
          }
          if (texts.length > 0 && currentRound) {
            currentRound.agentTexts.push(texts.join("\n\n"));
          }
        }
      }
      if (currentRound) rounds.push(currentRound);

      // For each round, show user message + only the last agent text (the final answer)
      for (const round of rounds) {
        chatMessages.push({ role: "user", text: round.user });
        if (round.agentTexts.length > 0) {
          chatMessages.push({ role: "agent", text: round.agentTexts[round.agentTexts.length - 1] });
        }
      }
    } catch { /* ignore */ }
  }

  // Ensure there's always an initial user message (for old sessions without it)
  if (!chatMessages.some(m => m.role === "user") && todoText) {
    chatMessages.unshift({ role: "user", text: todoText });
  }

  // Always ensure the summary is shown as the final agent message
  if (summaryText) {
    const lastAgent = [...chatMessages].reverse().find(m => m.role === "agent");
    if (!lastAgent || !lastAgent.text.includes(summaryText.slice(0, 80))) {
      chatMessages.push({ role: "agent", text: summaryText });
    }
  }
  if (failureText && !chatMessages.some(m => m.text.includes(failureText))) {
    chatMessages.push({ role: "agent", text: `**Failed:** ${failureText}` });
  }

  const sendFollowUp = async () => {
    if (!followUp.trim() || sending) return;
    const text = followUp.trim();
    setFollowUp("");
    setSending(true);
    // Optimistically show user message and working state
    setOptimisticMessages(prev => [...prev, { role: "user", text }]);
    setOptimisticRunning(true);
    // Fire and forget — don't block UI
    fetch("/api/agent/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id, follow_up: text }),
    }).then(() => {
      // Don't clear fullData — polling will update it. Just clear optimistic state when done.
      setOptimisticMessages([]);
      setOptimisticRunning(false);
      onRefresh?.();
    }).finally(() => setSending(false));
  };

  return (
    <div className="mt-1.5 mb-1.5">
      <div className="flex items-start gap-1.5 text-xs text-purple-400">
        <button onClick={() => setExpanded(!expanded)} className="cursor-pointer hover:text-purple-300 transition-colors shrink-0 mt-0.5 flex items-center gap-1">
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <Bot size={11} />
        </button>
        <span className="font-medium cursor-pointer" onClick={(e) => { if (window.getSelection()?.toString()) { e.stopPropagation(); return; } setExpanded(!expanded); }}>
          {isRunning ? "Working..." : session.summary ? (session.summary.split("\n")[0].replace(/^\*\*.*?\*\*\s*/, "").replace(/^#+\s*/, "").slice(0, 120) || session.summary.slice(0, 120)) : session.failure_reason ? "Failed" : "Agent result"}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 ml-1 border-l-2 border-purple-500/20 pl-3 space-y-3">
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Loader2 size={12} className="animate-spin" /> Loading...
            </div>
          )}
          {/* Q&A history */}
          {[...chatMessages, ...optimisticMessages].map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="flex items-start gap-2">
                  <User size={12} className="text-accent/60 shrink-0 mt-0.5" />
                  <p className="text-xs text-accent/80 font-medium">{msg.text}</p>
                </div>
              ) : (
                <div className="bg-card/50 rounded-lg px-3 py-2 border border-border/30">
                  <div className="text-xs text-foreground/80 leading-relaxed chat-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatAgentText(msg.text)}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isRunning && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Loader2 size={12} className="animate-spin text-purple-400" /> Processing...
            </div>
          )}
          {!isRunning && sessionStatus === "incomplete" && (
            <div className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded px-2.5 py-1.5 flex items-center gap-1.5">
              <AlertCircle size={11} /> Ran out of rounds — send a follow-up to continue
            </div>
          )}
          {!isRunning && sessionStatus === "waiting" && (
            <div className="text-[10px] text-blue-400/80 bg-blue-500/10 border border-blue-500/20 rounded px-2.5 py-1.5 flex items-center gap-1.5">
              <Clock size={11} /> Waiting for scheduled follow-up
            </div>
          )}
          {/* Follow-up input */}
          {!isRunning && (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFollowUp(); } }}
                placeholder="Follow up..."
                className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500/50"
                disabled={sending}
              />
              <button
                onClick={sendFollowUp}
                disabled={sending || !followUp.trim()}
                className="px-2.5 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700 text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {sending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
              </button>
            </div>
          )}
          {/* Action links */}
          <div className="flex items-center gap-3">
            {onOpenChat && (
              <button
                onClick={() => onOpenChat(session.id)}
                className="text-[10px] text-purple-400/40 hover:text-purple-300 transition-colors flex items-center gap-1"
              >
                <MessageSquare size={9} /> Full chat
              </button>
            )}
            {!isRunning && session.summary && (
              <button
                onClick={() => setClankerModal(true)}
                className="text-[10px] text-orange-400/40 hover:text-orange-300 transition-colors flex items-center gap-1"
              >
                <Zap size={9} /> Clanker session
              </button>
            )}
          </div>
          {clankerModal && (
            <ClankerSessionModal
              defaultPrompt={session.summary ?? ""}
              onClose={() => setClankerModal(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ClankerSessionModal({ defaultPrompt, onClose }: { defaultPrompt: string; onClose: () => void }) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [repos, setRepos] = useState<{ name: string }[]>([]);
  const [repo, setRepo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clanker")
      .then(r => r.json())
      .then((data: { name: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setRepos(data);
          setRepo(data[0].name);
        }
      })
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/clanker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          repo: repo || undefined,
          sessionType: "code",
          createPrAutomatically: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Failed to create session");
        return;
      }
      // Open the session in clanker
      const clankerUrl = `https://clanker.upsales.com/session/${data.id}`;
      window.open(clankerUrl, "_blank");
      onClose();
    } catch {
      setError("Failed to connect to Clanker");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-4 w-[500px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Zap size={14} className="text-orange-400" /> New Clanker Session</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground"><X size={14} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Task</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50 resize-none"
              placeholder="Describe the task..."
              autoFocus
            />
          </div>
          {repos.length > 0 && (
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Repository</label>
              <select
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50"
              >
                {repos.map(r => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-muted hover:text-foreground">Cancel</button>
            <button
              onClick={submit}
              disabled={!prompt.trim() || submitting}
              className="px-3 py-1.5 rounded bg-orange-600 text-white hover:bg-orange-700 text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Create Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: string) {
  const d = new Date(parseFloat(ts) * 1000);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

function SlackMessage({ item, onDismiss, isLast, onDismissChannel, isContext, showNewDivider, onImageClick, quickReplies }: {
  item: TodoItem; onDismiss: (item: TodoItem) => void; isLast?: boolean; onDismissChannel?: () => void; isContext?: boolean; showNewDivider?: boolean; onImageClick?: (src: string) => void; quickReplies?: string[];
}) {
  const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
  const [showThread, setShowThread] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [reactedEmoji, setReactedEmoji] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const [replies, setReplies] = useState<{ senderName: string; text: string; timestamp: string }[]>(raw.replies ?? []);
  const [loadingThread, setLoadingThread] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestionsLoaded = useRef(false);
  const replyCount: number = raw.replyCount ?? 0;
  const [actualReplyCount, setActualReplyCount] = useState<number | null>(null);
  const displayReplyCount = actualReplyCount ?? replyCount;
  const replyUserNames: string[] = raw.replyUserNames ?? [];

  const [contextMessages, setContextMessages] = useState<{ senderName: string; text: string; timestamp: string }[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextDirection, setContextDirection] = useState<"before" | "after" | null>(null);

  // Auto-expand thread for thread reply messages or when parent has new replies
  const threadAutoLoaded = useRef(false);
  const hasNewReplies = raw.hasNewReplies === true;
  const newReplies: { senderName: string; text: string; timestamp: string }[] = raw.newReplies ?? [];
  useEffect(() => {
    const shouldAutoExpand = raw.isThreadReply || hasNewReplies;
    const threadTs = raw.threadTs ?? raw.timestamp;
    if (shouldAutoExpand && threadTs && !threadAutoLoaded.current) {
      threadAutoLoaded.current = true;
      setShowThread(true);
      setLoadingThread(true);
      fetch(`/api/slack/thread?channel=${raw.channel}&ts=${threadTs}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setReplies(data);
            setActualReplyCount(data.length);
          }
        })
        .finally(() => setLoadingThread(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadContext = async (direction: "before" | "after") => {
    setLoadingContext(true);
    setContextDirection(direction);
    try {
      const res = await fetch(`/api/slack/context?channel=${raw.channel}&ts=${raw.timestamp}&direction=${direction}`);
      const msgs = await res.json();
      if (Array.isArray(msgs)) setContextMessages(msgs);
    } catch { /* ignore */ }
    setLoadingContext(false);
  };

  const fadeAndDismiss = (dismissFn: () => void) => {
    setFading(true);
    setTimeout(dismissFn, 300);
  };

  const isDm = raw.channelName?.startsWith("DM:");

  const sendReplyMessage = async (text: string) => {
    setSending(true);
    try {
      await fetch("/api/slack/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          channel: raw.channel,
          text,
          // DMs: reply in channel; threads/channels: reply in thread
          threadTs: isDm ? undefined : (raw.threadTs ?? raw.timestamp),
          timestamp: raw.timestamp,
        }),
      });
      setReplyText("");
      setShowReply(false);
      if (isLast && onDismissChannel) {
        fadeAndDismiss(onDismissChannel);
      } else {
        fadeAndDismiss(() => onDismiss(item));
      }
    } finally {
      setSending(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    await sendReplyMessage(replyText);
  };

  const handleReact = async (emojiChar: string, emojiName: string) => {
    setReactedEmoji(emojiChar);
    await fetch("/api/slack/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "react",
        channel: raw.channel,
        timestamp: raw.timestamp,
        reaction: emojiName,
      }),
    });
    // If reacting to last message in a DM, dismiss the whole conversation
    if (isLast && onDismissChannel) {
      setTimeout(() => fadeAndDismiss(onDismissChannel), 400);
    } else {
      setTimeout(() => fadeAndDismiss(() => onDismiss(item)), 400);
    }
  };

  const isUnread = isContext ? false : raw.isUnread === true;

  return (
    <>
    {showNewDivider && (
      <div className="flex items-center gap-2 px-4 py-1">
        <div className="flex-1 h-px bg-red-500/50" />
        <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">New</span>
        <div className="flex-1 h-px bg-red-500/50" />
      </div>
    )}
    <div className={`px-4 py-2.5 hover:bg-card-hover transition-all duration-300 group slack-msg-enter ${fading ? "opacity-0 max-h-0 py-0 overflow-hidden" : ""}`}>
      {/* Main message */}
      <div className="flex items-start gap-2">
        {/* Dismiss button on left */}
        <button onClick={() => fadeAndDismiss(() => onDismiss(item))} className="shrink-0 mt-1 cursor-pointer text-red-400/0 group-hover:text-red-400/50 hover:!text-red-400 transition-colors p-0.5" title="Dismiss">
          <X size={11} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{raw.senderName ?? raw.sender}</span>
            {raw.isThreadReply && (
              <span className="text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded">in thread</span>
            )}
            <span className="text-[11px] text-muted/60">{raw.timestamp ? formatTime(raw.timestamp) : ""}</span>
            {reactedEmoji && <span className="text-sm animate-bounce">{reactedEmoji}</span>}
            {/* Quick actions: emojis + reply — inline with timestamp */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
              {[
                ["\u{1F44D}", "+1"],
                ["\u{2705}", "white_check_mark"],
                ["\u{1F440}", "eyes"],
                ["\u{1F64F}", "pray"],
                ["\u{1F525}", "fire"],
                ["\u{1F680}", "rocket"],
                ["\u{1F389}", "tada"],
                ["\u{2764}\u{FE0F}", "heart"],
              ].map(([emoji, name]) => (
                <button key={name} onClick={() => handleReact(emoji, name)}
                  className="cursor-pointer hover:bg-card-hover rounded px-1 py-0.5 hover:scale-125 transition-all text-sm leading-none"
                >{emoji}</button>
              ))}
              <div className="w-px h-4 bg-border/30 mx-0.5" />
              <button onClick={() => {
                const opening = !showReply;
                setShowReply(opening);
                if (opening && !suggestionsLoaded.current) {
                  suggestionsLoaded.current = true;
                  setLoadingSuggestions(true);
                  const convContext = replies.length > 0
                    ? replies.map((r) => `${r.senderName}: ${r.text}`).join("\n")
                    : "";
                  fetch("/api/slack/suggest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      channelName: raw.channelName,
                      senderName: raw.senderName,
                      messageText: raw.text,
                      conversationContext: convContext,
                    }),
                  })
                    .then((r) => r.json())
                    .then((s) => { if (Array.isArray(s)) setSuggestions(s); })
                    .catch(() => {})
                    .finally(() => setLoadingSuggestions(false));
                }
              }} className="cursor-pointer text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded px-1.5 py-0.5 transition-all flex items-center gap-1 text-[11px] font-medium" title="Reply">
                <MessageSquare size={11} /> Reply
              </button>
              <div className="w-px h-4 bg-border/30 mx-0.5" />
              <button
                disabled={sending}
                onClick={async () => {
                  // Reply with a random quick reply and create a todo task
                  const replies = quickReplies?.length ? quickReplies : ["Kollar på det!"];
                  const reply = replies[Math.floor(Math.random() * replies.length)];
                  const taskText = `[Slack] ${raw.senderName ?? "Someone"} in #${raw.channelName ?? "channel"}: "${(raw.text ?? "").slice(0, 120)}"`;
                  sendReplyMessage(reply);
                  await fetch("/api/todos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: taskText }),
                  });
                }}
                className="cursor-pointer text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded px-1.5 py-0.5 transition-all flex items-center gap-1 text-[11px] font-medium disabled:opacity-50"
                title="Quick reply and create a task"
              >
                <Zap size={11} /> Quick reply
              </button>
            </div>
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed mt-0.5 text-foreground/80"><SlackText text={raw.text ?? ""} /></p>
          {raw.files && raw.files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1.5">
              {raw.files.map((f: { name: string; mimetype: string; url: string; thumb?: string }, idx: number) => {
                const proxyUrl = `/api/slack/image?url=${encodeURIComponent(f.thumb ?? f.url)}`;
                const fullProxyUrl = `/api/slack/image?url=${encodeURIComponent(f.url)}`;
                if (f.mimetype?.startsWith("image/")) {
                  return (
                    <img
                      key={idx}
                      src={proxyUrl}
                      alt={f.name}
                      className="max-w-[400px] max-h-[300px] rounded border border-border/50 hover:border-accent/50 transition-colors cursor-pointer"
                      onClick={() => onImageClick?.(fullProxyUrl)}
                    />
                  );
                }
                return (
                  <a key={idx} href={fullProxyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 rounded bg-card-hover border border-border/50 text-[11px] text-accent hover:underline">
                    <ExternalLink size={10} />
                    {f.name}
                  </a>
                );
              })}
            </div>
          )}
          {/* Reactions */}
          {raw.reactions && raw.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {raw.reactions.map((r: { name: string; count: number }, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-card-hover border border-border/50 text-xs">
                  <span>{EMOJI_MAP[r.name] ?? `:${r.name}:`}</span>
                  {r.count > 1 && <span className="text-[10px] text-muted/60">{r.count}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Right actions: snooze, link */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <SnoozeButton source={item.source} sourceId={item.source_id} onDone={() => fadeAndDismiss(() => onDismiss(item))} />
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="cursor-pointer text-accent/50 hover:text-accent transition-colors p-1">
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>


      {/* Context messages */}
      {contextMessages.length > 0 && (
        <div className="mt-1.5 border-l-2 border-muted/20 pl-3 space-y-1">
          {contextDirection === "before" && (
            <div className="text-[9px] text-muted/40 uppercase tracking-wide">Earlier messages</div>
          )}
          {contextMessages.map((msg, i) => (
            <div key={i} className="py-0.5">
              <span className="text-[10px] font-semibold text-muted/70">{msg.senderName}</span>
              <span className="text-[9px] text-muted/30 ml-1.5">{msg.timestamp ? formatTime(msg.timestamp) : ""}</span>
              <p className="text-[11px] text-muted/60 whitespace-pre-wrap leading-relaxed"><SlackText text={msg.text ?? ""} /></p>
            </div>
          ))}
          {contextDirection === "after" && (
            <div className="text-[9px] text-muted/40 uppercase tracking-wide">Later messages</div>
          )}
          <button onClick={() => setContextMessages([])} className="text-[9px] text-muted/40 hover:text-muted transition-colors">Hide</button>
        </div>
      )}

      {/* Load context buttons */}
      {contextMessages.length === 0 && (
        <div className="flex items-center gap-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => loadContext("before")}
            disabled={loadingContext}
            className="text-[9px] text-muted/40 hover:text-muted transition-colors flex items-center gap-0.5 disabled:opacity-50"
          >
            {loadingContext && contextDirection === "before" ? <Loader2 size={8} className="animate-spin" /> : "↑"} Earlier
          </button>
          <button
            onClick={() => loadContext("after")}
            disabled={loadingContext}
            className="text-[9px] text-muted/40 hover:text-muted transition-colors flex items-center gap-0.5 disabled:opacity-50"
          >
            {loadingContext && contextDirection === "after" ? <Loader2 size={8} className="animate-spin" /> : "↓"} Later
          </button>
        </div>
      )}

      {/* Thread indicator */}
      {(replyCount > 0 || hasNewReplies) && (
        <button
          onClick={async () => {
            if (!showThread && replies.length === 0) {
              setLoadingThread(true);
              try {
                const res = await fetch(`/api/slack/thread?channel=${raw.channel}&ts=${raw.threadTs ?? raw.timestamp}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                  setReplies(data);
                  setActualReplyCount(data.length);
                }
              } finally {
                setLoadingThread(false);
              }
            }
            setShowThread(!showThread);
          }}
          className="mt-1.5 flex items-center gap-1.5 text-[11px] text-accent hover:underline cursor-pointer"
        >
          {loadingThread ? <Loader2 size={10} className="animate-spin" /> : showThread ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {displayReplyCount} {displayReplyCount === 1 ? "reply" : "replies"}
          {hasNewReplies && !showThread && (
            <span className="text-[9px] text-red-400 font-semibold">NEW</span>
          )}
          {!showThread && replyUserNames.length > 0 && (
            <span className="text-muted/60 font-normal">from {replyUserNames.join(", ")}</span>
          )}
        </button>
      )}

      {/* Thread replies */}
      {showThread && replies.length > 0 && (() => {
        // Find where new replies start (by matching timestamps from newReplies)
        const newReplyTimestamps = new Set(newReplies.map(r => r.timestamp));
        let firstNewIdx = -1;
        if (newReplyTimestamps.size > 0) {
          for (let i = 0; i < replies.length; i++) {
            if (newReplyTimestamps.has(replies[i].timestamp)) {
              firstNewIdx = i;
              break;
            }
          }
        }
        return (
          <div className="ml-2 mt-2 border-l-2 border-accent/30 pl-3 space-y-1.5">
            {replies.map((reply, i) => (
              <div key={i}>
                {firstNewIdx > 0 && i === firstNewIdx && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-red-500/50" />
                    <span className="text-[9px] font-semibold text-red-400 uppercase tracking-wider">New</span>
                    <div className="flex-1 h-px bg-red-500/50" />
                  </div>
                )}
                <div className="py-1 group/reply">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{reply.senderName}</span>
                    <span className="text-[10px] text-muted/40">{reply.timestamp ? formatTime(reply.timestamp) : ""}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity ml-auto">
                      {[
                        ["\u{1F44D}", "+1"],
                        ["\u{2705}", "white_check_mark"],
                        ["\u{1F440}", "eyes"],
                      ].map(([emoji, name]) => (
                        <button key={name} onClick={() => {
                          fetch("/api/slack/action", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "react", channel: raw.channel, timestamp: reply.timestamp, reaction: name }),
                          });
                        }} className="cursor-pointer hover:bg-card-hover rounded px-0.5 py-0.5 hover:scale-125 transition-all text-xs leading-none">{emoji}</button>
                      ))}
                      <div className="w-px h-3 bg-border/30 mx-0.5" />
                      <button onClick={() => { setShowReply(true); setReplyText(""); }}
                        className="cursor-pointer text-emerald-400/60 hover:text-emerald-300 rounded px-1 py-0.5 transition-all text-[10px] flex items-center gap-0.5" title="Reply">
                        <MessageSquare size={9} /> Reply
                      </button>
                      <button
                        disabled={sending}
                        onClick={async () => {
                          const qr = quickReplies?.length ? quickReplies : ["Kollar på det!"];
                          const text = qr[Math.floor(Math.random() * qr.length)];
                          sendReplyMessage(text);
                        }}
                        className="cursor-pointer text-amber-400/60 hover:text-amber-300 rounded px-1 py-0.5 transition-all text-[10px] flex items-center gap-0.5 disabled:opacity-50" title="Quick reply">
                        <Zap size={9} /> Quick reply
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed mt-0.5"><SlackText text={reply.text ?? ""} /></p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Reply input with suggestions */}
      {showReply && (
        <div className="mt-2 space-y-1.5">
          {/* Suggested replies */}
          {loadingSuggestions && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted">
              <Sparkles size={10} className="animate-pulse text-accent" /> Thinking...
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => sendReplyMessage(s)} disabled={sending}
                  className="cursor-pointer text-[11px] px-2 py-1 rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors text-left disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
              placeholder={isDm ? "Reply in DM..." : "Reply in thread..."}
              className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
              autoFocus
            />
            <button
              onClick={handleReply}
              disabled={sending || !replyText.trim()}
              className="cursor-pointer px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <Send size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function ProfileSetup({ onDone }: { onDone: (p: Profile) => void }) {
  const [githubUsers, setGithubUsers] = useState<GithubUser[]>([]);
  const [linearUsers, setLinearUsers] = useState<LinearUser[]>([]);
  const [selectedGithub, setSelectedGithub] = useState("");
  const [selectedLinear, setSelectedLinear] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/profile/lookup?source=github").then((r) => r.json()),
      fetch("/api/profile/lookup?source=linear").then((r) => r.json()),
    ])
      .then(([gh, lin]) => {
        setGithubUsers(gh);
        setLinearUsers(lin);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const profile: Profile = {
      github_username: selectedGithub || null,
      linear_email: selectedLinear || null,
      slack_user_id: null,
    };
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    onDone(await res.json());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6">
        <h1 className="text-lg font-bold mb-1">Builder Command</h1>
        <p className="text-sm text-muted mb-6">Select yourself in each system.</p>

        <label className="block text-xs text-muted mb-1">GitHub</label>
        <select
          value={selectedGithub}
          onChange={(e) => setSelectedGithub(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-accent appearance-none"
        >
          <option value="">Select GitHub user...</option>
          {githubUsers.map((u) => (
            <option key={u.username} value={u.username}>
              {u.name} (@{u.username})
            </option>
          ))}
        </select>

        <label className="block text-xs text-muted mb-1">Linear</label>
        <select
          value={selectedLinear}
          onChange={(e) => setSelectedLinear(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-6 focus:outline-none focus:border-accent appearance-none"
        >
          <option value="">Select Linear user...</option>
          {linearUsers.map((u) => (
            <option key={u.email} value={u.email}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>

        <button
          onClick={handleSave}
          disabled={!selectedGithub && !selectedLinear}
          className="w-full py-2 rounded-lg bg-accent text-white hover:bg-accent-hover text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
