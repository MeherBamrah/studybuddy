import streamlit as st
import google.generativeai as genai
import os
import io
import time
import json
import base64
from pathlib import Path

# ── Page config ─────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="StudyBuddy AI",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ───────────────────────────────────────────────────────────────
st.markdown("""
<style>
  /* ── Fonts ── */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  /* ── Root tokens ── */
  :root {
    --bg:        #0f1117;
    --surface:   #1a1d27;
    --surface2:  #22263a;
    --border:    #2e3352;
    --accent:    #7c6ff7;
    --accent2:   #a78bfa;
    --green:     #34d399;
    --amber:     #fbbf24;
    --red:       #f87171;
    --text:      #e2e8f0;
    --muted:     #94a3b8;
    --radius:    12px;
  }

  /* ── Base ── */
  html, body, [class*="css"] {
    font-family: 'Inter', sans-serif;
    background-color: var(--bg);
    color: var(--text);
  }
  .main .block-container { padding: 1.5rem 2rem 4rem; max-width: 1200px; }
  h1,h2,h3 { font-weight: 600; letter-spacing: -0.02em; }

  /* ── Sidebar ── */
  [data-testid="stSidebar"] {
    background: var(--surface);
    border-right: 1px solid var(--border);
  }
  [data-testid="stSidebar"] .block-container { padding: 1.5rem 1rem; }

  /* ── Buttons ── */
  .stButton > button {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    font-size: 14px;
    padding: 0.5rem 1.25rem;
    transition: all 0.15s;
    width: 100%;
  }
  .stButton > button:hover { background: var(--accent2); transform: translateY(-1px); }
  .stButton > button:active { transform: translateY(0); }

  /* ── Text input / area ── */
  .stTextInput > div > input,
  .stTextArea > div > textarea {
    background: var(--surface2) !important;
    border: 1px solid var(--border) !important;
    border-radius: 8px !important;
    color: var(--text) !important;
    font-family: 'Inter', sans-serif !important;
  }
  .stTextInput > div > input:focus,
  .stTextArea > div > textarea:focus {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px rgba(124,111,247,0.15) !important;
  }

  /* ── File uploader ── */
  [data-testid="stFileUploader"] {
    background: var(--surface2);
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    padding: 1rem;
  }
  [data-testid="stFileUploader"]:hover { border-color: var(--accent); }

  /* ── Selectbox ── */
  .stSelectbox > div > div {
    background: var(--surface2) !important;
    border: 1px solid var(--border) !important;
    border-radius: 8px !important;
    color: var(--text) !important;
  }

  /* ── Chat messages ── */
  .chat-bubble-user {
    display: flex;
    justify-content: flex-end;
    margin: 0.5rem 0;
  }
  .chat-bubble-user .bubble {
    background: var(--accent);
    color: white;
    border-radius: 18px 18px 4px 18px;
    padding: 0.65rem 1rem;
    max-width: 75%;
    font-size: 14px;
    line-height: 1.55;
  }
  .chat-bubble-ai {
    display: flex;
    justify-content: flex-start;
    margin: 0.5rem 0;
  }
  .chat-bubble-ai .avatar {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, var(--accent), var(--green));
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0; margin-right: 0.5rem; margin-top: 2px;
  }
  .chat-bubble-ai .bubble {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 4px 18px 18px 18px;
    padding: 0.65rem 1rem;
    max-width: 80%;
    font-size: 14px;
    line-height: 1.6;
  }
  .chat-bubble-ai .bubble code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    background: var(--bg);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--accent2);
  }
  .chat-bubble-ai .bubble pre {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem;
    overflow-x: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  }

  /* ── Stat cards ── */
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    text-align: center;
  }
  .stat-card .num { font-size: 24px; font-weight: 600; color: var(--accent2); }
  .stat-card .lbl { font-size: 12px; color: var(--muted); margin-top: 2px; }

  /* ── Source badge ── */
  .source-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 99px; padding: 4px 10px;
    font-size: 11px; color: var(--muted); margin: 3px;
  }
  .source-badge.active { border-color: var(--accent); color: var(--accent2); }

  /* ── Section card ── */
  .section-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem 1.5rem;
    margin-bottom: 1rem;
  }

  /* ── Quiz card ── */
  .quiz-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    margin-bottom: 0.75rem;
  }
  .quiz-card .qnum {
    font-size: 11px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--accent2); margin-bottom: 6px;
  }
  .quiz-card .qtext { font-size: 15px; font-weight: 500; margin-bottom: 0; }
  .answer-reveal {
    background: rgba(52,211,153,0.08);
    border: 1px solid rgba(52,211,153,0.25);
    border-radius: 8px; padding: 0.75rem 1rem;
    font-size: 13px; color: var(--green); margin-top: 8px;
  }

  /* ── Divider ── */
  hr { border-color: var(--border); margin: 1.5rem 0; }

  /* ── Scrollable chat ── */
  .chat-container {
    max-height: 500px;
    overflow-y: auto;
    padding: 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  /* ── Tab styling ── */
  .stTabs [data-baseweb="tab-list"] {
    gap: 4px;
    background: var(--surface);
    border-radius: 10px;
    padding: 4px;
    border: 1px solid var(--border);
  }
  .stTabs [data-baseweb="tab"] {
    border-radius: 8px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 500;
    padding: 6px 16px;
  }
  .stTabs [aria-selected="true"] {
    background: var(--accent) !important;
    color: white !important;
  }

  /* ── Toast / info box ── */
  .info-box {
    background: rgba(124,111,247,0.1);
    border: 1px solid rgba(124,111,247,0.3);
    border-radius: 8px; padding: 0.75rem 1rem;
    font-size: 13px; color: var(--accent2);
    margin: 0.75rem 0;
  }
  .warn-box {
    background: rgba(251,191,36,0.08);
    border: 1px solid rgba(251,191,36,0.25);
    border-radius: 8px; padding: 0.75rem 1rem;
    font-size: 13px; color: var(--amber);
    margin: 0.75rem 0;
  }

  /* ── Hide streamlit chrome ── */
  #MainMenu, footer, [data-testid="stDecoration"] { display: none; }
</style>
""", unsafe_allow_html=True)


# ── Helpers ──────────────────────────────────────────────────────────────────

def init_session():
    defaults = {
        "api_key_set": False,
        "chat_history": [],
        "sources": [],          # list of {name, type, content_ref}
        "persona": "Study Buddy",
        "quiz_questions": [],
        "summary": "",
        "total_questions_asked": 0,
        "sources_loaded": 0,
        "model": None,
        "chat_session": None,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

def configure_gemini(api_key: str):
    genai.configure(api_key=api_key)
    st.session_state.api_key_set = True

def get_model():
    return genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=get_system_prompt(),
    )

def get_system_prompt() -> str:
    persona = st.session_state.get("persona", "Study Buddy")
    sources_desc = ""
    if st.session_state.sources:
        names = [s["name"] for s in st.session_state.sources]
        sources_desc = f"The user has uploaded the following sources: {', '.join(names)}. Use them as context for all answers."

    personas = {
        "Study Buddy": """You are StudyBuddy, a warm, encouraging AI study assistant. 
You celebrate correct answers, gently correct mistakes, and always keep the user engaged.
After every explanation, ask one follow-up question to deepen understanding.
Use clear bullet points and examples. Keep responses concise — never wall-of-text.""",

        "Socratic Tutor": """You are a Socratic tutor. You NEVER directly answer questions.
You only respond with thoughtful questions that guide the student to discover the answer themselves.
If asked 'what is X?', respond with 'What do you already know about X? What might it relate to?'
Keep nudging — never give the answer outright.""",

        "Exam Coach": """You are a strict but fair exam coach preparing students for competitive exams.
Speak formally. Give precise structured answers with numbered points.
After every concept, give one MCQ with options A, B, C, D and the correct answer at the end.
Do not accept vague answers — push for specifics and cite the source material.""",

        "Debate Partner": """You are a devil's advocate debate partner.
For every claim the user makes, argue the opposing view thoughtfully.
Force the user to defend their reasoning. Point out logical gaps.
End each turn with: 'Can you defend this against: [strongest counter-argument]?'""",

        "Simple Explainer": """You are an expert at explaining complex topics simply.
Use analogies, metaphors, and real-world examples. Explain everything as if to a curious 15-year-old.
No jargon. Short sentences. One idea at a time. Use emojis sparingly to illustrate points.""",
    }

    base = personas.get(persona, personas["Study Buddy"])
    return f"{base}\n\n{sources_desc}\n\nAlways be helpful, accurate, and cite the uploaded source material when answering questions about it."

def new_chat_session():
    model = get_model()
    st.session_state.chat_session = model.start_chat(history=[])
    st.session_state.chat_history = []

def send_message(user_text: str, uploaded_parts=None) -> str:
    if not st.session_state.chat_session:
        new_chat_session()

    parts = []
    if uploaded_parts:
        parts.extend(uploaded_parts)
    parts.append(user_text)

    try:
        response = st.session_state.chat_session.send_message(parts)
        st.session_state.total_questions_asked += 1
        return response.text
    except Exception as e:
        return f"⚠️ Error: {str(e)}"

def file_to_part(uploaded_file):
    """Convert a Streamlit uploaded file to a Gemini content part."""
    file_bytes = uploaded_file.read()
    uploaded_file.seek(0)
    mime = uploaded_file.type

    if mime == "application/pdf":
        return genai.protos.Part(
            inline_data=genai.protos.Blob(mime_type="application/pdf", data=file_bytes)
        )
    elif mime.startswith("image/"):
        return genai.protos.Part(
            inline_data=genai.protos.Blob(mime_type=mime, data=file_bytes)
        )
    elif mime in ("text/plain", "text/markdown", "text/csv"):
        return genai.protos.Part(text=file_bytes.decode("utf-8", errors="ignore"))
    else:
        # Try as text fallback
        try:
            return genai.protos.Part(text=file_bytes.decode("utf-8", errors="ignore"))
        except:
            return None

def generate_summary(file_parts) -> str:
    model = get_model()
    prompt = """Please analyse all the uploaded content and provide:

1. **Overview** — What is this material about? (2-3 sentences)
2. **Key Topics** — List the 5-8 main topics or concepts covered
3. **Key Takeaways** — The 3 most important things to understand
4. **Study Tips** — 2-3 specific tips for learning this material effectively

Be concise and structured."""
    try:
        response = model.generate_content([*file_parts, prompt])
        return response.text
    except Exception as e:
        return f"Could not generate summary: {str(e)}"

def generate_quiz(file_parts, num_questions: int, difficulty: str) -> list:
    model = get_model()
    prompt = f"""Based on the uploaded content, generate exactly {num_questions} quiz questions at {difficulty} difficulty.

Return ONLY a valid JSON array, no markdown, no explanation. Format:
[
  {{
    "question": "Question text here?",
    "options": ["A) option", "B) option", "C) option", "D) option"],
    "answer": "A",
    "explanation": "Brief explanation of why this is correct."
  }}
]"""
    try:
        response = model.generate_content([*file_parts, prompt])
        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except Exception as e:
        return []

def generate_flashcards(file_parts, num_cards: int) -> list:
    model = get_model()
    prompt = f"""Based on the uploaded content, generate exactly {num_cards} flashcards.

Return ONLY a valid JSON array, no markdown. Format:
[
  {{
    "front": "Question or term",
    "back": "Answer or definition"
  }}
]"""
    try:
        response = model.generate_content([*file_parts, prompt])
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except:
        return []


# ── UI ────────────────────────────────────────────────────────────────────────

init_session()

# ── Sidebar ──────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 🧠 StudyBuddy AI")
    st.markdown('<p style="font-size:12px;color:#94a3b8;margin-top:-8px">Powered by Gemini 2.0 Flash</p>', unsafe_allow_html=True)
    st.markdown("---")

    # API Key
    if not st.session_state.api_key_set:
        st.markdown("**Step 1 — API Key**")
        api_key_input = st.text_input(
            "Gemini API Key",
            type="password",
            placeholder="AIza...",
            help="Get your free key at aistudio.google.com",
        )
        st.markdown('<p style="font-size:11px;color:#94a3b8">Free at <a href="https://aistudio.google.com" target="_blank" style="color:#7c6ff7">aistudio.google.com</a></p>', unsafe_allow_html=True)
        if st.button("Connect →"):
            if api_key_input.strip():
                try:
                    configure_gemini(api_key_input.strip())
                    new_chat_session()
                    st.success("Connected!")
                    st.rerun()
                except Exception as e:
                    st.error(f"Invalid key: {e}")
            else:
                st.warning("Enter your API key first.")
    else:
        st.markdown('<div class="info-box">✅ Gemini connected</div>', unsafe_allow_html=True)

        st.markdown("---")

        # Upload sources
        st.markdown("**Step 2 — Upload Sources**")
        st.markdown('<p style="font-size:12px;color:#94a3b8">PDFs, images, text files, notes</p>', unsafe_allow_html=True)

        uploaded_files = st.file_uploader(
            "Drop files here",
            type=["pdf", "png", "jpg", "jpeg", "webp", "txt", "md", "csv"],
            accept_multiple_files=True,
            label_visibility="collapsed",
        )

        if uploaded_files:
            existing_names = {s["name"] for s in st.session_state.sources}
            for f in uploaded_files:
                if f.name not in existing_names:
                    st.session_state.sources.append({
                        "name": f.name,
                        "type": f.type,
                        "file": f,
                    })
            st.session_state.sources_loaded = len(st.session_state.sources)
            new_chat_session()  # Reset chat with new sources in system prompt

        if st.session_state.sources:
            st.markdown("**Loaded sources:**")
            for s in st.session_state.sources:
                icon = "📄" if "pdf" in s["type"] else "🖼️" if "image" in s["type"] else "📝"
                st.markdown(f'<span class="source-badge active">{icon} {s["name"]}</span>', unsafe_allow_html=True)

            if st.button("🗑️ Clear sources"):
                st.session_state.sources = []
                st.session_state.sources_loaded = 0
                new_chat_session()
                st.rerun()

        st.markdown("---")

        # Persona picker
        st.markdown("**Step 3 — Pick a Persona**")
        persona = st.selectbox(
            "AI Personality",
            ["Study Buddy", "Socratic Tutor", "Exam Coach", "Debate Partner", "Simple Explainer"],
            label_visibility="collapsed",
        )
        if persona != st.session_state.persona:
            st.session_state.persona = persona
            new_chat_session()
            st.rerun()

        st.markdown("---")

        # Stats
        col1, col2 = st.columns(2)
        with col1:
            st.markdown(f'<div class="stat-card"><div class="num">{st.session_state.sources_loaded}</div><div class="lbl">Sources</div></div>', unsafe_allow_html=True)
        with col2:
            st.markdown(f'<div class="stat-card"><div class="num">{st.session_state.total_questions_asked}</div><div class="lbl">Asked</div></div>', unsafe_allow_html=True)

        st.markdown("---")
        if st.button("🔄 New Session"):
            for key in ["chat_history", "sources", "quiz_questions", "summary",
                        "total_questions_asked", "sources_loaded", "chat_session"]:
                st.session_state[key] = [] if key in ("chat_history", "sources", "quiz_questions") else (0 if "total" in key or "loaded" in key else "" if key == "summary" else None)
            st.rerun()

        if st.button("🔑 Change API Key"):
            st.session_state.api_key_set = False
            st.rerun()


# ── Main area ────────────────────────────────────────────────────────────────

if not st.session_state.api_key_set:
    # Landing
    st.markdown("""
    <div style="text-align:center; padding: 4rem 2rem;">
      <div style="font-size:56px;margin-bottom:1rem">🧠</div>
      <h1 style="font-size:2.5rem;font-weight:600;margin-bottom:0.5rem">StudyBuddy AI</h1>
      <p style="font-size:1.1rem;color:#94a3b8;margin-bottom:2rem">
        Upload any PDF, image, or notes.<br>
        Get summaries, quizzes, flashcards, and a tutor — all in one place.
      </p>
    </div>
    """, unsafe_allow_html=True)

    c1, c2, c3, c4 = st.columns(4)
    for col, icon, title, desc in [
        (c1, "💬", "Chat", "Ask anything about your material in natural language"),
        (c2, "📋", "Summarise", "Instant structured summary of any uploaded content"),
        (c3, "🎯", "Quiz", "Auto-generated MCQs with answers and explanations"),
        (c4, "🃏", "Flashcards", "Smart flashcards for spaced repetition"),
    ]:
        col.markdown(f"""
        <div class="section-card" style="text-align:center">
          <div style="font-size:28px;margin-bottom:8px">{icon}</div>
          <div style="font-weight:600;margin-bottom:4px">{title}</div>
          <div style="font-size:12px;color:#94a3b8">{desc}</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("---")
    st.markdown('<p style="text-align:center;color:#94a3b8;font-size:13px">Enter your Gemini API key in the sidebar to get started. Free at <a href="https://aistudio.google.com" target="_blank" style="color:#7c6ff7">aistudio.google.com</a></p>', unsafe_allow_html=True)

else:
    # ── Header ──
    source_count = len(st.session_state.sources)
    if source_count == 0:
        st.markdown(f'<div class="warn-box">⬆️ Upload at least one source in the sidebar to unlock all features. You can still chat with Gemini\'s general knowledge.</div>', unsafe_allow_html=True)

    persona_emoji = {"Study Buddy": "🎓", "Socratic Tutor": "🤔", "Exam Coach": "📚", "Debate Partner": "⚔️", "Simple Explainer": "💡"}
    st.markdown(f'<p style="font-size:13px;color:#94a3b8;margin-bottom:1rem">{persona_emoji.get(st.session_state.persona,"🧠")} Persona: <strong style="color:#a78bfa">{st.session_state.persona}</strong> &nbsp;·&nbsp; {source_count} source{"s" if source_count != 1 else ""} loaded</p>', unsafe_allow_html=True)

    # ── Tabs ──
    tab_chat, tab_summary, tab_quiz, tab_flash = st.tabs([
        "💬 Chat", "📋 Summary", "🎯 Quiz", "🃏 Flashcards"
    ])

    # ── Collect current file parts ──
    def get_file_parts():
        parts = []
        for s in st.session_state.sources:
            f = s.get("file")
            if f:
                p = file_to_part(f)
                if p:
                    parts.append(p)
        return parts

    # ════════════════════════════════════════════════════════
    # TAB 1 — CHAT
    # ════════════════════════════════════════════════════════
    with tab_chat:
        # Render history
        chat_html = '<div class="chat-container">'
        if not st.session_state.chat_history:
            chat_html += '<p style="text-align:center;color:#94a3b8;font-size:13px;padding:2rem">Start the conversation below 👇</p>'
        for msg in st.session_state.chat_history:
            if msg["role"] == "user":
                chat_html += f'<div class="chat-bubble-user"><div class="bubble">{msg["content"]}</div></div>'
            else:
                # Simple markdown-to-HTML for bold and code
                content = msg["content"].replace("**", "<strong>", 1)
                content = content.replace("**", "</strong>", 1) if "<strong>" in content else content
                chat_html += f'<div class="chat-bubble-ai"><div class="avatar">🧠</div><div class="bubble">{content}</div></div>'
        chat_html += '</div>'
        st.markdown(chat_html, unsafe_allow_html=True)

        st.markdown("")

        # Suggested prompts
        if not st.session_state.chat_history:
            st.markdown("**Try asking:**")
            suggestions = [
                "Summarise the key concepts from my material",
                "What are the most important things I should know?",
                "Quiz me on anything from the content",
                "Explain the hardest concept in simple terms",
            ]
            cols = st.columns(2)
            for i, s in enumerate(suggestions):
                if cols[i % 2].button(s, key=f"sug_{i}"):
                    file_parts = get_file_parts()
                    reply = send_message(s, file_parts if file_parts else None)
                    st.session_state.chat_history.append({"role": "user", "content": s})
                    st.session_state.chat_history.append({"role": "assistant", "content": reply})
                    st.rerun()

        # Input
        with st.form("chat_form", clear_on_submit=True):
            col_in, col_btn = st.columns([5, 1])
            with col_in:
                user_input = st.text_area(
                    "Message",
                    placeholder="Ask anything about your material…",
                    height=80,
                    label_visibility="collapsed",
                )
            with col_btn:
                st.markdown("<br>", unsafe_allow_html=True)
                submitted = st.form_submit_button("Send →")

        if submitted and user_input.strip():
            file_parts = get_file_parts()
            with st.spinner("Thinking…"):
                reply = send_message(user_input.strip(), file_parts if file_parts else None)
            st.session_state.chat_history.append({"role": "user", "content": user_input.strip()})
            st.session_state.chat_history.append({"role": "assistant", "content": reply})
            st.rerun()

        if st.session_state.chat_history:
            if st.button("🗑️ Clear chat"):
                st.session_state.chat_history = []
                new_chat_session()
                st.rerun()

    # ════════════════════════════════════════════════════════
    # TAB 2 — SUMMARY
    # ════════════════════════════════════════════════════════
    with tab_summary:
        if not st.session_state.sources:
            st.markdown('<div class="warn-box">⬆️ Upload sources in the sidebar first.</div>', unsafe_allow_html=True)
        else:
            if not st.session_state.summary:
                st.markdown("**Generate a structured summary of all your uploaded material.**")
                if st.button("✨ Generate Summary"):
                    file_parts = get_file_parts()
                    with st.spinner("Analysing your material…"):
                        st.session_state.summary = generate_summary(file_parts)
                    st.rerun()
            else:
                st.markdown(st.session_state.summary)
                st.markdown("---")
                col1, col2 = st.columns(2)
                with col1:
                    if st.button("🔄 Regenerate"):
                        st.session_state.summary = ""
                        st.rerun()
                with col2:
                    st.download_button(
                        "⬇️ Download Summary",
                        data=st.session_state.summary,
                        file_name="studybuddy_summary.md",
                        mime="text/markdown",
                    )

    # ════════════════════════════════════════════════════════
    # TAB 3 — QUIZ
    # ════════════════════════════════════════════════════════
    with tab_quiz:
        if not st.session_state.sources:
            st.markdown('<div class="warn-box">⬆️ Upload sources in the sidebar first.</div>', unsafe_allow_html=True)
        else:
            col_a, col_b, col_c = st.columns([2, 2, 1])
            with col_a:
                num_q = st.slider("Number of questions", 3, 15, 5)
            with col_b:
                difficulty = st.select_slider("Difficulty", ["Easy", "Medium", "Hard", "Mixed"], value="Medium")
            with col_c:
                st.markdown("<br>", unsafe_allow_html=True)
                gen_quiz = st.button("🎯 Generate Quiz")

            if gen_quiz:
                file_parts = get_file_parts()
                with st.spinner(f"Writing {num_q} {difficulty.lower()} questions…"):
                    st.session_state.quiz_questions = generate_quiz(file_parts, num_q, difficulty)
                if not st.session_state.quiz_questions:
                    st.error("Could not generate quiz — try again or check your source files.")

            if st.session_state.quiz_questions:
                st.markdown(f"**{len(st.session_state.quiz_questions)} Questions** — click to reveal answers")
                st.markdown("")

                for i, q in enumerate(st.session_state.quiz_questions):
                    st.markdown(f'<div class="quiz-card"><div class="qnum">Question {i+1}</div><div class="qtext">{q.get("question","")}</div></div>', unsafe_allow_html=True)

                    options = q.get("options", [])
                    if options:
                        for opt in options:
                            st.markdown(f'<span style="font-size:14px;color:#94a3b8;display:block;padding:3px 0">　{opt}</span>', unsafe_allow_html=True)

                    with st.expander("See answer"):
                        ans = q.get("answer", "")
                        exp = q.get("explanation", "")
                        st.markdown(f'<div class="answer-reveal">✅ <strong>Answer: {ans}</strong><br>{exp}</div>', unsafe_allow_html=True)

                st.markdown("---")
                quiz_export = json.dumps(st.session_state.quiz_questions, indent=2)
                st.download_button("⬇️ Download Quiz (JSON)", data=quiz_export, file_name="studybuddy_quiz.json", mime="application/json")

    # ════════════════════════════════════════════════════════
    # TAB 4 — FLASHCARDS
    # ════════════════════════════════════════════════════════
    with tab_flash:
        if not st.session_state.sources:
            st.markdown('<div class="warn-box">⬆️ Upload sources in the sidebar first.</div>', unsafe_allow_html=True)
        else:
            col_f1, col_f2 = st.columns([3, 1])
            with col_f1:
                num_cards = st.slider("Number of flashcards", 5, 30, 10)
            with col_f2:
                st.markdown("<br>", unsafe_allow_html=True)
                gen_flash = st.button("🃏 Generate")

            if gen_flash:
                file_parts = get_file_parts()
                with st.spinner(f"Creating {num_cards} flashcards…"):
                    if "flashcards" not in st.session_state:
                        st.session_state.flashcards = []
                    st.session_state.flashcards = generate_flashcards(file_parts, num_cards)

            if st.session_state.get("flashcards"):
                cards = st.session_state.flashcards
                st.markdown(f"**{len(cards)} Flashcards** — click each card to flip")
                st.markdown("")

                cols = st.columns(2)
                for i, card in enumerate(cards):
                    with cols[i % 2]:
                        with st.expander(f"🃏 {card.get('front', f'Card {i+1}')}"):
                            st.markdown(f'<div class="answer-reveal">{card.get("back","")}</div>', unsafe_allow_html=True)

                st.markdown("---")
                flash_export = "\n\n".join([f"Q: {c['front']}\nA: {c['back']}" for c in cards])
                st.download_button("⬇️ Download Flashcards (.txt)", data=flash_export, file_name="studybuddy_flashcards.txt", mime="text/plain")
