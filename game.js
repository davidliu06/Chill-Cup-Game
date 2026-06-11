(() => {
  const intMoves = 5;
  const initialSpeed = 500;
  const maxSpeed = 180;
  const finalRoundInitialSpeed = 140;
  const finalRoundMaxSpeed = 45;

  const game = document.querySelector(".game-container");
  const instructions = document.querySelector("#instructions");
  const playerScore = document.querySelector("#playerScore");
  const houseScore = document.querySelector("#houseScore");
  const roundNumber = document.querySelector("#roundNumber");
  const btnStart = document.querySelector("#btnStart");
  const btnReset = document.querySelector("#btnReset");
  const musicToggle = document.querySelector("#musicToggle");
  const ball = document.querySelector("#ball");
  const floorBall = document.querySelector("#floorBall");
  const catAssist = document.querySelector("#catAssist");
  const cups = [...document.querySelectorAll(".cup")];
  const audio = {
    hover: createSound("assets/hover.mp3", 0.32),
    click: createSound("assets/click.mp3", 0.42),
    roundWin: createSound("assets/round-win.mp3", 0.62),
    roundLoss: createSound("assets/round-loss.mp3", 0.58),
    matchWin: createSound("assets/match-win.mp3", 0.68),
    matchLoss: createSound("assets/match-loss.mp3", 0.68),
    music: createSound("assets/music-loop.mp3", 0.34, true)
  };
  let thinkTimerId = 0;
  let lastHoverTarget = null;

  const state = {
    player: 0,
    house: 0,
    round: 1,
    ballCupId: "cup1",
    acceptingPicks: false,
    shuffling: false,
    matchOver: false,
    catUsed: false,
    catHelpActive: false,
    removedCupId: "",
    floorBallReleased: false
  };

  init();

  function init() {
    resetSlots();
    updateScoreboard();
    placeBallUnderCup(state.ballCupId);
    hideBall(true);
    updateFloorBall();
    updateCatAssist();
    cups.forEach((cup) => {
      cup.addEventListener("click", clickCup);
      cup.addEventListener("keydown", keyboardCup);
    });
    btnStart.addEventListener("click", startGame);
    btnReset.addEventListener("click", resetMatch);
    musicToggle.addEventListener("click", toggleMusic);
    floorBall.addEventListener("click", clickFloorBall);
    catAssist.addEventListener("click", clickCatAssist);
    setupInteractionSounds();
    window.addEventListener("resize", () => placeBallUnderCup(state.ballCupId, true));
  }

  async function startGame() {
    if (state.shuffling) return;
    clearThinkTimer();
    if (state.matchOver) {
      resetMatch();
    }

    state.acceptingPicks = false;
    state.shuffling = true;
    state.catHelpActive = false;
    state.removedCupId = "";
    resetRemovedCups();
    updateCatAssist();
    btnStart.disabled = true;
    btnStart.textContent = "WATCH";
    setCupClickability(false);
    clearRoundFlash();

    state.ballCupId = randomCup().id;
    const startingCup = document.querySelector(`#${state.ballCupId}`);

    instructions.textContent = "Keep your eyes on the sparkle.";
    placeBallUnderCup(state.ballCupId, true);
    hideBall(false);
    await liftCup(startingCup, true);
    if (state.matchOver) return;
    ball.classList.add("pop");
    await wait(620);
    if (state.matchOver) return;
    ball.classList.remove("pop");
    await liftCup(startingCup, false);
    if (state.matchOver) return;
    await wait(250);
    if (state.matchOver) return;

    hideBall(true);
    if (state.round === 3 && state.player === 1 && state.house === 1) {
      state.floorBallReleased = true;
      updateFloorBall();
    }
    instructions.textContent = state.round === 3 ? "Final round. Blink and lose." : playfulShuffleLine();
    await shakeCups();
    if (state.matchOver) return;

    state.shuffling = false;
    state.acceptingPicks = true;
    btnStart.textContent = "PICK";
    setCupClickability(true);
    updateCatAssist();
    instructions.textContent = state.player === 1
      ? "Match point. Surely nothing strange will happen."
      : "Pick a cup.";
    startThinkTimer();
  }

  async function shakeCups() {
    const isFinalRound = state.round === 3;
    let moveSpeed = isFinalRound ? finalRoundInitialSpeed : initialSpeed;
    const fastestSpeed = isFinalRound ? finalRoundMaxSpeed : maxSpeed;
    const speedRamp = isFinalRound ? 1.5 : 1.12;
    const movePause = isFinalRound ? 18 : 80;
    const moves = generateMovePatterns(intMoves + state.round + (isFinalRound ? 5 : 0));

    for (const [firstId, secondId] of moves) {
      if (state.matchOver) return;
      moveSpeed = Math.max(fastestSpeed, Math.round(moveSpeed / speedRamp));
      const firstCup = document.querySelector(`#${firstId}`);
      const secondCup = document.querySelector(`#${secondId}`);
      const firstSlot = Number(firstCup.dataset.slot);
      const secondSlot = Number(secondCup.dataset.slot);

      firstCup.style.setProperty("--move-speed", `${moveSpeed}ms`);
      secondCup.style.setProperty("--move-speed", `${moveSpeed}ms`);
      firstCup.dataset.slot = secondSlot;
      secondCup.dataset.slot = firstSlot;
      firstCup.style.setProperty("--slot", secondSlot);
      secondCup.style.setProperty("--slot", firstSlot);

      if (firstId === state.ballCupId || secondId === state.ballCupId) {
        placeBallUnderCup(state.ballCupId, true);
      }

      await wait(moveSpeed + movePause);
    }

    placeBallUnderCup(state.ballCupId, true);
  }

  async function clickCup(event) {
    const currentCup = event.currentTarget;
    if (!state.acceptingPicks || state.shuffling || currentCup.classList.contains("removed")) return;

    clearThinkTimer();
    state.acceptingPicks = false;
    setCupClickability(false);
    updateCatAssist();
    btnStart.disabled = true;

    const pickedCorrectly = currentCup.id === state.ballCupId;
    const tableNeedsToCheat = state.player === 1 && state.house === 0 && pickedCorrectly && !state.catHelpActive;

    if (tableNeedsToCheat) {
      await cheatThePlayer(currentCup);
    }

    const playerWonRound = currentCup.id === state.ballCupId;
    await revealPick(currentCup, playerWonRound);
    awardRound(playerWonRound);
  }

  async function clickCatAssist() {
    if (state.catUsed || !state.acceptingPicks || state.shuffling || state.matchOver) return;

    clearThinkTimer();
    const removableCups = cups.filter((cup) => cup.id !== state.ballCupId && !cup.classList.contains("removed"));
    if (removableCups.length === 0) return;

    const cup = removableCups[Math.floor(Math.random() * removableCups.length)];
    state.catUsed = true;
    state.catHelpActive = true;
    state.removedCupId = cup.id;
    game.classList.add("cat-used");
    cup.classList.add("removed");
    cup.classList.remove("clickable");
    cup.setAttribute("aria-disabled", "true");
    updateCatAssist();
    instructions.textContent = "The cat swats one away. Two cups. No tricks.";
    await wait(680);
    if (!state.acceptingPicks || state.matchOver) return;
    setCupClickability(true);
    startThinkTimer();
  }

  function keyboardCup(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.currentTarget.click();
    }
  }

  async function cheatThePlayer(chosenCup) {
    chosenCup.classList.add("cheat");
    instructions.textContent = "The table saw your confidence and took that personally.";
    await wait(260);
    state.ballCupId = randomCup(chosenCup.id).id;
    placeBallUnderCup(state.ballCupId);
    await wait(440);
    chosenCup.classList.remove("cheat");
  }

  async function revealPick(cup, playerWonRound) {
    hideBall(true);
    placeBallUnderCup(state.ballCupId, true);
    hideBall(!playerWonRound);
    await liftCup(cup, true);

    if (playerWonRound) {
      ball.classList.add("pop");
      await wait(680);
      ball.classList.remove("pop");
      return;
    }

    await wait(520);
    const realCup = document.querySelector(`#${state.ballCupId}`);
    placeBallUnderCup(state.ballCupId, true);
    hideBall(false);
    await liftCup(realCup, true);
    ball.classList.add("pop");
    await wait(760);
    ball.classList.remove("pop");
  }

  async function awardRound(playerWonRound) {
    clearThinkTimer();
    if (playerWonRound) {
      state.player += 1;
      flashResult("player-point");
      instructions.textContent = complimentLine();
    } else {
      state.house += 1;
      flashResult("house-point");
      instructions.textContent = state.player === 1
        ? "No idea how that happened. The table refuses questions."
        : teaseLine();
    }

    updateScoreboard();
    const matchEnded = state.player === 2 || state.house === 2;
    if (!matchEnded) {
      playSound(playerWonRound ? audio.roundWin : audio.roundLoss);
    }
    await wait(980);
    lowerAllCups();
    resetRemovedCups();
    game.classList.remove("cat-used");
    hideBall(true);
    state.catHelpActive = false;
    state.removedCupId = "";

    if (matchEnded) {
      endMatch();
      return;
    }

    state.round += 1;
    updateScoreboard();
    updateFloorBall();
    updateCatAssist();
    btnStart.disabled = false;
    btnStart.textContent = "NEXT";
    instructions.textContent = state.player === 1
      ? "One more point wins it. The table looks nervous."
      : "Ready for the next round?";
  }

  function endMatch() {
    clearThinkTimer();
    state.matchOver = true;
    updateScoreboard();
    updateFloorBall();
    updateCatAssist();
    btnStart.disabled = false;
    btnStart.textContent = "PLAY AGAIN";
    playSound(state.player === 2 ? audio.matchWin : audio.matchLoss);
    instructions.textContent = state.player === 2
      ? "You beat the table. Honestly, impressive."
      : "The table wins best of 3. It is being very normal about it.";
  }

  function clickFloorBall() {
    if (state.matchOver || !floorBall.classList.contains("is-visible")) return;

    clearThinkTimer();
    state.player = 2;
    state.matchOver = true;
    state.acceptingPicks = false;
    state.shuffling = false;
    setCupClickability(false);
    lowerAllCups();
    hideBall(true);
    clearRoundFlash();
    flashResult("player-point");
    updateScoreboard();
    updateFloorBall();
    updateCatAssist();
    btnStart.disabled = false;
    btnStart.textContent = "PLAY AGAIN";
    playSound(audio.matchWin);
    instructions.textContent = "You found the real ball by the plant. You win.";
  }

  function resetMatch() {
    clearThinkTimer();
    state.player = 0;
    state.house = 0;
    state.round = 1;
    state.matchOver = false;
    state.acceptingPicks = false;
    state.shuffling = false;
    state.ballCupId = "cup1";
    state.catUsed = false;
    state.catHelpActive = false;
    state.removedCupId = "";
    state.floorBallReleased = false;

    resetSlots();
    lowerAllCups();
    resetRemovedCups();
    hideBall(true);
    clearRoundFlash();
    updateScoreboard();
    setCupClickability(false);
    updateFloorBall();
    updateCatAssist();
    btnStart.disabled = false;
    btnStart.textContent = "START";
    instructions.textContent = "Find the ball";
  }

  function resetSlots() {
    cups.forEach((cup, index) => {
      cup.dataset.slot = String(index);
      cup.style.setProperty("--slot", index);
      cup.style.removeProperty("--move-speed");
    });
  }

  function updateScoreboard() {
    playerScore.textContent = state.player;
    houseScore.textContent = state.house;
    roundNumber.textContent = state.matchOver ? "Final" : `Round ${state.round}`;
  }

  function setCupClickability(isClickable) {
    cups.forEach((cup) => {
      const canClick = isClickable && !cup.classList.contains("removed");
      cup.classList.toggle("clickable", canClick);
      cup.setAttribute("aria-disabled", String(!canClick));
    });
  }

  function placeBallUnderCup(cupId, instant = false) {
    const cup = document.querySelector(`#${cupId}`);
    if (!cup) return;

    const ballX = cup.offsetLeft + (cup.offsetWidth - ball.offsetWidth) / 2 + 11;
    if (instant) {
      ball.style.transition = "none";
    }
    ball.style.setProperty("--ball-x", `${ballX}px`);
    if (instant) {
      void ball.offsetWidth;
      ball.style.transition = "";
    }
  }

  function restartFloorBall() {
    floorBall.style.animation = "none";
    void floorBall.offsetWidth;
    floorBall.style.animation = "";
  }

  function updateFloorBall() {
    const shouldShow = state.floorBallReleased && state.round === 3 && state.player === 1 && state.house === 1 && !state.matchOver;
    const isShowing = floorBall.classList.contains("is-visible");

    floorBall.classList.toggle("is-visible", shouldShow);
    floorBall.setAttribute("aria-hidden", String(!shouldShow));
    floorBall.disabled = !shouldShow;

    if (shouldShow && !isShowing) {
      restartFloorBall();
    }
  }

  function updateCatAssist() {
    const canUseCat = !state.catUsed && state.acceptingPicks && !state.shuffling && !state.matchOver;
    catAssist.disabled = !canUseCat;
    catAssist.setAttribute("aria-hidden", String(!canUseCat));
  }

  function setupInteractionSounds() {
    const hoverSelector = "button:not(:disabled), .cup.clickable";
    const clickSelector = "button:not(:disabled), .cup.clickable";

    document.addEventListener("pointerover", (event) => {
      const target = event.target.closest(hoverSelector);
      if (!target || !document.contains(target)) return;
      if (target === lastHoverTarget) return;
      lastHoverTarget = target;
      playSound(audio.hover);
    });

    document.addEventListener("pointerout", (event) => {
      const target = event.target.closest(hoverSelector);
      if (target && target === lastHoverTarget) {
        lastHoverTarget = null;
      }
    });

    document.addEventListener("pointerdown", (event) => {
      const target = event.target.closest(clickSelector);
      if (!target || !document.contains(target)) return;
      playSound(audio.click);
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target.closest(clickSelector);
      if (!target || !document.contains(target)) return;
      playSound(audio.click);
    }, true);
  }

  function createSound(src, volume, loop = false) {
    const sound = new Audio(src);
    sound.preload = "auto";
    sound.volume = volume;
    sound.loop = loop;
    return sound;
  }

  function playSound(sound) {
    if (!sound) return;

    sound.pause();
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  function toggleMusic() {
    if (audio.music.paused) {
      audio.music.play().then(() => {
        musicToggle.classList.add("is-playing");
        musicToggle.setAttribute("aria-pressed", "true");
        musicToggle.setAttribute("aria-label", "Pause music");
      }).catch(() => {});
      return;
    }

    audio.music.pause();
    musicToggle.classList.remove("is-playing");
    musicToggle.setAttribute("aria-pressed", "false");
    musicToggle.setAttribute("aria-label", "Play music");
  }

  function startThinkTimer() {
    clearThinkTimer();
    thinkTimerId = window.setTimeout(() => {
      if (!state.acceptingPicks || state.shuffling || state.matchOver) return;
      instructions.textContent = "Still thinking? The cups are laughing at you.";
    }, 5000);
  }

  function clearThinkTimer() {
    if (!thinkTimerId) return;
    window.clearTimeout(thinkTimerId);
    thinkTimerId = 0;
  }

  function hideBall(isHidden) {
    ball.classList.toggle("hidden", isHidden);
  }

  async function liftCup(cup, shouldLift) {
    cup.classList.toggle("lifted", shouldLift);
    await wait(290);
  }

  function lowerAllCups() {
    cups.forEach((cup) => cup.classList.remove("lifted", "cheat"));
  }

  function resetRemovedCups() {
    cups.forEach((cup) => cup.classList.remove("removed"));
  }

  function clearRoundFlash() {
    game.classList.remove("player-point", "house-point");
  }

  function flashResult(className) {
    clearRoundFlash();
    void game.offsetWidth;
    game.classList.add(className);
  }

  function generateMovePatterns(totalMoves) {
    const patterns = [];

    for (let index = 0; index < totalMoves; index += 1) {
      const first = randomCup();
      let second = randomCup(first.id);
      while (second.id === first.id) {
        second = randomCup(first.id);
      }
      patterns.push([first.id, second.id]);
    }

    return patterns;
  }

  function randomCup(excludeId = "") {
    const availableCups = cups.filter((cup) => cup.id !== excludeId);
    return availableCups[Math.floor(Math.random() * availableCups.length)];
  }

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function playfulShuffleLine() {
    const lines = [
      "And now, professional wobbling.",
      "The cups are doing cardio.",
      "A tiny carnival has begun.",
      "The table is practicing misdirection."
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function complimentLine() {
    const lines = [
      "Clean pick. The table is pretending not to notice.",
      "Nice eye. That cup never stood a chance.",
      "Point for you. Very stylish."
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function teaseLine() {
    const lines = [
      "Point for the table. It looks smug.",
      "The ball was elsewhere. Very inconsiderate.",
      "The table takes that one."
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }
})();
