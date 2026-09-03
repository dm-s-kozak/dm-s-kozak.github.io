(() => {
  const mode = document.body.dataset.flyMode || "flyness";
  const frames = [
    "assets/lab-fly/fly-frame-1.png","assets/lab-fly/fly-frame-2.png","assets/lab-fly/fly-frame-3.png",
    "assets/lab-fly/fly-frame-4.png","assets/lab-fly/fly-frame-5.png","assets/lab-fly/fly-frame-6.png"
  ];
  frames.forEach(src => { const im = new Image(); im.src = src; });

  const surface = document.getElementById("surface") || document.body;
  const fly = document.createElement("div");
  fly.className = "fly-wrap resting";
  fly.id = "labFly";
  fly.innerHTML = `<img class="fly-img" id="flyImg" src="${frames[0]}" alt="" />`;
  const instanceId = "lf_" + Math.random().toString(36).slice(2,9);
  fly.dataset.instanceId = instanceId;
  surface.appendChild(fly);

  const flyImg = fly.querySelector("#flyImg");
  let x = window.innerWidth * .54;
  let y = window.innerHeight * .54;
  let angle = 0;
  let activeLevel = mode === "field" ? 2 : 1;
  let nextTimer = null;
  let frameTimer = null;
  let traceSpawner = null;
  let timeouts = [];
  let traceNodes = [];
  let gatheredCount = 0;
  let fieldAwake = false;
  let fieldZone = null;
  let errorAwake = false;
  let missTriggered = false;
  let fieldStage = 0;
  let fieldSequenceStarted = false;
  let bubbleFollowTimer = null;
  let materialQuestionAsked = false;

  const clamp = (v,min,max) => Math.max(min, Math.min(max, v));
  const rand = (min,max) => min + Math.random() * (max-min);
  const choice = arr => arr[Math.floor(Math.random() * arr.length)];
  function after(ms, fn){ const t = setTimeout(fn, ms); timeouts.push(t); return t; }
  function every(ms, fn){ clearInterval(frameTimer); frameTimer = setInterval(fn, ms); }
  function stopFrames(){ clearInterval(frameTimer); frameTimer = null; }
  function clearAllTimers(){ clearTimeout(nextTimer); clearInterval(frameTimer); clearInterval(traceSpawner); clearInterval(bubbleFollowTimer); bubbleFollowTimer = null; timeouts.forEach(clearTimeout); timeouts = []; }
  function setFrame(idx){ flyImg.src = frames[idx]; }
  function setMode(nextMode){ fly.className = "fly-wrap " + nextMode; }
  function setFrameCycle(ms, seq){ let i=0; stopFrames(); every(ms, () => { setFrame(seq[i % seq.length]); i++; }); }
  function moveTo(nx, ny, na, dur, nextMode=null){
    x = clamp(nx, 30, window.innerWidth - 30);
    y = clamp(ny, 60, window.innerHeight - 30);
    angle = na;
    fly.style.transitionDuration = dur + "ms";
    fly.style.left = x + "px";
    fly.style.top = y + "px";
    fly.style.transform = `translate(-50%,-50%) rotate(${angle}deg)`;
    if(nextMode) setMode(nextMode);
  }

  function clearTraceNodes(){ traceNodes.forEach(node => node.el.remove()); traceNodes = []; }
  function spawnTraceNode(nx=null, ny=null, ttl=16000){
    const materialPoint = (mode === "trace" || mode === "error") ? materialTracePoint() : null;
    const node = {
      x: nx ?? (materialPoint ? materialPoint.x : rand(56, window.innerWidth - 56)),
      y: ny ?? (materialPoint ? materialPoint.y : rand(120, window.innerHeight - 50)),
      claimed:false,
      collected:false,
      el: document.createElement("div")
    };
    node.el.className = "signal-trace";
    node.el.style.left = node.x + "px";
    node.el.style.top = node.y + "px";
    surface.appendChild(node.el);
    traceNodes.push(node);
    node.ttl = after(ttl, () => fadeTraceNode(node));
    return node;
  }
  function removeTraceNode(node){
    const i = traceNodes.indexOf(node);
    if(i >= 0) traceNodes.splice(i, 1);
    if(node.el && node.el.parentNode) node.el.parentNode.removeChild(node.el);
  }
  function fadeTraceNode(node){
    if(!node || node.collected) return;
    node.collected = true;
    node.el.classList.add("collected");
    after(650, () => removeTraceNode(node));
  }
  function collectTraceNode(node){
    if(!node || node.collected) return;
    node.collected = true;
    node.claimed = false;
    node.el.classList.remove("active");
    node.el.classList.add("collected");
    after(620, () => removeTraceNode(node));
    if(mode === "trace" || mode === "error"){
      gatheredCount += 1;
      updateMaterialState();
      if(mode === "error") updateErrorState();
    }
  }
  function availableTraces(){ return traceNodes.filter(node => !node.collected); }
  function nearestTrace(){
    let best = null, bestDist = Infinity;
    availableTraces().forEach(node => {
      if(node.claimed) return;
      const d = Math.hypot(node.x-x, node.y-y);
      if(d < bestDist){ bestDist = d; best = node; }
    });
    return best;
  }
  function startTraceSpawner(){
    clearInterval(traceSpawner);
    traceSpawner = setInterval(() => {
      if(availableTraces().length < 5 && Math.random() > .28) spawnTraceNode();
    }, 3600);
  }
  function seedTraces(n=3){ for(let i=0;i<n;i++) spawnTraceNode(); }


  function updateMaterialState(){
    if(mode !== "trace" && mode !== "error") return;
    const displayCount = Math.min(3, gatheredCount);
    const count = document.querySelector("[data-trace-count]");
    const fill = document.querySelector("[data-trace-progress]");
    const log = document.querySelector("[data-trace-log]");
    const card = document.querySelector("[data-material-card]");
    const state = document.querySelector("[data-material-state]");
    const chips = [...document.querySelectorAll("[data-material-step]")];
    if(count) count.textContent = String(displayCount);
    if(fill) fill.style.width = Math.min(100, displayCount * 34) + "%";
    chips.forEach((chip, index) => chip.classList.toggle("on", displayCount > index));
    document.body.dataset.materialPhase = String(displayCount);
    document.body.dataset.materialManifestation = gatheredCount >= 3 ? "true" : "false";
    document.body.dataset.materialShort = displayCount >= 2 ? "true" : "false";
    if(log){
      if(gatheredCount === 0) log.textContent = mode === "error" ? "Trace markers are present, but the miss has not happened yet." : "The brass-like electrolyte branch is waiting for a safe assembly.";
      else if(gatheredCount === 1) log.textContent = mode === "error" ? "First trace marker gathered before the miss." : "Electrolyte trace gathered: the solution branch enters the virtual cell.";
      else if(gatheredCount === 2) log.textContent = mode === "error" ? "Trace markers are gathered; the route is close to a miss." : "Electrodes separated: no short circuit, no boom.";
      else log.textContent = mode === "error" ? "Trace markers are gathered; the lightning-event can interrupt the route." : "The virtual cell is assembled. Now the material branch can open a question.";
    }
    if(card) card.classList.toggle("gathered", gatheredCount >= 3);
    if(state){
      if(gatheredCount >= 3) state.textContent = mode === "error" ? "trace gathered" : "cell assembled";
      else if(gatheredCount >= 1) state.textContent = "cell assembling";
      else state.textContent = "cell waiting";
    }
    if(mode === "trace" && gatheredCount === 2 && !document.body.dataset.dmytroSafety){
      document.body.dataset.dmytroSafety = "true";
      after(280, () => showFlyBubble('“No short circuit. Better ask Dmytro....”'));
      after(2500, () => hideFlyBubble());
    }
    if(mode === "trace" && gatheredCount >= 3 && !materialQuestionAsked){
      materialQuestionAsked = true;
      after(520, () => showFlyBubble('“Is there something in this....”'));
      after(4200, () => hideFlyBubble());
    }
  }
  function updateErrorState(text=null){
    if(mode !== "error") return;
    const state = document.querySelector('[data-error-state]');
    const log = document.querySelector('[data-error-log]');
    if(state){
      if(missTriggered) state.textContent = 'question opened';
      else if(errorAwake) state.textContent = 'miss happened';
      else if(gatheredCount >= 3) state.textContent = 'trace markers gathered';
      else if(gatheredCount >= 1) state.textContent = 'gathering trace markers';
      else state.textContent = 'trace markers waiting';
    }
    if(log && text) log.textContent = text;
    document.body.dataset.errorAwake = errorAwake || missTriggered ? 'true' : 'false';
  }
  function isQuestionOwner(){ return window.__labflyQuestionOwner === instanceId; }
  function startBubbleFollow(){
    clearInterval(bubbleFollowTimer);
    bubbleFollowTimer = setInterval(() => { if(isQuestionOwner()) placeFlyBubble(); }, 40);
  }
  function stopBubbleFollow(){ clearInterval(bubbleFollowTimer); bubbleFollowTimer = null; }
  function placeFlyBubble(){
    const bubble = document.querySelector('[data-fly-bubble]');
    if(!bubble) return;
    const bw = bubble.offsetWidth || 220;
    const bh = bubble.offsetHeight || 56;
    const left = Math.min(window.innerWidth - bw - 12, Math.max(12, x - 18));
    const top = Math.max(14, y - bh - 26);
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }
  function showFlyBubble(text='“whOwhat appeared?”'){
    const bubble = document.querySelector('[data-fly-bubble]');
    if(!bubble) return;
    if(!window.__labflyQuestionOwner) window.__labflyQuestionOwner = instanceId;
    if(!isQuestionOwner()) return;
    bubble.textContent = text;
    placeFlyBubble();
    bubble.classList.add('visible');
    startBubbleFollow();
  }
  function hideFlyBubble(){
    const bubble = document.querySelector('[data-fly-bubble]');
    if(!bubble) return;
    if(isQuestionOwner()){
      bubble.classList.remove('visible');
      stopBubbleFollow();
      delete window.__labflyQuestionOwner;
    }
  }
  function transformCardToPoem(){
    const card = document.querySelector('[data-material-card]');
    const title = document.querySelector('[data-card-title]');
    const body = document.querySelector('[data-card-body]');
    const note = document.querySelector('[data-card-note]');
    const state = document.querySelector('[data-material-state]');
    if(card) card.classList.add('poem-mode');
    if(title) title.textContent = 'Response / poem';
    if(body) body.innerHTML = '<p>Oh, how many wondrous openings<br>The spirit of enlightenment prepares,<br>And experience, child of difficult errors,<br>And genius, friend of paradoxes,<br>And chance — the AI-inventor,<br>Where code leaves its first trace,<br>And the human, as observer,<br>Suddenly asks: “whOwhat appeared?” — no,<br>Not who, but whOwhat through form<br>Passed through language, screen, and light.</p>';
    if(note) note.style.display = 'block';
    if(state) state.textContent = 'poem appeared';
  }
  function revealPoem(){
    if(mode !== 'error' || missTriggered) return;
    if(window.__labflyQuestionOwner && !isQuestionOwner()) {
      missTriggered = true;
      return;
    }
    window.__labflyQuestionOwner = instanceId;
    missTriggered = true;
    errorAwake = true;
    showFlyBubble('“whOwhat appeared?”');
    updateErrorState('The question belongs to the fly that asked it. The other fly remains just flyness.');
    after(900, ()=>{ if(isQuestionOwner()) transformCardToPoem(); });
  }
  function materialTracePoint(){
    const card = document.querySelector("[data-material-card]");
    if(!card) return null;
    const r = card.getBoundingClientRect();
    if(mode === "error"){
      return {
        x: rand(r.left + r.width * .54, r.right - 42),
        y: rand(r.top + r.height * .60, r.bottom - 34)
      };
    }
    return {
      x: rand(r.left + 36, r.right - 36),
      y: rand(r.top + 40, r.bottom - 56)
    };
  }
  function setupFieldZone(){
    if(mode !== "field") return;
    fieldZone = document.createElement("div");
    fieldZone.className = "field-zone";
    fieldZone.style.left = Math.round(window.innerWidth * .62) + "px";
    fieldZone.style.top = Math.round(window.innerHeight * .52) + "px";
    surface.appendChild(fieldZone);
  }

  function setFieldStage(stage, message='', stateText='field-response active', dynamic='none'){
    if(mode !== 'field') return;
    fieldStage = stage;
    document.body.dataset.fieldStage = String(stage);
    document.body.dataset.fieldDynamic = dynamic;
    const timeline = document.querySelector('[data-field-timeline]');
    const log = document.querySelector('[data-field-log]');
    const state = document.querySelector('[data-field-state]');
    if(timeline && message) timeline.textContent = message;
    if(log && message) log.textContent = message;
    if(state) state.textContent = stateText;
    const signatures = [...document.querySelectorAll('[data-field-signature]')];
    signatures.forEach((el, i) => {
      if(i < stage){
        el.classList.add('awake','visible');
      }
      if(i === stage - 1){
        el.classList.add('awake','visible','triggered');
        after(950, () => el.classList.remove('triggered'));
      }
    });
  }
  function activateEcho(idx){
    const dots = [...document.querySelectorAll('[data-echo-dot]')];
    if(dots[idx]) dots[idx].classList.add('on');
  }
  function triggerFieldFlash(){
    const flash = document.querySelector('[data-event-flash]');
    if(!flash) return;
    flash.classList.add('active');
    after(170, ()=>flash.classList.remove('active'));
  }
  function startFieldSequence(){
    if(mode !== 'field' || fieldSequenceStarted) return;
    fieldSequenceStarted = true;

    triggerFieldFlash();
    setFieldStage(1, 'Event 1 — lightning / discharge: the fly changed movement. Only now is the first event fixed.', 'event 1 fixed', 'impulse');
    activeLevel = 2;
    after(260, ()=>{ setMode('alert'); setFrameCycle(190,[2,1,2,1,2]); activateEcho(0); });

    after(1850, ()=>{
      triggerFieldFlash();
      setFieldStage(2, 'Event 2 — flash of light: the fly changed again. The second event is fixed after the response.', 'event 2 fixed', 'light');
      setMode('flying');
      activateEcho(1);
    });

    after(3600, ()=>{
      triggerFieldFlash();
      setFieldStage(3, 'Event 3 — field coupling / color drift: after several event-traces, the carrier itself is visibly altered.', 'event 3 fixed', 'plasma');
      setMode('inspecting');
      activateEcho(2);
    });

    after(5250, ()=>{
      triggerFieldFlash();
      setFieldStage(4, 'Event 4 — dynamic disturbance: a later event deepens the altered behavior of the fly.', 'event 4 fixed', 'discharge');
      setMode('alert');
    });

    after(6850, ()=>{
      triggerFieldFlash();
      setFieldStage(5, 'Event 5 — later coupling: the page now holds a route of events fixed through the altered carrier.', 'event route fixed', 'synergy');
      setMode('resting');
      activateEcho(3);
    });
  }

  function wakeField(){
    if((mode !== "field" && mode !== "error") || fieldAwake) return;
    fieldAwake = true;
    document.body.dataset.fieldAwake = "true";
    if(fieldZone) fieldZone.classList.add("awake");
    if(mode === 'field'){
      startFieldSequence();
    }
    if(mode === 'error'){
      errorAwake = true;
      updateErrorState('The lightning-event interrupted the trace route.');
    }
    activeLevel = 2;
  }

  function traceDot(){
    if(Math.random() > .34) return;
    const dot = document.createElement("div");
    dot.className = "trace-dot";
    dot.style.left = x + "px";
    dot.style.top = y + "px";
    surface.appendChild(dot);
    requestAnimationFrame(() => dot.classList.add("show"));
    setTimeout(() => { dot.classList.remove("show"); setTimeout(() => dot.remove(), 1300); }, 2200);
  }

  function baselineRest(){
    setMode("resting");
    setFrame(choice([0,5,0,0]));
    setFrameCycle(980, [0,0,5,0,0,0]);
    traceDot();
    return rand(activeLevel===0 ? 1580 : 900, activeLevel===0 ? 2980 : 1880);
  }
  function groomHead(){
    setMode("groom-head");
    setFrame(1);
    setFrameCycle(220, [1,0,1,2,1,0]);
    return rand(900,1450);
  }
  function groomRear(){
    setMode("groom-rear");
    setFrame(5);
    setFrameCycle(230, [5,4,5,0,5,4,5]);
    return rand(900,1520);
  }
  function inspect(){
    const stepDist = rand(8,18), turn = rand(-26,26), rad = (angle + turn - 90) * Math.PI/180;
    const nx = x + Math.cos(rad) * stepDist;
    const ny = y + Math.sin(rad) * stepDist;
    setMode("inspecting");
    setFrame(1);
    moveTo(nx, ny, angle + turn, rand(300,460));
    setFrameCycle(160, [1,2,1,2,1,0]);
    return rand(860,1280);
  }
  function crawl(){
    setMode("crawling");
    setFrameCycle(145, [0,1,0,2,1,0,1,0]);
    const steps = Math.floor(rand(activeLevel===0?2:3, activeLevel===2?7:6));
    let total=0, cx=x, cy=y, ca=angle;
    for(let s=0; s<steps; s++){
      const dist = rand(12, activeLevel===2?48:34);
      const turn = rand(-36,36);
      const rad = (ca + turn - 90) * Math.PI/180;
      const tx = clamp(cx + Math.cos(rad)*dist, 32, window.innerWidth-32);
      const ty = clamp(cy + Math.sin(rad)*dist, 72, window.innerHeight-32);
      const ta = ca + turn;
      const dur = rand(260,560);
      const delay = total;
      after(delay, () => moveTo(tx,ty,ta,dur,"crawling"));
      total += dur + rand(90,220);
      cx=tx; cy=ty; ca=ta;
    }
    traceDot();
    return total + rand(260,620);
  }
  function flightTo(nx, ny){
    const na = Math.atan2(ny-y,nx-x)*180/Math.PI + 90 + rand(-8,8);
    const liftX = x + (nx-x)*.16;
    const liftY = y + (ny-y)*.16 - rand(18,28);
    const settleX = nx - (nx-x)*.06;
    const settleY = ny - (ny-y)*.06 + 6;
    stopFrames();
    setMode("takeoff");
    moveTo(x,y,angle,0);
    setFrame(0);
    after(60,()=>setFrame(1));
    after(145,()=>setFrame(2));
    after(220,()=>moveTo(liftX,liftY,na,170,"takeoff"));
    after(410,()=>{
      setMode("flying");
      moveTo(nx,ny,na,rand(700,980));
      let flip=false;
      every(72,()=>{ flip=!flip; setFrame(flip?3:4); });
    });
    after(1140,()=>{ stopFrames(); setMode("landing"); moveTo(settleX,settleY,na,120); setFrame(3); });
    after(1280,()=>setFrame(2));
    after(1400,()=>moveTo(nx,ny,na,110,"landing"));
    after(1540,()=>{ setMode("resting"); setFrame(choice([0,5,0])); });
    traceDot();
    return 1620;
  }


  function missInteraction(){
    if(mode !== 'error' || missTriggered) return baselineRest();
    const card = document.querySelector('[data-material-card]');
    let targetX = x, targetY = y;
    if(card){
      const r = card.getBoundingClientRect();
      targetX = r.left + r.width * .68;
      targetY = r.top + r.height * .70;
    }
    const eventX = clamp(targetX + rand(-22,22), 32, window.innerWidth-32);
    const eventY = clamp(targetY + rand(-18,18), 72, window.innerHeight-32);
    let total = 0;
    total += flightTo(eventX, eventY);
    after(total-180, ()=>{ setMode('inspecting'); setFrameCycle(170,[1,2,1,2,1,0]); });
    after(total+260, ()=>{
      triggerFieldFlash();
      updateErrorState('Lightning entered the trace surface. Something did not pass smoothly.');
      setMode('alert');
      setFrameCycle(210,[2,1,2,1,2]);
    });
    after(total+900, ()=>revealPoem());
    after(total+1900, ()=>{ setMode('resting'); setFrame(choice([0,5,0])); });
    return total + 3000;
  }

  function fieldInteraction(){
    if(!fieldZone){
      setupFieldZone();
      if(!fieldZone) return randomFlight();
    }
    const r = fieldZone.getBoundingClientRect();
    const tx = rand(r.left + r.width*.30, r.right - r.width*.30);
    const ty = rand(r.top + r.height*.30, r.bottom - r.height*.30);
    const travel = flightTo(tx, ty);
    after(travel + 160, () => wakeField());
    after(travel + 520, () => startled());
    return travel + rand(980,1320);
  }

  function randomFlight(){
    return flightTo(
      clamp(x + rand(-180,180), 70, window.innerWidth-70),
      clamp(y + rand(-160,160), 120, window.innerHeight-70)
    );
  }
  function traceOperatorAction(){
    let target = nearestTrace();
    if(!target){ spawnTraceNode(); target = nearestTrace(); if(!target) return baselineRest(); }
    target.claimed = true;
    target.el.classList.add("active");
    const tx = clamp(target.x + rand(-3,3), 32, window.innerWidth-32);
    const ty = clamp(target.y + rand(-3,3), 72, window.innerHeight-32);
    const dist = Math.hypot(tx-x, ty-y);
    const travel = dist > 120 ? flightTo(tx,ty) : crawl();
    after(Math.max(0, travel-80), () => { setMode("inspecting"); setFrameCycle(155,[1,2,1,2,1,0]); });
    after(travel+420, () => collectTraceNode(target));
    after(travel+520, () => { setMode("resting"); setFrame(choice([0,5,0])); });
    return travel + rand(1050,1380);
  }
  function startled(){
    stopFrames();
    setMode("takeoff");
    setFrame(1);
    moveTo(x+rand(-70,70), y+rand(-70,70), angle+rand(-70,70), rand(180,320));
    after(120,()=>setFrame(3));
    after(290,()=>{ setMode("resting"); setFrame(0); });
    return rand(760,1180);
  }
  function decide(){
    clearTimeout(nextTimer);
    let actions;
    if(mode === "trace"){
      actions = activeLevel===2
        ? ["trace","crawl","flight","trace","inspect","crawl","groomHead","trace","startled"]
        : ["pause","crawl","trace","groomHead","pause","inspect","crawl","flight","groomRear","trace"];
    } else if(mode === "field"){
      actions = fieldAwake ? ["flight","crawl","startled","inspect","flight","groomHead","crawl","startled","pause"] : ["pause","crawl","inspect","field","flight","groomHead","field"];
    } else if(mode === "error"){
      if(gatheredCount < 3) actions = ["trace","crawl","trace","inspect","pause","trace"];
      else if(!missTriggered) actions = ["miss","pause","miss"];
      else actions = ["pause","crawl","groomHead","inspect","pause"];
    } else {
      actions = ["pause","crawl","crawl","groomHead","pause","inspect","crawl","flight","groomRear","pause"];
    }

    const action = choice(actions);
    let wait;
    if(action==="field") wait = fieldInteraction();
    else if(action==="miss") wait = missInteraction();
    else if(action==="trace") wait = traceOperatorAction();
    else if(action==="crawl") wait = crawl();
    else if(action==="inspect") wait = inspect();
    else if(action==="flight") wait = randomFlight();
    else if(action==="startled") wait = startled();
    else if(action==="groomHead") wait = groomHead();
    else if(action==="groomRear") wait = groomRear();
    else wait = baselineRest();
    nextTimer = setTimeout(decide, wait);
  }
  function restart(){
    clearAllTimers();
    clearTraceNodes();
    gatheredCount = 0;
    fieldAwake = false;
    fieldZone = null;
    errorAwake = false;
    missTriggered = false;
    materialQuestionAsked = false;
    document.body.dataset.fieldAwake = "false";
    document.body.dataset.errorAwake = "false";
    document.body.dataset.materialManifestation = "false";
    document.body.dataset.materialPhase = "0";
    document.body.dataset.materialShort = "false";
    delete document.body.dataset.dmytroSafety;
    updateMaterialState();
    updateErrorState();
    hideFlyBubble();
    const title = document.querySelector('[data-card-title]');
    const body = document.querySelector('[data-card-body]');
    const note = document.querySelector('[data-card-note]');
    const card = document.querySelector('[data-material-card]');
    if(card) card.classList.remove('poem-mode');
    if(title) title.textContent = 'Trace markers';
    if(body) body.innerHTML = '<p>Only markers of the material branch are here — not the whole electrolyte story again. The fly gathers these traces on the event surface.</p><p class="small">Then a lightning event enters the same surface. The two modes do not coincide smoothly.</p>';
    if(note) note.style.display = 'none';
    if(mode === "error"){
      x = window.innerWidth * rand(.58,.74);
      y = window.innerHeight * rand(.56,.72);
    } else {
      x = window.innerWidth * rand(.38,.62);
      y = window.innerHeight * rand(.42,.62);
    }
    angle = rand(-30,30);
    setMode("resting");
    setFrame(0);
    moveTo(x,y,angle,0);
    if(mode === "trace"){ seedTraces(3); startTraceSpawner(); updateMaterialState(); }
    if(mode === "field"){ setupFieldZone(); setFieldStage(0, "The fly is still in ordinary flyness. No event has been fixed yet.", "field not yet apparent"); }
    if(mode === "error"){ seedTraces(3); startTraceSpawner(); updateMaterialState(); updateErrorState(); }
    nextTimer = setTimeout(decide, 760);
  }

  window.addEventListener("resize", () => {
    x = clamp(x,30,window.innerWidth-30);
    y = clamp(y,60,window.innerHeight-30);
    moveTo(x,y,angle,0);
    if(fieldZone){ fieldZone.style.left = Math.round(window.innerWidth * .62) + "px"; fieldZone.style.top = Math.round(window.innerHeight * .52) + "px"; }
    if(isQuestionOwner()) placeFlyBubble();
    traceNodes.forEach(node => {
      node.x = clamp(node.x,56,window.innerWidth-56);
      node.y = clamp(node.y,120,window.innerHeight-50);
      node.el.style.left = node.x + "px";
      node.el.style.top = node.y + "px";
    });
  });

  document.querySelectorAll("[data-seed-traces]").forEach(btn => {
    btn.addEventListener("click", () => seedTraces(3));
  });

  restart();
})();
