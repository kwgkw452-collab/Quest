(function () {
  "use strict";

  if (window.DevJumpRuntimeTrace && typeof window.DevJumpRuntimeTrace.registerRuntimeComponent === "function") {
    window.DevJumpRuntimeTrace.registerRuntimeComponent(
      "dev-checkpoints.js",
      "eigo-de-quest/dev-checkpoints/runtime-dispatch-trace-v1"
    );
  }

  var defeated = {
    discovered: true,
    defeated: true,
    encounterCount: 1,
    defeatCount: 1
  };

  var checkpoints = [
    {
      id: "S001",
      label: "S001",
      entry: { kind: "story", id: "S001" },
      party: [],
      completedStories: [],
      bestiary: {},
      continueWith: [],
      progressStoryId: "S001"
    },
    {
      id: "S002",
      label: "S002",
      entry: { kind: "story", id: "S002" },
      party: [1, 2],
      completedStories: ["S001", "m001"],
      bestiary: { m001: defeated },
      continueWith: [],
      progressStoryId: "S002"
    },
    {
      id: "S003",
      label: "S003",
      entry: { kind: "story", id: "S003" },
      party: [1, 2, 3],
      completedStories: ["S001", "m001", "S002"],
      bestiary: { m001: defeated },
      continueWith: [],
      progressStoryId: "S003"
    },
    {
      id: "M002_BATTLE",
      label: "m002 Battle",
      entry: { kind: "monster", id: "m002" },
      party: [1, 2, 3],
      completedStories: ["S001", "m001", "S002"],
      bestiary: { m001: defeated },
      continueWith: [
        { kind: "camp", id: "CAMP_M002" },
        { kind: "story", id: "S004", completeStories: ["S003"] }
      ],
      progressStoryId: "S003"
    },
    {
      id: "CAMP_M002",
      label: "CAMP_M002",
      entry: { kind: "camp", id: "CAMP_M002" },
      party: [1, 2, 3],
      completedStories: ["S001", "m001", "S002"],
      bestiary: { m001: defeated, m002: defeated },
      continueWith: [
        { kind: "story", id: "S004", completeStories: ["S003"] }
      ],
      progressStoryId: "S003"
    },
    {
      id: "S004",
      label: "S004",
      entry: { kind: "story", id: "S004" },
      party: [1, 2, 3],
      completedStories: ["S001", "m001", "S002", "S003"],
      bestiary: { m001: defeated, m002: defeated },
      continueWith: [],
      progressStoryId: "S004"
    },
    {
      id: "M003_BATTLE",
      label: "m003 Battle",
      entry: { kind: "monster", id: "m003" },
      party: [1, 2, 3, 4],
      completedStories: ["S001", "m001", "S002", "S003"],
      bestiary: { m001: defeated, m002: defeated },
      continueWith: [
        { kind: "story", id: "st004", completeStories: ["S004"] }
      ],
      progressStoryId: "S004"
    },
    {
      id: "ST004",
      label: "st004",
      entry: { kind: "story", id: "st004" },
      party: [1, 2, 3, 4],
      completedStories: ["S001", "m001", "S002", "S003", "S004"],
      bestiary: { m001: defeated, m002: defeated, m003: defeated },
      continueWith: [],
      progressStoryId: "st004"
    },
    {
      id: "M004",
      label: "m004",
      entry: { kind: "story", id: "m004" },
      party: [1, 2, 4],
      completedStories: ["S001", "m001", "S002", "S003", "S004", "st004"],
      bestiary: { m001: defeated, m002: defeated, m003: defeated },
      continueWith: [],
      progressStoryId: "m004"
    }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validate() {
    var ids = Object.create(null);
    var kinds = { story: true, monster: true, camp: true };
    checkpoints.forEach(function (checkpoint) {
      if (!checkpoint.id || ids[checkpoint.id]) throw new Error("Invalid or duplicate Dev checkpoint id: " + checkpoint.id);
      ids[checkpoint.id] = true;
      if (!checkpoint.label) throw new Error("Dev checkpoint needs a label: " + checkpoint.id);
      if (!checkpoint.entry || !kinds[checkpoint.entry.kind] || !checkpoint.entry.id) {
        throw new Error("Invalid Dev checkpoint entry: " + checkpoint.id);
      }
      if (!Array.isArray(checkpoint.party) || !Array.isArray(checkpoint.completedStories)) {
        throw new Error("Invalid Dev checkpoint state: " + checkpoint.id);
      }
      (checkpoint.continueWith || []).forEach(function (entry) {
        if (!kinds[entry.kind] || !entry.id) throw new Error("Invalid Dev continuation: " + checkpoint.id);
      });
    });
    return true;
  }

  validate();

  window.DevCheckpointDatabase = {
    get: function (id) {
      var checkpoint = checkpoints.find(function (item) { return item.id === id; });
      return checkpoint ? clone(checkpoint) : null;
    },
    list: function () { return clone(checkpoints); },
    validate: validate
  };
})();
