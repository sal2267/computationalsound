var audioCtx;
var waveform = 'sine';
var globalGain;
var quackGain;

const QUACK_KEY = '76'; // L
var quackBuffer = null;

var keyPressCount = 0;
const QUACK_INTERVAL = 10;

var ATTACK = 0.02;
var RELEASE = 0.06;

var activeVoices = {};

document.addEventListener("DOMContentLoaded", function () {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Master
  globalGain = audioCtx.createGain();
  globalGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  globalGain.connect(audioCtx.destination);

  // Quack has its own gain so it doesn’t clip the mix
  quackGain = audioCtx.createGain();
  quackGain.gain.setValueAtTime(0.18, audioCtx.currentTime);
  quackGain.connect(globalGain);

  fetch('quack.mp3')
    .then(r => r.arrayBuffer())
    .then(data => audioCtx.decodeAudioData(data))
    .then(buf => { quackBuffer = buf; })
    .catch(err => console.error('Error loading quack:', err));

  const waveToggleButton = document.getElementById("waveToggle");
  waveToggleButton.addEventListener("click", function () {
    if (waveform === 'sine') {
      waveform = 'sawtooth';
      waveToggleButton.textContent = "Waveform: Sawtooth";
    } else {
      waveform = 'sine';
      waveToggleButton.textContent = "Waveform: Sine";
    }
  });
});

const keyboardFrequencyMap = {
  '90': 261.63, '83': 277.18, '88': 293.66, '68': 311.13,
  '67': 329.63, '86': 349.23, '71': 369.99, '66': 391.99,
  '72': 415.30, '78': 440.00, '74': 466.16, '77': 493.88,
  '81': 523.25, '50': 554.37, '87': 587.33, '51': 622.25,
  '69': 659.26, '82': 698.46, '53': 739.99, '84': 783.99,
  '54': 830.61, '89': 880.00, '55': 932.33, '85': 987.77
};

window.addEventListener('keydown', keyDown, false);
window.addEventListener('keyup', keyUp, false);

function keyDown(event) {
  if (event.repeat) return; // prevents repeat-trigger clicks

  const key = (event.detail || event.which).toString();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  // Manual quack
  if (key === QUACK_KEY) {
    playQuack();
    return;
  }

  if (!keyboardFrequencyMap[key] || activeVoices[key]) return;

  playNote(key);

  // Auto quack every 10 real note presses
  keyPressCount++;
  if (keyPressCount >= QUACK_INTERVAL) {
    playQuack();
    keyPressCount = 0;
  }
}

function keyUp(event) {
  const key = (event.detail || event.which).toString();
  if (!activeVoices[key]) return;

  const { osc, envGain } = activeVoices[key];
  const now = audioCtx.currentTime;

  envGain.gain.cancelScheduledValues(now);
  envGain.gain.setTargetAtTime(0.0, now, RELEASE);

  osc.stop(now + RELEASE * 6);

  delete activeVoices[key];
  updatePolyphony();
}

function playNote(key) {
  const now = audioCtx.currentTime;

  const envGain = audioCtx.createGain();
  envGain.gain.setValueAtTime(0.0, now);
  envGain.gain.setTargetAtTime(1.0, now, ATTACK);

  const voiceGain = audioCtx.createGain();
  voiceGain.gain.setValueAtTime(0.0, now);

  const osc = audioCtx.createOscillator();
  osc.type = waveform;
  osc.frequency.setValueAtTime(keyboardFrequencyMap[key], now);

  osc.connect(envGain);
  envGain.connect(voiceGain);
  voiceGain.connect(globalGain);

  activeVoices[key] = { osc, envGain, voiceGain };

  osc.start(now);
  updatePolyphony();
}

function updatePolyphony() {
  const keys = Object.keys(activeVoices);
  const n = keys.length;
  const now = audioCtx.currentTime;

  const base = 0.35;
  const target = n > 0 ? (base / n) : base;

  keys.forEach(k => {
    const { voiceGain } = activeVoices[k];
    voiceGain.gain.cancelScheduledValues(now);
    voiceGain.gain.setTargetAtTime(target, now, 0.02); // smooth rebalance (no click)
  });
}

function playQuack() {
  if (!quackBuffer) return;

  const src = audioCtx.createBufferSource();
  src.buffer = quackBuffer;
  src.connect(quackGain);
  src.start();
}
