import "./styles.css";

const musicLinks = [
  {
    label: "Spotify",
    url: "https://open.spotify.com/search/Rolund%20Somewhere%20Between/albums",
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
    url: "https://listen.tidal.com/search?q=Rolund%20Somewhere%20Between",
  },
  {
    label: "Beatport",
    url: "https://www.beatport.com/search?q=Rolund%20Somewhere%20Between",
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
    <button class="contact-trigger contact-icon-button" type="button" aria-label="Contact Rolund">
      <span class="mail-icon" aria-hidden="true"></span>
    </button>

    <audio class="preview-audio" src="${previewAudioUrl}" preload="auto" loop></audio>
  </section>

  <div class="contact-overlay" hidden>
    <div class="contact-dialog" role="dialog" aria-modal="true" aria-labelledby="contact-title">
      <button class="contact-close" type="button" aria-label="Close contact form">X</button>
      <h2 id="contact-title">Contact Rolund</h2>
      <form class="contact-form">
        <label>
          <span>Name</span>
          <input name="name" type="text" autocomplete="name" required maxlength="80" />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" required maxlength="120" />
        </label>
        <label>
          <span>Message</span>
          <textarea name="message" rows="5" required maxlength="1400"></textarea>
        </label>
        <label class="contact-trap" aria-hidden="true">
          <span>Website</span>
          <input name="website" type="text" tabindex="-1" autocomplete="off" />
        </label>
        <button class="contact-submit" type="submit">Send</button>
        <p class="contact-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </div>
`;

const portraitLink = document.querySelector(".portrait-link");
const profile = document.querySelector(".profile");
const audioToggle = document.querySelector(".audio-toggle");
const visualizer = document.querySelector(".visualizer");
const canvasContext = visualizer?.getContext("2d");
const previewAudio = document.querySelector(".preview-audio");
const contactTrigger = document.querySelector(".contact-trigger");
const contactOverlay = document.querySelector(".contact-overlay");
const contactClose = document.querySelector(".contact-close");
const contactForm = document.querySelector(".contact-form");
const contactStatus = document.querySelector(".contact-status");

let audioContext;
let analyser;
let audioBuffer;
let bufferSource;
let frequencyData;
let isPlaying = false;
let animationFrame;
let haloTurn = 20;
let lastVisualizerTime = 0;
let bassBaseline = 0;
let eyeBeatLevel = 0;

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

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.48;
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
    eyeBeatLevel = 0;
    bassBaseline = 0;
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
    eyeBeatLevel = 0;
    bassBaseline = 0;
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

const setContactOpen = (isOpen) => {
  if (!contactOverlay) {
    return;
  }

  contactOverlay.hidden = !isOpen;
  document.body.classList.toggle("has-contact-open", isOpen);

  if (isOpen) {
    contactStatus.textContent = "";
    contactForm?.querySelector("input[name='name']")?.focus();
  } else {
    contactTrigger?.focus();
  }
};

contactTrigger?.addEventListener("click", () => setContactOpen(true));
contactClose?.addEventListener("click", () => setContactOpen(false));
contactOverlay?.addEventListener("click", (event) => {
  if (event.target === contactOverlay) {
    setContactOpen(false);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && contactOverlay && !contactOverlay.hidden) {
    setContactOpen(false);
  }
});

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(contactForm);
  const submitButton = contactForm.querySelector(".contact-submit");
  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    message: String(formData.get("message") || "").trim(),
    website: String(formData.get("website") || "").trim(),
  };

  submitButton.disabled = true;
  contactStatus.textContent = "Sending...";

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Message could not be sent.");
    }

    contactForm.reset();
    contactStatus.textContent = "Sent. Thanks for reaching out.";
  } catch (error) {
    contactStatus.textContent = error.message || "Message could not be sent.";
  } finally {
    submitButton.disabled = false;
  }
});

resizeVisualizer();
drawVisualizer();
