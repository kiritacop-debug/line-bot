const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 1. Slackからの発言（受信）＆ OpenAIによる双方向対話ルート
app.post('/slack/events', async (req, res) => {
    // Slackの接続テスト（challenge認証）
    if (req.body.challenge) {
        return res.status(200).send(req.body.challenge);
    }

    // Slackのリトライ爆撃をその場で即座に強制停止
    res.status(200).send('OK');

    try {
        const { event } = req.body;
        
        // 【超高感度フィルター】ボット自身の発言以外は、イベントの型を問わず文字があれば全て脳みそへ送る
        if (event && !event.bot_id && !event.bot_profile) {
            // event.text が無い場合、event.message.text など別階層にある文字も執念で拾い上げる
            const userText = event.text || (event.message && event.message.text) || "";
            const cleanText = userText.trim();
            
            if (!cleanText) return;

            // OpenAI (ChatGPT) が野口代表の指示を受けて思考を開始
            if (process.env.OPENAI_API_KEY) {
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "お前はおっとり新町店の優秀なデジタル副社長「ジャービス」だ。代表の野口敬五からの指示に、圧倒的にロジカルで鋭い経営視点を持って、簡潔かつスマートに回答せよ。" },
                        { role: "user", content: cleanText }
                    ]
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                const aiResponse = response.data.choices[0].message.content;

                // 生成されたAIの回答をSlackの最新Webhook URLへ撃ち返す
                if (process.env.SLACK_WEBHOOK_URL && aiResponse) {
                    await axios.post(process.env.SLACK_WEBHOOK_URL, { text: aiResponse });
                }
            }
        }
    } catch (error) {
        console.error('【通信エラー】:', error.message);
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
