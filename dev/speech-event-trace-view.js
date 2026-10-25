(function () {
  "use strict";

  // Pilot display only: consume existing diagnostics, never Recognition/Audio APIs.
  var names = {
    onstart: "start", onaudiostart: "audiostart", onsoundstart: "soundstart",
    onspeechstart: "speechstart", onresult: "result", onspeechend: "speechend",
    onsoundend: "soundend", onaudioend: "audioend", onerror: "error", onend: "end",
    "termination-call": "APP termination request", "timeout-armed": "timeout armed",
    "timeout-fired": "timeout fired"
  };
  var entries = [];
  var views = [];

  function clock(at) {
    var date = new Date(at);
    function pad(value, size) { return ("000" + value).slice(-size); }
    return pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2) + ":" +
      pad(date.getSeconds(), 2) + "." + pad(date.getMilliseconds(), 3);
  }

  function append(view, entry) {
    var follow = view.list.scrollHeight - view.list.clientHeight - view.list.scrollTop < 24;
    var row = document.createElement("li");
    row.style.cssText = "padding:3px 0;overflow-wrap:anywhere";
    var label = entry.type === "termination-call" ? "APP " + entry.method + " REQUEST" : names[entry.type];
    row.textContent = clock(entry.at) + "  " + label +
      (entry.instanceId ? "  [" + entry.instanceId + "]" : "") +
      (entry.error ? "  " + entry.error : "");
    if (entry.type === "termination-call" || entry.type === "timeout-armed" || entry.type === "timeout-fired") {
      var detail = document.createElement("div");
      detail.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px";
      detail.textContent = "caller: " + entry.caller + "\nreason: " + entry.reason +
        "\nelapsed: " + (entry.elapsedSinceStartMs === null ? "native start前" : entry.elapsedSinceStartMs + "ms") +
        (entry.configuredTimeoutMs === undefined ? "" : "\ntimeout: " + entry.configuredTimeoutMs + "ms") +
        (entry.upstreamCaller ? "\nfrom: " + entry.upstreamCaller : "");
      row.appendChild(detail);
      if (entry.stack) {
        var stack = document.createElement("details");
        var summary = document.createElement("summary");
        summary.textContent = "caller stack";
        var text = document.createElement("pre");
        text.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px";
        text.textContent = entry.stack;
        stack.appendChild(summary); stack.appendChild(text); row.appendChild(stack);
      }
    }
    if (entry.type === "onerror" || entry.type === "onend") {
      var evidence = document.createElement("div");
      evidence.style.cssText = "white-space:pre-wrap;font-size:12px";
      evidence.textContent = "elapsed: " + (entry.elapsedSinceStartMs == null ? "未計測" : entry.elapsedSinceStartMs + "ms") +
        "\n直前までのAPP stop/abort: " + (entry.appTerminationCallBeforeEvent ?
          "記録あり（" + entry.appTerminationCallBeforeEvent.reason + "）" : "記録なし");
      row.appendChild(evidence);
    }
    view.list.appendChild(row);
    view.status.textContent = "記録 " + entries.length + "件（発生順・再読込でクリア）";
    if (follow) view.list.scrollTop = view.list.scrollHeight;
  }

  function receive(entry) {
    if (!entry || !Object.prototype.hasOwnProperty.call(names, entry.type)) return;
    entries.push(entry);
    views.forEach(function (view) { append(view, entry); });
  }

  function mount(panel) {
    if (views.some(function (view) { return view.panel === panel; })) return;
    var section = document.createElement("section");
    section.className = "speech-event-trace";
    section.style.cssText = "margin-top:12px;padding-top:10px;border-top:1px solid #9ba5b8;text-align:left";
    var heading = document.createElement("h3");
    heading.textContent = "SPEECH EVENT TRACE";
    heading.style.cssText = "margin:0 0 6px;font-size:16px";
    var status = document.createElement("p");
    status.style.cssText = "margin:0 0 6px;font-size:12px";
    status.textContent = "イベント待ち（未発生のイベントは表示しません）";
    var list = document.createElement("ol");
    list.className = "speech-event-trace-list";
    list.tabIndex = 0;
    list.setAttribute("aria-label", "SPEECH EVENT TRACE 発生順の記録");
    list.style.cssText = "box-sizing:border-box;height:min(34vh,260px);min-height:150px;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;margin:0;padding:8px 8px 8px 34px;background:#081018;color:#d8f8ff;border:1px solid #6b8b9e;border-radius:5px;font:13px/1.5 monospace;white-space:normal";
    section.appendChild(heading);
    section.appendChild(status);
    section.appendChild(list);
    panel.appendChild(section);
    var view = { panel: panel, list: list, status: status };
    views.push(view);
    entries.forEach(function (entry) { append(view, entry); });
    if (!window.MicReleaseTrace || typeof MicReleaseTrace.subscribe !== "function") {
      status.textContent = "診断版の読込を確認してください（ページを再読込）";
    } else if (!MicReleaseTrace.enabled()) {
      status.textContent = "イベント記録を有効にするには、次のリンクから開いてください。";
      var link = document.createElement("a");
      var url = new URL(window.location.href);
      url.searchParams.set("micReleaseTrace", "1");
      link.href = url.href;
      link.textContent = "診断を有効にして開く";
      link.style.cssText = "display:block;color:#a9e9ff;padding:8px 0";
      section.insertBefore(link, list);
    }
  }

  function findPanels() {
    ["communicative-question-manager-playtest", "communicative-judge-pilot"].forEach(function (id) {
      var panel = document.getElementById(id);
      if (panel) mount(panel);
    });
  }

  if (window.MicReleaseTrace && typeof MicReleaseTrace.subscribe === "function") {
    MicReleaseTrace.events().forEach(receive);
    MicReleaseTrace.subscribe(receive);
  }
  function ready() {
    findPanels();
    if (typeof MutationObserver === "function") {
      var observer = new MutationObserver(function () {
        findPanels();
        if (views.length === 2) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      if (views.length === 2) observer.disconnect();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
