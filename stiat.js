(() => {
  // ---------------------------
  // CONFIG
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

  // Trials per block
  const N1 = 20;  // attribute practice
  const N2 = 20;  // combined practice
  const N3 = 40;  // combined test (critical)
  const N4 = 20;  // switched practice
  const N5 = 40;  // switched test (critical)

  // Timing
  const ITI_MS = 250;
  const TOO_SLOW_MS = 10000;

  // Set later for Qualtrics:
  const QUALTRICS_RETURN = ""; // e.g. "https://YOURORG.qualtrics.com/jfe/form/SV_XXXX"

  // Debug switch (true on debug.html)
  const DEBUG = Boolean(window.STIAT_DEBUG);

  // ---------------------------
  // Helpers
  // ---------------------------
  const $ = (id) => document.getElementById(id);

  function mean(xs){ return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : NaN; }
  function sd(xs){
    if (xs.length < 2) return NaN;
    const m = mean(xs);
    const v = xs.reduce((a,b)=>a+(b-m)*(b-m),0) / (xs.length - 1);
    return Math.sqrt(v);
  }
  function pooledSD(a,b){ return sd(a.concat(b)); }

  function getParam(name){
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }
  function pick(list){ return list[Math.floor(Math.random()*list.length)]; }

  // ---------------------------
  // State
  // ---------------------------
  const pid = getParam("pid") || "";
  const trials = []; // each trial: {block, stim, correctKey, rt, errors}

  let blockIndex = 0;
  let trialIndex = 0;
  let currentBlock = null;
  let currentTrial = null;
  let awaitingResponse = false;
  let tStart = 0;

  const blocks = [
    // 1: attributes only
    {
      name: "Part 1 of 5 (Practice)",
      leftTop: "Pleasant", leftBottom: "",
      rightTop: "Unpleasant", rightBottom: "",
      makeStim: () => (Math.random()<0.5 ? pick(PLEASANT) : pick(UNPLEASANT)),
      correctKey: (stim) => (PLEASANT.includes(stim) ? "E" : "I"),
      n: N1
    },
    // 2: combined practice (LD + Pleasant left)
    {
      name: "Part 2 of 5 (Practice)",
      leftTop: "Pleasant", leftBottom: "Learning Disability",
      rightTop: "Unpleasant", rightBottom: "",
      makeStim: () => (Math.random()<0.33 ? pick(TARGET) : (Math.random()<0.5 ? pick(PLEASANT) : pick(UNPLEASANT))),
      correctKey: (stim) => ((PLEASANT.includes(stim) || TARGET.includes(stim)) ? "E" : "I"),
      n: N2
    },
    // 3: combined test (critical) (LD + Pleasant left)
    {
      name: "Part 3 of 5 (Test)",
      leftTop: "Pleasant", leftBottom: "Learning Disability",
      rightTop: "Unpleasant", rightBottom: "",
      makeStim: () => (Math.random()<0.33 ? pick(TARGET) : (Math.random()<0.5 ? pick(PLEASANT) : pick(UNPLEASANT))),
      correctKey: (stim) => ((PLEASANT.includes(stim) || TARGET.includes(stim)) ? "E" : "I"),
      n: N3,
      critical: true,
      compat: true
    },
    // 4: switched practice (LD on right with Unpleasant)
    {
      name: "Part 4 of 5 (Practice, switched)",
      leftTop: "Pleasant", leftBottom: "",
      rightTop: "Unpleasant", rightBottom: "Learning Disability",
      makeStim: () => (Math.random()<0.33 ? pick(TARGET) : (Math.random()<0.5 ? pick(PLEASANT) : pick(UNPLEASANT))),
      correctKey: (stim) => (TARGET.includes(stim) ? "I" : (PLEASANT.includes(stim) ? "E" : "I")),
      n: N4
    },
    // 5: switched test (critical)
    {
      name: "Part 5 of 5 (Test, switched)",
      leftTop: "Pleasant", leftBottom: "",
      rightTop: "Unpleasant", rightBottom: "Learning Disability",
      makeStim: () => (Math.random()<0.33 ? pick(TARGET) : (Math.random()<0.5 ? pick(PLEASANT) : pick(UNPLEASANT))),
      correctKey: (stim) => (TARGET.includes(stim) ? "I" : (PLEASANT.includes(stim) ? "E" : "I")),
      n: N5,
      critical: true,
      compat: false
    }
  ];

  // ---------------------------
  // UI
  // ---------------------------
  function setLabels(b){
    $("leftTop").textContent = b.leftTop || "";
    $("leftBottom").textContent = b.leftBottom || "";
    $("rightTop").textContent = b.rightTop || "";
    $("rightBottom").textContent = b.rightBottom || "";
  }
  function setInstructions(html){ $("instructions").innerHTML = html; }
  function showStim(text){ $("stimulus").textContent = text || ""; }
  function showError(on){ $("feedback").textContent = on ? "X" : ""; }

  function startBlock(){
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

  function nextTrial(){
    if (trialIndex >= currentBlock.n){
      blockIndex++;
      if (blockIndex >= blocks.length) return finishTask();
      return startBlock();
    }

    const stim = currentBlock.makeStim();
    const correctKey = currentBlock.correctKey(stim);

    currentTrial = { block: blockIndex+1, blockName: currentBlock.name, stim, correctKey, rt:null, errors:0 };
    showError(false);
    showStim(stim);

    tStart = performance.now();
    awaitingResponse = true;
  }

  function handleKey(e){
    const key = e.key.toUpperCase();

    if (key === " " || key === "SPACEBAR"){
      if (!currentBlock) return;
      if (!awaitingResponse){
        setInstructions("");
        $("startBtn").disabled = true;
        return nextTrial();
      }
      return;
    }

    if (!awaitingResponse) return;
    if (key !== "E" && key !== "I") return;

    const rt = Math.round(performance.now() - tStart);

    if (key === currentTrial.correctKey){
      currentTrial.rt = rt;
      trials.push(currentTrial);

      awaitingResponse = false;
      trialIndex++;

      showStim("");
      showError(false);
      setTimeout(nextTrial, ITI_MS);
    } else {
      currentTrial.errors += 1;
      showError(true);
      // forced correction: keep waiting; RT includes correction time
    }
  }

  function finishTask(){
    showStim("");
    showError(false);

    // Critical blocks: 3 (compat) vs 5 (incompat)
    const b3 = trials.filter(t => t.block === 3).map(t => t.rt).filter(rt => rt <= TOO_SLOW_MS);
    const b5 = trials.filter(t => t.block === 5).map(t => t.rt).filter(rt => rt <= TOO_SLOW_MS);

    const m3 = mean(b3);
    const m5 = mean(b5);
    const s  = pooledSD(b3, b5);
    const d  = (m5 - m3) / s;

    const totalErrors = trials.reduce((a,t)=>a+t.errors,0);
    const totalTrials = trials.length;
    const errorRate = totalTrials ? (totalErrors / totalTrials) : 0;

    const payload = {
      pid,
      dscore: isFinite(d) ? d.toFixed(4) : "",
      mean_rt_compat: isFinite(m3) ? String(Math.round(m3)) : "",
      mean_rt_incompat: isFinite(m5) ? String(Math.round(m5)) : "",
      error_rate: isFinite(errorRate) ? errorRate.toFixed(4) : "",
      n: String(totalTrials)
    };

    if (DEBUG){
      const out = $("debugOut");
      if (out) out.textContent = JSON.stringify(payload, null, 2);
      setInstructions(`<p><b>Done.</b> Debug results printed below.</p>`);
      return;
    }

    setInstructions(`<p><b>Done.</b> Redirecting back to the survey…</p>`);

    if (!QUALTRICS_RETURN){
      setInstructions(`<p><b>Done.</b> (No Qualtrics return URL set yet.)</p>`);
      return;
    }

    const u = new URL(QUALTRICS_RETURN);
    Object.entries(payload).forEach(([k,v]) => u.searchParams.set(k, v));
    window.location.href = u.toString();
  }

  $("startBtn").addEventListener("click", () => {
    if (!currentBlock) startBlock();
    $("startBtn").disabled = true;
  });

  window.addEventListener("keydown", handleKey);

  // init text
  setInstructions(`<p>Click <b>Start</b>, then press <b>Space</b> to begin.</p>`);
})();
