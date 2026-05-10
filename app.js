// ═══════════════════════════════════════
//  CHEF VOICE — Full App Logic
// ═══════════════════════════════════════

// ═══════════════════════════════════════
//  VOICE COMMANDS — Phase 2 (recognition)
// ═══════════════════════════════════════
let voiceCommandsOn = false;
let recognition     = null;
let recognitionStarting = false;

// Initialize speech recognition (only once)
function initRecognition() {
  if (recognition) return true;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert('Voice commands need Chrome or Edge browser. Your browser doesn\'t support this.');
    return false;
  }
  recognition = new SR();
  recognition.continuous     = true;
  recognition.interimResults = true;
  recognition.lang           = 'en-US';

  recognition.onresult = (event) => {
    // Get the latest piece of speech
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    transcript = transcript.trim().toLowerCase();
    if (transcript) {
      showDebug(transcript);
      // Only run commands on FINAL results (not interim guesses)
      const isFinal = event.results[event.results.length - 1].isFinal;
      if (isFinal) {
        handleCommand(transcript);
      }
    }
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      alert('Microphone access blocked. Click the lock icon in your browser address bar and allow microphone.');
      voiceCommandsOn = false;
      updateVoiceToggleUI();
      updateMicStatusUI();
      hideDebug();
    }
    // Other errors (no-speech, audio-capture) — auto-restart handles them
  };

  recognition.onend = () => {
    // Auto-restart if user still wants it on (browsers stop after long silence)
    if (voiceCommandsOn && !recognitionStarting) {
      try {
        recognitionStarting = true;
        recognition.start();
        setTimeout(() => { recognitionStarting = false; }, 200);
      } catch (e) {
        recognitionStarting = false;
      }
    }
  };

  return true;
}

function toggleVoiceCommands() {
  voiceCommandsOn = !voiceCommandsOn;
  updateVoiceToggleUI();
  updateMicStatusUI();

  if (voiceCommandsOn) {
    document.body.classList.add('voice-on');
    if (!initRecognition()) {
      voiceCommandsOn = false;
      updateVoiceToggleUI();
      updateMicStatusUI();
      document.body.classList.remove('voice-on');
      return;
    }
    showDebug('Listening…');
    try {
      recognition.start();
    } catch (e) {}
  } else {
    document.body.classList.remove('voice-on');
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
    hideDebug();
  }
}

function showDebug(text) {
  const box  = document.getElementById('voice-debug');
  const txt  = document.getElementById('voice-debug-text');
  if (box && txt) {
    box.classList.add('active');
    txt.textContent = text;
  }
}

function hideDebug() {
  const box = document.getElementById('voice-debug');
  if (box) box.classList.remove('active');
}

// ═══════════════════════════════════════
//  COMMAND HANDLER — Phase 3
// ═══════════════════════════════════════
function handleCommand(transcript) {
  // Find which cook screen is currently active (if any)
  const activeScreen = document.querySelector('.screen.active');
  if (!activeScreen) return;
  const screenId = activeScreen.id;

  // Match commands - check if the word appears in the transcript
  // Order matters: "chef tip" must be checked before "tip" etc

  // ── HOME command works from anywhere ──
  if (matches(transcript, ['home', 'go home', 'back to home'])) {
    flashCommand('🏠 Home');
    goTo('screen-home');
    return;
  }

  // ── These only work on cook screens ──
  if (!screenId.startsWith('screen-cook-')) return;
  const recipe = screenId.replace('screen-cook-', '');
  if (!recipes[recipe]) return;

  // CHEF TIP — must come before generic checks
  if (matches(transcript, ['help', 'why', 'tip', 'explain'])) {
    flashCommand('👨‍🍳 Chef tip');
    pressChef(recipe);
    return;
  }

  // READ
  if (matches(transcript, ['read', 'read step', 'read it', 'read again'])) {
    flashCommand('🔊 Reading step');
    pressVoice(recipe);
    return;
  }

  // NEXT
  if (matches(transcript, ['next', 'next step', 'continue', 'go next'])) {
    flashCommand('→ Next');
    nextStep(recipe);
    return;
  }

  // BACK
  if (matches(transcript, ['back', 'go back', 'previous', 'last step'])) {
    flashCommand('← Back');
    prevStep(recipe);
    return;
  }

  // START / RESUME
  if (matches(transcript, ['start', 'begin', 'go', 'resume'])) {
    const s = state[recipe];
    if (!s.timerRunning && document.getElementById(recipe + '-timer-box') &&
        !document.getElementById(recipe + '-timer-box').classList.contains('hidden')) {
      flashCommand('▶ Timer started');
      toggleTimer(recipe);
    }
    return;
  }

  // PAUSE / STOP
  if (matches(transcript, ['pause', 'stop', 'wait', 'hold'])) {
    const s = state[recipe];
    if (s.timerRunning) {
      flashCommand('⏸ Timer paused');
      toggleTimer(recipe);
    }
    return;
  }
}

// Helper — checks if any of the trigger words appear in the transcript
function matches(transcript, triggers) {
  for (const trigger of triggers) {
    // Use word boundaries so "starting" doesn't match "start"
    const regex = new RegExp('\\b' + trigger + '\\b', 'i');
    if (regex.test(transcript)) return true;
  }
  return false;
}

// Visual feedback when a command fires
function flashCommand(label) {
  const txt = document.getElementById('voice-debug-text');
  if (!txt) return;
  // Briefly show the recognized command in orange
  txt.style.color = '#FFD3B5';
  txt.textContent = '✓ ' + label;
  setTimeout(() => {
    txt.style.color = '';
    txt.textContent = 'Listening…';
  }, 1500);
}

function updateVoiceToggleUI() {
  const btn  = document.getElementById('voice-toggle-btn');
  const sub  = document.getElementById('voice-toggle-sub');
  if (!btn) return;
  if (voiceCommandsOn) {
    btn.classList.add('on');
    sub.textContent = 'On — listening while cooking';
  } else {
    btn.classList.remove('on');
    sub.textContent = 'Off — tap to enable';
  }
}

function updateMicStatusUI() {
  document.querySelectorAll('.mic-status').forEach(el => {
    if (voiceCommandsOn) el.classList.add('on');
    else el.classList.remove('on');
  });
}

// ═══════════════════════════════════════
//  DARK MODE
// ═══════════════════════════════════════
let darkMode = false;

function toggleDarkMode() {
  darkMode = !darkMode;
  document.body.classList.toggle('dark', darkMode);
  const btn = document.getElementById('dark-mode-btn');
  if (btn) btn.textContent = darkMode ? '☀️' : '🌙';
}

// ── Navigation ──
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
    updateMicStatusUI();
  }
}

// ═══════════════════════════════════════
//  VOICE SYSTEM
// ═══════════════════════════════════════

// speakNow — cancels any current speech then speaks immediately
function speakNow(text, onDone) {
  window.speechSynthesis.cancel();
  // Pause mic while speaking to prevent echo loop
  pauseRecognition();
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate  = 0.92;
    u.pitch = 1.05;
    u.lang  = 'en-US';
    u.onend = () => {
      // Resume mic after speech finishes + small delay
      setTimeout(() => {
        resumeRecognition();
        if (onDone) onDone();
      }, 600);
    };
    window.speechSynthesis.speak(u);
  }, 150);
}

// speakWhenFree — waits until current speech finishes, then speaks
function speakWhenFree(text) {
  const trySpeak = () => {
    if (!window.speechSynthesis.speaking) {
      pauseRecognition();
      const u = new SpeechSynthesisUtterance(text);
      u.rate  = 0.9;
      u.pitch = 1.1;
      u.lang  = 'en-US';
      u.onend = () => {
        setTimeout(() => resumeRecognition(), 600);
      };
      window.speechSynthesis.speak(u);
    } else {
      setTimeout(trySpeak, 500);
    }
  };
  trySpeak();
}

// speakAlways — for timer end, always interrupts
function speakAlways(text) {
  window.speechSynthesis.cancel();
  pauseRecognition();
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate  = 0.9;
    u.pitch = 1.1;
    u.lang  = 'en-US';
    u.onend = () => {
      setTimeout(() => resumeRecognition(), 600);
    };
    window.speechSynthesis.speak(u);
  }, 100);
}

// Pause mic without fully stopping it
function pauseRecognition() {
  if (recognition && voiceCommandsOn) {
    try { recognition.stop(); } catch(e) {}
  }
}

// Resume mic after speech ends
function resumeRecognition() {
  if (recognition && voiceCommandsOn && !recognitionStarting) {
    try {
      recognitionStarting = true;
      recognition.start();
      setTimeout(() => { recognitionStarting = false; }, 300);
    } catch(e) {
      recognitionStarting = false;
    }
  }
}

// ── Voice button — press = read step, press again = restart reading ──
function pressVoice(recipe) {
  const btn = document.getElementById(recipe + '-voice-btn');
  // Visual feedback while speaking
  btn.classList.add('active');
  const speechText = buildStepSpeech(recipe);
  speakNow(speechText, () => {
    // Remove active style when done speaking
    btn.classList.remove('active');
  });
}

// ── Build the speech text for current step ──
function buildStepSpeech(recipe) {
  const r    = recipes[recipe];
  const s    = state[recipe];
  const step = r.steps[s.step];
  let plainText = step.desc.replace(/\*\*|%%/g, '');
  plainText = expandForSpeech(plainText);
  let full = step.title + '. ' + plainText;
  if (step.timer) {
    const mins = Math.floor(step.timer / 60);
    const secs = step.timer % 60;
    let timerText = '';
    if (mins > 0 && secs > 0) timerText = mins + ' minutes and ' + secs + ' seconds';
    else if (mins > 0) timerText = mins + (mins === 1 ? ' minute' : ' minutes');
    else timerText = secs + ' seconds';
    full += '. Timer for this step is ' + timerText + '.';
  }
  return full;
}

// ── Chef button — explains WHY we do this step ──
function pressChef(recipe) {
  const r    = recipes[recipe];
  const s    = state[recipe];
  const step = r.steps[s.step];
  if (!step.why) return;
  const btn = document.getElementById(recipe + '-chef-btn');
  btn.classList.add('active');
  speakNow('Chef tip: ' + step.why, () => {
    btn.classList.remove('active');
  });
}

// ── Beep ──
function playBeep(frequency = 880, duration = 0.25, times = 3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.start(t);
      osc.stop(t + duration);
      t += duration + 0.12;
    }
  } catch(e) {}
}

// ═══════════════════════════════════════
//  RECIPE DATA
// ═══════════════════════════════════════
const recipes = {
  pasta: {
    emoji: '🍝',
    name: 'Pasta',
    backScreen: 'screen-pasta',
    steps: [
      {
        title: 'Boil the water',
        desc: 'Fill your large pot with water and place it on the stove on **high heat**. Add **%%a generous pinch of salt%%** — the water should taste slightly salty. Wait until it fully boils and you see big bubbles rising.',
        timer: 8 * 60,
        next: 'Add the spaghetti to the boiling water.',
        why: 'We salt the water because pasta absorbs water as it cooks. If the water is salty, the pasta soaks up that flavor from the inside — without this, no matter how much sauce you add on top, the pasta itself will taste bland.'
      },
      {
        title: 'Cook the spaghetti',
        desc: 'Add **%%200g of spaghetti%%** to the boiling water. Stir once so strands don\'t stick. Cook until soft but with a slight bite — taste a strand to check. Then drain it using your colander.',
        timer: 9 * 60,
        next: 'Fry the garlic in a pan while pasta cooks.',
        why: 'We cook pasta until it has a slight bite — this is called al dente in Italian. If you overcook it, it becomes mushy and falls apart when you mix it with the sauce. A little resistance means perfect texture.'
      },
      {
        title: 'Fry the garlic',
        desc: 'Heat **%%1 tbsp of olive oil%%** in your frying pan on **medium heat**. Add **%%2 cloves of crushed garlic%%**. Stir and fry until golden and fragrant — about 1–2 minutes. Don\'t burn it or it turns bitter!',
        timer: 2 * 60,
        next: 'Beat the eggs in your bowl for the sauce.',
        why: 'Frying garlic in oil releases its flavor into the oil itself. When you later add the pasta, every strand gets coated in that garlic-flavored oil. Raw garlic would be too sharp and harsh — the heat mellows it into something rich and sweet.'
      },
      {
        title: 'Make the egg sauce',
        desc: 'In your mixing bowl, beat **%%2 eggs%%** well with a fork. Add a **%%handful of parmesan%%** if you have it. Add **%%a pinch of black pepper%%**. Mix until smooth. This becomes your creamy sauce — no heat needed.',
        timer: null,
        next: 'Drain pasta and combine everything off the heat.',
        why: 'Eggs are our cream substitute — no actual cream needed. When hot pasta touches the egg mixture, the heat gently cooks the eggs just enough to turn creamy without scrambling. This is why we do it OFF the heat — too much heat and you get scrambled eggs on pasta instead of a silky sauce.'
      },
      {
        title: 'Combine everything',
        desc: 'Turn the stove **OFF**. Add the hot drained **%%pasta%%** into the pan with **%%garlic%%**. Pour the **%%egg mixture%%** over immediately and toss fast for **%%1–2 minutes%%**. The pasta heat cooks the eggs into a silky cream. Serve right away!',
        timer: 2 * 60,
        next: null,
        why: 'Speed is everything in this step. The pasta is hot when it leaves the boiling water — that heat is what cooks the egg sauce. If you wait too long, the pasta cools down and the eggs won\'t cook properly. If you put it back on the stove, the eggs scramble. The window is about 2 minutes — work fast and it comes out perfectly silky.'
      }
    ]
  },

  chicken: {
    emoji: '🍗',
    name: 'Chicken Masala',
    backScreen: 'screen-chicken',
    steps: [
      {
        title: 'Fry the onions',
        desc: 'Heat **%%2 tbsp of olive oil or butter%%** in your pan on **medium-high heat**. Add the **%%diced onion%%** and stir. Fry until the onions turn **golden brown** — this takes patience but is the most important step.',
        timer: 8 * 60,
        next: 'Add garlic and spices to the golden onions.',
        why: 'Frying onions until golden is called caramelizing. As they cook, the natural sugars in the onion turn sweet and rich. This becomes the flavor base of your entire masala — if your onions are pale and undercooked, the whole dish will taste flat. Golden brown is the goal, not just soft.'
      },
      {
        title: 'Add garlic & spices',
        desc: 'Add **%%3 cloves of crushed garlic%%** to the pan. Stir for 30 seconds. Then add **%%1 tsp cumin%%**, **%%1 tsp paprika%%**, and **%%salt to taste%%**. Stir everything together for **%%1 minute%%** — it will smell amazing.',
        timer: 2 * 60,
        next: 'Add the tomatoes and let them break down.',
        why: 'We add garlic and spices directly to the hot oil and onions rather than to water or sauce. Heat releases the essential oils inside spices — that\'s where all the flavor lives. Frying them for just 60 seconds "blooms" the spices and makes them 3 to 4 times more flavorful than if you just stirred them in at the end.'
      },
      {
        title: 'Cook the tomatoes',
        desc: 'Add your **%%chopped tomatoes%%** (or canned tomatoes) to the pan. Stir well and break them apart with your spoon. Cook until the tomatoes turn into a thick sauce and the oil starts to separate at the edges.',
        timer: 7 * 60,
        next: 'Add the chicken pieces and cover to cook.',
        why: 'We cook tomatoes until the oil separates — this is a key sign in Indian cooking called "bhunao". It means the water from the tomatoes has fully evaporated and the spices are now frying in the oil rather than just boiling. This deepens the flavor massively. If you skip this and add chicken too early, the sauce will taste raw and watery.'
      },
      {
        title: 'Cook the chicken',
        desc: 'Add the **%%chicken pieces%%** to the pan. Stir to coat every piece in the masala sauce. Cover with the lid and cook on **medium heat**. Stir every few minutes so nothing sticks to the bottom.',
        timer: 15 * 60,
        next: 'Finish with cream and taste for salt.',
        why: 'Covering the pan traps steam inside, which cooks the chicken from all sides at once — top, bottom and through the sauce. This makes the chicken stay juicy and tender instead of drying out. The chicken is safe to eat when it\'s white all the way through with no pink remaining.'
      },
      {
        title: 'Finish & serve',
        desc: 'Check the chicken is fully cooked — **no pink inside**. If using, stir in **%%200ml of heavy cream%%** and simmer for **%%2 more minutes%%**. Taste and add more **%%salt%%** if needed. Serve hot!',
        timer: 2 * 60,
        next: null,
        why: 'Adding cream at the very end rather than the beginning keeps it from curdling or splitting. Cream added to a very hot, acidic tomato sauce too early can separate into grainy lumps. Stirring it in at low heat right before serving gives you that smooth, rich, restaurant-style finish.'
      }
    ]
  },

  pizza: {
    emoji: '🍕',
    name: 'Pizza',
    backScreen: 'screen-pizza',
    steps: [
      {
        title: 'Flatten the dough',
        desc: 'Take your **%%store-bought dough%%** out of the package. Place it on the baking tray. Press it flat with your hands — push from the center outwards. **Don\'t worry about shape**, round or rectangle is fine. Just make sure it\'s evenly flat.',
        timer: null,
        next: 'Spread the tomato paste over the dough.',
        why: 'Store-bought dough is already done for you — no kneading, no waiting, no rolling pin needed. Pressing with hands is fine because it\'s already soft and ready. The shape doesn\'t matter at all, as long as it\'s flat enough to cook evenly.'
      },
      {
        title: 'Spread the sauce',
        desc: 'Spoon **%%3 tbsp of tomato paste%%** onto the dough. Spread it around with the back of the spoon. Drizzle **%%1 tbsp of olive oil%%** on top. Don\'t worry about being perfect — leave a little bit of edge bare for the crust.',
        timer: null,
        next: 'Add cheese and any toppings you like.',
        why: 'The bare edge becomes your crust — that golden puffy border. Tomato paste already has flavor and thickness so you don\'t need to make any sauce yourself. The olive oil drizzle helps everything cook evenly and adds richness.'
      },
      {
        title: 'Add cheese & toppings',
        desc: 'Sprinkle **%%100g of melting cheese%%** evenly over the sauce. Add any optional toppings you have — **%%pepperoni%%**, **%%fresh basil%%**, anything you like. Done!',
        timer: null,
        next: 'Bake the pizza in the oven.',
        why: 'Cheese goes on first because it melts and holds your toppings in place — they won\'t slide off when you eat. Any cheese that melts works: mozzarella, cheddar, even a mix.'
      },
      {
        title: 'Bake the pizza',
        desc: 'Slide the tray into your **preheated oven at %%220°C%%**. Bake until the cheese is **fully melted and bubbly** with golden brown spots, and the crust is golden. Use oven mitts to take it out!',
        timer: 12 * 60,
        next: null,
        why: 'A hot oven is the secret to good pizza. High heat cooks the dough quickly and crispy on the outside while keeping it soft inside. If your oven runs cool, leave it in a few extra minutes — just check that the cheese is fully melted before taking it out.'
      }
    ]
  },

  dessert: {
    emoji: '🍮',
    name: 'Crème Brûlée',
    backScreen: 'screen-dessert',
    steps: [
      {
        title: 'Whisk eggs & sugar',
        desc: 'Add **%%4 egg yolks%%** and **%%80g of sugar%%** to your mixing bowl. Whisk hard for about **%%2 minutes%%** until the mixture turns **pale yellow** and looks creamy. That\'s it for this step — easy!',
        timer: 3 * 60,
        next: 'Warm the cream gently on the stove.',
        why: 'Whisking sugar with the yolks dissolves it so there are no gritty bits in the final dessert. The pale yellow color tells you it\'s ready. Don\'t skip this — sugar that doesn\'t dissolve makes a sandy texture.'
      },
      {
        title: 'Warm the cream',
        desc: 'Pour **%%300ml of heavy cream%%** into the small saucepan. Add **%%1 tsp of vanilla cream%%**. Heat on **low-to-medium heat**, stirring sometimes. Take it off the heat **as soon as you see steam rising** — DO NOT let it boil!',
        timer: 5 * 60,
        next: 'Mix the warm cream into the egg mixture.',
        why: 'We warm the cream just to steaming, never boiling. Boiling cream gets too hot and will instantly cook the eggs into scrambled bits. Just steaming is the perfect temperature — warm enough to gently combine, not hot enough to ruin everything.'
      },
      {
        title: 'Combine slowly',
        desc: 'Pour the warm cream into the egg bowl **VERY SLOWLY**, while whisking with your other hand. Start with just a spoon at a time. After 4–5 spoons, you can pour in a slow stream. Keep whisking the whole time!',
        timer: null,
        next: 'Pour into mugs and bake.',
        why: 'This is the most important step. Pouring slowly while whisking gradually heats the eggs without shocking them. If you dump it all in at once, you get scrambled eggs. Slow and steady = silky custard. Trust the process.'
      },
      {
        title: 'Bake in the oven',
        desc: 'Pour the mixture evenly into your **%%4 mugs%%**. Place them on the baking tray. Slide into the **%%oven at 160°C%%**. Bake for **%%35 minutes%%**. The edges should be set but the **center wobbles slightly** when shaken — that\'s perfect!',
        timer: 35 * 60,
        next: null,
        why: 'The slight wobble in the center looks underdone but isn\'t — the custard keeps cooking from its own heat after you take it out. If you wait until it\'s totally firm, it will be overcooked and rubbery once cooled. Trust the wobble! Serve warm or let it chill in the fridge.'
      }
    ]
  },

  rice: {
    emoji: '🍚',
    name: 'Rice',
    backScreen: 'screen-rice',
    steps: [
      {
        title: 'Boil the water',
        desc: 'Pour **%%2 cups of water%%** into your pot. Add a **%%pinch of salt%%** and **%%1 tsp of butter or oil%%** if using. Put on **high heat** and bring to a full boil — you\'ll see big bubbles.',
        timer: 4 * 60,
        next: 'Add rice, reduce heat and cover.',
        why: 'We salt the water before adding rice so the salt gets absorbed into every grain as it cooks — same principle as pasta. The butter or oil is optional but makes the rice grains separate beautifully instead of clumping together.'
      },
      {
        title: 'Add rice & cover',
        desc: 'Add **%%1 cup of rinsed rice%%** to the boiling water. Stir once. Reduce heat to the **lowest setting**. Put the lid on. Do NOT lift the lid during cooking — the steam inside is what cooks the rice.',
        timer: 15 * 60,
        next: 'Remove from heat and let it rest.',
        why: 'Keeping the lid on traps steam, which is what actually cooks the rice. Every time you lift the lid, steam escapes and the rice takes longer to cook and can turn out unevenly done. Low heat prevents the bottom from burning while the steam gently cooks the top.'
      },
      {
        title: 'Rest & fluff',
        desc: 'Turn the heat **OFF**. Keep the lid on and let it rest for **%%5 minutes%%** — don\'t skip this! Then remove the lid and fluff the rice gently with a fork. Serve immediately.',
        timer: 5 * 60,
        next: null,
        why: 'The resting time allows the steam still inside the pot to finish cooking the top layer of rice evenly. If you open it immediately, the rice on top will be slightly underdone while the bottom is perfect. 5 minutes makes it uniform all the way through.'
      }
    ]
  },

  eggs: {
    emoji: '🥚',
    name: 'Fried Eggs',
    backScreen: 'screen-eggs',
    steps: [
      {
        title: 'Heat the pan',
        desc: 'Put your non-stick pan on **low-to-medium heat**. Add **%%1 tsp of butter or oil%%**. Wait until the butter melts and starts to shimmer slightly — about **%%1 minute%%**. Don\'t let it brown or smoke.',
        timer: 60,
        next: 'Crack the eggs directly into the pan.',
        why: 'Starting with the right heat is everything for eggs. Too hot and the whites turn rubbery and brown before the yolk is done. Low-medium heat cooks the whites gently and evenly while keeping the yolk soft and runny. The butter shimmering is your signal that it\'s ready.'
      },
      {
        title: 'Crack & cook eggs',
        desc: 'Crack **%%2 eggs%%** carefully into the pan — crack on the edge, open over the pan. Add a **%%pinch of salt%%**. Cook without touching them until the whites are fully white and set but the yolk still looks bright yellow and slightly jiggly.',
        timer: 3 * 60,
        next: null,
        why: 'The egg white and yolk cook at different speeds. The white is done when it turns fully opaque and white with no clear/translucent parts remaining. The yolk is done to your taste — jiggly means runny, fully set means hard. For a runny yolk, take it off as soon as the whites are done. Never break the yolk unless you want it scrambled.'
      }
    ]
  },

  garlicBread: {
    emoji: '🧄',
    name: 'Garlic Bread',
    backScreen: 'screen-garlic-bread',
    steps: [
      {
        title: 'Spread the butter',
        desc: 'Take your **%%4 slices of bread%%**. Spread the **%%garlic butter mixture%%** generously on one side of each slice. Make sure every corner is covered — especially the edges so they crisp up nicely.',
        timer: null,
        next: 'Put the bread in the oven to toast.',
        why: 'Covering every corner including the edges ensures even toasting. The parts without butter will toast faster and can burn at the edges while the middle is still soft. Even coverage = even golden color all over.'
      },
      {
        title: 'Bake until golden',
        desc: 'Place the slices butter-side UP on your baking tray. Slide into the **preheated oven at %%200°C%%**. Bake until the edges are golden and the top is lightly crispy. Watch it — bread goes from perfect to burnt quickly!',
        timer: 8 * 60,
        next: null,
        why: 'Butter-side up means the garlic butter melts into the bread as it bakes rather than dripping away. The high heat quickly caramelizes the garlic — turning it sweet and nutty. If you added cheese, it will melt and bubble on top which is the sign it\'s ready.'
      }
    ]
  }
};

// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
const state = {
  pasta:       { step: 0, timerInterval: null, timerRunning: false, timeLeft: 0, totalTime: 0 },
  chicken:     { step: 0, timerInterval: null, timerRunning: false, timeLeft: 0, totalTime: 0 },
  pizza:       { step: 0, timerInterval: null, timerRunning: false, timeLeft: 0, totalTime: 0 },
  dessert:     { step: 0, timerInterval: null, timerRunning: false, timeLeft: 0, totalTime: 0 },
  rice:        { step: 0, timerInterval: null, timerRunning: false, timeLeft: 0, totalTime: 0 },
  eggs:        { step: 0, timerInterval: null, timerRunning: false, timeLeft: 0, totalTime: 0 },
  garlicBread: { step: 0, timerInterval: null, timerRunning: false, timeLeft: 0, totalTime: 0 },
};

// ── Start cook ──
function startCook(recipe) {
  state[recipe].step = 0;
  clearTimerState(recipe);
  rebuildCookScreen(recipe);
  goTo('screen-cook-' + recipe);
  renderStep(recipe);
}

// ── Render step ──
function renderStep(recipe) {
  const r     = recipes[recipe];
  const s     = state[recipe];
  const step  = r.steps[s.step];
  const total = r.steps.length;

  // Progress
  const pct = ((s.step + 1) / total) * 100;
  document.getElementById(recipe + '-progress').style.width = pct + '%';
  document.getElementById(recipe + '-step-label').textContent = 'Step ' + (s.step + 1) + ' of ' + total;

  // Content
  document.getElementById(recipe + '-step-title').textContent = step.title;
  document.getElementById(recipe + '-step-desc').innerHTML    = formatDesc(step.desc);

  // Timer
  const timerBox = document.getElementById(recipe + '-timer-box');
  const timerBtn = document.getElementById(recipe + '-timer-btn');
  clearTimerState(recipe);

  if (step.timer) {
    timerBox.classList.remove('hidden');
    s.timeLeft  = step.timer;
    s.totalTime = step.timer;
    updateCircle(recipe);
    updateTimerDisplay(recipe);
    timerBtn.textContent = '▶  Start Timer';
    timerBtn.className   = 'cook-timer-btn';
  } else {
    timerBox.classList.add('hidden');
  }

  // Next preview
  const nextPreview = document.getElementById(recipe + '-next-preview');
  if (step.next) {
    nextPreview.style.display = 'block';
    document.getElementById(recipe + '-next-text').textContent = step.next;
  } else {
    nextPreview.style.display = 'none';
  }

  // Next button
  const nextBtn = document.getElementById(recipe + '-next-btn');
  nextBtn.textContent = s.step === total - 1 ? '🍽️  Done! Enjoy your meal!' : 'Next Step →';

  // Prev button
  const prevBtn = document.getElementById(recipe + '-prev-btn');
  if (prevBtn) prevBtn.disabled = s.step === 0;

  // Chef button — hide if no why for this step
  const chefBtn = document.getElementById(recipe + '-chef-btn');
  if (chefBtn) chefBtn.style.display = step.why ? 'flex' : 'none';

  // Reset voice button state (not speaking anymore)
  const voiceBtn = document.getElementById(recipe + '-voice-btn');
  if (voiceBtn) voiceBtn.classList.remove('active');
}

// ── Format desc ──
function formatDesc(text) {
  text = text.replace(/%%(.+?)%%/g, '<span class="ing-measure">$1</span>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<span class="ing-bold">$1</span>');
  return text;
}

// ── Next / Prev ──
function nextStep(recipe) {
  const r = recipes[recipe];
  const s = state[recipe];
  clearTimerState(recipe);
  window.speechSynthesis.cancel();
  if (s.step >= r.steps.length - 1) { showDone(recipe); }
  else { s.step++; renderStep(recipe); window.scrollTo(0, 0); }
}

function prevStep(recipe) {
  const s = state[recipe];
  if (s.step === 0) return;
  clearTimerState(recipe);
  window.speechSynthesis.cancel();
  s.step--;
  renderStep(recipe);
  window.scrollTo(0, 0);
}

// ── Timer ──
function toggleTimer(recipe) {
  const s        = state[recipe];
  const timerBtn = document.getElementById(recipe + '-timer-btn');

  if (s.timerRunning) {
    clearInterval(s.timerInterval);
    s.timerRunning = false;
    timerBtn.textContent = '▶  Resume';
    timerBtn.className   = 'cook-timer-btn';
  } else {
    s.timerRunning = true;
    timerBtn.textContent = '⏸  Pause';
    timerBtn.className   = 'cook-timer-btn running';

    s.timerInterval = setInterval(() => {
      s.timeLeft--;
      updateTimerDisplay(recipe);
      updateCircle(recipe);

      // Warnings — wait until any current speech finishes, never interrupt
      if (s.timeLeft === 120) {
        speakWhenFree('2 minutes remaining.');
      }
      if (s.timeLeft === 30) {
        speakWhenFree('30 seconds remaining.');
      }

      if (s.timeLeft <= 0) {
        clearInterval(s.timerInterval);
        s.timerRunning = false;
        timerBtn.textContent = "✓  Time's up!";
        timerBtn.className   = 'cook-timer-btn done-green';
        // Timer end always interrupts and plays beep
        playBeep(880, 0.3, 3);
        speakAlways("Time's up! Your step is done.");
        const screen = document.getElementById('screen-cook-' + recipe);
        screen.style.background = '#f0fff4';
        setTimeout(() => { screen.style.background = 'white'; }, 900);
      }
    }, 1000);
  }
}

// ── Circular timer ──
function updateCircle(recipe) {
  const s    = state[recipe];
  const fill = document.getElementById(recipe + '-timer-fill');
  if (!fill) return;
  const r              = 38;
  const circumference  = 2 * Math.PI * r;
  const progress       = s.totalTime > 0 ? s.timeLeft / s.totalTime : 1;
  fill.style.strokeDasharray  = circumference;
  fill.style.strokeDashoffset = circumference * (1 - progress);
}

function updateTimerDisplay(recipe) {
  const s  = state[recipe];
  const el = document.getElementById(recipe + '-timer-display');
  if (el) el.textContent = formatTime(s.timeLeft);
}

// ── Done screen ──
function showDone(recipe) {
  window.speechSynthesis.cancel();
  const emoji = recipes[recipe].emoji;
  const name  = recipes[recipe].name;
  const screen = document.getElementById('screen-cook-' + recipe);
  playBeep(660, 0.3, 4);
  speakAlways('Congratulations! Your ' + name + ' is ready. Enjoy your meal!');
  screen.innerHTML = `
    <div class="done-screen">
      <div class="done-emoji">${emoji}</div>
      <div class="done-title">You did it! 🎉</div>
      <div class="done-sub">Your ${name} is ready. Enjoy what you just made from scratch!</div>
      <div class="done-btn-row">
        <button class="btn-secondary" onclick="restartCook('${recipe}')">↺  Cook Again</button>
        <button class="btn-cook" onclick="goTo('screen-home')">🏠  Back to Home</button>
      </div>
    </div>
  `;
}

// ── Restart ──
function restartCook(recipe) {
  window.speechSynthesis.cancel();
  state[recipe].step = 0;
  clearTimerState(recipe);
  rebuildCookScreen(recipe);
  goTo('screen-cook-' + recipe);
  renderStep(recipe);
}

// ── Build cook screen HTML ──
function rebuildCookScreen(recipe) {
  const screen = document.getElementById('screen-cook-' + recipe);
  const R    = 38;
  const circ = (2 * Math.PI * R).toFixed(2);

  screen.innerHTML = `
    <div class="cook-card">

      <!-- TOP BAR: home | progress | mic status | read -->
      <div class="cook-top">
        <div class="cook-top-home-wrap">
          <button class="cook-top-home" onclick="goTo('screen-home')" title="Home">🏠</button>
          <span class="voice-cmd-label">say: home</span>
        </div>
        <div class="cook-progress-wrap">
          <div class="cook-progress-bar">
            <div class="cook-progress-fill" id="${recipe}-progress"></div>
          </div>
          <div class="cook-step-label" id="${recipe}-step-label"></div>
        </div>
        <div class="mic-status" id="${recipe}-mic-status" title="Voice commands status">
          <span class="mic-icon">🎤</span>
          <span class="mic-dot"></span>
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:3px;">
          <button class="voice-btn" id="${recipe}-voice-btn"
            onclick="pressVoice('${recipe}')" title="Tap to hear this step">🔊</button>
          <span class="voice-cmd-label">say: read</span>
        </div>
      </div>

      <!-- BODY -->
      <div class="cook-body">
        <div class="cook-step-title" id="${recipe}-step-title"></div>
        <div class="cook-step-desc"  id="${recipe}-step-desc"></div>

        <!-- CHEF TIP — sits right under description -->
        <button class="chef-btn" id="${recipe}-chef-btn"
          onclick="pressChef('${recipe}')">
          <span class="chef-btn-icon">👨‍🍳</span>
          <span>Chef tip — why are we doing this?</span>
          <span class="voice-cmd-label" style="margin-left:auto; font-size:10px;" id="${recipe}-chef-voice-label">say: help</span>
        </button>

        <!-- CIRCULAR TIMER -->
        <div class="cook-timer-box hidden" id="${recipe}-timer-box">
          <div class="timer-circle-wrap">
            <svg class="timer-svg" width="90" height="90" viewBox="0 0 90 90">
              <circle class="timer-track" cx="45" cy="45" r="${R}"/>
              <circle class="timer-fill"  cx="45" cy="45" r="${R}"
                id="${recipe}-timer-fill"
                style="stroke-dasharray:${circ}; stroke-dashoffset:0;"/>
            </svg>
            <div class="timer-center-text">
              <div class="cook-timer-display" id="${recipe}-timer-display">0:00</div>
              <div class="cook-timer-sublabel">left</div>
            </div>
          </div>
          <div class="timer-right">
            <div class="cook-timer-label">⏱ Timer</div>
            <button class="cook-timer-btn" id="${recipe}-timer-btn"
              onclick="toggleTimer('${recipe}')">▶  Start Timer</button>
          </div>
        </div>

        <!-- NEXT PREVIEW -->
        <div class="cook-next-preview" id="${recipe}-next-preview">
          <div class="cook-next-label">⏭ Coming up next</div>
          <div class="cook-next-text" id="${recipe}-next-text"></div>
        </div>
      </div>

      <!-- BOTTOM NAV -->
      <div class="cook-nav">
        <div class="nav-btn-wrap">
          <button class="cook-prev-btn" id="${recipe}-prev-btn"
            onclick="prevStep('${recipe}')" disabled>←</button>
          <span class="voice-cmd-label">say: back</span>
        </div>
        <div class="nav-btn-wrap grow">
          <button class="cook-next-big" id="${recipe}-next-btn"
            onclick="nextStep('${recipe}')">Next Step →</button>
          <span class="voice-cmd-label">say: next</span>
        </div>
      </div>

    </div>
  `;
}

// ── Expand abbreviations for speech ──
function expandForSpeech(text) {
  return text
    .replace(/(\d+)\s*g\b/g,    '$1 grams')
    .replace(/(\d+)\s*kg\b/g,   '$1 kilograms')
    .replace(/(\d+)\s*ml\b/g,   '$1 milliliters')
    .replace(/(\d+)\s*l\b/gi,   '$1 liters')
    .replace(/(\d+)\s*tbsp\b/g, '$1 tablespoons')
    .replace(/(\d+)\s*tsp\b/g,  '$1 teaspoons')
    .replace(/(\d+)\s*mins?\b/g,'$1 minutes')
    .replace(/(\d+)\s*secs?\b/g,'$1 seconds')
    .replace(/(\d+)\s*cm\b/g,   '$1 centimeters')
    .replace(/°C\b/g,           'degrees Celsius')
    .replace(/°F\b/g,           'degrees Fahrenheit');
}

// ── Helpers ──
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
function clearTimerState(recipe) {
  const s = state[recipe];
  if (s.timerInterval) clearInterval(s.timerInterval);
  s.timerInterval = null;
  s.timerRunning  = false;
}
