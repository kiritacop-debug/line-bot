import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
const app = express();
app.use(express.json());
/**
 * ============================
 * 共通ユーティリティ
 * ============================
 */
// 安全実行（落ちても全体止めない）
const safeCall = async (fn, name) => {
  try {
    return await fn();
  } catch (e) {
    console.log(`❌ ${name} skipped:`, e.message);
    return null;
  }
};
// APIキー存在チェック
const hasKey = (key) => {
  return key && key !== "undefined" && key !== "";
};
/**
 * ============================
 * 各AI呼び出し（7神）
 * ============================
 */
// ① OpenAI
const callOpenAI = async (prompt) => {
  if (!hasKey(process.env.OPENAI_API_KEY)) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
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
// ② Claude
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
// ③ Gemini
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
// ④ Groq
const callGroq = async (prompt) => {
  if (!hasKey(process.env.GROQ_API_KEY)) return null;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
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
// ⑤ Perplexity
const callPerplexity = async (prompt) => {
  if (!hasKey(process.env.PERPLEXITY_API_KEY)) return null;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
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
// ⑥ Cohere
const callCohere = async (prompt) => {
  if (!hasKey(process.env.COHERE_API_KEY)) return null;
  const res = await fetch("https://api.cohere.ai/v1/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.COHERE_API_KEY}`,
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
// ⑦ Mistral
const callMistral = async (prompt) => {
  if (!hasKey(process.env.MISTRAL_API_KEY)) return null;
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
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
 * ジャービス（最終統合エンジン）
 * ============================
 */
const callJarvis = async (inputs) => {
  const validInputs = inputs.filter(Boolean).join("\n\n---\n\n");
  const prompt = `
あなたは「経営参謀ジャービス」です。
以下は複数のAI専門家の意見です。
それぞれ視点・強みが異なります。
【絶対ルール】
・単なる要約は禁止
・箇条書き並べは禁止
・意見の“良い部分だけを抽出し融合”すること
・矛盾があれば最も合理的なものを採用
・最終的に「1つの実行戦略」に統合する
【目的】
おっとり新町店の売上・利益を最大化する
“即実行可能な必勝戦略”を作ること
【出力形式】
① 結論（最重要戦略）
② なぜそれが最適か（統合理由）
③ 具体的アクション（今日からできるレベル）
④ 中長期の伸ばし方
【専門家の意見】
${validInputs}
`;
  return await callOpenAI(prompt);
};
/**
 * ============================
 * メイン処理
 * ============================
 */
app.post("/webhook", async (req, res) => {
  const userMessage = req.body.message || "テスト質問";
  const prompt = `飲食店経営の観点で回答してください:\n${userMessage}`;
  const results = await Promise.all([
    safeCall(() => callOpenAI(prompt), "OpenAI"),
    safeCall(() => callClaude(prompt), "Claude"),
    safeCall(() => callGemini(prompt), "Gemini"),
    safeCall(() => callGroq(prompt), "Groq"),
    safeCall(() => callPerplexity(prompt), "Perplexity"),
    safeCall(() => callCohere(prompt), "Cohere"),
    safeCall(() => callMistral(prompt), "Mistral")
  ]);
  const final = await callJarvis(results);
  res.json({
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
  console.log(`🚀 Server running on port ${PORT}`);
});
