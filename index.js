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
      text: '👑 サブスク電子会員証のご利用、誠にありがとうございます！ 👑\n\n鉄板ダイニングおっとり新町店 スタッフ一同より、心からの感謝を込めて。\n\n本日はご来店いただき、本日の『毎日1杯の会員限定プラン』をしっかりとご活用いただきありがとうございました！会員様のお帰りと、美味しそうに楽しんでいただける時間が、私たちスタッフ全員の何よりの喜びです。\n\n── 【ご安心ください】クーポンは翌朝に再発行されます ──\n「今日使ったら、次はどうなるの？」という心配は一切いりません。\n次回使える新しいクーポンは、明日の朝10:00にこのLINEへ自動的に再発行（補給）されます。\n\n権利が消えることはありませんので、どうぞご安心ください。\n明日の配信をどうぞ楽しみに、またのお帰りをスタッフ一同心よりお待ちしております！\n\n─────────────────\n※このメッセージの受信をもって、本日のご利用確認が正常に完了いたしました。'
    });
  }

  return Promise.resolve(null);
}
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
