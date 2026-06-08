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

const safe = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    console.error("API ERROR:", e.response?.data || e.message);
    return "";
  }
};

const withTimeout = (promise, ms = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
};

const cache = new Map();
const getCache = (key) => cache.get(key);
const setCache = (key, value) => cache.set(key, value);

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

const roles = {
  openai: "経営戦略の総責任者",
  claude: "論理・リスク分析の専門家",
};

/**
 * =========================================================
 * Slack Event API（無限ループ防止）
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

  const cached = getCache(userMessage);
  if (cached) {
    await sendToSlack(cached);
    return res.sendStatus(200);
  }

  await sendToSlack("🧠 AI合議中（OpenAI + Claude）...");

  try {
    const [openai, claude] = await Promise.all([
      callOpenAI(userMessage),
      callClaude(userMessage),
    ]);

    const combined = `
【戦略】
${openai}

【論理】
${claude}
`;

    const finalReport = await callFinalSummarizer(combined);

    setCache(userMessage, finalReport);
    saveLog(userMessage, finalReport);

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
  await axios.post(process.env.SLACK_WEBHOOK_URL, {
    text,
  });
};

/**
 * =========================================================
 * AI呼び出し
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
          temperature: 0.7,
          messages: [
            {
              role: "user",
              content: createPrompt(roles.openai, input),
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
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
            {
              role: "user",
              content: createPrompt(roles.claude, input),
            },
          ],
        },
        {
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
        }
      ),
      8000
    ).then((res) => res.data.content?.[0]?.text || "")
  );

/**
 * =========================================================
 * 最終統合
 * =========================================================
 */
const callFinalSummarizer = async (input) => {
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "あなたはCEOの参謀です。必ず1つの意思決定にまとめてください。",
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
        "Content-Type": "application/json",
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
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🔥 AI合議制サーバー起動: ${PORT}`);
});
