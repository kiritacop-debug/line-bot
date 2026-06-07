const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 1. Slackからの発言（受信）＆ OpenAIによる双方向対話ルート
app.post('/slack/events', async (req, res) => {
    // Slackの接続テスト（challenge認証）を秒速でクリア
    if (req.body.challenge) {
        return res.status(200).send(req.body.challenge);
    }

    // 【最強の防壁】Slackの無限リトライをこの1行で即座に強制停止させる
    res.status(200).send('OK');

    try {
        const { event } = req.body;
        
        // ダイレクトメッセージ(im)またはチャンネル発言を検知し、ボット自身の発言は徹底防御
        if (event && (event.type === 'message' || event.type === 'app_mention') && !event.bot_id) {
            const userText = event.text ? event.text.trim() : "";
            if (!userText) return;

            // OpenAI (ChatGPT) が野口代表の指示を受けて思考を開始
            if (process.env.OPENAI_API_KEY) {
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "お前はおっとり新町店の優秀なデジタル副社長「ジャービス」だ。代表の野口敬五からの指示に、圧倒的にロジカルで鋭い経営視点を持って、簡潔かつスマートに回答せよ。" },
                        { role: "user", content: userText }
                    ]
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                const aiResponse = response.data.choices[0].message.content;

                // 生成されたAIの回答をSlackへ撃ち返す
                if (process.env.SLACK_WEBHOOK_URL && aiResponse) {
                    await axios.post(process.env.SLACK_WEBHOOK_URL, { text: aiResponse });
                }
            }
        }
    } catch (error) {
        // 万が一エラーが起きてもログに吐き出すだけで、Slackにはエラーを絶対に見せない
        console.error('【内部通信エラー（制限中またはキー不備）】:', error.message);
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
                text: "📢 【ジャービス双方向通信】OpenAIブレインの同期に成功。会話待機状態へ移行します。"
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
