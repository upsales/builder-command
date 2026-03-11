"use client";

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { RefreshCw, ExternalLink, Loader2, GitPullRequest, CircleDot, User, Calendar, Tag, ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, XCircle, CheckCircle, MessageSquare, Send, Hash, X, Clock, MapPin, Video, Users, Bot, ArrowUp, Sparkles, PanelLeftClose, PanelLeft, Settings, LayoutDashboard, Flame, Zap, Trophy, Plus, Trash2, Square, CheckSquare, Play, Pause } from "lucide-react";
import ReactMarkdown from "react-markdown";

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
function CustomActionsMenu({ source, context, onAction, size = 12 }: {
  source: "linear" | "github";
  context: Record<string, string>;
  onAction: (prompt: string) => void;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actions, setActions] = useLocalStorage<{ id: string; name: string; emoji: string; prompt: string; source: "linear" | "github" | "both" }[]>("ui:customActions", [
    { id: "1", name: "Summarize", emoji: "📋", prompt: "Summarize this ticket concisely: [{identifier}] {title}\n\n{description}", source: "both" },
    { id: "2", name: "Plan implementation", emoji: "🛠️", prompt: "Create an implementation plan for: [{identifier}] {title}\n\n{description}", source: "both" },
  ]);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("⚡");
  const [newPrompt, setNewPrompt] = useState("");
  const [newSource, setNewSource] = useState<"linear" | "github" | "both">("both");

  const applicable = actions.filter((a) => a.source === "both" || a.source === source);

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
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
          {applicable.map((a) => (
            <div key={a.id} className="flex items-center">
              <button
                onClick={() => { onAction(fillTemplate(a.prompt)); setOpen(false); }}
                className="flex-1 text-left px-3 py-1.5 text-xs hover:bg-card-hover transition-colors flex items-center gap-2"
              >
                <span>{a.emoji}</span> {a.name}
              </button>
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
                <textarea value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1 text-xs h-16 resize-none" placeholder="Prompt template... Use {title}, {identifier}, {description}" />
                <select value={newSource} onChange={(e) => setNewSource(e.target.value as "linear" | "github" | "both")} className="w-full bg-background border border-border rounded px-2 py-0.5 text-xs">
                  <option value="both">Both Linear & GitHub</option>
                  <option value="linear">Linear only</option>
                  <option value="github">GitHub only</option>
                </select>
                <div className="flex gap-1">
                  <button onClick={() => {
                    if (!newName.trim() || !newPrompt.trim()) return;
                    setActions([...actions, { id: String(Date.now()), name: newName, emoji: newEmoji || "⚡", prompt: newPrompt, source: newSource }]);
                    setNewName(""); setNewEmoji("⚡"); setNewPrompt(""); setNewSource("both");
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
  const [agentSessionData, setAgentSessionData] = useState<{ id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; messages?: string; tool_calls?: string; started_at?: string; completed_at?: string; todoText?: string } | null>(null);
  const [agentSessions, setAgentSessions] = useState<{ id: string; todo_id: string; status: string; summary?: string; started_at?: string; completed_at?: string }[]>([]);
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
        const todosRes = await fetch("/api/todos?mode=queue");
        const todos = await todosRes.json();
        const todo = todos.find((t: { id: string }) => t.id === data.todo_id);
        setAgentSessionData({ ...data, todoText: todo?.text });
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

  // Auto-open a running session when switching to agent tab
  useEffect(() => {
    if (chatTab !== "agent" || agentSessionId) return;
    const running = agentSessions.find(s => s.status === "running");
    if (running) loadAgentSession(running.id);
  }, [chatTab, agentSessions, agentSessionId, loadAgentSession]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
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
                  streamingTextRef.current += `> ✓ ${data.result}\n\n`;
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
          <span className="text-[10px] text-muted bg-card-hover px-1.5 py-0.5 rounded">context-aware</span>
        )}
      </div>

      {/* Chat tab */}
      {chatTab === "chat" && (<>
        <div ref={messagesContainerRef} onScroll={checkIfNearBottom} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
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
                {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
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
                <ReactMarkdown>{streamingText}</ReactMarkdown>
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
                <button onClick={() => { setAgentSessionId(null); setAgentSessionData(null); }} className="text-muted hover:text-foreground transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{agentSessionData.todoText ?? "Task"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {agentSessionData.status === "running" && <span className="text-[9px] text-purple-400 flex items-center gap-0.5"><Loader2 size={8} className="animate-spin" /> Running</span>}
                    {agentSessionData.status === "completed" && <span className="text-[9px] text-green-400 flex items-center gap-0.5"><CheckCircle size={8} /> Completed</span>}
                    {agentSessionData.status === "failed" && <span className="text-[9px] text-red-400 flex items-center gap-0.5"><XCircle size={8} /> Failed</span>}
                    {agentSessionData.started_at && <span className="text-[9px] text-muted/40">{new Date(agentSessionData.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>}
                  </div>
                </div>
              </div>
              {/* Session content — tool calls and summary */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* Summary */}
                {agentSessionData.summary && (
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                    <h4 className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide mb-1.5">Summary</h4>
                    <div className="text-sm text-foreground/80 leading-relaxed chat-markdown">
                      <ReactMarkdown>{agentSessionData.summary}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {agentSessionData.failure_reason && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                    <h4 className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-1.5">Failed</h4>
                    <p className="text-sm text-red-400/80 leading-relaxed">{agentSessionData.failure_reason}</p>
                  </div>
                )}
                {/* Tool calls log — collapsed by default */}
                {agentSessionData.tool_calls && (() => {
                  const calls = JSON.parse(agentSessionData.tool_calls);
                  return calls.length > 0 ? (
                    <details>
                      <summary className="text-[10px] font-semibold text-muted uppercase tracking-wide cursor-pointer hover:text-foreground transition-colors select-none">
                        Tool Calls ({calls.length})
                      </summary>
                      <div className="space-y-1.5 mt-1.5">
                        {calls.map((tc: { tool: string; input: unknown; result: string; timestamp?: string }, i: number) => (
                          <div key={i} className="bg-card border border-border rounded-lg p-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-semibold text-purple-400">{tc.tool}</span>
                              <span className="text-[9px] text-muted/40">#{i + 1}</span>
                              {tc.timestamp && <span className="text-[9px] text-muted/30 ml-auto">{new Date(tc.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span>}
                            </div>
                            {tc.input && (
                              <pre className="text-[10px] text-muted/60 bg-background rounded p-1.5 overflow-x-auto mb-1 max-h-20 overflow-y-auto">{JSON.stringify(tc.input, null, 2)}</pre>
                            )}
                            <p className="text-[11px] text-muted/70 whitespace-pre-wrap">{tc.result}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null;
                })()}
                {/* Full messages */}
                {agentSessionData.messages && (() => {
                  try {
                    const msgs = JSON.parse(agentSessionData.messages);
                    const textBlocks: { role: string; text: string }[] = [];
                    for (const msg of msgs) {
                      if (typeof msg.content === "string") {
                        textBlocks.push({ role: msg.role, text: msg.content });
                      } else if (Array.isArray(msg.content)) {
                        for (const block of msg.content) {
                          if (block.type === "text") textBlocks.push({ role: msg.role, text: block.text });
                        }
                      }
                    }
                    return textBlocks.length > 0 ? (
                      <div>
                        <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1.5">Conversation</h4>
                        <div className="space-y-2">
                          {textBlocks.map((tb, i) => (
                            <div key={i} className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${tb.role === "user" ? "bg-accent/10 text-foreground/80" : "bg-card border border-border chat-markdown"}`}>
                              <span className="text-[9px] font-semibold text-muted/50 uppercase block mb-0.5">{tb.role === "user" ? "Task" : "Agent"}</span>
                              <ReactMarkdown>{tb.text}</ReactMarkdown>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  } catch { return null; }
                })()}
              </div>
            </div>
          ) : loadingAgentSession ? (
            <div className="flex items-center justify-center h-full text-muted">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            /* Session list */
            <div className="px-4 py-3 space-y-2">
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
                      className="w-full text-left bg-card border border-border rounded-lg p-2.5 hover:bg-card-hover transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        {s.status === "running" && <Loader2 size={10} className="text-purple-400 animate-spin" />}
                        {s.status === "completed" && <CheckCircle size={10} className="text-green-400" />}
                        {s.status === "failed" && <XCircle size={10} className="text-red-400" />}
                        <span className="text-xs font-medium truncate">{s.summary?.slice(0, 60) ?? "Processing..."}</span>
                      </div>
                      <span className="text-[9px] text-muted/40">
                        {s.started_at ? new Date(s.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : ""}
                      </span>
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

interface XpData {
  total: number; today: number; level: number; xpInLevel: number; xpForNextLevel: number; streak: number;
  todayActions: { action: string; source: string | null; xp: number; label: string | null; created_at: string }[];
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

  // XP / gamification
  const [xpData, setXpData] = useState<XpData | null>(null);
  const refreshXp = useCallback(() => {
    fetch("/api/xp").then((r) => r.json()).then(setXpData).catch(() => {});
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
  const [dailyTodos, setDailyTodos] = useState<{ id: string; text: string; done: number; date: string; deadline?: string | null; image?: string | null; note?: string | null; agent_enabled?: number }[]>([]);
  const [agentStatus, setAgentStatus] = useState<{ running: boolean; currentTodoId: string | null; currentTodoText: string | null; queueLength: number } | null>(null);
  const [agentSessions, setAgentSessions] = useState<Record<string, { id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; tool_calls?: string }>>({});
  const refreshTodos = useCallback(() => {
    fetch("/api/todos?mode=queue").then((r) => r.json()).then((todos) => {
      setDailyTodos(todos);
      // Fetch agent sessions for agent-enabled todos
      const agentTodoIds = todos.filter((t: { agent_enabled?: number }) => t.agent_enabled).map((t: { id: string }) => t.id);
      if (agentTodoIds.length > 0) {
        Promise.all(agentTodoIds.map((id: string) =>
          fetch(`/api/agent/sessions?todo_id=${id}`).then(r => r.json())
        )).then((results) => {
          const sessionsMap: Record<string, { id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; tool_calls?: string }> = {};
          for (const sessions of results) {
            if (sessions.length > 0) sessionsMap[sessions[0].todo_id] = sessions[0];
          }
          setAgentSessions(sessionsMap);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshXp();
    refreshTodos();
    // Poll todos every 5 seconds to catch external changes (e.g. CLI updates)
    const todoPoll = setInterval(refreshTodos, 5000);
    return () => clearInterval(todoPoll);
  }, [refreshXp, refreshTodos]);

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
          // Focus the todo input (switch to queue tab if needed)
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
          watchedChannels,
          githubMode,
          ...(quick ? { slackLookbackMinutes: 5, activeDmChannelIds } : {}),
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

  // Auto-sync: full on first load, quick every 30s
  const syncingRef = useRef(false);
  syncingRef.current = syncing;
  const hasInitialSynced = useRef(false);
  useEffect(() => {
    if (!profile) return;
    if (!hasInitialSynced.current) {
      hasInitialSynced.current = true;
      handleSync(false);
    }
    // Quick sync every 30s for near-realtime Slack updates
    const interval = setInterval(() => {
      if (!syncingRef.current) handleSync(true);
    }, 30 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Lightweight poll for webhook-triggered changes (every 2s, just checks a counter)
  const lastChangeRef = useRef(0);
  const [slackSocketLog, setSlackSocketLog] = useState<{ time: string; type: string; detail: string }[]>([]);
  const [slackSocketRunning, setSlackSocketRunning] = useState(false);
  const [showSocketLog, setShowSocketLog] = useState(false);
  const [activeTab, setActiveTab] = useLocalStorage<"dashboard" | "queue">("ui:activeTab", "queue");
  useEffect(() => {
    if (!profile) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/changes");
        const data = await res.json();
        setSlackSocketRunning(!!data.slackSocket);
        if (data.socketLog) setSlackSocketLog(data.socketLog);
        if (data.agentStatus) setAgentStatus(data.agentStatus);
        if (data.v !== lastChangeRef.current) {
          lastChangeRef.current = data.v;
          const itemsRes = await fetch("/api/items");
          const newItems = await itemsRes.json();
          setItems(newItems);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [profile]);

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
    }).then(() => refreshXp());
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }, [refreshXp]);

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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
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
          <h1 className="text-sm font-bold">Builder Agent</h1>
        </div>

        {/* Socket status */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSocketLog((p) => !p)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${slackSocketRunning ? "bg-green-500/10 text-green-400 hover:bg-green-500/20" : "bg-red-500/10 text-red-400 hover:bg-red-500/20"}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${slackSocketRunning ? "bg-green-400" : "bg-red-400"}`} />
            Socket
          </button>
        </div>

        {/* Agent status */}
        {agentStatus?.running && (
          <div className="flex items-center gap-1.5" title={agentStatus.currentTodoText ? `Working on: ${agentStatus.currentTodoText}` : "Agent processing..."}>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 bg-purple-500/10 text-purple-400">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              Agent
            </span>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex items-center gap-0.5 border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === "dashboard" ? "bg-sky-500/20 text-sky-400" : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            <LayoutDashboard size={11} /> Overview
          </button>
          <button
            onClick={() => setActiveTab("queue")}
            className={`px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
              activeTab === "queue" ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            Action Queue
          </button>
        </div>

        {/* Sync status */}
        {syncing && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Loader2 size={10} className="animate-spin" />
            <span className="truncate max-w-[200px]">{syncStatus ?? "Syncing..."}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* XP bar — right-aligned */}
        {xpData && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px]">
              <Trophy size={11} className="text-yellow-400" />
              <span className="font-bold text-yellow-400">Lv{xpData.level}</span>
            </div>
            <div className="w-24 h-1.5 bg-card-hover rounded-full overflow-hidden" title={`${xpData.xpInLevel}/${xpData.xpForNextLevel} XP to next level`}>
              <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-500" style={{ width: `${(xpData.xpInLevel / xpData.xpForNextLevel) * 100}%` }} />
            </div>
            <span className="text-[10px] text-muted/60">{xpData.xpInLevel}/{xpData.xpForNextLevel}</span>
            {xpData.today > 0 && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                <Zap size={9} /> +{xpData.today} today
              </span>
            )}
            {xpData.streak > 1 && (
              <span className="text-[10px] text-orange-400 flex items-center gap-0.5">
                <Flame size={9} /> {xpData.streak}d
              </span>
            )}
          </div>
        )}

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
          <button onClick={() => handleSync(false)} disabled={syncing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover text-[11px] transition-colors disabled:opacity-50">
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Sync
          </button>
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
              <XCircle size={10} /> {err}
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
          <div className="p-4">
            {items.length === 0 ? (
              <div className="text-center py-20 text-muted">
                <p className="text-lg mb-2">No items yet</p>
                <p className="text-sm">Hit Sync to pull from your integrations</p>
              </div>
            ) : (
              <ItemList items={items} setItems={setItems} onDismiss={onDismiss} dailyTodos={dailyTodos} xpData={xpData} onRefreshTodos={refreshTodos} onRefreshXp={refreshXp} onChatAbout={handleChatAbout} repoStatuses={repoStatuses} slackUserId={profile?.slack_user_id ?? undefined} watchedChannels={watchedChannels} availableChannels={availableChannels} onToggleWatchedChannel={toggleWatchedChannel} activeTab={activeTab} agentSessions={agentSessions} githubMode={githubMode} onSetGithubMode={setGithubMode} onOpenAgentSession={(sessionId) => { setChatCollapsed(false); chatRef.current?.openAgentSession(sessionId); }} />
            )}
          </div>
        </div>

        {/* Right: Slack Socket Log Panel */}
        {showSocketLog && (
          <div className="w-[360px] shrink-0 border-l border-border bg-card flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${slackSocketRunning ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                Slack Socket Live Log
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetch("/api/slack/socket-restart", { method: "POST" })}
                  className="text-[10px] text-accent hover:text-accent-hover px-2 py-0.5 rounded hover:bg-accent/10 transition-colors"
                >
                  Restart
                </button>
                <button onClick={() => setShowSocketLog(false)} className="text-muted/50 hover:text-muted p-1"><X size={14} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {slackSocketLog.length === 0 ? (
                <div className="text-[11px] text-muted/50 text-center py-8">No events yet. Waiting for Slack messages...</div>
              ) : (
                <div className="space-y-0.5 font-mono">
                  {slackSocketLog.map((evt, i) => (
                    <div key={i} className="text-[10px] flex gap-2 py-0.5">
                      <span className="text-muted/50 shrink-0">{evt.time}</span>
                      <span className={`shrink-0 w-16 ${
                        evt.type === "added" ? "text-green-400" :
                        evt.type === "error" ? "text-red-400" :
                        evt.type === "connected" ? "text-sky-400" :
                        evt.type === "skip" || evt.type === "ignored" ? "text-muted/40" :
                        "text-yellow-400"
                      }`}>{evt.type}</span>
                      <span className="text-muted/70 break-all">{evt.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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

function SettingsModal({ onClose }: { onClose: () => void }) {
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

        {!settings ? (
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

function TodoSection({ todos, onRefresh, inProgressTodoId, onToggleInProgressTodo, agentSessions, onOpenAgentSession }: {
  todos: { id: string; text: string; done: number; date: string | null; deadline?: string | null; image?: string | null; note?: string | null; agent_enabled?: number }[];
  onRefresh: () => void;
  inProgressTodoId?: string | null;
  onToggleInProgressTodo?: (id: string) => void;
  agentSessions?: Record<string, { id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; tool_calls?: string }>;
  onOpenAgentSession?: (sessionId: string) => void;
}) {
  const [newTodo, setNewTodo] = useState("");
  const [noDate, setNoDate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [doneLimit, setDoneLimit] = useState(15);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImage(reader.result as string);
        if (!newTodo.trim()) setNewTodo("Screenshot");
      };
      reader.readAsDataURL(file);
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
          reader.onload = () => {
            setPendingImage(reader.result as string);
            if (!newTodo.trim()) setNewTodo("Screenshot");
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  };

  const setDeadline = async (id: string, deadline: string | null) => {
    await fetch("/api/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, deadline }),
    });
    onRefresh();
  };

  const formatDeadline = (dl: string) => {
    const d = new Date(dl + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: "text-red-400" };
    if (diff === 0) return { text: "today", color: "text-orange-400" };
    if (diff === 1) return { text: "tomorrow", color: "text-yellow-400" };
    return { text: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "text-muted/60" };
  };

  const addTodo = async () => {
    const text = newTodo.trim();
    if (!text && !pendingImage) return;
    setNewTodo("");
    const image = pendingImage;
    setPendingImage(null);
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
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const toggleAgent = async (id: string, enabled: boolean) => {
    if (enabled) {
      // Use trigger endpoint which sets agent_enabled and starts processing
      await fetch("/api/agent/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todo_id: id }),
      });
    } else {
      await fetch("/api/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, agent_enabled: false }),
      });
    }
    onRefresh();
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
    <div className="space-y-1">
      {/* Undone todos */}
      {undoneTodos.map((todo) => (
        <div
          key={todo.id}
          draggable
          onDragStart={() => handleDragStart(todo.id)}
          onDragOver={(e) => handleDragOver(e, todo.id)}
          onDragEnd={handleDragEnd}
          className={`group/todo py-0.5 transition-all duration-400 ${completingIds.has(todo.id) ? "opacity-40 line-through scale-95 translate-x-2" : ""} ${dragId === todo.id ? "opacity-30" : ""} ${dragOverId === todo.id && dragId !== todo.id ? "border-t-2 border-accent" : ""} cursor-grab active:cursor-grabbing`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleTodo(todo.id, true)}
              className={`shrink-0 transition-colors ${completingIds.has(todo.id) ? "text-green-400" : "text-muted/40 hover:text-muted"}`}
            >
              {completingIds.has(todo.id) ? <CheckSquare size={14} /> : <Square size={14} />}
            </button>
            {editingId === todo.id ? (
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => saveEdit(todo.id)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(todo.id); if (e.key === "Escape") setEditingId(null); }}
                autoFocus
                className="flex-1 bg-transparent text-xs focus:outline-none border-b border-accent/50"
              />
            ) : (
              <span
                className="flex-1 text-xs"
                onDoubleClick={() => { setEditingId(todo.id); setEditText(todo.text); }}
              >
                {todo.text}
              </span>
            )}
          {inProgressTodoId === todo.id && (
            <span className="text-[9px] text-sky-400 font-medium shrink-0 flex items-center gap-0.5"><Play size={8} fill="currentColor" /> In Progress</span>
          )}
          {todo.deadline && (() => {
            const dl = formatDeadline(todo.deadline);
            return <span className={`text-[9px] shrink-0 ${dl.color}`}>{dl.text}</span>;
          })()}
          {todo.date === null && !todo.deadline && <span className="text-[9px] text-muted/30 shrink-0">persistent</span>}
          {/* Agent session status badge */}
          {agentSessions?.[todo.id] && (() => {
            const session = agentSessions[todo.id];
            if (session.status === "running") return <span className="text-[9px] text-purple-400 font-medium shrink-0 flex items-center gap-0.5"><Loader2 size={8} className="animate-spin" /> Agent</span>;
            if (session.status === "completed") return <span className="text-[9px] text-green-400 font-medium shrink-0 flex items-center gap-0.5"><CheckCircle size={8} /> Done</span>;
            if (session.status === "failed") return <span className="text-[9px] text-red-400 font-medium shrink-0 flex items-center gap-0.5"><XCircle size={8} /> Failed</span>;
            return null;
          })()}
          {onToggleInProgressTodo && (
            <button
              onClick={() => onToggleInProgressTodo(todo.id)}
              className={`opacity-0 group-hover/todo:opacity-100 transition-all p-1 ${inProgressTodoId === todo.id ? "text-sky-400 hover:text-muted !opacity-100" : "text-muted/50 hover:text-sky-400"}`}
              title={inProgressTodoId === todo.id ? "Stop working" : "Set In Progress"}
            >
              {inProgressTodoId === todo.id ? <Pause size={13} /> : <Play size={13} />}
            </button>
          )}
          <button
            onClick={() => toggleAgent(todo.id, !todo.agent_enabled)}
            className={`opacity-0 group-hover/todo:opacity-100 transition-all p-1 ${todo.agent_enabled ? "text-purple-400 hover:text-muted !opacity-100" : "text-muted/50 hover:text-purple-400"}`}
            title={todo.agent_enabled ? "Disable AI agent" : "Run with AI agent"}
          >
            <Bot size={13} />
          </button>
          <input
            type="date"
            value={todo.deadline ?? ""}
            onChange={(e) => setDeadline(todo.id, e.target.value || null)}
            className="opacity-0 group-hover/todo:opacity-100 w-5 h-5 text-[9px] bg-transparent cursor-pointer shrink-0 [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
            title="Set deadline"
          />
          <button
            onClick={() => startNoting(todo.id)}
            className="opacity-0 group-hover/todo:opacity-100 text-muted/50 hover:text-green-400 transition-all p-1"
            title="Complete with note"
          >
            <MessageSquare size={13} />
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
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitNote(todo.id); if (e.key === "Escape") setNotingId(null); }}
                placeholder="Add a note..."
                autoFocus
                className="flex-1 bg-card border border-border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-accent/50"
              />
              <button onClick={() => submitNote(todo.id)} className="text-green-400 hover:text-green-300 text-[10px] font-medium">Done</button>
              <button onClick={() => setNotingId(null)} className="text-muted/50 hover:text-muted text-[10px]">Cancel</button>
            </div>
          )}
          {todo.image && (
            <div className="ml-5 mt-0.5 mb-1">
              <img src={todo.image} alt="" className="h-16 rounded border border-border/50 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(todo.image!, "_blank")} />
            </div>
          )}
          {/* Agent session details — prominent display */}
          {agentSessions?.[todo.id] && (() => {
            const session = agentSessions[todo.id];
            const isCompleted = session.status === "completed";
            const isFailed = session.status === "failed";
            return (
              <div className={`ml-5 mt-1 mb-1.5 rounded-lg p-2 ${isCompleted ? "bg-purple-500/5 border border-purple-500/15" : isFailed ? "bg-red-500/5 border border-red-500/15" : "bg-card border border-border"}`}>
                {session.summary && (
                  <p className="text-[11px] text-foreground/70 leading-relaxed whitespace-pre-wrap">{session.summary}</p>
                )}
                {session.failure_reason && (
                  <p className="text-[11px] text-red-400/80 leading-relaxed">{session.failure_reason}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  {onOpenAgentSession && (
                    <button
                      onClick={() => onOpenAgentSession(session.id)}
                      className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 font-medium"
                    >
                      <MessageSquare size={9} /> Open in chat
                    </button>
                  )}
                  {session.tool_calls && (
                    <button
                      onClick={() => setExpandedSession(expandedSession === todo.id ? null : todo.id)}
                      className="text-[9px] text-muted/40 hover:text-muted/70 transition-colors flex items-center gap-0.5"
                    >
                      {expandedSession === todo.id ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
                      {JSON.parse(session.tool_calls).length} tool calls
                    </button>
                  )}
                </div>
                {expandedSession === todo.id && session.tool_calls && (
                  <div className="mt-1 space-y-0.5 pl-2 border-l border-border/30">
                    {JSON.parse(session.tool_calls).map((tc: { tool: string; result: string }, i: number) => (
                      <div key={i} className="text-[9px] text-muted/50">
                        <span className="text-purple-400/60">{tc.tool}</span>
                        <span className="text-muted/30"> — {tc.result.slice(0, 100)}{tc.result.length > 100 ? "..." : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ))}

      {/* Add new todo */}
      <div
        className={`py-1 transition-colors ${dragOver ? "bg-accent/10 rounded border border-dashed border-accent/30" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {pendingImage && (
          <div className="flex items-center gap-2 mb-1 ml-5">
            <img src={pendingImage} alt="preview" className="h-12 rounded border border-border/50" />
            <button onClick={() => setPendingImage(null)} className="text-muted/50 hover:text-red-400 text-[10px]"><X size={10} /></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Plus size={14} className="text-muted/30 shrink-0" />
          <input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTodo(); }}
            onPaste={handlePaste}
            placeholder={dragOver ? "Drop image here..." : "Add a task..."}
            id="todo-input"
            className="flex-1 bg-transparent text-xs placeholder:text-muted/30 focus:outline-none"
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
              <div key={todo.id} className="group/todo py-0.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTodo(todo.id, false)}
                    className="shrink-0 text-green-400/60 transition-colors"
                  >
                    <CheckSquare size={14} />
                  </button>
                  <span className="flex-1 text-xs line-through text-muted decoration-muted/30" data-tooltip={todo.note || undefined}>{todo.text}</span>
                  {todo.note && (
                    <span className="text-accent/50 hover:text-accent transition-colors" data-tooltip={todo.note}><MessageSquare size={11} /></span>
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
    </div>
  );
}

function ItemList({ items, setItems, onDismiss, dailyTodos, xpData, onRefreshTodos, onRefreshXp, onChatAbout, repoStatuses, slackUserId, watchedChannels, availableChannels, onToggleWatchedChannel, activeTab, agentSessions, githubMode, onSetGithubMode, onOpenAgentSession }: {
  items: TodoItem[];
  setItems: React.Dispatch<React.SetStateAction<TodoItem[]>>;
  onDismiss: (item: TodoItem) => void;
  dailyTodos: { id: string; text: string; done: number; date: string; deadline?: string | null; image?: string | null; note?: string | null; agent_enabled?: number }[];
  xpData: XpData | null;
  onRefreshTodos: () => void;
  onRefreshXp: () => void;
  onChatAbout: (prompt: string, prInfo?: { repo: string; prNumber: number }) => void;
  repoStatuses: Record<string, string>;
  slackUserId?: string;
  watchedChannels: string[];
  availableChannels: { id: string; name: string; isDm: boolean; memberCount?: number }[];
  onToggleWatchedChannel: (id: string) => void;
  activeTab: "dashboard" | "queue";
  agentSessions: Record<string, { id: string; todo_id: string; status: string; summary?: string; failure_reason?: string; tool_calls?: string }>;
  githubMode?: "author" | "assignee";
  onSetGithubMode?: (mode: "author" | "assignee") => void;
  onOpenAgentSession?: (sessionId: string) => void;
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
  // In-progress item (pinned to top of action queue)
  const [inProgressKey, setInProgressKey] = useLocalStorage<string | null>("ui:inProgressKey", null);
  const inProgressItem = inProgressKey ? items.find((i) => `${i.source}:${i.source_id}` === inProgressKey) : null;
  const inProgressTodoId = inProgressKey?.startsWith("todo:") ? inProgressKey.slice(5) : null;
  const toggleInProgress = useCallback((item: TodoItem) => {
    const key = `${item.source}:${item.source_id}`;
    setInProgressKey((prev) => prev === key ? null : key);
  }, [setInProgressKey]);
  const toggleInProgressTodo = useCallback((todoId: string) => {
    const key = `todo:${todoId}`;
    setInProgressKey((prev) => prev === key ? null : key);
  }, [setInProgressKey]);

  // Chat about + set in progress: returns an onChatAbout wrapper for a specific item
  const chatAboutItem = useCallback((item: TodoItem) => (prompt: string, prInfo?: { repo: string; prNumber: number }) => {
    setInProgressKey(`${item.source}:${item.source_id}`);
    onChatAbout(prompt, prInfo);
  }, [setInProgressKey, onChatAbout]);

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
  });

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

  // Filtered items for browse tabs
  const linearItems = items.filter((i) => {
    if (i.source !== "linear") return false;
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    if (hiddenStates.has(raw.state)) return false;
    return true;
  });

  const githubItems = items.filter((i) => {
    if (i.source !== "github") return false;
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

  const slackItems = items.filter((i) => {
    if (i.source !== "slack") return false;
    if (hiddenSlackSenders.size === 0) return true;
    const raw = i.raw_data ? JSON.parse(i.raw_data) : {};
    const senderName = (raw.senderName ?? raw.sender ?? "").toLowerCase();
    for (const hidden of hiddenSlackSenders) {
      if (senderName.includes(hidden.toLowerCase())) return false;
    }
    return true;
  });

  const githubByRepo = new Map<string, TodoItem[]>();
  for (const item of githubItems) {
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    const repo = raw.repo ?? "unknown";
    if (!githubByRepo.has(repo)) githubByRepo.set(repo, []);
    githubByRepo.get(repo)!.push(item);
  }

  const [linearGroupBy, setLinearGroupBy] = useLocalStorage<"state" | "project" | "initiative">("filter:linearGroupBy", "state");

  const linearGrouped = new Map<string, TodoItem[]>();
  for (const item of linearItems) {
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    let key: string;
    if (linearGroupBy === "project") {
      key = raw.project ?? "No Project";
    } else if (linearGroupBy === "initiative") {
      key = raw.initiative ?? "No Initiative";
    } else {
      key = raw.state ?? "Unknown";
    }
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
    const aLatest = a[1][a[1].length - 1];
    const bLatest = b[1][b[1].length - 1];
    const aTs = aLatest?.raw_data ? parseFloat(JSON.parse(aLatest.raw_data).timestamp ?? "0") : 0;
    const bTs = bLatest?.raw_data ? parseFloat(JSON.parse(bLatest.raw_data).timestamp ?? "0") : 0;
    return bTs - aTs;
  });

  const linearCount = items.filter((i) => i.source === "linear").length;
  const githubCount = items.filter((i) => i.source === "github").length;
  const slackCount = slackItems.length;

  return (
    <div className="space-y-3">
      {/* Calendar Timeline — always visible */}
      <CalendarTimeline items={items} onDismiss={onDismiss} hiddenCalendars={hiddenCalendars} onToggleCalendar={toggleCalendar} />

      {/* Recently Hidden toggle + panel */}
      <div className="flex justify-end -mt-1 mb-1">
        <button
          onClick={() => { setShowDismissed(!showDismissed); if (!showDismissed) loadDismissed(); }}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
            showDismissed ? "bg-muted/20 text-foreground" : "text-muted/30 hover:text-muted/60"
          }`}
        >
          Recently Hidden
        </button>
      </div>
      {showDismissed && (
        <div className="mb-3 bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted">Recently Hidden (last 24h)</span>
            <button onClick={() => setShowDismissed(false)} className="text-muted hover:text-foreground"><X size={12} /></button>
          </div>
          {dismissedItems.length === 0 ? (
            <div className="px-3 py-4 text-[11px] text-muted/50 text-center">No recently hidden items</div>
          ) : (
            <div className="divide-y divide-border/30 max-h-[300px] overflow-y-auto">
              {dismissedItems.map((item) => (
                <div key={item.id} className="px-3 py-1.5 flex items-center gap-2 hover:bg-card-hover transition-colors group/dismissed">
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

      {/* Tab content + Filters sidebar */}
      <div className="flex gap-4">
      <div className="flex-1 min-w-0">
      {activeTab === "dashboard" && (() => {
        const linearItems = filteredItems.filter((i) => i.source === "linear");
        const ghItems = filteredItems.filter((i) => i.source === "github");
        const slkItems = filteredItems.filter((i) => i.source === "slack");
        const calItems = filteredItems.filter((i) => i.source === "calendar");

        // Linear stats
        const inProgress = linearItems.filter((i) => { const r = JSON.parse(i.raw_data ?? "{}"); return r.state === "In Progress"; }).length;
        const inReview = linearItems.filter((i) => { const r = JSON.parse(i.raw_data ?? "{}"); return r.state === "In Review"; }).length;
        const todo = linearItems.filter((i) => { const r = JSON.parse(i.raw_data ?? "{}"); return r.state === "Todo"; }).length;
        const backlog = linearItems.filter((i) => { const r = JSON.parse(i.raw_data ?? "{}"); return r.state === "Backlog"; }).length;

        // GitHub stats
        const myPRs = ghItems.filter((i) => { const r = JSON.parse(i.raw_data ?? "{}"); return !r.reviewRequested; }).length;
        const reviewRequested = ghItems.filter((i) => { const r = JSON.parse(i.raw_data ?? "{}"); return r.reviewRequested; }).length;
        const withConflicts = ghItems.filter((i) => { const r = JSON.parse(i.raw_data ?? "{}"); return r.mergeableState === "dirty" || r.mergeable === false; }).length;
        const readyToMerge = ghItems.filter((i) => {
          const r = JSON.parse(i.raw_data ?? "{}");
          const checks = r.checks ?? [];
          return r.mergeable === true && checks.filter((c: { conclusion: string }) => c.conclusion === "failure").length === 0;
        }).length;

        // Slack stats
        const dmCount = slkItems.filter((i) => { const r = JSON.parse(i.raw_data ?? "{}"); return r.channelName?.startsWith("DM:"); }).length;
        const channelCount = slkItems.length - dmCount;

        const statCard = (label: string, value: number, color: string) => (
          <div className={`bg-card border border-border rounded-lg px-2.5 py-1.5 flex items-center gap-2 ${value > 0 ? "" : "opacity-50"}`}>
            <div className={`text-lg font-bold ${color} leading-none`}>{value}</div>
            <div className="text-[10px] text-muted">{label}</div>
          </div>
        );

        return (
          <div className="space-y-2 flex flex-col h-full">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-1.5">
              {statCard("Action Items", totalUrgent, "text-red-400")}
              {statCard("Linear", linearItems.length, "text-violet-400")}
              {statCard("GitHub", ghItems.length, "text-orange-400")}
              {statCard("Slack", slkItems.length, "text-emerald-400")}
            </div>

            {/* Source breakdowns — compact grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {linearItems.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-2">
                  <h3 className="text-[10px] font-semibold text-violet-400 mb-1 flex items-center gap-1">
                    <CircleDot size={10} /> Linear
                  </h3>
                  <div className="flex gap-3 text-center">
                    {[[inProgress, "In Prog", "text-blue-400"], [inReview, "Review", "text-violet-400"], [todo, "Todo", "text-muted"], [backlog, "Backlog", "text-muted/50"]].map(([v, l, c]) => (
                      <div key={l as string}>
                        <div className={`text-sm font-bold ${c}`}>{v}</div>
                        <div className="text-[8px] text-muted">{l}</div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const byPriority = [0, 0, 0, 0, 0];
                    linearItems.forEach((i) => { const p = JSON.parse(i.raw_data ?? "{}").priority ?? 0; if (p >= 0 && p <= 4) byPriority[p]++; });
                    const total = linearItems.length;
                    const colors = ["bg-muted/30", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500"];
                    return total > 0 ? (
                      <div className="mt-1.5">
                        <div className="flex h-1.5 rounded-full overflow-hidden">
                          {byPriority.map((count, i) => count > 0 ? (
                            <div key={i} className={`${colors[i]}`} style={{ width: `${(count / total) * 100}%` }} />
                          ) : null)}
                        </div>
                        <div className="flex gap-2 text-[8px] text-muted/50 mt-0.5">
                          {byPriority[1] > 0 && <span className="text-red-400">{byPriority[1]}urg</span>}
                          {byPriority[2] > 0 && <span className="text-orange-400">{byPriority[2]}hi</span>}
                          {byPriority[3] > 0 && <span className="text-yellow-400">{byPriority[3]}med</span>}
                          {byPriority[4] > 0 && <span className="text-blue-400">{byPriority[4]}low</span>}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {ghItems.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-2">
                  <h3 className="text-[10px] font-semibold text-orange-400 mb-1 flex items-center gap-1">
                    <GitPullRequest size={10} /> GitHub
                  </h3>
                  <div className="flex gap-3 text-center">
                    {[[myPRs, "My PRs", "text-orange-400"], [reviewRequested, "Reviews", "text-accent"], [readyToMerge, "Ready", "text-green-400"], [withConflicts, "Conflicts", "text-red-400"]].map(([v, l, c]) => (
                      <div key={l as string}>
                        <div className={`text-sm font-bold ${c}`}>{v}</div>
                        <div className="text-[8px] text-muted">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {slkItems.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-2">
                  <h3 className="text-[10px] font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                    <MessageSquare size={10} /> Slack
                  </h3>
                  <div className="flex gap-3 text-center">
                    <div><div className="text-sm font-bold text-emerald-400">{channelCount}</div><div className="text-[8px] text-muted">Channels</div></div>
                    <div><div className="text-sm font-bold text-emerald-300">{dmCount}</div><div className="text-[8px] text-muted">DMs</div></div>
                  </div>
                </div>
              )}
            </div>

            {/* Today's Work Summary — fills remaining height */}
            {xpData && xpData.todayActions.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-2 flex flex-col min-h-0 flex-1">
                <h3 className="text-[10px] font-semibold text-amber-400 mb-1 flex items-center gap-1 shrink-0">
                  <Zap size={10} /> Today — {xpData.today} XP
                </h3>
                <div className="space-y-0.5 overflow-y-auto flex-1">
                  {xpData.todayActions.map((a, i) => {
                    const actionIcons: Record<string, string> = {
                      dismiss: "text-muted/60",
                      merge_pr: "text-green-400",
                      complete_todo: "text-yellow-400",
                      reply_slack: "text-emerald-400",
                    };
                    const time = new Date(a.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
                    return (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="text-muted/40 font-mono w-10 shrink-0">{time}</span>
                        <span className={`font-semibold ${actionIcons[a.action] ?? "text-muted"}`}>+{a.xp}</span>
                        <span className="text-muted truncate">{a.label}</span>
                        {a.source && <span className={`text-[9px] px-1 py-0.5 rounded ${SOURCE_STYLE[a.source] ?? ""}`}>{a.source}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === "queue" && (
        <div className="space-y-1.5">
          {/* In Progress — pinned above My Tasks */}
          {(inProgressItem || inProgressTodoId) && (() => {
            const inProgressTodo = inProgressTodoId ? dailyTodos.find(t => t.id === inProgressTodoId) : null;
            return (
              <div className="space-y-1">
                <h3 className="text-xs uppercase tracking-wide text-muted flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 flex items-center gap-1"><Play size={10} fill="currentColor" /> In Progress</span>
                </h3>
                <div className="bg-sky-500/5 border border-sky-500/30 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-sky-400 rounded-l-lg" />
                  {inProgressItem?.source === "linear" && (
                    <LinearCard item={inProgressItem} states={linearStates} members={linearMembers} onDismiss={onDismiss} onChatAbout={chatAboutItem(inProgressItem)} onUpdateItem={onUpdateItem} hiddenStates={hiddenStates} isInProgress onToggleInProgress={() => toggleInProgress(inProgressItem)} />
                  )}
                  {inProgressItem?.source === "github" && (
                    <GithubCard item={inProgressItem} onDismiss={onDismiss} onChatAbout={chatAboutItem(inProgressItem)} repoStatus={repoStatuses[(inProgressItem.raw_data ? JSON.parse(inProgressItem.raw_data) : {}).repo]} isInProgress onToggleInProgress={() => toggleInProgress(inProgressItem)} />
                  )}
                  {inProgressItem?.source === "calendar" && (
                    <CalendarCard item={inProgressItem} onDismiss={onDismiss} onChatAbout={chatAboutItem(inProgressItem)} isInProgress onToggleInProgress={() => toggleInProgress(inProgressItem)} />
                  )}
                  {inProgressItem?.source === "slack" && (
                    <SlackMessage item={inProgressItem} onDismiss={onDismiss} />
                  )}
                  {inProgressTodo && (
                    <div className="flex items-center gap-2 px-4 py-2.5">
                      <span className="flex-1 text-xs font-medium">{inProgressTodo.text}</span>
                      <button onClick={() => toggleInProgressTodo(inProgressTodo.id)} className="text-sky-400 hover:text-muted transition-colors p-1" title="Stop working">
                        <Pause size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Pending Review — tasks where agent finished but user hasn't checked off */}
          {(() => {
            const pendingReview = dailyTodos.filter(t => !t.done && agentSessions[t.id] && (agentSessions[t.id].status === "completed" || agentSessions[t.id].status === "failed"));
            if (pendingReview.length === 0) return null;
            return (
              <div className="space-y-1">
                <h3 className="text-xs uppercase tracking-wide text-muted flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 flex items-center gap-1"><Bot size={10} /> Pending Review</span>
                  <span className="text-[10px] text-muted/50">{pendingReview.length}</span>
                </h3>
                <div className="space-y-1.5">
                  {pendingReview.map(todo => {
                    const session = agentSessions[todo.id];
                    const isFailed = session.status === "failed";
                    return (
                      <div key={todo.id} className={`border rounded-lg p-3 ${isFailed ? "bg-red-500/5 border-red-500/20" : "bg-purple-500/5 border-purple-500/20"}`}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              await fetch("/api/todos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: todo.id, done: true }) });
                              onRefreshTodos(); onRefreshXp();
                            }}
                            className="shrink-0 text-muted/40 hover:text-green-400 transition-colors"
                            title="Mark as done"
                          >
                            <Square size={14} />
                          </button>
                          <span className="flex-1 text-xs font-medium">{todo.text}</span>
                          {isFailed ? (
                            <span className="text-[9px] text-red-400 flex items-center gap-0.5"><XCircle size={9} /> Failed</span>
                          ) : (
                            <span className="text-[9px] text-green-400 flex items-center gap-0.5"><CheckCircle size={9} /> Agent done</span>
                          )}
                        </div>
                        {session.summary && (
                          <p className="mt-1.5 text-[11px] text-foreground/70 leading-relaxed ml-5">{session.summary}</p>
                        )}
                        {session.failure_reason && (
                          <p className="mt-1.5 text-[11px] text-red-400/80 leading-relaxed ml-5">{session.failure_reason}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 ml-5">
                          {onOpenAgentSession && (
                          <button
                            onClick={() => onOpenAgentSession(session.id)}
                            className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 font-medium"
                          >
                            <MessageSquare size={9} /> Open in chat
                          </button>
                          )}
                          {session.tool_calls && (
                            <span className="text-[9px] text-muted/40">{JSON.parse(session.tool_calls).length} tool calls</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* My Tasks section — always visible */}
          <div className="space-y-1">
            <h3 className="text-xs uppercase tracking-wide text-muted flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">My Tasks</span>
            </h3>
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <TodoSection todos={dailyTodos} onRefresh={() => { onRefreshTodos(); onRefreshXp(); }} inProgressTodoId={inProgressTodoId} onToggleInProgressTodo={toggleInProgressTodo} agentSessions={agentSessions} onOpenAgentSession={(sessionId) => { setChatCollapsed(false); chatRef.current?.openAgentSession(sessionId); }} />
            </div>
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
                <CollapsibleGroup key={channel} label={label} icon={isDm ? <User size={10} /> : <Hash size={10} />} count={channelItems.length} defaultOpen onDismissAll={dismissAll}>
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
                        />
                      ));
                    })()}
                  </div>
                </CollapsibleGroup>
              );
            };

            return (
              <CollapsibleGroup label="Slack" icon={<MessageSquare size={10} />} count={slackItems.length} defaultOpen>
                <div className="space-y-1 ml-3 border-l border-border/30 pl-2">
                  {regularChannels.map(renderSlackChannel)}
                  {dmChannels.length > 0 && (
                    <div className="ml-3 border-l border-border/30 pl-2">
                      <CollapsibleGroup label="Direct Messages" icon={<User size={10} />} count={totalDmMessages} defaultOpen>
                        <div className="space-y-1">
                          {dmChannels.map(renderSlackChannel)}
                        </div>
                      </CollapsibleGroup>
                    </div>
                  )}
                </div>
              </CollapsibleGroup>
            );
          })()}

          {/* GitHub section — grouped by repo */}
          {githubItems.length > 0 && (
            <CollapsibleGroup label="GitHub" icon={<GitPullRequest size={10} />} count={githubItems.length} defaultOpen>
              <div className="space-y-1 ml-3 border-l border-border/30 pl-2">
                {Array.from(githubByRepo.entries()).map(([repo, repoItems]) => (
                  <CollapsibleGroup key={repo} label={repo} count={repoItems.length} mono defaultOpen>
                    {repoItems.map((item) => (
                      <GithubCard key={item.id} item={item} onDismiss={onDismiss} onChatAbout={chatAboutItem(item)} repoStatus={repoStatuses[(item.raw_data ? JSON.parse(item.raw_data) : {}).repo]} isInProgress={`${item.source}:${item.source_id}` === inProgressKey} onToggleInProgress={() => toggleInProgress(item)} />
                    ))}
                  </CollapsibleGroup>
                ))}
              </div>
            </CollapsibleGroup>
          )}

          {/* Linear section — grouped by state/project/initiative */}
          {linearItems.length > 0 && (
            <CollapsibleGroup label="Linear" icon={<CircleDot size={10} />} count={linearItems.length} defaultOpen>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1 mb-1">
                  <span className="text-[10px] text-muted/60">Group by:</span>
                  {(["state", "project", "initiative"] as const).map((mode) => (
                    <button key={mode} onClick={() => setLinearGroupBy(mode)}
                      className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                        linearGroupBy === mode ? "bg-violet-500/20 text-violet-400 border border-violet-500/30" : "text-muted/50 hover:text-muted"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="ml-3 border-l border-border/30 pl-2 space-y-1">
                  {Array.from(linearGrouped.entries()).map(([group, groupItems]) => (
                    <CollapsibleGroup key={group} label={group} icon={<CircleDot size={10} />} count={groupItems.length} defaultOpen>
                      {groupItems.map((item) => (
                        <LinearCard key={item.id} item={item} states={linearStates} members={linearMembers} onDismiss={onDismiss} onChatAbout={chatAboutItem(item)} onUpdateItem={onUpdateItem} hiddenStates={hiddenStates} isInProgress={`${item.source}:${item.source_id}` === inProgressKey} onToggleInProgress={() => toggleInProgress(item)} />
                      ))}
                    </CollapsibleGroup>
                  ))}
                </div>
              </div>
            </CollapsibleGroup>
          )}

          {linearItems.length === 0 && githubItems.length === 0 && slackItems.length === 0 && dailyTodos.filter(t => !t.done).length === 0 && !inProgressItem && (
            <div className="text-center py-8 text-muted">
              <CheckCircle size={32} className="mx-auto mb-3 text-green-400/50" />
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs text-muted/60 mt-1">No items need your attention right now</p>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Filters sidebar */}
      <div className="w-48 shrink-0 space-y-3 sticky top-12 self-start max-h-[calc(100vh-5rem)] overflow-y-auto">
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
              {onSetGithubMode && (
                <div className="mt-1.5">
                  <h6 className="text-[9px] text-muted/50 mb-0.5">Show PRs by</h6>
                  <div className="flex gap-1">
                    {(["author", "assignee"] as const).map((mode) => (
                      <button key={mode} onClick={() => onSetGithubMode(mode)}
                        className={`px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                          githubMode === mode ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "text-muted/50 hover:text-muted"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

        {/* Slack channel filters */}
        {availableChannels.length > 0 && (
          <div>
            <h5 className="text-[10px] text-muted mb-1">Slack Channels</h5>
            <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
              {availableChannels.filter(ch => !ch.isDm).map(ch => (
                <button
                  key={ch.id}
                  onClick={() => onToggleWatchedChannel(ch.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                    watchedChannels.includes(ch.id)
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-card text-muted/30"
                  }`}
                >
                  #{ch.name}
                </button>
              ))}
            </div>
            <span className="text-[9px] text-muted/40 mt-1 block">{watchedChannels.length} watched</span>
          </div>
        )}

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
      </div>
      </div>
    </div>
  );
}

function CollapsibleGroup({ label, icon, count, mono, defaultOpen = false, onDismissAll, children }: {
  label: string; icon?: React.ReactNode; count: number; mono?: boolean; defaultOpen?: boolean; onDismissAll?: () => void; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-muted mb-1 px-1 group/header">
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

function ExpandableCard({ item, summary, children, onDismiss, onChatAbout, isInProgress, onToggleInProgress }: {
  item: TodoItem; summary?: React.ReactNode; children: React.ReactNode; onDismiss?: (item: TodoItem) => void; onChatAbout?: (prompt: string) => void; isInProgress?: boolean; onToggleInProgress?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
  return (
    <div className="bg-card border border-border rounded-lg hover:bg-card-hover transition-colors group">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <button className="text-muted shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{item.title}</span>
          {summary && <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">{summary}</div>}
        </div>
        {/* Custom Actions — prominent, always visible */}
        {onChatAbout && (item.source === "github" || item.source === "linear") && (
          <div onClick={(e) => e.stopPropagation()}>
            <CustomActionsMenu source={item.source === "github" ? "github" : "linear"} context={{ identifier: raw.identifier ?? item.source_id, title: raw.title ?? item.title ?? "", description: raw.body ?? raw.description ?? "", url: item.url ?? "", state: raw.state ?? "", assignee: raw.assignee ?? "", labels: (raw.labels ?? []).join(", "), repo: raw.repo ?? "", author: raw.author ?? "", pr_number: String(raw.id ?? ""), reviewers: (raw.reviewers ?? []).join(", ") }} onAction={onChatAbout} size={16} />
          </div>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent/50 hover:text-accent transition-colors shrink-0">
            <ExternalLink size={14} />
          </a>
        )}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleInProgress && (
            <button onClick={(e) => { e.stopPropagation(); onToggleInProgress(); }} className={`transition-colors p-1 ${isInProgress ? "text-sky-400 hover:text-muted" : "text-muted hover:text-sky-400"}`} title={isInProgress ? "Stop working" : "Set In Progress"}>
              {isInProgress ? <Pause size={14} /> : <Play size={14} />}
            </button>
          )}
          <SnoozeButton source={item.source} sourceId={item.source_id} onDone={() => onDismiss?.(item)} size={14} />
          {onDismiss && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(item); }}
              className="text-muted hover:text-red-400 transition-colors p-1"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 ml-[38px] border-t border-border/50 pt-3 text-xs space-y-2" onClick={(e) => e.stopPropagation()}>
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

function LinearCard({ item, states, members, onDismiss, onChatAbout, onUpdateItem, hiddenStates, isInProgress, onToggleInProgress }: {
  item: TodoItem;
  states: { id: string; name: string; type: string }[];
  members: { id: string; name: string; email: string }[];
  onDismiss: (item: TodoItem) => void;
  onChatAbout: (prompt: string) => void;
  onUpdateItem: (itemId: string, updates: Record<string, unknown>) => void;
  hiddenStates: Set<string>;
  isInProgress?: boolean;
  onToggleInProgress?: () => void;
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
        </div>

        {/* Actions on hover */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleInProgress && (
            <button onClick={(e) => { e.stopPropagation(); onToggleInProgress(); }} className={`transition-colors p-1 ${isInProgress ? "text-sky-400 hover:text-muted" : "text-muted hover:text-sky-400"}`} title={isInProgress ? "Stop working" : "Set In Progress"}>
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
          <CustomActionsMenu source="linear" context={{ identifier: raw.identifier ?? "", title: raw.title ?? "", description: (raw.description ?? "").slice(0, 500), state: raw.state ?? "", assignee: raw.assignee ?? "", project: raw.project ?? "", url: item.url ?? "" }} onAction={(prompt) => onChatAbout(prompt)} />
          <SnoozeButton source={item.source} sourceId={item.source_id} onDone={() => onDismiss(item)} />
          <button onClick={(e) => { e.stopPropagation(); onDismiss(item); }} className="text-red-400/50 hover:text-red-400 transition-colors p-1" title="Dismiss">
            <X size={12} />
          </button>
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

function GithubCard({ item, onDismiss, onChatAbout, repoStatus, isInProgress, onToggleInProgress }: { item: TodoItem; onDismiss: (item: TodoItem) => void; onChatAbout: (prompt: string, prInfo?: { repo: string; prNumber: number }) => void; repoStatus?: string; isInProgress?: boolean; onToggleInProgress?: () => void }) {
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
    <ExpandableCard item={item} onDismiss={onDismiss} onChatAbout={onChatAbout} isInProgress={isInProgress} onToggleInProgress={onToggleInProgress} summary={
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
        {comments.length > 0 && <span className="text-[11px] text-muted flex items-center gap-1"><MessageSquare size={10} /> {comments.length}</span>}
        {(raw.updatedAt || raw.createdAt) && <span className="text-[11px] text-muted flex items-center gap-1"><Calendar size={10} /> {formatDate(raw.updatedAt ?? raw.createdAt)}</span>}
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

function SlackMessage({ item, onDismiss, isLast, onDismissChannel, isContext, showNewDivider }: {
  item: TodoItem; onDismiss: (item: TodoItem) => void; isLast?: boolean; onDismissChannel?: () => void; isContext?: boolean; showNewDivider?: boolean;
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
    <div className={`px-4 py-2.5 hover:bg-card-hover transition-all duration-300 group ${fading ? "opacity-0 max-h-0 py-0 overflow-hidden" : ""}`}>
      {/* Main message */}
      <div className="flex items-start gap-3">
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
                    <a key={idx} href={fullProxyUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <img
                        src={proxyUrl}
                        alt={f.name}
                        className="max-w-[400px] max-h-[300px] rounded border border-border/50 hover:border-accent/50 transition-colors"
                      />
                    </a>
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
        </div>
        {/* Right actions: snooze, link, dismiss */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <SnoozeButton source={item.source} sourceId={item.source_id} onDone={() => fadeAndDismiss(() => onDismiss(item))} />
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="cursor-pointer text-accent/50 hover:text-accent transition-colors p-1">
              <ExternalLink size={12} />
            </a>
          )}
          <button onClick={() => fadeAndDismiss(() => onDismiss(item))} className="cursor-pointer text-red-400/50 hover:text-red-400 transition-colors p-1" title="Dismiss">
            <X size={12} />
          </button>
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
      {replyCount > 0 && (
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
          {!showThread && replyUserNames.length > 0 && (
            <span className="text-muted/60 font-normal">from {replyUserNames.join(", ")}</span>
          )}
        </button>
      )}

      {/* Thread replies */}
      {showThread && replies.length > 0 && (
        <div className="ml-2 mt-2 border-l-2 border-accent/30 pl-3 space-y-1.5">
          {replies.map((reply, i) => (
            <div key={i} className="py-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{reply.senderName}</span>
                <span className="text-[10px] text-muted/40">{reply.timestamp ? formatTime(reply.timestamp) : ""}</span>
              </div>
              <p className="text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed mt-0.5"><SlackText text={reply.text ?? ""} /></p>
            </div>
          ))}
        </div>
      )}

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
        <h1 className="text-lg font-bold mb-1">Builder Agent</h1>
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
