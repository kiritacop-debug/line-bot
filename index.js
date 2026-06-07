const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 1. LINEからのメッセージ受信 ＆ 自動返信（受動ルート）
app.post('/webhook', async (req, res) => {
    try {
        const events = req.body.events;
        if (!events || events.length === 0) {
            return res.status(200).send('No events');
        }

        for (let event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const userMessage = event.message.text.trim();
                const replyToken = event.replyToken;

                // 純度100%の「テスト」にのみ反応するロジック
                if (userMessage === 'テスト') {
                    const replyMessage = {
                        replyToken: replyToken,
                        messages: [
                            {
                                type: 'text',
                                text: '👑 サブスク電子会員証のご利用、誠にありがとうございます！\n\nおっとり新町店のご利用の際は、こちらのトーク画面よりいつでも会員証をご提示いただけます。'
                            }
                        ]
                    };

                    await axios.post('https://api.line.me/v2/bot/message/reply', replyMessage, {
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
        console.error('【LINEエラー】:', error.response ? error.response.data : error.message);
        res.status(200).send('OK'); // LINE側へのエラー応答によるリトライを防ぐため200を返す
    }
});

// 2. AI側から能動的にSlackへ連絡を送る窓口（攻めのルート）
app.get('/test-push', async (req, res) => {
    try {
        if (process.env.SLACK_WEBHOOK_URL) {
            await axios.post(process.env.SLACK_WEBHOOK_URL, {
                text: "🔥 【ジャービス覚醒】AI側からの自発的プッシュ通知テストに成功しました！実務インフラ完全に稼働中。"
            });
            res.status(200).send('Push test triggered successfully! Check your Slack.');
        } else {
            res.status(400).send('Slack Webhook URL is not configured.');
        }
    } catch (error) {
        console.error('【プッシュエラー】:', error.message);
        res.status(500).send('Push test failed: ' + error.message);
    }
});

// サーバー起動設定
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
