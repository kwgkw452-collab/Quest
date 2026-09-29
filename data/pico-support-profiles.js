(function () {
  "use strict";

  window.PicoSupportProfileDatabase = {
    get: function (actionId) {
      if (actionId !== "order.request") return null;
      return {
        actionId: actionId,
        levels: {
          structure: ["まず I から始めてみようピコ！", "I want ... の形を使ってみようピコ！", "I want two apples. と言ってみようピコ！"],
          quantity: ["今回は{quantity}個ほしいことを伝えてみようピコ！", "数を品物の前に置いてみようピコ！", "{quantityWord} {itemPlural}, please. と言ってみようピコ！"],
          item: ["今回は{itemJa}をお願いしたいピコ！", "ほしい品物をもう一度確かめようピコ！", "{quantityWord} {itemPlural}, please. と言ってみようピコ！"],
          task: ["もう少し注文に必要なことを伝えてみようピコ！", "品物と数を入れてみようピコ！", "I want {quantityWord} {itemPlural}. と言ってみようピコ！"]
        },
        missingQuantity: "いくつほしいかも伝えてみようピコ！",
        speechFailure: "声をうまく聞き取れなかったピコ。もう一度話してみよう！",
        unavailable: "まだこの言い方はローカル判定できないピコ。いっしょに注文の形を確認しよう！",
        finalRescue: "今回はここまでにして、見本を確認して冒険へ戻ろうピコ！"
      };
    }
  };
})();
