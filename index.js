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
const hasKey = (key) => key && key !== "" && key !== "undefined";
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
 * モード定義
 * ============================
 */
const MODE = {
  STRATEGY: "経営",
  CREATIVE: "販促",
  MARKET: "市場",
  INVEST: "投資",
  BUSINESS: "事業",
  EDUCATION: "教育"
};
/**
 * ============================
 * モード判定
 * ============================
 */
const detectMode = (input) => {
  if (input.startsWith("販促")) return MODE.CREATIVE;
  if (input.startsWith("市場")) return MODE.MARKET;
  if (input.startsWith("投資")) return MODE.INVEST;
  if (input.startsWith("事業")) return MODE.BUSINESS;
  if (input.startsWith("教育")) return MODE.EDUCATION;
  return MODE.STRATEGY;
};
/**
 * ============================
 * プロンプト生成
 * ============================
 */
const buildPrompt = (role, mode, input) => {
  switch (mode) {
    case MODE.CREATIVE:
      return `あなたは飲食店のトップマーケターです。売れるPOP・キャッチコピーを作成してください。\n${input}`;
    case MODE.MARKET:
      return `市場分析の専門家として、最新トレンドと今後の動きを分析してください。\n${input}`;
    case MODE.INVEST:
      return `投資家として、リスクとリターンを踏まえた判断をしてください。\n${input}`;
    case MODE.BUSINESS:
      return `新規事業の戦略家として、拡張性と収益性を重視して提案してください。\n${input}`;
    case MODE.EDUCATION:
      return `経営を学ぶ人に対して、理論と具体例でわかりやすく教えてください。\n${input}`;
    default:
      // STRATEGY
      if (role === "Claude") {
        return `リスク分析の専門家として、失敗要因と回避策を示せ。\n${input}`;
      }
      if (role === "Gemini") {
        return `市場と将来性を踏まえて戦略を分析せよ。\n${input}`;
      }
      return `飲食店経営として最適な戦略を提示せよ。\n${input}`;
  }
};
/**
 * ============================
 * AI呼び出し（7神）
 * ============================
 */
const callOpenAI = async (prompt) => {
  if (!hasKey(process.env.OPENAI_API_KEY)) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
};
const callClaude = async (prompt) => {
  if (!hasKey(process.env.ANTHROPIC_API_KEY)) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || null;
};
const callGemini = async (prompt) => {
  if (!hasKey(process.env.GEMINI_API_KEY)) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
};
const callGroq = async (prompt) => {
  if (!hasKey(process.env.GROQ_API_KEY)) return null;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
};
const callPerplexity = async (prompt) => {
  if (!hasKey(process.env.PERPLEXITY_API_KEY)) return null;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "sonar-medium-chat",
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
};
const callCohere = async (prompt) => {
  if (!hasKey(process.env.COHERE_API_KEY)) return null;
  const res = await fetch("https://api.cohere.ai/v1/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "command",
      prompt: prompt,
      max_tokens: 500
    })
  });
  const data = await res.json();
  return data.generations?.[0]?.text || null;
};
const callMistral = async (prompt) => {
  if (!hasKey(process.env.MISTRAL_API_KEY)) return null;
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mistral-medium",
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
};
/**
 * ============================
 * ジャービス（最終意思決定）
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
・最適解のみ抽出
・不要は排除
【出力】
① 結論
② 理由
③ 実行手順
④ 捨てた意見と理由
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
  const userInput = req.body.message || "売上を上げる方法";
  const mode = detectMode(userInput);
  const results = await Promise.all([
    safeCall(() => callOpenAI(buildPrompt("OpenAI", mode, userInput)), "OpenAI"),
    safeCall(() => callClaude(buildPrompt("Claude", mode, userInput)), "Claude"),
    safeCall(() => callGemini(buildPrompt("Gemini", mode, userInput)), "Gemini"),
    safeCall(() => callGroq(buildPrompt("Groq", mode, userInput)), "Groq"),
    safeCall(() => callPerplexity(buildPrompt("Perplexity", mode, userInput)), "Perplexity"),
    safeCall(() => callCohere(buildPrompt("Cohere", mode, userInput)), "Cohere"),
    safeCall(() => callMistral(buildPrompt("Mistral", mode, userInput)), "Mistral")
  ]);
  const final = await callJarvis(results);
  res.json({
    mode: mode,
    raw: results,
    final: final
  });
});
/**
 * ============================
 * 起動
 * ============================
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 モード対応AI七福神 起動: ${PORT}`);
});
