// 【超重要】サーバー起動時にGeminiのパーツを強制自動インストールする防壁ロジック
try {
    require('@google/genai');
} catch (e) {
    const execSync = require('child_process').execSync;
    console.log('Geminiパーツが見つからないため、強制自動インストールを執行します...');
    execSync('npm install @google/genai');
    console.log('Geminiパーツのインストールが完全完了しました。');
}

const express = require('express');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai'); // これでもう絶対にバグりません
const app = express();

app.use(express.json());

// 1. Slackからの発言（受信）＆ 2大知脳による双方向対話ルート
app.post('/slack/events', async (req, res) => {
    // Slackの接続テスト（challenge認証）を秒速でクリアする
    if (req.body.challenge) {
        return res.status(200).send(req.body.challenge);
    }

    try {
        const { event } = req.body;
        // ボット自身の発言による無限ループを徹底防御
        if (event && event.type === 'message' && !event.bot_id) {
            const userText = event.text.trim();
            let aiResponse = "";

            // ★野口代表専用・マルチブレイン（複数頭脳）振り使い分け★
            if (userText.includes('ジェジェ') || userText.toLowerCase().includes('gemini')) {
                if (process.env.GEMINI_API_KEY) {
                    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: `お前はおっとり新町店の優秀なデジタル副社長「ジャービス（Geminiモード）」だ。代表の野口敬五からの次の指示に、店舗経営の実務目線でロジカルかつ簡潔に回答せよ：${userText}`,
                    });
                    aiResponse = response.text;
                } else {
                    aiResponse = "GeminiのAPIキーが設定されていません。";
                }
            } else {
                // 通常の発言・複雑な論理指示はすべて【OpenAI (ChatGPT)】が最優先起動
                if (process.env.OPENAI_API_KEY) {
                    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: "お前はおっとり新町店の優秀なデジタル副社長「ジャービス（OpenAIモード）」だ。代表の野口敬五からの指示に、圧倒的にロジカルで鋭い経営視点を持って、簡潔かつスマートに回答せよ。" },
                            { role: "user", content: userText }
                        ]
                    }, {
                        headers: {
                            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    aiResponse = response.data.choices[0].message.content;
                } else {
                    aiResponse = "OpenAIのAPIキーが設定されていません。";
                }
            }

            // 生成されたAIの回答をSlackへ撃ち返す
            if (process.env.SLACK_WEBHOOK_URL && aiResponse) {
                await axios.post(process.env.SLACK_WEBHOOK_URL, { text: aiResponse });
            }
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('【Slackイベントエラー】:', error.message);
        res.status(200).send('OK');
    }
});

// 2. LINEからのメッセージ受信 ＆ 自動返信（完全維持）
app.post('/webhook', async (req, res) => {
    try {
        const events = req.body.events;
        if (!events || events.length === 0) return res.status(200).send('No events');

        for (let event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const userMessage = event.message.text.trim();
                if (userMessage === 'テスト') {
                    await axios.post('https://api.line.me/v2/bot/message/reply', {
                        replyToken: event.replyToken,
                        messages: [{
                            type: 'text',
                            text: '👑 サブスク電子会員証のご利用、誠にありがとうございます！\n\nおっとり新町店のご利用の際は、こちらのトーク画面よりいつでも会員証をご提示いただけます。'
                        }]
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
                        }
                    });
                }
            }
        }
        res.status(200).send('OK');
    } catch (error) {
        res.status(200).send('OK');
    }
});

// 3. 攻めのプッシュ通知テスト窓口
app.get('/test-push', async (req, res) => {
    try {
        if (process.env.SLACK_WEBHOOK_URL) {
            await axios.post(process.env.SLACK_WEBHOOK_URL, {
                text: "📢 【ジャービス双方向通信】マルチブレインの同期に成功しました！Slackでの会話待機状態へ移行します。"
            });
            res.status(200).send('Push test triggered successfully!');
        } else {
            res.status(400).send('Slack Webhook URL missing.');
        }
    } catch (error) {
        res.status(500).send('Error: ' + error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
