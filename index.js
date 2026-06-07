const express = require('express');
const axios = require('axios');
const app = express();

// 必須の通信設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 【完全復旧】1. LINE公式アカウント メッセージ受信窓口
app.post('/webhook', async (req, res) => {
  res.status(200).send('OK');
  try {
    const events = req.body.events;
    if (!events || events.length === 0) return;

    for (let event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const replyToken = event.replyToken;
        const userMessage = event.message.text;

        // 野口様が調整された「3,300円サブスク会員証」の自動返信
        let replyMessage = "メッセージを受信しました。";
        if (userMessage === "テスト") {
          replyMessage = "👑 サブスク電子会員証のご利用、誠にありがとうございます！\n\nおっとり新町店のご利用の際は、こちらのトーク画面よりいつでも会員証をご提示いただけます。\n\n店内のQRコードを読み取って、スムーズにご入場ください。";
        }

        await axios.post('https://api.line.me/v2/bot/message/reply', {
          replyToken: replyToken,
          messages: [{ type: 'text', text: replyMessage }]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          }
        });
        console.log('【LINE返信成功】');
      }
    }
  } catch (error) {
    console.error('【LINEエラー】:', error.message);
  }
});

// 【新規開通】2. Squareデータ受信 ＆ Slack通知窓口
app.post('/square/webhook', async (req, res) => {
  res.status(200).send('OK');
  try {
    console.log('【Square着弾】:', JSON.stringify(req.body));
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      console.log('【警告】SLACK_WEBHOOK_URLが環境変数に設定されていません。');
      return;
    }

    const eventType = req.body.type;
    let slackMessage = `🤖 【ジャービス通知】 Squareイベント検知: ${eventType}`;

    if (eventType === 'payment.created') {
      const amount = req.body.data?.object?.payment?.amount_money?.amount || 0;
      slackMessage = `💰 【実売上発生】 Squareで決済が完了しました。金額: ${amount}円`;
    } else if (eventType === 'subscription.updated' || eventType === 'subscription.created') {
      slackMessage = `👑 【サブスク連動】 サブスクリプションの動きを検知（単価: 3,300円ベース分析開始）`;
    }

    await axios.post(slackWebhookUrl, { text: slackMessage });
    console.log('【Slack転送成功】');
  } catch (error) {
    console.error('【Square・Slack連携エラー】:', error.message);
  }
});

// 3. サーバー起動ロジック
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
