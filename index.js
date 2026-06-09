import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();
const app = express();
app.use(express.json());
/**
 * ============================
 * 共通ユーティリティ
 * ============================
 */
const hasKey = (key) => key && key !== "" && key !== "undefined";
const safeCall = async (fn, name) => {
  try {
    return await fn();
  } catch (e) {
    console.log(`❌ ${name} error: ${e.message}`);
    return null;
  }
};
/**
 * ============================
 * LINE署名検証（超重要）
 * ============================
 */
const verifyLineSignature = (body, signature) => {
  const hash = crypto
    .createHmac("SHA256", process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
};
/**
 * ============================
 * 3神API
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
/**
 * ============================
 * ジャービス統合エンジン
 * ============================
 */
const callJarvis = async (inputs) => {
  const valid = inputs.filter(Boolean).join("\n\n---\n\n");
  const prompt = `
あなたは経営参謀ジャービス。
3人の専門家の意見を統合し、
「最も実行可能で利益最大化する唯一の戦略」を作れ。
【絶対ルール】
・要約禁止ではなく“意思決定”を行う
・最も勝率が高いものだけ採用
・矛盾は必ず解消する
・現場（飲食店）で即実行できる形にする
【出力】
① 結論（1つだけ）
② 採用理由
③ 具体的実行手順（現場レベル）
④ リスクと対策
【専門家意見】
${valid}
`;
  return await callOpenAI(prompt);
};
/**
 * ============================
 * LINE Reply API
 * ============================
 */
const replyToLine = async (replyToken, text) => {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text: text.substring(0, 4900)
        }
      ]
    })
  });
};
/**
 * ============================
 * 無限ループ防止
 * ============================
 */
const isBotMessage = (event) => {
  return event?.source?.type === "bot" || event?.message?.type !== "text";
};
/**
 * ============================
 * Webhook（LINE入口）
 * ============================
 */
app.post("/webhook", async (req, res) => {
  const signature = req.headers["x-line-signature"];
  const bodyString = JSON.stringify(req.body);
  // 署名チェック（改ざん防止）
  if (!verifyLineSignature(bodyString, signature)) {
    console.log("❌ Invalid signature");
    return res.sendStatus(403);
  }
  const event = req.body.events?.[0];
  if (!event) return res.sendStatus(200);
  // 無限ループ防止
  if (isBotMessage(event)) {
    return res.sendStatus(200);
  }
  const userMessage = event.message.text;
  const replyToken = event.replyToken;
  /**
   * ============================
   * 3神並列処理
   * ============================
   */
  const results = await Promise.all([
    safeCall(() => callOpenAI(userMessage), "OpenAI"),
    safeCall(() => callClaude(userMessage), "Claude"),
    safeCall(() => callGemini(userMessage), "Gemini")
  ]);
  /**
   * ============================
   * ジャービス統合
   * ============================
   */
  const final = await callJarvis(results);
  /**
   * ============================
   * LINEへ返信
   * ============================
   */
  await replyToLine(replyToken, final || "回答を生成できませんでした");
  res.sendStatus(200);
});
/**
 * ============================
 * 起動
 * ============================
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 LINE AI七福神（3神版）起動: ${PORT}`);
});
