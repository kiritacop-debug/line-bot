require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

/**
 * =========================================================
 * 共通ユーティリティ
 * =========================================================
 */

// フェイルセーフ
const safe = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    console.error("API ERROR:", e.message);
    return "";
  }
};

// タイムアウト制御
const withTimeout = (promise, ms = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
};

// キャッシュ
const cache = new Map();

const getCache = (key) => cache.get(key);
const setCache = (key, value) => cache.set(key, value);

// ログ保存
const saveLog = (input, output) => {
  const log = `
[${new Date().toISOString()}]
INPUT:
${input}

OUTPUT:
${output}
`;
  fs.appendFileSync("logs.txt", log);
};

// 役割プロンプト
const createPrompt = (role, input) => `
あなたは以下の専門家です：
${role}

テーマ：
${input}

条件：
・結論を最初に述べる
・理由は3つ以内
・実行案を必ず提示
`;

// 役割定義
const roles = {
  openai: "経営戦略の総責任者",
  claude: "論理・リスク分析の専門家",
  gemini: "市場・トレンド分析官",
  groq: "革新的アイデア創出担当",
  mistral: "財務・コスト管理責任者",
  cohere: "現場オペレーション責任者",
  deepseek: "データ・数理最適化エンジニア",
};

/**
 * =========================================================
 * Slack Event API（無限ループ完全防御）
 * =========================================================
 */
app.post("/slack/events", async (req, res) => {
  const body = req.body;

  if (body.type === "url_verification") {
    return res.send({ challenge: body.challenge });
  }

  if (!body.event) return res.sendStatus(200);

  const event = body.event;

  if (
    event.bot_id ||
    event.subtype === "bot_message" ||
    !event.text
  ) {
    return res.sendStatus(200);
  }

  const userMessage = event.text;

  // キャッシュ確認
  const cached = getCache(userMessage);
  if (cached) {
    await sendToSlack(cached);
    return res.sendStatus(200);
  }

  // 進行中通知
  await sendToSlack("🧠 AI7体が合議中...");

  try {
    const results = await Promise.all([
      callOpenAI(userMessage),
      callClaude(userMessage),
      callGemini(userMessage),
      callGroq(userMessage),
      callMistral(userMessage),
      callCohere(userMessage),
      callDeepSeek(userMessage),
    ]);

    const [openai, claude, gemini, groq, mistral, cohere, deepseek] = results;

    const combined = `
【戦略】
${openai}

【論理】
${claude}

【市場】
${gemini}

【アイデア】
${groq}

【財務】
${mistral}

【現場】
${cohere}

【数理】
${deepseek}
`;

    const finalReport = await callFinalSummarizer(combined);

    // キャッシュ保存
    setCache(userMessage, finalReport);

    // ログ保存
    saveLog(userMessage, finalReport);

    // Slack送信
    await sendToSlack(`📊 *AI合議制 上申書*\n\n${finalReport}`);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    await sendToSlack("⚠️ エラーが発生しました");
    res.sendStatus(500);
  }
});

/**
 * =========================================================
 * Slack送信
 * =========================================================
 */
const sendToSlack = async (text) => {
  await axios.post(process.env.SLACK_WEBHOOK_URL, { text });
};

/**
 * =========================================================
 * 各AI呼び出し
 * =========================================================
 */

// OpenAI
const callOpenAI = (input) =>
  safe(() =>
    withTimeout(
      axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o",
          messages: [
            { role: "user", content: createPrompt(roles.openai, input) },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        }
      ),
      8000
    ).then((res) => res.data.choices[0].message.content)
  );

// Claude
const callClaude = (input) =>
  safe(() =>
    withTimeout(
      axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1000,
          messages: [
            { role: "user", content: createPrompt(roles.claude, input) },
          ],
        },
        {
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
        }
      ),
      8000
    ).then((res) => res.data.content[0].text)
  );

// Gemini
const callGemini = (input) =>
  safe(() =>
    withTimeout(
      axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [{ text: createPrompt(roles.gemini, input) }],
            },
          ],
        }
      ),
      8000
    ).then((res) => res.data.candidates[0].content.parts[0].text)
  );

// Groq
const callGroq = (input) =>
  safe(() =>
    withTimeout(
      axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama3-70b-8192",
          messages: [
            { role: "user", content: createPrompt(roles.groq, input) },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
        }
      ),
      6000
    ).then((res) => res.data.choices[0].message.content)
  );

// Mistral
const callMistral = (input) =>
  safe(() =>
    withTimeout(
      axios.post(
        "https://api.mistral.ai/v1/chat/completions",
        {
          model: "mistral-large-latest",
          messages: [
            { role: "user", content: createPrompt(roles.mistral, input) },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          },
        }
      ),
      8000
    ).then((res) => res.data.choices[0].message.content)
  );

// Cohere
const callCohere = (input) =>
  safe(() =>
    withTimeout(
      axios.post(
        "https://api.cohere.ai/v1/chat",
        {
          model: "command-r-plus",
          message: createPrompt(roles.cohere, input),
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          },
        }
      ),
      8000
    ).then((res) => res.data.text)
  );

// DeepSeek
const callDeepSeek = (input) =>
  safe(() =>
    withTimeout(
      axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: "deepseek-chat",
          messages: [
            { role: "user", content: createPrompt(roles.deepseek, input) },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          },
        }
      ),
      8000
    ).then((res) => res.data.choices[0].message.content)
  );

/**
 * =========================================================
 * 最終統合（意思決定AI）
 * =========================================================
 */
const callFinalSummarizer = async (input) => {
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "あなたはCEOの参謀です。複数の意見を統合し、必ず1つの意思決定を出してください。",
        },
        {
          role: "user",
          content: `
以下を統合してください：

${input}

出力形式：
① 結論
② 採用戦略（1つ）
③ 理由
④ リスクと対策
⑤ 明日のアクション（3つ）
`,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  );

  return res.data.choices[0].message.content;
};

/**
 * =========================================================
 * 既存Webhook保護
 * =========================================================
 */
app.post("/webhook", (req, res) => {
  res.sendStatus(200);
});

/**
 * =========================================================
 * 起動
 * =========================================================
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔥 AI合議制サーバー起動: ${PORT}`);
});
