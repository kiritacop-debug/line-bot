import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
const app = express();
app.use(express.json());
/**
 * ============================
 * 共通処理
 * ============================
 */
// APIキー確認
const hasKey = (key) => key && key !== "" && key !== "undefined";
// 落ちても止めない
const safeCall = async (fn, name) => {
  try {
    return await fn();
  } catch (e) {
    console.log(`❌ ${name} skipped: ${e.message}`);
    return null;
  }
};
/**
 * ============================
 * 役割プロンプト
 * ============================
 */
const buildPrompt = (role, userInput) => {
  switch (role) {
    case "Claude":
      return `あなたはリスク分析の専門家。失敗要因と回避策を中心に答えよ。\n${userInput}`;
    case "Gemini":
      return `あなたは市場分析の専門家。トレンドと将来性を踏まえて答えよ。\n${userInput}`;
    case "Perplexity":
      return `事実ベースで現実的に答えよ。\n${userInput}`;
    case "Cohere":
      return `売れる言葉・キャッチコピー重視で答えよ。\n${userInput}`;
    case "Mistral":
      return `最も論理的な結論を導け。\n${userInput}`;
    case "Groq":
      return `スピード重視で結論ファーストで答えよ。\n${userInput}`;
    default:
      return `飲食店経営として最適な判断をせよ。\n${userInput}`;
  }
};
/**
 * ============================
 * 各AI（7神）
 * ============================
 */
// OpenAI（必須）
const callOpenAI = async (prompt) => {
  if (!hasKey(process.env.OPENAI_API_KEY)) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
};
// Claude
const callClaude = async (prompt) => {
  if (!hasKey(process.env.ANTHROPIC_API_KEY)) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || null;
};
// Gemini
const callGemini = async (prompt) => {
  if (!hasKey(process.env.GEMINI_API_KEY)) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
};
// Groq
const callGroq = async (prompt) => {
  if (!hasKey(process.env.GROQ_API_KEY)) return null;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
};
// Perplexity
const callPerplexity = async (prompt) => {
  if (!hasKey(process.env.PERPLEXITY_API_KEY)) return null;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-medium-chat",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
};
// Cohere
const callCohere = async (prompt) => {
  if (!hasKey(process.env.COHERE_API_KEY)) return null;
  const res = await fetch("https://api.cohere.ai/v1/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "command",
      prompt: prompt,
      max_tokens: 500,
    }),
  });
  const data = await res.json();
  return data.generations?.[0]?.text || null;
};
// Mistral
const callMistral = async (prompt) => {
  if (!hasKey(process.env.MISTRAL_API_KEY)) return null;
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-medium",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
};
/**
 * ============================
 * ジャービス（意思決定エンジン）
 * ============================
 */
const callJarvis = async (inputs) => {
  const valid = inputs.filter(Boolean).join("\n\n---\n\n");
  const prompt = `
あなたは経営参謀ジャービス。
複数の専門家の意見を統合し、
最も勝率の高い「1つの戦略」を作れ。
【ルール】
・要約禁止
・並列禁止
・最も合理的なもののみ採用
・不要な意見は切り捨てる
【出力】
① 結論（唯一の戦略）
② 採用理由
③ 実行手順（即実行レベル）
④ 却下した意見と理由
【意見】
${valid}
`;
  return await callOpenAI(prompt);
};
/**
 * ============================
 * メイン処理
 * ============================
 */
app.post("/webhook", async (req, res) => {
  const userInput = req.body.message || "売上を伸ばす方法";
  const results = await Promise.all([
    safeCall(() => callOpenAI(buildPrompt("OpenAI", userInput)), "OpenAI"),
    safeCall(() => callClaude(buildPrompt("Claude", userInput)), "Claude"),
    safeCall(() => callGemini(buildPrompt("Gemini", userInput)), "Gemini"),
    safeCall(() => callGroq(buildPrompt("Groq", userInput)), "Groq"),
    safeCall(() => callPerplexity(buildPrompt("Perplexity", userInput)), "Perplexity"),
    safeCall(() => callCohere(buildPrompt("Cohere", userInput)), "Cohere"),
    safeCall(() => callMistral(buildPrompt("Mistral", userInput)), "Mistral"),
  ]);
  const final = await callJarvis(results);
  res.json({
    raw: results,
    final: final,
  });
});
/**
 * ============================
 * 起動
 * ============================
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 AI七福神 起動: ${PORT}`);
});
