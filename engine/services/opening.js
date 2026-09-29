(function () {
  "use strict";

  var openingLayer;

  function button(label, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function clearOpening() {
    openingLayer.innerHTML = "";
  }

  function startOpeningBgm() {
    try {
      AudioManager.playBgm("zephyrFields", { loop: true, volume: 0.23 });
    } catch (error) {
      console.warn("Opening BGM could not start:", error);
    }
  }

  function showOpeningVideo() {
    return new Promise(function (resolve) {
      clearOpening();

      var video = document.createElement("video");
      video.className = "opening-video";
      video.src = window.AssetManager ? AssetManager.video("opening") : "video/The world is closed.(2).mp4";
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "auto";
      video.controls = false;

      var skip = button("スキップ", function () {
        video.pause();
        finish();
      });
      skip.classList.add("opening-skip");

      var finished = false;

      function finish() {
        if (finished) {
          return;
        }
        finished = true;
        openingLayer.classList.add("fade-out");

        window.setTimeout(function () {
          openingLayer.classList.remove("fade-out");
          resolve();
        }, 900);
      }

      video.addEventListener("ended", finish);

      video.addEventListener("error", function () {
        clearOpening();

        var panel = document.createElement("section");
        panel.className = "opening-panel";

        var title = document.createElement("h1");
        title.textContent = "オープニング動画を再生できませんでした";

        var text = document.createElement("p");
        text.textContent =
          "video フォルダに「The world is closed.(2).mp4」が入っているか確認してください。";

        panel.appendChild(title);
        panel.appendChild(text);
        panel.appendChild(button("次へ進む", finish));
        openingLayer.appendChild(panel);
      });

      openingLayer.appendChild(video);
      openingLayer.appendChild(skip);

      var playPromise = video.play();

      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {
          clearOpening();

          var panel = document.createElement("section");
          panel.className = "opening-panel";

          var title = document.createElement("h1");
          title.textContent = "Eigo DE Quest";

          var text = document.createElement("p");
          text.textContent =
            "ブラウザの制限で動画を自動再生できません。下のボタンを押すとオープニングが始まります。";

          panel.appendChild(title);
          panel.appendChild(text);
          panel.appendChild(button("オープニングを再生", function () {
            clearOpening();
            openingLayer.appendChild(video);
            openingLayer.appendChild(skip);
            video.play();
          }));

          openingLayer.appendChild(panel);
        });
      }
    });
  }

  function showNameRegistration() {
    return new Promise(function (resolve) {
      clearOpening();

      var panel = document.createElement("section");
      panel.className = "opening-panel";

      var title = document.createElement("h1");
      title.textContent = "復活の呪文";

      var text = document.createElement("p");
      text.textContent =
        "この ぼうけんで あなたが よばれたい なまえ（ハンドルネーム）を おしえてね！\n" +
        "誰も使っていない名前を入れてね！もし、ケータイが壊れても、この名前を入れればまた続きから始められるよ！";

      var input = document.createElement("input");
      input.type = "text";
      input.className = "text-input";
      input.maxLength = 30;
      input.autocomplete = "off";
      input.placeholder = "よばれたい名前";

      var startButton = button("この名前にする", function () {
        var name = input.value.trim();

        if (!name) {
          input.focus();
          return;
        }

        SaveManager.setPlayerName(name);
        startOpeningBgm();
        resolve(name);
      });

      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          startButton.click();
        }
      });

      panel.appendChild(title);
      panel.appendChild(text);
      panel.appendChild(input);
      panel.appendChild(startButton);
      openingLayer.appendChild(panel);
      input.focus();
    });
  }

  function showDisclaimer() {
    return new Promise(function (resolve) {
      clearOpening();

      var panel = document.createElement("section");
      panel.className = "opening-panel notice-panel";

      var title = document.createElement("div");
      title.className = "notice-title";
      title.textContent = "🌟 たいせつな お約束";

      var text = document.createElement("p");
      text.innerHTML =
        "これは『進化と実験のフリーゲーム』です。後からグラフィックが強化されたり、仕様が変わったりすることがあります。もしデータが消えてしまっても、どうか笑顔でやり直してね！そして、このゲームにゲームオーバーはありません。負けても翌日には体力が全回復します！<br><br>" +
        "<span class=\"notice-accent\">🗣️ 君の声が魔法になる世界へようこそ！</span><br>" +
        "ここから先は、ワクワクドキドキが止まらない英語の異世界！『英語なんて無理！』って思ってる？大丈夫、最高の相棒ロボット・ピコがいつでも君を助けてくれるよ！長い言葉なんていらない。たった２、３語、ピンチの時は『たった１語』の英単語を喋るだけで、それが世界を動かす最大の魔法になる。その魔法こそが『サバイバル・イングリッシュ』なんだ！失敗したってへっちゃら！君の言葉だけで、どんなピンチも乗り越えられる。たった一言の勇気が、きっと君を新しく変えてくれる！まずはその一歩を踏み出して、新しい自分に出会いにいこう。さぁ、大冒険を始めよう！";

      panel.appendChild(title);
      panel.appendChild(text);
      panel.appendChild(button("冒険を始める", resolve));
      openingLayer.appendChild(panel);
    });
  }

  async function start() {
    openingLayer = document.getElementById("opening-layer");

    await showOpeningVideo();
    var name = await showNameRegistration();
    await showDisclaimer();

    openingLayer.classList.add("hidden");
    return name;
  }

  window.Opening = {
    start: start
  };
})();
