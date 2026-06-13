import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

export const runtime = "edge";
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `You are StudyBuddy, an intelligent and encouraging AI study assistant powered by Google Gemini.

Your capabilities:
- You can read and analyse PDFs, images, handwritten notes, diagrams, slides, and any uploaded files
- You remember everything discussed in this conversation
- You help students learn through explanation, quizzing, summarisation, and Socratic questioning

Your personality:
- Warm, encouraging, and genuinely excited about learning
- You celebrate correct answers and gently guide through mistakes
- You use clear, concise explanations with real-world analogies
- You always end responses with a follow-up question or suggestion to deepen learning

Your rules:
- When given a document or image, always start by summarising what you see before answering questions
- When asked to quiz, generate varied question types (MCQ, short answer, true/false)
- Never just give the answer — guide the student to find it
- Keep responses focused and scannable — use bullet points and headers where helpful
- If content is in another language, respond in that same language`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const messagesRaw = formData.get("messages") as string;
    const messages: Array<{ role: string; content: string }> = JSON.parse(messagesRaw);

    // Build content parts — handle file attachments on the latest message
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const parts: Array<Record<string, unknown>> = [];

      // If this is the latest user message, check for file attachments
      if (i === messages.length - 1 && msg.role === "user") {
        const fileCount = parseInt(formData.get("fileCount") as string || "0");

        for (let f = 0; f < fileCount; f++) {
          const file = formData.get(`file_${f}`) as File;
          if (file) {
            const bytes = await file.arrayBuffer();
            const base64 = Buffer.from(bytes).toString("base64");
            parts.push({
              inlineData: {
                mimeType: file.type,
                data: base64,
              },
            });
          }
        }
      }

      // Add text content
      if (msg.content.trim()) {
        parts.push({ text: msg.content });
      }

      if (parts.length > 0) {
        contents.push({ role: msg.role === "assistant" ? "model" : "user", parts });
      }
    }

    // Stream the response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const response = await ai.models.generateContentStream({
          model: "gemini-2.0-flash",
          config: { systemInstruction: SYSTEM_PROMPT },
          contents,
        });

        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            await writer.write(encoder.encode(text));
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        await writer.write(encoder.encode(`\n\n[Error: ${errorMsg}]`));
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to process request";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
