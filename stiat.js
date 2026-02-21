(() => {
  // ---------------------------
  // CONFIG (EDITABLE)
  // ---------------------------
  const TARGET = [
    "Learning disability",
    "Intellectual disability",
    "Developmental delay",
    "Cognitive impairment",
    "Special education",
    "Learning difficulty",
    "Dyslexia",
  ];

  const PLEASANT = ["Joy","Warmth","Hope","Comfort","Love","Peace","Happiness"];
  const UNPLEASANT = ["Pain","Fear","Burden","Stress","Suffering","Difficulty","Failure"];

  // Trials per block (close to what you’ve been using)
  const N1 = 20;  // Block 1 attribute practice
  const N2 = 20;  // Block 2 combined practice
  const N3 = 40;  // Block 3 combined test (critical)
  const N4 = 20;  // Block 4 reversed practice
  const N5 = 40;  // Block 5 reversed test (critical)

  // Timing
  const ITI_MS = 250;           // pause between trials
  const TOO_SLOW_MS = 10000;    // drop ultra-slow trials in scoring

  // Redirect back to Qualtrics (SET THIS)
  // You will paste YOUR Qualtrics anonymous link here later.
  // Keep the ?dscore=... etc.
  const QUALTRICS_RETURN = ""; // e.g. "https://yourorg.qualtrics.com/jfe/form/SV_xxxxx"

  // ---------------------------
  // Helpers
  // ---------------------------
  const $ = (id) => document.getElementById(id);

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function mean(xs) {
    if (!xs.length) return NaN;
    return xs.reduce((a,b)=>a+b,0) / xs.length;
  }

  function sd(xs) {
    if (xs.length < 2) return NaN;
    const m = mean(xs);
    const v = xs.reduce((a,b)=>a+(b-m)*(b-m),0) / (xs.length - 1);
    return Math.sqrt(v);
  }

  function pooledSD(a, b) {
    const all = a.concat(b);
    return sd(all);
  }

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  // ---------------------------
  // Task state
  // ---------------------------
  const pid = getParam("pid") || "";
  const trials = []; // {block, stim, correctKey, rt, errors, correct}

  let blockIndex = 0;
  let trialIndex = 0;
  let currentBlock = null;
  let currentTrial = null;
  let awaitingResponse = false;
  let tStart = 0;
  let errorShown = false;

  const blocks = [
    {
      name: "Block 1 (Practice)",
      leftTop: "Pleasant",
      leftBottom: "",
      rightTop: "Unpleasant",
      rightBottom: "",
      makeStim: () => (Math.random() < 0.5 ? pick(PLEASANT) : pick(UNPLEASANT)),
      correctKey: (stim) => (PLEASANT.includes(stim) ? "E" : "I"),
      n: N1
    },
    {
      name: "Block 2 (Practice)",
      leftTop: "Pleasant",
      leftBottom: "Learning Disability",
      rightTop: "Unpleasant",
      rightBottom: "",
      makeStim: () => (Math.random() < 0.33 ? pick(TARGET) : (Math.random() < 0.5 ? pick(PLEASANT) : pick(UNPLEASANT))),
      correctKey: (stim) => ((PLEASANT.includes(stim) || TARGET.includes(stim)) ? "E" : "I"),
      n: N2
    },
    {
      name: "Block 3 (Test)",
      leftTop: "Pleasant",
      leftBottom: "Learning Disability",
      rightTop: "Unpleasant",
      rightBottom: "",
      makeStim: () => (Math.random() < 0.33 ? pick(TARGET) : (Math.random() < 0.5 ? pick(PLEASANT) : pick(UNPLEASANT))),
      correctKey: (stim) => ((PLEASANT.includes(stim) || TARGET.includes(stim)) ? "E" : "I"),
      n: N3,
      critical: true,
      compat: true
    },
    {
      name: "Block 4 (Practice, switched)",
      leftTop: "Pleasant",
      leftBottom: "",
      rightTop: "Unpleasant",
      rightBottom: "Learning Disability",
      makeStim: () => (Math.random() < 0.33 ? pick(TARGET) : (Math.random() < 0.5 ? pick(PLEASANT) : pick(UNPLEASANT))),
      correctKey: (stim) => (PLEASANT.includes(stim) ? "E" : "I"), // pleasant left; unpleasant+target right
      // but TARGET should be I
      correctKey2: (stim) => (TARGET.includes(stim) ? "I" : (PLEASANT.includes(stim) ? "E" : "I")),
      n: N4
    },
    {
      name: "Block 5 (Test, switched)",
      leftTop: "Pleasant",
      leftBottom: "",
      rightTop: "Unpleasant",
      rightBottom: "Learning Disability",
      makeStim: () => (Math.random() < 0.33 ? pick(TARGET) : (Math.random() < 0.5 ? pick(PLEASANT) : pick(UNPLEASANT))),
      correctKey: (stim) => (TARGET.includes(stim) ? "I" : (PLEASANT.includes(stim) ? "E" : "I")),
      n: N5,
      critical: true,
      compat: false
    }
  ];

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Fix Block 4 mapping (we used correctKey2)
  blocks[3].correctKey = blocks[3].correctKey2;
  delete blocks[3].correctKey2;

  // ---------------------------
  // UI
  // ---------------------------
  function setLabels(b) {
    $("leftTop").textContent = b.leftTop || "";
    $("leftBottom").textContent = b.leftBottom || "";
    $("rightTop").textContent = b.rightTop || "";
    $("rightBottom").textContent = b.rightBottom || "";
  }

  function setInstructions(html) {
    $("instructions").innerHTML = html;
  }

  function showStim(text) {
    $("stimulus").textContent = text || "";
  }

  function showError(on) {
    $("feedback").textContent = on ? "X" : "";
  }

  function startBlock() {
    currentBlock = blocks[blockIndex];
    trialIndex = 0;
    setLabels(currentBlock);
    showStim("");
    showError(false);

    setInstructions(`
      <p><b>${currentBlock.name}</b></p>
      <p>Use <b>E</b> for LEFT and <b>I</b> for RIGHT. Go fast, make as few errors as possible.
      If you see a red <b>X</b>, correct by pressing the other key.</p>
      <p>Press <b>Space</b> to begin.</p>
    `);

    awaitingResponse = false;
    currentTrial = null;
  }

  function nextTrial() {
    if (trialIndex >= currentBlock.n) {
      blockIndex++;
      if (blockIndex >= blocks.length) return finishTask();
      return startBlock();
    }

    const stim = currentBlock.makeStim();
    const correctKey = currentBlock.correctKey(stim);

    currentTrial = {
      block: blockIndex + 1,
      blockName: currentBlock.name,
      stim,
      correctKey,
      rt: null,
      errors: 0,
      correct: false
    };

    showError(false);
    errorShown = false;
    showStim(stim);

    tStart = performance.now();
    awaitingResponse = true;
  }

  function handleKey(e) {
    const key = e.key.toUpperCase();
    if (key === " " || key === "SPACEBAR") {
      if (!currentBlock) return;
      if (!awaitingResponse) {
        // start the trial stream
        setInstructions("");
        $("startBtn").disabled = true;
        return nextTrial();
      }
      return;
    }

    if (!awaitingResponse) return;
    if (key !== "E" && key !== "I") return;

    const rt = Math.round(performance.now() - tStart);

    if (key === currentTrial.correctKey) {
      // correct
      currentTrial.rt = rt;
      currentTrial.correct = true;
      trials.push(currentTrial);

      awaitingResponse = false;
      trialIndex++;

      // move on after ITI
      showStim("");
      showError(false);
      setTimeout(() => nextTrial(), ITI_MS);
    } else {
      // error: show X, keep waiting (forced correction)
      currentTrial.errors += 1;
      showError(true);
      errorShown = true;
      // keep timing running until correct key hit (rt includes correction)
      // do not reset tStart
    }
  }

  function finishTask() {
    showStim("");
    showError(false);

    // Score from critical blocks (3 = compat, 5 = incompat)
    const b3 = trials.filter(t => t.block === 3).map(t => t.rt).filter(rt => rt <= TOO_SLOW_MS);
    const b5 = trials.filter(t => t.block === 5).map(t => t.rt).filter(rt => rt <= TOO_SLOW_MS);

    const m3 = mean(b3);
    const m5 = mean(b5);
    const s = pooledSD(b3, b5);
    const d = (m5 - m3) / s;

    const totalErrors = trials.reduce((a,t)=>a+t.errors,0);
    const totalTrials = trials.length;
    const errorRate = totalTrials ? (totalErrors / totalTrials) : 0;

    const payload = {
      pid,
      dscore: isFinite(d) ? d : "",
      mean_rt_compat: isFinite(m3) ? Math.round(m3) : "",
      mean_rt_incompat: isFinite(m5) ? Math.round(m5) : "",
      error_rate: isFinite(errorRate) ? errorRate.toFixed(4) : "",
      n: totalTrials
    };

    setInstructions(`
      <p><b>Done.</b> Redirecting back to the survey…</p>
      <p class="tiny">If you are not redirected, notify the researcher.</p>
    `);

    if (!QUALTRICS_RETURN) {
      // If you haven't set return URL yet, show payload for testing
      setInstructions(`
        <p><b>Done.</b> (Testing mode)</p>
        <pre>${JSON.stringify(payload, null, 2)}</pre>
        <p class="tiny">Set QUALTRICS_RETURN in stiat.js to enable redirect.</p>
      `);
      return;
    }

    const u = new URL(QUALTRICS_RETURN);
    Object.entries(payload).forEach(([k,v]) => u.searchParams.set(k, String(v)));
    window.location.href = u.toString();
  }

  // Start button just focuses instructions; space begins
  $("startBtn").addEventListener("click", () => {
    if (!currentBlock) startBlock();
    $("startBtn").disabled = true;
  });

  window.addEventListener("keydown", handleKey);

  // Initialize
  setInstructions(`
    <p>This task uses the <b>E</b> and <b>I</b> keys.</p>
    <p>Click <b>Start</b>, then press <b>Space</b> to begin.</p>
  `);
})();
