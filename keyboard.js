var audioCtx;
var waveform = 'sine';
var globalGain;
const QUACK_KEY = '76'; // L
var quackBuffer = null;
var keyPressCount = 0;
const QUACK_INTERVAL = 10;

document.addEventListener("DOMContentLoaded", function(event){

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    fetch('quack.mp3')
    .then(response => response.arrayBuffer())
    .then(data => audioCtx.decodeAudioData(data))
    .then(buffer => {
        quackBuffer = buffer;
    })
    .catch(err => console.error('Error loading quack:', err));

    globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    globalGain.connect(audioCtx.destination);
    
    const waveToggleButton = document.getElementById("waveToggle");
    waveToggleButton.addEventListener("click", function() {
    if (waveform === 'sine') {
        waveform = 'sawtooth';
        waveToggleButton.textContent = "Waveform: Sawtooth";
    } else if (waveform === 'sawtooth') {
        waveform = 'sine';
        waveToggleButton.textContent = "Waveform: Sine";
    }

});
})

const keyboardFrequencyMap = {
    '90': 261.625565300598634,  //Z - C
    '83': 277.182630976872096, //S - C#
    '88': 293.664767917407560,  //X - D
    '68': 311.126983722080910, //D - D#
    '67': 329.627556912869929,  //C - E
    '86': 349.228231433003884,  //V - F
    '71': 369.994422711634398, //G - F#
    '66': 391.995435981749294,  //B - G
    '72': 415.304697579945138, //H - G#
    '78': 440.000000000000000,  //N - A
    '74': 466.163761518089916, //J - A#
    '77': 493.883301256124111,  //M - B
    '81': 523.251130601197269,  //Q - C
    '50': 554.365261953744192, //2 - C#
    '87': 587.329535834815120,  //W - D
    '51': 622.253967444161821, //3 - D#
    '69': 659.255113825739859,  //E - E
    '82': 698.456462866007768,  //R - F
    '53': 739.988845423268797, //5 - F#
    '84': 783.990871963498588,  //T - G
    '54': 830.609395159890277, //6 - G#
    '89': 880.000000000000000,  //Y - A
    '55': 932.327523036179832, //7 - A#
    '85': 987.766602512248223,  //U - B
    };

window.addEventListener('keydown', keyDown, false);
window.addEventListener('keyup', keyUp, false);

var activeOscillators = {}

function keyDown(event) {
    const key = (event.detail || event.which).toString();
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    // QUACK KEY 🦆
    if (key === QUACK_KEY) {
        playQuack();
        return;
    }

    if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
      playNote(key);
    }

    keyPressCount++;
    if (keyPressCount >= QUACK_INTERVAL) {
        playQuack();
        keyPressCount = 0;
    }
}

function keyUp(event) {
    const key = (event.detail || event.which).toString();
    if (keyboardFrequencyMap[key] && activeOscillators[key]) {
        const {osc, nodeGain} = activeOscillators[key];
        const now = audioCtx.currentTime;
        nodeGain.gain.cancelScheduledValues(now);

        nodeGain.gain.setTargetAtTime(0.0001, now, 0.08);
        osc.stop(now + 0.51);
        delete activeOscillators[key];
    }
}

function playNote(key) {
    
    const nodeGain = audioCtx.createGain();
    nodeGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    nodeGain.gain.setTargetAtTime(0.8, audioCtx.currentTime, 0.1);
    
    const osc = audioCtx.createOscillator();
    osc.frequency.setValueAtTime(keyboardFrequencyMap[key], audioCtx.currentTime)
    osc.type = waveform;
    activeOscillators[key] = {osc, nodeGain};
    updateGains();

    osc.connect(nodeGain);
    nodeGain.connect(globalGain);    
    osc.start();
    
  }

function updateGains() {
  const keys = Object.keys(activeOscillators);
  const scale = keys.length > 0 ? 0.8 / keys.length : 1;
  const now = audioCtx.currentTime;

  keys.forEach(key => {
    const { nodeGain } = activeOscillators[key];

    // Prevent discontinuities when rebalancing polyphony
    nodeGain.gain.cancelScheduledValues(now);
    nodeGain.gain.setTargetAtTime(scale, now, 0.01); // 10ms smoothing
    // alternatively:
    // nodeGain.gain.linearRampToValueAtTime(scale, now + 0.01);
  });
}

function playQuack() {
    if (!quackBuffer) return;

    const src = audioCtx.createBufferSource();
    src.buffer = quackBuffer;
    src.connect(globalGain);
    src.start();
}
