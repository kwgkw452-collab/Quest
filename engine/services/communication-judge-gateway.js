(function () {
  "use strict";

  function context(taskSpec) {
    var action = CommunicationActionCatalog.get(taskSpec && taskSpec.action);
    var profile = LocalJudgeProfileDatabase.forAction(taskSpec && taskSpec.action);
    var item = taskSpec && Array.isArray(taskSpec.requiredInformation) ? taskSpec.requiredInformation.filter(function (entry) {
      return entry.slotId === "item";
    })[0] : null;
    var required = item && CommunicationConceptCatalog.get(item.conceptId);
    return { action: action, profile: profile, required: required, concepts: CommunicationConceptCatalog.all() };
  }

  function judge(taskSpec, transcript, options) {
    options = options || {};
    var values = context(taskSpec);
    var local = CommunicationJudgeAdapter.normalize(LocalCommunicationJudgeProvider.judge({
      taskSpec: taskSpec, actionProfile: values.action, judgeProfile: values.profile,
      requiredConcept: values.required, concepts: values.concepts, transcript: transcript
    }));
    if (local.technicalStatus !== "AVAILABLE" || local.verdict !== "UNKNOWN") return Promise.resolve(local);

    var provider = options.provider;
    if (!provider || provider.enabled === false || typeof provider.judge !== "function") return Promise.resolve(local);
    return Promise.resolve().then(function () {
      return provider.judge({ taskSpec: taskSpec, transcript: transcript, localResult: local });
    }).then(function (providerResult) {
      return CommunicationJudgeAdapter.normalize(providerResult);
    }, function (error) {
      var message = error && error.message ? String(error.message).toLowerCase() : "";
      return CommunicationJudgeAdapter.unavailable(message.indexOf("timeout") !== -1 ? "provider_timeout" : "provider_error");
    });
  }

  window.CommunicationJudgeGateway = { judge: judge };
})();
