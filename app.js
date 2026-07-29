(function () {
  "use strict";

  var STORAGE_KEY = "mpw_quiz_progress_v1";
  var ALL = QUIZ_DATA;
  var TOTAL = ALL.length;
  var byId = {};
  ALL.forEach(function (q) { byId[q.id] = q; });

  var progress = loadProgress();
  var round = null; // { ids, index, correctCount, answered }

  var el = {
    setup: document.getElementById("screen-setup"),
    quiz: document.getElementById("screen-quiz"),
    summary: document.getElementById("screen-summary"),

    statDone: document.getElementById("stat-done-count"),
    statTotal: document.getElementById("stat-total-count"),
    statDonePct: document.getElementById("stat-done-pct"),
    statCorrect: document.getElementById("stat-correct-count"),
    statDone2: document.getElementById("stat-done-count-2"),
    statCorrectPct: document.getElementById("stat-correct-pct"),

    roundSize: document.getElementById("round-size"),
    roundHint: document.getElementById("round-hint"),
    btnStart: document.getElementById("btn-start"),
    btnReset: document.getElementById("btn-reset"),

    qIndex: document.getElementById("q-index"),
    qTotal: document.getElementById("q-total"),
    questionText: document.getElementById("question-text"),
    options: document.getElementById("options"),
    explainWrap: document.getElementById("explain-wrap"),
    btnExplain: document.getElementById("btn-explain"),
    explainPanel: document.getElementById("explain-panel"),
    btnNext: document.getElementById("btn-next"),

    summaryCorrect: document.getElementById("summary-correct"),
    summaryTotal: document.getElementById("summary-total"),
    summaryPct: document.getElementById("summary-pct"),
    btnBack: document.getElementById("btn-back"),
  };

  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function pct(n, d) {
    if (!d) return 0;
    return Math.round((n / d) * 1000) / 10;
  }

  function computeStats() {
    var ids = Object.keys(progress);
    var done = 0, correct = 0;
    ids.forEach(function (id) {
      if (!byId[id]) return; // stale entry from an old data version
      var p = progress[id];
      if (p.attempted) {
        done++;
        if (p.lastCorrect) correct++;
      }
    });
    return {
      total: TOTAL,
      done: done,
      donePct: pct(done, TOTAL),
      correct: correct,
      correctPct: pct(correct, done),
    };
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function renderSetup() {
    var s = computeStats();
    el.statDone.textContent = s.done;
    el.statTotal.textContent = s.total;
    el.statDonePct.textContent = s.donePct;
    el.statCorrect.textContent = s.correct;
    el.statDone2.textContent = s.done;
    el.statCorrectPct.textContent = s.correctPct;

    el.roundSize.max = TOTAL;
    var remaining = TOTAL - s.done;
    if (remaining > 0) {
      el.roundHint.textContent = "Nieprzerobionych zostało: " + remaining + ". Runda w pierwszej kolejności dobiera nowe pytania.";
    } else {
      el.roundHint.textContent = "Wszystkie pytania zostały już przerobione co najmniej raz — runda wylosuje pytania do powtórki.";
    }

    showScreen(el.setup);
  }

  function showScreen(target) {
    [el.setup, el.quiz, el.summary].forEach(function (s) {
      s.classList.toggle("hidden", s !== target);
    });
  }

  function startRound(n) {
    n = Math.max(1, Math.min(n, TOTAL));

    var unseen = [];
    var seen = [];
    ALL.forEach(function (q) {
      var p = progress[q.id];
      if (p && p.attempted) seen.push(q.id); else unseen.push(q.id);
    });

    unseen = shuffle(unseen);
    seen = shuffle(seen);

    var ids = unseen.slice(0, n);
    if (ids.length < n) {
      ids = ids.concat(seen.slice(0, n - ids.length));
    }
    ids = shuffle(ids);

    round = { ids: ids, index: 0, correctCount: 0 };
    el.qTotal.textContent = ids.length;
    showScreen(el.quiz);
    renderQuestion();
  }

  function renderQuestion() {
    var q = byId[round.ids[round.index]];
    el.qIndex.textContent = round.index + 1;
    el.questionText.textContent = q.text;

    el.explainWrap.classList.add("hidden");
    el.explainPanel.classList.add("hidden");
    el.explainPanel.innerHTML = "";
    el.btnNext.classList.add("hidden");

    el.options.innerHTML = "";
    ["A", "B", "C", "D"].forEach(function (letter) {
      var btn = document.createElement("button");
      btn.className = "option-btn";
      btn.innerHTML = '<span class="opt-letter">' + letter + ".</span>" + escapeHtml(q.options[letter]);
      btn.addEventListener("click", function () { onAnswer(q, letter, btn); });
      el.options.appendChild(btn);
    });
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : s;
    return d.innerHTML;
  }

  function onAnswer(q, chosenLetter, chosenBtn) {
    var buttons = el.options.querySelectorAll(".option-btn");
    var isCorrect = chosenLetter === q.correct;

    buttons.forEach(function (b) { b.disabled = true; });
    chosenBtn.classList.add(isCorrect ? "correct" : "wrong");
    if (!isCorrect) {
      var idx = ["A", "B", "C", "D"].indexOf(q.correct);
      buttons[idx].classList.add("correct");
    }

    var p = progress[q.id] || { attempted: false, timesSeen: 0, timesCorrect: 0 };
    p.attempted = true;
    p.timesSeen = (p.timesSeen || 0) + 1;
    p.lastCorrect = isCorrect;
    if (isCorrect) p.timesCorrect = (p.timesCorrect || 0) + 1;
    progress[q.id] = p;
    saveProgress();

    if (isCorrect) round.correctCount++;

    el.explainWrap.classList.remove("hidden");
    el.btnExplain.onclick = function () {
      var visible = !el.explainPanel.classList.contains("hidden");
      if (visible) {
        el.explainPanel.classList.add("hidden");
        return;
      }
      var html = "<strong>Poprawna odpowiedź: " + q.correct + ".</strong> " + escapeHtml(q.options[q.correct]);
      if (q.explanationHtml) {
        html += "<br><br>" + q.explanationHtml;
      } else if (q.explanation) {
        html += "<br><br>" + escapeHtml(q.explanation);
      }
      el.explainPanel.innerHTML = html;
      el.explainPanel.classList.remove("hidden");
      renderPayoffCharts(el.explainPanel);
    };

    el.btnNext.classList.remove("hidden");
    el.btnNext.textContent = (round.index + 1 < round.ids.length) ? "Dalej" : "Zakończ rundę";
  }

  function nextQuestion() {
    round.index++;
    if (round.index >= round.ids.length) {
      finishRound();
    } else {
      renderQuestion();
    }
  }

  function finishRound() {
    el.summaryCorrect.textContent = round.correctCount;
    el.summaryTotal.textContent = round.ids.length;
    el.summaryPct.textContent = pct(round.correctCount, round.ids.length);
    showScreen(el.summary);
  }

  el.btnStart.addEventListener("click", function () {
    var n = parseInt(el.roundSize.value, 10);
    if (!n || n < 1) n = 1;
    startRound(n);
  });

  el.btnNext.addEventListener("click", nextQuestion);

  el.btnBack.addEventListener("click", renderSetup);

  el.btnReset.addEventListener("click", function () {
    if (confirm("Na pewno wyzerować cały zapisany postęp?")) {
      progress = {};
      saveProgress();
      renderSetup();
    }
  });

  function payoffAt(legs, S) {
    var total = 0;
    legs.forEach(function (leg) {
      var qty = leg.qty || 1;
      var sign = leg.side === "short" ? -1 : 1;
      var premium = leg.premium || 0;
      var intrinsic;
      if (leg.type === "forward") {
        intrinsic = S - leg.strike;
      } else if (leg.type === "call") {
        intrinsic = Math.max(S - leg.strike, 0);
      } else {
        intrinsic = Math.max(leg.strike - S, 0);
      }
      total += sign * (intrinsic - premium) * qty;
    });
    return total;
  }

  function slopeAt(legs, S) {
    var d = Math.max(S * 0.001, 0.01);
    return (payoffAt(legs, S + d) - payoffAt(legs, S - d)) / (2 * d);
  }

  function fmtNum(n) {
    var r = Math.round(n * 100) / 100;
    return (r % 1 === 0) ? String(r) : r.toFixed(2);
  }

  function buildPayoffSVG(legs, title) {
    var strikes = legs.map(function (l) { return l.strike; });
    var minK = Math.min.apply(null, strikes);
    var maxK = Math.max.apply(null, strikes);
    var span = Math.max(maxK - minK, 1);
    var padding = Math.max(span * 0.7, minK * 0.15, 5);
    var sMin = Math.max(0, minK - padding);
    var sMax = maxK + padding;

    var xs = [sMin].concat(strikes, [sMax]);
    xs = xs.filter(function (v, i) { return xs.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    var points = xs.map(function (x) { return { x: x, y: payoffAt(legs, x) }; });

    var breakevens = [];
    for (var i = 0; i < points.length - 1; i++) {
      var y1 = points[i].y, y2 = points[i + 1].y;
      if (Math.abs(y1) < 1e-9) { breakevens.push(points[i].x); }
      else if ((y1 < 0 && y2 > 0) || (y1 > 0 && y2 < 0)) {
        var x1 = points[i].x, x2 = points[i + 1].x;
        breakevens.push(x1 + (0 - y1) * (x2 - x1) / (y2 - y1));
      }
    }
    if (Math.abs(points[points.length - 1].y) < 1e-9) breakevens.push(points[points.length - 1].x);

    var ys = points.map(function (p) { return p.y; });
    var maxProfit = Math.max.apply(null, ys);
    var maxLoss = Math.min.apply(null, ys);
    var leftUnbounded = Math.abs(slopeAt(legs, sMin + (sMax - sMin) * 0.02)) > 1e-6;
    var rightUnbounded = Math.abs(slopeAt(legs, sMax - (sMax - sMin) * 0.02)) > 1e-6;

    var yPad = Math.max((maxProfit - maxLoss) * 0.25, 1);
    var yMin = maxLoss - yPad, yMax = maxProfit + yPad;

    var PX0 = 56, PX1 = 600, PY0 = 26, PY1 = 210;
    function sx(x) { return PX0 + (x - sMin) / (sMax - sMin) * (PX1 - PX0); }
    function sy(y) { return PY1 - (y - yMin) / (yMax - yMin) * (PY1 - PY0); }

    var path = points.map(function (p, i) { return (i === 0 ? "M" : "L") + sx(p.x).toFixed(1) + "," + sy(p.y).toFixed(1); }).join(" ");

    var svg = '<svg viewBox="0 0 640 250" class="payoff-svg" xmlns="http://www.w3.org/2000/svg">';

    // zero line
    svg += '<line x1="' + PX0 + '" y1="' + sy(0).toFixed(1) + '" x2="' + PX1 + '" y2="' + sy(0).toFixed(1) + '" class="payoff-zero"/>';
    // axis
    svg += '<line x1="' + PX0 + '" y1="' + PY0 + '" x2="' + PX0 + '" y2="' + PY1 + '" class="payoff-axis"/>';

    // strike guide lines + labels
    strikes.filter(function (v, idx) { return strikes.indexOf(v) === idx; }).forEach(function (k) {
      svg += '<line x1="' + sx(k).toFixed(1) + '" y1="' + PY0 + '" x2="' + sx(k).toFixed(1) + '" y2="' + PY1 + '" class="payoff-strike"/>';
      svg += '<text x="' + sx(k).toFixed(1) + '" y="' + (PY1 + 16) + '" class="payoff-label" text-anchor="middle">' + fmtNum(k) + '</text>';
    });

    // payoff curve
    svg += '<path d="' + path + '" class="payoff-curve"/>';

    // breakeven markers
    breakevens.forEach(function (be) {
      svg += '<circle cx="' + sx(be).toFixed(1) + '" cy="' + sy(0).toFixed(1) + '" r="4" class="payoff-be"/>';
      svg += '<text x="' + sx(be).toFixed(1) + '" y="' + (sy(0) - 8).toFixed(1) + '" class="payoff-label payoff-be-label" text-anchor="middle">BE ' + fmtNum(be) + '</text>';
    });

    // max profit / max loss labels
    svg += '<text x="' + PX1 + '" y="' + (sy(maxProfit) - 6).toFixed(1) + '" class="payoff-label" text-anchor="end">Max zysk: ' + (rightUnbounded ? "nieograniczony" : fmtNum(maxProfit)) + '</text>';
    svg += '<text x="' + PX1 + '" y="' + (sy(maxLoss) + 14).toFixed(1) + '" class="payoff-label" text-anchor="end">Max strata: ' + (leftUnbounded ? "nieograniczona" : fmtNum(maxLoss)) + '</text>';

    // axis titles
    svg += '<text x="' + PX0 + '" y="16" class="payoff-label">P/L</text>';
    svg += '<text x="' + PX1 + '" y="' + (PY1 + 34) + '" class="payoff-label" text-anchor="end">cena instrumentu bazowego (S) w dniu wygaśnięcia</text>';

    svg += '</svg>';
    return svg;
  }

  function renderPayoffCharts(container) {
    var nodes = container.querySelectorAll(".payoff-chart[data-legs]");
    nodes.forEach(function (node) {
      try {
        var legs = JSON.parse(node.getAttribute("data-legs"));
        node.innerHTML = buildPayoffSVG(legs);
      } catch (e) {
        node.textContent = "(nie udało się wyrenderować wykresu)";
      }
    });
  }

  function startFixedRound(ids) {
    round = { ids: ids, index: 0, correctCount: 0 };
    el.qTotal.textContent = ids.length;
    showScreen(el.quiz);
    renderQuestion();
  }

  var qidsParam = new URLSearchParams(location.search).get("qids");
  if (qidsParam) {
    startFixedRound(qidsParam.split(",").map(function (s) { return parseInt(s, 10); }).filter(function (id) { return byId[id]; }));
  } else {
    renderSetup();
  }
})();
