(function () {
  "use strict";

  var C = StoryCommands;

  var story = {
    id: "S003",
    title: "ナンバー・モンスター",
    nextStoryId: "S004",
    steps: [
      C.morning("MORNING_001", "s003Morning"),
      C.monsterBattle("m002", "numberBattle"),
      C.camp("CAMP_M002", "s003Camp")
    ]
  };

  StoryRegistry.register(story);
  window.S003 = story;
})();
