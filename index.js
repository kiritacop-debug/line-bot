require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

/**
 * =========================================================
 * ① Slack Event API（最上部・無限ループ防御付き）
 * =========================================================
 */
app.post("/slack/events", async (req, res) => {
  const body = req.body;

  // URL検証
  if (body.type === "url_verification") {
    return res.send({ challenge: body.challenge });
  }

  // イベント存在チェック
  if (!body.event) return res.sendStatus(200);

  const event = body.event;

  // ❗無限ループ防御
  if (
    event.bot_id || // Bot投稿
    event.subtype === "bot_message" || // Botメッセージ
    !event.text // テキストなし
  ) {
    return res.sendStatus(200);
  }

  const userMessage = event.text;

  try {
    // 並列実行
    const results = await Promise.all([
      callOpenAI(userMessage),
      callClaude(userMessage),
      callGemini(userMessage),
      callGroq(userMessage),
      callMistral(userMessage),
      callCohere(userMessage),
      callDeepSeek(userMessage),
    ]);

    const [
      openai,
      claude,
      gemini,
      groq,
      mistral,
      cohere,
      deepseek,
    ] = results;

    const combined = `
【GPT】
${openai}

【Claude】
${claude}

【Gemini】
${gemini}

【Groq】
${groq}

【Mistral】
${mistral}

【Cohere】
${cohere}

【DeepSeek】
${deepseek}
`;

    // 最終統合（ジャービス）
    const finalReport = await callFinalSummarizer(combined);

    // Slackへ送信
    await axios.post(process.env.SLACK_WEBHOOK_URL, {
      text: `📊 *AI合議制 上申書*\n\n${finalReport}`,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

/**
 * =========================================================
 * ② 各AI呼び出し（全部フェイルセーフ）
 * =========================================================
 */

const safe = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    console.error("API ERROR:", e.message);
    return "";
  }
};

// OpenAI
const callOpenAI = (input) =>
  safe(async () => {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: input }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        timeout: 15000,
      }
    );
    return res.data.choices[0].message.content;
  });

// Claude
const callClaude = (input) =>
  safe(async () => {
    const res = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1000,
        messages: [{ role: "user", content: input }],
      },
      {
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        timeout: 15000,
      }
    );
    return res.data.content[0].text;
  });

// Gemini
const callGemini = (input) =>
  safe(async () => {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: input }] }],
      },
      { timeout: 15000 }
    );
    return res.data.candidates[0].content.parts[0].text;
  });

// Groq
const callGroq = (input) =>
  safe(async () => {
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: input }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        timeout: 10000,
      }
    );
    return res.data.choices[0].message.content;
  });

// Mistral
const callMistral = (input) =>
  safe(async () => {
    const res = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-large-latest",
        messages: [{ role: "user", content: input }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        },
        timeout: 15000,
      }
    );
    return res.data.choices[0].message.content;
  });

// Cohere
const callCohere = (input) =>
  safe(async () => {
    const res = await axios.post(
      "https://api.cohere.ai/v1/chat",
      {
        model: "command-r-plus",
        message: input,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        },
        timeout: 15000,
      }
    );
    return res.data.text;
  });

// DeepSeek
const callDeepSeek = (input) =>
  safe(async () => {
    const res = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: input }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        timeout: 15000,
      }
    );
    return res.data.choices[0].message.content;
  });

/**
 * =========================================================
 * ③ 最終統合（ジャービス）
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
            "あなたは経営者の意思決定を支援するAI議長です。複数のAI意見を統合し、1つの論理的で実務的な上申書にまとめてください。",
        },
        {
          role: "user",
          content: input,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      timeout: 20000,
    }
  );

  return res.data.choices[0].message.content;
};

/**
 * =========================================================
 * ④ 既存Webhook保護（LINEなど）
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
  console.log(`Server running on port ${PORT}`);
});
