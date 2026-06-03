const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: 'YVF2VpNmOJ2K4iccp590y9HAQ6GAUurAO3tQ2dBg60A05nFevJFoStf+tPt432nVzTaQFLuEnh1XdV+M93OQcE2aV0rV+BYjKsQ4T862WUahoZAsC8X+iVd7KAXgHiIdYfbj/94ChZdwkwUD3A+hfgdB04t89/1O/w1cDnyilFU=',
  channelSecret: '5ed7ad9c666564003f28b7d86b1f8185'
};

const app = express();

app.get('/webhook', (req, res) => {
  res.status(200).send('OK');
});

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

const client = new line.Client(config);

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  if (event.message.text === 'テスト') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '👑 ビールサブスク電子会員証の自動補給 👑\n\n会員証のご利用ありがとうございます！\n新しい会員証を自動発行いたしました。次回ご来店時も、こちらの画面をスタッフへご提示ください。'
    });
  }

  return Promise.resolve(null);
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
