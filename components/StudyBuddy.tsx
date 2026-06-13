"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useDropzone } from "react-dropzone";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: AttachedFile[];
  timestamp: Date;
}

interface AttachedFile {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  file: File;
}

// ─── Accepted file types ──────────────────────────────────────────────────────

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "text/plain": [".txt"],
};

const PERSONAS = [
  { id: "buddy",    label: "Study Buddy",     emoji: "🤓", desc: "Encouraging tutor" },
  { id: "socratic", label: "Socratic",         emoji: "🏛️", desc: "Questions only" },
  { id: "examiner", label: "Exam Coach",       emoji: "📝", desc: "Strict MCQ style" },
  { id: "eli5",     label: "Explain Simply",   emoji: "🧒", desc: "Like I'm 5" },
];

const PERSONA_PROMPTS: Record<string, string> = {
  buddy:    "You are a warm, enthusiastic study buddy. Celebrate wins, gently correct mistakes, end every response with a follow-up question.",
  socratic: "You are a Socratic tutor. You NEVER give direct answers. You ONLY respond with probing questions that guide the student to discover the answer themselves.",
  examiner: "You are a strict exam coach. Always respond with numbered points. After every explanation, give an MCQ with 4 options (A–D) and mark the correct answer at the end.",
  eli5:     "Explain everything as if talking to a curious 10-year-old. Use simple words, fun analogies, and emoji. Keep it under 5 lines.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type === "application/pdf") return "📄";
  if (type.startsWith("image/")) return "🖼️";
  return "📎";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudyBuddy() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState("buddy");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewFile, setPreviewFile] = useState<AttachedFile | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // ── Dropzone ────────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (accepted: File[]) => {
    const newFiles: AttachedFile[] = await Promise.all(
      accepted.map((file) =>
        new Promise<AttachedFile>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: reader.result as string,
            file,
          });
          reader.readAsDataURL(file);
        })
      )
    );
    setFiles((prev) => [...prev, ...newFiles].slice(0, 5)); // max 5 files
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    noClick: true,
    noKeyboard: true,
    maxSize: 20 * 1024 * 1024,
  });

  // ── Send message ────────────────────────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    if (!text && files.length === 0) return;
    if (loading) return;

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      files: files.length > 0 ? [...files] : undefined,
      timestamp: new Date(),
    };

    const assistantMsg: Message = {
      id: uid(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setFiles([]);
    setLoading(true);

    try {
      const allMessages = [...messages, userMsg];

      const formData = new FormData();
      formData.append(
        "messages",
        JSON.stringify(
          allMessages.map((m) => ({
            role: m.role,
            content: m.content || (m.files ? `[Uploaded ${m.files.length} file(s)]` : ""),
          }))
        )
      );

      // Inject persona into the first user message context
      const personaNote = `[Persona: ${PERSONA_PROMPTS[persona]}]\n\n`;
      const lastIdx = allMessages.length - 1;
      const msgs = allMessages.map((m, i) => ({
        role: m.role,
        content: i === lastIdx && m.role === "user"
          ? personaNote + m.content
          : m.content,
      }));
      formData.set("messages", JSON.stringify(msgs));

      // Attach files from the latest user message
      if (userMsg.files) {
        formData.append("fileCount", String(userMsg.files.length));
        userMsg.files.forEach((f, i) => formData.append(`file_${i}`, f.file));
      } else {
        formData.append("fileCount", "0");
      }

      abortRef.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snapshot = accumulated;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: snapshot } : m))
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: "Something went wrong. Please check your API key and try again." }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
    setFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.shell} {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div style={styles.dragOverlay}>
          <div style={styles.dragBox}>
            <span style={{ fontSize: 40 }}>📂</span>
            <p style={{ fontSize: 16, fontWeight: 500, color: "#F5A623" }}>Drop files here</p>
            <p style={{ fontSize: 13, color: "#8B90A0" }}>PDF, images, text — up to 20 MB</p>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside style={{ ...styles.sidebar, width: sidebarOpen ? 260 : 0, overflow: "hidden" }}>
        <div style={styles.sidebarInner}>
          {/* Logo */}
          <div style={styles.logo}>
            <span style={styles.logoIcon}>✦</span>
            <span style={styles.logoText}>StudyBuddy</span>
          </div>
          <p style={styles.logoPowered}>powered by Gemini</p>

          <div style={styles.divider} />

          {/* New chat */}
          <button style={styles.newChatBtn} onClick={clearChat}>
            <span>＋</span> New session
          </button>

          <div style={styles.divider} />

          {/* Persona picker */}
          <p style={styles.sideLabel}>Learning mode</p>
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              style={{
                ...styles.personaBtn,
                ...(persona === p.id ? styles.personaBtnActive : {}),
              }}
              onClick={() => setPersona(p.id)}
            >
              <span style={{ fontSize: 16 }}>{p.emoji}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: persona === p.id ? "#F5A623" : "#E8EAF0" }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 11, color: "#8B90A0" }}>{p.desc}</div>
              </div>
            </button>
          ))}

          <div style={styles.divider} />

          {/* Tips */}
          <p style={styles.sideLabel}>Try asking</p>
          {[
            "Quiz me on this PDF",
            "Summarise my notes",
            "Explain this diagram",
            "Give me 5 exam questions",
            "What are the key concepts?",
          ].map((tip) => (
            <button
              key={tip}
              style={styles.tipBtn}
              onClick={() => { setInput(tip); inputRef.current?.focus(); }}
            >
              {tip}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Footer */}
          <p style={styles.sideFooter}>
            Built with Gemini API ·{" "}
            <a href="https://ai.google.dev" target="_blank" rel="noreferrer"
               style={{ color: "#4A90E2" }}>ai.google.dev</a>
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={styles.main}>
        {/* Top bar */}
        <header style={styles.topbar}>
          <button style={styles.iconBtn} onClick={() => setSidebarOpen((s) => !s)} aria-label="Toggle sidebar">
            <SidebarIcon />
          </button>
          <div style={styles.topbarTitle}>
            <span style={{ color: "#F5A623", fontWeight: 600 }}>Study</span>Buddy
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <span style={styles.modelBadge}>gemini-2.0-flash</span>
            {messages.length > 0 && (
              <button style={styles.iconBtn} onClick={clearChat} title="Clear chat" aria-label="Clear chat">
                <TrashIcon />
              </button>
            )}
          </div>
        </header>

        {/* Chat area */}
        <div style={styles.chatArea}>
          {messages.length === 0 ? (
            <EmptyState onPrompt={(p) => { setInput(p); inputRef.current?.focus(); }} onUpload={open} />
          ) : (
            <div style={styles.messageList}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {loading && messages[messages.length - 1]?.content === "" && (
                <div style={styles.thinking}>
                  <ThinkingDots />
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* File preview strip */}
        {files.length > 0 && (
          <div style={styles.fileStrip}>
            {files.map((f, i) => (
              <div key={i} style={styles.fileChip}>
                <button style={styles.fileChipPreview} onClick={() => setPreviewFile(f)} title="Preview">
                  <span>{fileIcon(f.type)}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#8B90A0" }}>{formatFileSize(f.size)}</div>
                  </div>
                </button>
                <button style={styles.fileRemoveBtn} onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove file">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div style={styles.inputBar}>
          <button style={styles.attachBtn} onClick={open} title="Attach PDF or image" aria-label="Attach file">
            <PaperclipIcon />
          </button>

          <textarea
            ref={inputRef}
            style={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything, or drop a PDF to get started…"
            rows={1}
            disabled={loading}
          />

          {loading ? (
            <button style={{ ...styles.sendBtn, background: "#E05C5C22", color: "#E05C5C" }} onClick={stop} aria-label="Stop">
              <StopIcon />
            </button>
          ) : (
            <button
              style={{
                ...styles.sendBtn,
                ...(input.trim() || files.length > 0 ? styles.sendBtnActive : {}),
              }}
              onClick={send}
              disabled={!input.trim() && files.length === 0}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          )}
        </div>

        <p style={styles.disclaimer}>
          Gemini can make mistakes. Verify important information.
        </p>
      </main>

      {/* File preview modal */}
      {previewFile && (
        <div style={styles.modalOverlay} onClick={() => setPreviewFile(null)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{previewFile.name}</span>
              <button style={{ ...styles.iconBtn, fontSize: 18 }} onClick={() => setPreviewFile(null)}>×</button>
            </div>
            {previewFile.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewFile.dataUrl} alt={previewFile.name} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8 }} />
            ) : (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#8B90A0" }}>
                <span style={{ fontSize: 48 }}>{fileIcon(previewFile.type)}</span>
                <p style={{ marginTop: 8 }}>{previewFile.name}</p>
                <p style={{ fontSize: 12 }}>{formatFileSize(previewFile.size)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ ...styles.msgRow, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      {!isUser && (
        <div style={styles.avatar}>✦</div>
      )}
      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Attached files preview */}
        {msg.files && msg.files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: isUser ? "flex-end" : "flex-start" }}>
            {msg.files.map((f, i) => (
              <div key={i} style={styles.msgFileChip}>
                <span>{fileIcon(f.type)}</span>
                <span style={{ fontSize: 11, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.name}
                </span>
              </div>
            ))}
          </div>
        )}
        {/* Message bubble */}
        {(msg.content || msg.role === "user") && (
          <div style={isUser ? styles.userBubble : styles.aiBubble}>
            {isUser ? (
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{msg.content}</p>
            ) : (
              <div className="prose">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPrompt, onUpload }: { onPrompt: (p: string) => void; onUpload: () => void }) {
  const suggestions = [
    { emoji: "📄", label: "Summarise a PDF",     prompt: "Please summarise the key points from this document" },
    { emoji: "🧠", label: "Quiz me",              prompt: "Generate 5 exam questions based on the uploaded content" },
    { emoji: "🖼️", label: "Explain a diagram",   prompt: "Explain what this diagram shows and the key concepts" },
    { emoji: "📝", label: "Make flashcards",       prompt: "Create 10 flashcards from the content I've uploaded" },
  ];

  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>✦</div>
      <h1 style={styles.emptyTitle}>What are we studying today?</h1>
      <p style={styles.emptySub}>
        Drop a PDF, image, or notes — or just start chatting.
      </p>

      <button style={styles.uploadPromptBtn} onClick={onUpload}>
        <PaperclipIcon /> &nbsp; Attach a file to get started
      </button>

      <div style={styles.suggestionGrid}>
        {suggestions.map((s) => (
          <button key={s.label} style={styles.suggestionCard} onClick={() => onPrompt(s.prompt)}>
            <span style={{ fontSize: 22 }}>{s.emoji}</span>
            <span style={{ fontSize: 13, color: "#E8EAF0" }}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "10px 14px" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "#F5A623",
          animation: "pulse 1.2s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
          display: "inline-block",
        }} />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/>
  </svg>
);
const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2"/>
  </svg>
);
const PaperclipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const SidebarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
  </svg>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    height: "100vh",
    background: "#0D0F14",
    position: "relative",
    overflow: "hidden",
  },
  dragOverlay: {
    position: "fixed", inset: 0, zIndex: 999,
    background: "rgba(13,15,20,0.92)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  dragBox: {
    border: "2px dashed #F5A623", borderRadius: 20,
    padding: "48px 64px", textAlign: "center", display: "flex",
    flexDirection: "column", alignItems: "center", gap: 10,
  },

  // Sidebar
  sidebar: {
    background: "#13161D",
    borderRight: "1px solid #2A2F3D",
    transition: "width 0.2s ease",
    flexShrink: 0,
    height: "100vh",
    overflow: "hidden",
  },
  sidebarInner: {
    width: 260, height: "100%", padding: "20px 16px",
    display: "flex", flexDirection: "column", gap: 4,
    overflowY: "auto",
  },
  logo: { display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 0" },
  logoIcon: { color: "#F5A623", fontSize: 20, fontWeight: 700 },
  logoText: { fontSize: 17, fontWeight: 600, color: "#E8EAF0" },
  logoPowered: { fontSize: 11, color: "#4A5068", paddingLeft: 4, marginBottom: 4 },
  divider: { height: 1, background: "#1F2330", margin: "8px 0" },
  newChatBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#1A1E28", border: "1px solid #2A2F3D",
    borderRadius: 8, padding: "9px 12px",
    color: "#E8EAF0", fontSize: 13, cursor: "pointer",
    transition: "background 0.15s",
    width: "100%", fontFamily: "inherit",
  },
  sideLabel: { fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4A5068", padding: "6px 4px 2px" },
  personaBtn: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 10px", borderRadius: 8, cursor: "pointer",
    background: "transparent", border: "1px solid transparent",
    width: "100%", textAlign: "left", fontFamily: "inherit",
    transition: "all 0.15s",
  },
  personaBtnActive: {
    background: "#F5A62312",
    border: "1px solid #F5A62340",
  },
  tipBtn: {
    display: "block", width: "100%", textAlign: "left",
    padding: "6px 10px", borderRadius: 6, cursor: "pointer",
    background: "transparent", border: "none",
    color: "#8B90A0", fontSize: 12, fontFamily: "inherit",
    transition: "color 0.15s",
  },
  sideFooter: { fontSize: 11, color: "#4A5068", marginTop: 8, padding: "4px 4px" },

  // Main
  main: {
    flex: 1, display: "flex", flexDirection: "column",
    height: "100vh", overflow: "hidden", minWidth: 0,
  },
  topbar: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "12px 20px",
    borderBottom: "1px solid #1F2330",
    background: "#0D0F14",
    flexShrink: 0,
  },
  topbarTitle: { fontSize: 16, fontWeight: 600, color: "#E8EAF0" },
  modelBadge: {
    fontSize: 11, padding: "3px 8px", borderRadius: 99,
    background: "#4A90E215", color: "#4A90E2",
    border: "1px solid #4A90E230",
  },
  iconBtn: {
    background: "none", border: "none",
    color: "#8B90A0", cursor: "pointer", padding: 6, borderRadius: 6,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "color 0.15s",
  },

  // Chat
  chatArea: { flex: 1, overflowY: "auto", padding: "0 0 8px" },
  messageList: { padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 780, margin: "0 auto" },
  msgRow: { display: "flex", alignItems: "flex-start", gap: 10 },
  avatar: {
    width: 30, height: 30, borderRadius: "50%",
    background: "#F5A62320", border: "1px solid #F5A62340",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#F5A623", fontSize: 14, flexShrink: 0,
  },
  userBubble: {
    background: "#1A1E28", border: "1px solid #2A2F3D",
    borderRadius: "16px 16px 4px 16px",
    padding: "10px 14px",
    color: "#E8EAF0", fontSize: 14,
  },
  aiBubble: {
    background: "transparent",
    padding: "2px 0",
    color: "#E8EAF0", fontSize: 14,
  },
  thinking: { paddingLeft: 40 },
  msgFileChip: {
    display: "flex", alignItems: "center", gap: 6,
    background: "#1A1E28", border: "1px solid #2A2F3D",
    borderRadius: 8, padding: "5px 10px",
    fontSize: 12, color: "#E8EAF0",
  },

  // Input
  fileStrip: {
    display: "flex", gap: 8, padding: "8px 20px 0",
    flexWrap: "wrap", maxWidth: 780, margin: "0 auto", width: "100%",
  },
  fileChip: {
    display: "flex", alignItems: "center",
    background: "#1A1E28", border: "1px solid #2A2F3D",
    borderRadius: 8, overflow: "hidden",
  },
  fileChipPreview: {
    display: "flex", alignItems: "center", gap: 7,
    padding: "6px 10px", background: "none", border: "none",
    color: "#E8EAF0", cursor: "pointer", fontFamily: "inherit",
  },
  fileRemoveBtn: {
    padding: "6px 8px", background: "none", border: "none",
    borderLeft: "1px solid #2A2F3D",
    color: "#8B90A0", cursor: "pointer", fontSize: 16, lineHeight: 1,
  },
  inputBar: {
    display: "flex", alignItems: "flex-end", gap: 8,
    padding: "12px 20px",
    borderTop: "1px solid #1F2330",
    background: "#0D0F14",
    maxWidth: 780, margin: "0 auto", width: "100%",
    flexShrink: 0,
  },
  attachBtn: {
    background: "none", border: "1px solid #2A2F3D",
    borderRadius: 8, width: 38, height: 38,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#8B90A0", cursor: "pointer", flexShrink: 0,
    transition: "border-color 0.15s, color 0.15s",
  },
  textarea: {
    flex: 1, resize: "none", background: "#13161D",
    border: "1px solid #2A2F3D", borderRadius: 10,
    padding: "9px 12px", color: "#E8EAF0",
    fontSize: 14, fontFamily: "inherit", lineHeight: 1.6,
    outline: "none", minHeight: 38, maxHeight: 160,
    overflowY: "auto",
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 8, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#1A1E28", border: "1px solid #2A2F3D",
    color: "#4A5068", cursor: "pointer", transition: "all 0.15s",
  },
  sendBtnActive: {
    background: "#F5A623", border: "1px solid #F5A623", color: "#0D0F14",
  },
  disclaimer: { fontSize: 11, color: "#4A5068", textAlign: "center", padding: "4px 0 10px" },

  // Empty state
  emptyState: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", height: "100%",
    padding: "40px 24px", textAlign: "center",
  },
  emptyIcon: { fontSize: 40, color: "#F5A623", marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: 600, color: "#E8EAF0", marginBottom: 8 },
  emptySub: { fontSize: 14, color: "#8B90A0", marginBottom: 24, maxWidth: 380 },
  uploadPromptBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#1A1E28", border: "1px dashed #2A2F3D",
    borderRadius: 10, padding: "10px 20px",
    color: "#8B90A0", fontSize: 13, cursor: "pointer",
    fontFamily: "inherit", marginBottom: 24,
    transition: "border-color 0.15s, color 0.15s",
  },
  suggestionGrid: {
    display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, maxWidth: 380, width: "100%",
  },
  suggestionCard: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
    background: "#13161D", border: "1px solid #2A2F3D",
    borderRadius: 10, padding: "14px 16px",
    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
    transition: "border-color 0.15s",
  },

  // Modal
  modalOverlay: {
    position: "fixed", inset: 0, zIndex: 100,
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    background: "#13161D", border: "1px solid #2A2F3D",
    borderRadius: 16, padding: 20, maxWidth: 640, width: "100%",
    maxHeight: "85vh", overflowY: "auto",
  },
};
