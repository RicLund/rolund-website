import "./styles.css";

const musicLinks = [
  {
    label: "Spotify",
    url: "https://open.spotify.com/album/6qXwHXPs68xAqQkxjuOCih",
  },
  {
    label: "Apple Music",
    url: "https://music.apple.com/ca/album/somewhere-between/6773210957",
  },
  {
    label: "YouTube Music",
    url: "https://music.youtube.com/search?q=Rolund%20Somewhere%20Between",
  },
  {
    label: "Amazon Music",
    url: "https://music.amazon.com/search/Rolund+Somewhere+Between",
  },
  {
    label: "Deezer",
    url: "https://www.deezer.com/album/991229401",
  },
  {
    label: "TIDAL",
    url: "https://tidal.com/album/527982714",
  },
  {
    label: "Beatport",
    url: "https://www.beatport.com/release/somewhere-between/6983026",
  },
];

const releaseUrl = "https://music.apple.com/ca/album/somewhere-between/6773210957";
const previewAudioUrl = "/website-loop4-gapless.wav";
const makeWaveBars = () =>
  Array.from({ length: 9 }, (_, index) => `<i style="--i: ${index}"></i>`).join("");

document.querySelector("#app").innerHTML = `
  <canvas class="visualizer" aria-hidden="true"></canvas>
  <section class="profile" aria-labelledby="page-title">
    <a class="portrait-link" href="${releaseUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open Somewhere Between on Apple Music">
      <span class="portrait-frame">
        <img class="portrait" src="/headshot.jpg" alt="Rolund headshot" width="512" height="512" />
        <span class="eye-glow eye-glow-left" aria-hidden="true"></span>
        <span class="eye-glow eye-glow-right" aria-hidden="true"></span>
      </span>
    </a>

    <h1 id="page-title">Rolund</h1>

    <nav class="links" aria-label="Music platforms">
      ${musicLinks
        .map(
          ({ label, url }) => `
            <a class="music-link" href="${url}" target="_blank" rel="noopener noreferrer">
              <span>${label}</span>
              <span class="wave" aria-hidden="true">${makeWaveBars()}</span>
            </a>
          `,
        )
        .join("")}
    </nav>

    <button class="audio-toggle" type="button" aria-label="Play Rolund pulse preview" aria-pressed="false">
      <span class="play-icon" aria-hidden="true"></span>
      <span class="pause-icon" aria-hidden="true"></span>
    </button>
    <p class="sample-note">
      <span>Feel Your Heart</span><br />
      from <a href="${releaseUrl}" target="_blank" rel="noopener noreferrer">Somewhere Between</a><br />
      available now
    </p>
    <a class="contact-icon-button" href="mailto:info@rolundmusic.com?subject=Rolund%20website%20contact" aria-label="Email Rolund">
      <span class="mail-icon" aria-hidden="true"></span>
      <span>Contact</span>
    </a>

    <audio class="preview-audio" src="${previewAudioUrl}" preload="auto" loop></audio>
  </section>
`;

const portraitLink = document.querySelector(".portrait-link");
const profile = document.querySelector(".profile");
const audioToggle = document.querySelector(".audio-toggle");
const visualizer = document.querySelector(".visualizer");
const canvasContext = visualizer?.getContext("2d");
const previewAudio = document.querySelector(".preview-audio");

let audioContext;
let analyser;
let audioBuffer;
let bufferSource;
let mediaElementSource;
let frequencyData;
let isPlaying = false;
let animationFrame;
let haloTurn = 20;
let lastVisualizerTime = 0;
let bassBaseline = 0;
let eyeBeatLevel = 0;
let playSessionId = 0;

if (previewAudio && typeof previewAudio.volume === "number") {
  previewAudio.volume = 0.82;
}

portraitLink?.addEventListener("pointermove", (event) => {
  const rect = portraitLink.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3);
  const y = ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3);

  portraitLink.style.setProperty("--tilt-x", `${Number(y) * -10}deg`);
  portraitLink.style.setProperty("--tilt-y", `${Number(x) * 12}deg`);
  portraitLink.style.setProperty("--glow-x", `${(Number(x) + 0.5) * 100}%`);
  portraitLink.style.setProperty("--glow-y", `${(Number(y) + 0.5) * 100}%`);
});

portraitLink?.addEventListener("pointerleave", () => {
  portraitLink.style.removeProperty("--tilt-x");
  portraitLink.style.removeProperty("--tilt-y");
  portraitLink.style.removeProperty("--glow-x");
  portraitLink.style.removeProperty("--glow-y");
});

const resizeVisualizer = () => {
  if (!visualizer || !canvasContext) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  visualizer.width = Math.floor(window.innerWidth * pixelRatio);
  visualizer.height = Math.floor(window.innerHeight * pixelRatio);
  canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
};

const ensureAudioGraph = async () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return false;
  }

  try {
    if (!audioContext) {
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.48;
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    return audioContext.state === "running";
  } catch (error) {
    console.warn("Web Audio graph unavailable.", error);
    audioContext = undefined;
    analyser = undefined;
    frequencyData = undefined;
    return false;
  }
};

const loadAudioBuffer = async () => {
  try {
    if (!audioBuffer) {
      const response = await fetch(previewAudioUrl);
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    }

    return true;
  } catch (error) {
    console.warn("Web Audio loop unavailable; falling back to HTML audio.", error);
    return false;
  }
};

const prefersNativeAudio = () =>
  window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches ||
  /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);

const startWebAudioLoop = async ({ offset = 0, pauseNative = true } = {}) => {
  const hasAudioGraph = await ensureAudioGraph();

  if (!hasAudioGraph || !audioContext || !analyser) {
    return false;
  }

  const hasAudioBuffer = await loadAudioBuffer();

  if (!hasAudioBuffer || !audioBuffer) {
    return false;
  }

  bufferSource?.stop?.();
  bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.loop = true;
  bufferSource.connect(analyser);
  bufferSource.start(0, audioBuffer.duration ? offset % audioBuffer.duration : 0);

  if (pauseNative) {
    previewAudio?.pause?.();
  }

  return true;
};

const startHtmlAudioLoop = async ({ analyzeAudio = true } = {}) => {
  if (!previewAudio || typeof previewAudio.play !== "function") {
    return false;
  }

  bufferSource?.stop?.();
  bufferSource = undefined;
  previewAudio.currentTime = 0;
  previewAudio.loop = true;

  const playPromise = previewAudio.play();

  if (analyzeAudio) {
    try {
      const hasAudioGraph = await ensureAudioGraph();

      if (hasAudioGraph && audioContext && analyser && !mediaElementSource) {
        mediaElementSource = audioContext.createMediaElementSource(previewAudio);
        mediaElementSource.connect(analyser);
      }
    } catch (error) {
      console.warn("Audio analysis unavailable; playing native audio only.", error);
    }
  }

  await playPromise;

  return !previewAudio.paused;
};

const upgradeNativeLoopToWebAudio = async (sessionId) => {
  if (!previewAudio) {
    return;
  }

  const offset = previewAudio.currentTime || 0;
  const didUpgrade = await startWebAudioLoop({ offset, pauseNative: true });

  if (!didUpgrade || sessionId !== playSessionId || !isPlaying) {
    bufferSource?.stop?.();
    bufferSource = undefined;
  }
};

const setPlaying = async (nextPlaying) => {
  if (!nextPlaying) {
    playSessionId += 1;
    bufferSource?.stop?.();
    bufferSource = undefined;
    previewAudio?.pause?.();
    isPlaying = false;
    eyeBeatLevel = 0;
    bassBaseline = 0;
    profile?.classList.remove("is-playing");
    audioToggle?.setAttribute("aria-pressed", "false");
    audioToggle?.setAttribute("aria-label", "Play Rolund pulse preview");
    return;
  }

  try {
    const sessionId = playSessionId + 1;
    const useNativeAudio = prefersNativeAudio();
    let didStart = useNativeAudio ? await startHtmlAudioLoop({ analyzeAudio: false }) : await startWebAudioLoop();

    if (!didStart) {
      didStart = useNativeAudio ? await startWebAudioLoop() : await startHtmlAudioLoop();
    }

    if (!didStart) {
      throw new Error("This browser does not expose audio playback APIs.");
    }

    playSessionId = sessionId;
    isPlaying = true;
    eyeBeatLevel = 0;
    bassBaseline = 0;
    profile?.classList.add("is-playing");
    audioToggle?.setAttribute("aria-pressed", "true");
    audioToggle?.setAttribute("aria-label", "Pause Rolund pulse preview");

    if (useNativeAudio) {
      upgradeNativeLoopToWebAudio(sessionId);
    }
  } catch (error) {
    console.warn("Audio playback was blocked by the browser.", error);
    playSessionId += 1;
    isPlaying = false;
    profile?.classList.remove("is-playing");
    audioToggle?.setAttribute("aria-pressed", "false");
    audioToggle?.setAttribute("aria-label", "Play Rolund pulse preview");
  }
};

const drawVisualizer = (time = 0) => {
  if (!visualizer || !canvasContext) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isCompact = width <= 480;
  const barCount = isCompact ? 46 : 72;
  const barWidth = width / barCount;
  const centerY = height * (isCompact ? 0.34 : 0.5);
  const activeScale = isCompact ? 0.22 : 0.36;
  const idleScale = isCompact ? 0.11 : 0.18;

  canvasContext.clearRect(0, 0, width, height);

  if (isPlaying && analyser && frequencyData) {
    analyser.getByteFrequencyData(frequencyData);
  }

  const fallbackPulse = Math.sin(time * 0.008) * 0.5 + 0.5;
  const elapsed = lastVisualizerTime ? Math.min(48, time - lastVisualizerTime) : 16;
  lastVisualizerTime = time;

  for (let i = 0; i < barCount; i += 1) {
    const audioLevel = frequencyData?.[i % frequencyData.length] || 0;
    const idleLevel = Math.sin(time * 0.0014 + i * 0.55) * 0.5 + 0.5;
    const level = isPlaying
      ? analyser
        ? audioLevel / 255
        : idleLevel * 0.72
      : idleLevel * 0.3;
    const barHeight = Math.max(isCompact ? 6 : 10, level * height * (isPlaying ? activeScale : idleScale));
    const x = i * barWidth;
    const y = centerY - barHeight * 0.5;
    const hueMix = i / barCount;

    canvasContext.fillStyle =
      hueMix < 0.5
        ? `rgba(255, ${Math.floor(58 + level * 90)}, 48, ${0.08 + level * 0.26})`
        : `rgba(92, ${Math.floor(170 + level * 55)}, 255, ${0.06 + level * 0.18})`;
    canvasContext.fillRect(x + barWidth * 0.28, y, Math.max(1, barWidth * 0.34), barHeight);
  }

  const glow = isPlaying
    ? frequencyData && analyser
      ? frequencyData[2] / 255
      : fallbackPulse * 0.72
    : 0;

  let eyePulse = 0;

  if (isPlaying && frequencyData && analyser) {
    const bassEnergy =
      (frequencyData[1] * 1.12 +
        frequencyData[2] * 1.08 +
        frequencyData[3] * 0.88 +
        frequencyData[4] * 0.58) /
      (255 * 3.66);

    if (!bassBaseline) {
      bassBaseline = bassEnergy * 0.82;
    }

    const baselineRate = bassEnergy > bassBaseline ? 0.012 : 0.09;
    bassBaseline += (bassEnergy - bassBaseline) * baselineRate;

    const transient = Math.max(0, bassEnergy - bassBaseline * 1.04);
    const beatHit = Math.min(1, transient * 7.2 + Math.max(0, bassEnergy - 0.52) * 0.55);
    const decay = Math.exp(-elapsed / 92);
    eyeBeatLevel = Math.max(beatHit, eyeBeatLevel * decay);
    eyePulse = Math.min(1, eyeBeatLevel ** 0.82);
  } else if (isPlaying) {
    eyePulse = fallbackPulse * 0.5;
  } else {
    eyeBeatLevel = 0;
    bassBaseline = 0;
  }

  if (isPlaying) {
    haloTurn = (haloTurn + elapsed * (0.028 + eyePulse * 0.08)) % 360;
  }

  profile?.style.setProperty("--audio-pulse", glow.toFixed(3));
  profile?.style.setProperty("--eye-pulse", eyePulse.toFixed(3));
  profile?.style.setProperty("--halo-angle", `${haloTurn.toFixed(2)}deg`);
  animationFrame = window.requestAnimationFrame(drawVisualizer);
};

window.addEventListener("resize", resizeVisualizer);
audioToggle?.addEventListener("click", () => {
  setPlaying(!isPlaying);
});

resizeVisualizer();
drawVisualizer();
