(function () {
  "use strict";

  var currentStoryId = null;
  var currentState = null;
  var running = false;

  function stopSceneAudio() {
    if (window.AudioManager && typeof AudioManager.stopAll === "function") AudioManager.stopAll();
  }

  function requireStory(storyId) {
    if (!window.StoryRegistry) {
      throw new Error("StoryRegistry is not loaded.");
    }
    var story = StoryRegistry.get(storyId);
    if (!story) {
      throw new Error("Story is not registered: " + storyId);
    }
    return story;
  }

  async function start(storyId, initialState) {
    if (running) {
      throw new Error("SceneManager is already running a story.");
    }

    running = true;
    try {
      currentState = initialState || {};
      var story = requireStory(storyId);
      while (story) {
        currentStoryId = story.id;
        currentState = await StoryEngine.play(story, currentState);
        if (story.nextStoryId) stopSceneAudio();
        story = story.nextStoryId ? requireStory(story.nextStoryId) : null;
      }
      return currentState;
    } finally {
      stopSceneAudio();
      running = false;
    }
  }

  async function goto(storyId, statePatch) {
    var nextState = Object.assign({}, currentState || {}, statePatch || {});
    return start(storyId, nextState);
  }

  function getCurrentStoryId() {
    return currentStoryId;
  }

  function getState() {
    return currentState;
  }

  function isRunning() {
    return running;
  }

  window.SceneManager = {
    start: start,
    goto: goto,
    getCurrentStoryId: getCurrentStoryId,
    getState: getState,
    isRunning: isRunning
  };
})();
