(function () {
  "use strict";

  var stories = Object.create(null);

  function register(story) {
    if (window.StoryCompiler) story = StoryCompiler.compile(story);

    if (!story || typeof story !== "object") {
      throw new Error("StoryRegistry.register needs a story object.");
    }
    if (!story.id) {
      throw new Error("StoryRegistry.register needs story.id.");
    }
    if (stories[story.id]) {
      throw new Error("Story id is already registered: " + story.id);
    }
    stories[story.id] = story;
    return story;
  }

  function get(id) {
    return stories[id] || null;
  }

  function has(id) {
    return Boolean(stories[id]);
  }

  function list() {
    return Object.keys(stories).map(function (id) {
      var story = stories[id];
      return {
        id: story.id,
        title: story.title || story.id
      };
    });
  }

  window.StoryRegistry = {
    register: register,
    get: get,
    has: has,
    list: list
  };
})();
