(function () {
  "use strict";

  function getMonster(monsterId) {
    var monster = MonsterDatabase.get(monsterId);
    if (!monster) throw new Error("Monster not found: " + monsterId);
    return monster;
  }

  function getHint(monster, hintLevel) {
    var level = Math.max(0, Math.min(3, Number(hintLevel) || 0));
    if (level === 0) return null;
    var campMessages = monster && monster.battle && monster.battle.pseudoCampMessages;
    if (Array.isArray(campMessages) && campMessages[level - 1]) return campMessages[level - 1];
    var question = QuestionDatabase.get(monster.questionId);
    if (!question) throw new Error("Question not found: " + monster.questionId);
    if (level === 1) return question.hint ? "最初の音は『" + String(question.hint).charAt(0) + "』だよ。" : "問題の言葉を、最初の音から思い出してみよう。";
    if (level === 2) return question.hint ? "『" + question.hint + "』に近い音だよ。" : "ゆっくり区切って言ってみよう。";
    return question.answers[0] ? "答えは『" + question.answers[0] + "』だよ。一緒に言ってみよう。" : "表示された言葉を、そのまま言ってみよう。";
  }

  function canonicalAnswer(monster, answer) {
    var dictionaryId = monster && monster.battle && monster.battle.dictionaryId;
    if (!dictionaryId) return String(answer || "").toLowerCase();
    return WordDictionaryDatabase.match(dictionaryId, answer);
  }

  window.MonsterBattleData = {
    getMonster: getMonster,
    getHint: getHint,
    canonicalAnswer: canonicalAnswer
  };
})();
