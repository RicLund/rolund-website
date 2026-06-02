import "./styles.css";

const musicLinks = [
  {
    label: "Spotify",
    url: "https://open.spotify.com/search/Rolund",
  },
  {
    label: "Apple Music",
    url: "https://music.apple.com/ca/artist/rolund/1868146719",
  },
  {
    label: "YouTube Music",
    url: "https://music.youtube.com/search?q=Rolund",
  },
  {
    label: "Amazon Music",
    url: "https://music.amazon.com/artists/B0GG79T6GY/rolund",
  },
  {
    label: "Deezer",
    url: "https://www.deezer.com/artist/366866462",
  },
  {
    label: "TIDAL",
    url: "https://listen.tidal.com/search?q=Rolund",
  },
  {
    label: "Beatport",
    url: "https://www.beatport.com/search?q=Rolund",
  },
];

const previewAudioUrl = "/website-loop4-gapless.wav";
const makeWaveBars = () =>
  Array.from({ length: 9 }, (_, index) => `<i style="--i: ${index}"></i>`).join("");

document.querySelector("#app").innerHTML = `
  <canvas class="visualizer" aria-hidden="true"></canvas>
  <section class="profile" aria-labelledby="page-title">
    <a class="portrait-link" href="${musicLinks[1].url}" target="_blank" rel="noopener noreferrer" aria-label="Open Rolund on Apple Music">
      <span class="portrait-frame">
        <img class="portrait" src="/headshot.jpg" alt="Rolund headshot" width="512" height="512" />
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
let frequencyData;
let isPlaying = false;
let animationFrame;

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

const initAudio = async () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return false;
  }

  try {
    if (!audioContext) {
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();

      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.84;
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.connect(audioContext.destination);
    }

    if (!audioBuffer) {
      const response = await fetch(previewAudioUrl);
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    }

    return true;
  } catch (error) {
    console.warn("Web Audio loop unavailable; falling back to HTML audio.", error);
    audioContext = undefined;
    analyser = undefined;
    frequencyData = undefined;
    return false;
  }
};

const setPlaying = async (nextPlaying) => {
  if (!nextPlaying) {
    bufferSource?.stop?.();
    bufferSource = undefined;
    previewAudio?.pause?.();
    isPlaying = false;
    profile?.classList.remove("is-playing");
    audioToggle?.setAttribute("aria-pressed", "false");
    audioToggle?.setAttribute("aria-label", "Play Rolund pulse preview");
    return;
  }

  try {
    const hasWebAudioLoop = await initAudio();

    if (hasWebAudioLoop && audioContext && audioBuffer && analyser) {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.loop = true;
      bufferSource.connect(analyser);
      bufferSource.start();
    } else if (previewAudio && typeof previewAudio.play === "function") {
      await previewAudio.play();
    } else {
      console.warn("This browser does not expose audio playback APIs.");
    }

    isPlaying = true;
    profile?.classList.add("is-playing");
    audioToggle?.setAttribute("aria-pressed", "true");
    audioToggle?.setAttribute("aria-label", "Pause Rolund pulse preview");
  } catch (error) {
    console.warn("Audio playback was blocked by the browser.", error);
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
  profile?.style.setProperty("--audio-pulse", glow.toFixed(3));
  animationFrame = window.requestAnimationFrame(drawVisualizer);
};

window.addEventListener("resize", resizeVisualizer);
audioToggle?.addEventListener("click", () => {
  setPlaying(!isPlaying);
});

resizeVisualizer();
drawVisualizer();
