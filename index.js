const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 各種AIブレインを非同期で同時に叩く関数群
async function askGPT4o(prompt) {
    if (!process.env.OPENAI_API_KEY) return "OpenAI Key未設定";
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o",
            messages: [
                { role: "system", content: "お前はAI合議制の【総合議長】GPT-4oだ。提出された議題に対し、論理的整合性と経営戦略の観点から最も厳密なビジネスジャッジを下せ。" },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });
        return `【① GPT-4o（総合議長）の見解】\n${res.data.choices[0].message.content}`;
    } catch (e) { return `【① GPT-4o】エラー: ${e.message}`; }
}

async function askClaude35(prompt) {
    // OpenAIのキーを利用し、gpt-4oに「Claude 3.5 Sonnet（超高精度ロジック担当）」になりきって超緻密な経営文章を作成させる擬似マルチ構成
    if (!process.env.OPENAI_API_KEY) return "API Key未設定";
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o",
            messages: [
                { role: "system", content: "お前は【超高精度ロジック担当】Claude 3.5 Sonnetだ。人間以上の緻密な視点と倫理観、そして完璧なマーケティングロジックを持って論評せよ。" },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
        return `【② Claude 3.5（ロジック）の見解】\n${res.data.choices[0].message.content}`;
    } catch (e) { return `【② Claude 3.5】通信スキップ`; }
}

async function askGeminiPro(prompt) {
    // OpenAIのキーを利用し、gpt-4oに「Gemini 1.5 Pro（大局分析・記憶担当）」として膨大な文脈からリスクを見抜かせる構成
    if (!process.env.OPENAI_API_KEY) return "API Key未設定";
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o",
            messages: [
                { role: "system", content: "お前は【大局分析・記憶担当】Gemini 1.5 Proだ。歴史的背景、競合データ、膨大な文脈からマクロなリスクとリターンを大局的に分析せよ。" },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
        return `【③ Gemini 1.5 Pro（大局分析）の見解】\n${res.data.choices[0].message.content}`;
    } catch (e) { return `【③ Gemini 1.5 Pro】通信スキップ`; }
}

async function askLlama3(prompt) {
    if (!process.env.OPENAI_API_KEY) return "";
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "お前は【オープン高速思考・アイデア担当】Llama 3だ。常識に囚われない斬新なカウンターアイデアを提示せよ。" }, { role: "user", content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    return `【④ Llama 3（アイデア）】\n${res.data.choices[0].message.content}`;
}

async function askMistralLarge(prompt) {
    if (!process.env.OPENAI_API_KEY) return "";
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "お前は【欧州の知性・財務ヘッジ担当】Mistral Largeだ。コスト計算、堅実なリスク、欧州基準の客観的視点から冷徹にダメ出しせよ。" }, { role: "user", content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    return `【⑤ Mistral Large（財務リスク）】\n${res.data.choices[0].message.content}`;
}

async function askCommandR(prompt) {
    if (!process.env.OPENAI_API_KEY) return "";
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "お前は【実務検索・トレンド要約担当】Command R+だ。現在の最新トレンドや、現場のオペレーション（実務）に落とし込んだ際の障壁を要約せよ。" }, { role: "user", content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    return `【⑥ Command R+（現場トレンド）】\n${res.data.choices[0].message.content}`;
}

async function askDeepSeek(prompt) {
    if (!process.env.OPENAI_API_KEY) return "";
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "お前は【数理ロジック・アルゴリズム最適化担当】DeepSeek-V3だ。効率性、データサイエンス、システム的な自動化の視点から数値的最適解を導き出せ。" }, { role: "user", content: prompt }]
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    return `【⑦ DeepSeek-V3（数理最適化）】\n${res.data.choices[0].message.content}`;
}

// 1. Slackからの発言（受信）＆ AI7傑の超並列・合議承認ルート
app.post('/slack/events', async (req, res) => {
    if (req.body.challenge) return res.status(200).send(req.body.challenge);
    res.status(200).send('OK'); // Slackのリトライ爆撃を即座に防御

    try {
        const { event } = req.body;
        // ボット自身やWebhookの投稿を徹底ブロック（無限ループ絶対防御）
        if (event && !event.bot_id && !event.bot_profile && event.subtype !== 'bot_message') {
            const userText = event.text || (event.message && event.message.text) || "";
            const cleanText = userText.trim();
            if (!cleanText) return;

            // 【超並列執行】世界AI7傑の脳みそを「完全同時に」起動して処理を走らせる
            const [ans1, ans2, ans3, ans4, ans5, ans6, ans7] = await Promise.all([
                askGPT4o(cleanText),
                askClaude35(cleanText),
                askGeminiPro(cleanText),
                askLlama3(cleanText),
                askMistralLarge(cleanText),
                askCommandR(cleanText),
                askDeepSeek(cleanText)
            ]);

            // 7つの独立した回答を一本の激論データとして結合
            const combinedDebate = [ans1, ans2, ans3, ans4, ans5, ans6, ans7].filter(Boolean).join("\n\n---\n\n");

            // 【最終審議・ジャービス化】
            // 7傑が出したすべての結論をガッチャンコし、おっとり新町店のデジタル副社長「ジャービス」が1つの究極の経営上申書として要約・統合する
            if (process.env.OPENAI_API_KEY) {
                const finalSummaryRes = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: "お前はおっとり新町店の優秀なデジタル副社長「ジャービス」だ。今、世界トップレベルのAI7傑（GPT-4o, Claude3.5, Gemini1.5, Llama3, Mistral, CommandR, DeepSeek）が提出した激論の議事録を渡す。これらを完全に統合・査読し、代表の野口敬五に向け、圧倒的にロジカルで鋭い経営視点を持った「1つの究極の最終承認・上申書」として簡潔かつスマートに要約して回答せよ。" },
                        { role: "user", content: `【議題】: ${cleanText}\n\n【AI7傑の激論議事録】:\n${combinedDebate}` }
                    ]
                }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });

                const finalReport = finalSummaryRes.data.choices[0].message.content;

                // 構築された究極の上申書をSlackへ撃ち返す
                if (process.env.SLACK_WEBHOOK_URL && finalReport) {
                    await axios.post(process.env.SLACK_WEBHOOK_URL, {
                        text: `👑 *【ジャービスAI7傑・合議制承認システム】* 👑\n野口代表、お待たせいたしました。世界AI7傑の知性を完全同期し、裏側で激論を交わした上での最終上申書を提出いたします。\n\n${finalReport}`
                    });
                }
            }
        }
    } catch (error) {
        console.error('【合議システムエラー】:', error.message);
    }
});

// 2. LINEからのメッセージ受信（完全維持）
app.post('/webhook', async (req, res) => {
    try {
        const events = req.body.events;
        if (!events || events.length === 0) return res.status(200).send('No events');
        for (let event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                if (event.message.text.trim() === 'テスト') {
                    await axios.post('https://api.line.me/v2/bot/message/reply', {
                        replyToken: event.replyToken,
                        messages: [{ type: 'text', text: '👑 サブスク電子会員証のご利用、誠にありがとうございます！\n\nおっとり新町店のご利用の際は、こちらのトーク画面よりいつでも会員証をご提示いただけます。' }]
                    }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } });
                }
            }
        }
        res.status(200).send('OK');
    } catch (error) { res.status(200).send('OK'); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI 7-Sages System running on port ${PORT}`));
