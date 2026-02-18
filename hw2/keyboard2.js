var audioCtx;
var waveform = 'sine';
var mode = 'additive';
var AM_modulator_freq = 10;
var FM_modulator_freq = 100;
var FM_modulation_index = 250;
var ATTACK = 0.05;
var RELEASE = 0.08;
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
    .then(buffer => { quackBuffer = buffer; })
    .catch(err => console.error('Error loading quack:', err));

  globalGain = audioCtx.createGain();
  globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
  globalGain.connect(audioCtx.destination);

  // Waveform toggle
    const waveToggleButton = document.getElementById("waveToggle");
    waveToggleButton.addEventListener("click", function() {
        if (waveform === 'sine') {
            waveform = 'sawtooth';
            waveToggleButton.textContent = "Waveform: Sawtooth";
        } else {
            waveform = 'sine';
            waveToggleButton.textContent = "Waveform: Sine";
    }
});

  // Mode radio buttons (THIS MUST BE OUTSIDE waveform click)
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      mode = e.target.value;
      console.log("Mode switched to:", mode);
    });
  });
  // --- sliders: update globals + show values ---
    const amFreq = document.getElementById("amFreq");
    const amVal = document.getElementById("amVal");
    amFreq.addEventListener("input", (e) => {
        AM_modulator_freq = parseFloat(e.target.value);
        amVal.textContent = AM_modulator_freq;
    });

    const fmFreq = document.getElementById("fmFreq");
    const fmVal = document.getElementById("fmVal");
    fmFreq.addEventListener("input", (e) => {
        FM_modulator_freq = parseFloat(e.target.value);
        fmVal.textContent = FM_modulator_freq;
    });

    const fmIndex = document.getElementById("fmIndex");
    const fmIndexVal = document.getElementById("fmIndexVal");
    fmIndex.addEventListener("input", (e) => {
        FM_modulation_index = parseFloat(e.target.value);
        fmIndexVal.textContent = FM_modulation_index;
    });

    const attackSlider = document.getElementById("attack");
    const atkVal = document.getElementById("atkVal");
    attackSlider.addEventListener("input", (e) => {
        ATTACK = parseFloat(e.target.value);
        atkVal.textContent = ATTACK.toFixed(3);
    });

    const releaseSlider = document.getElementById("release");
    const relVal = document.getElementById("relVal");
    releaseSlider.addEventListener("input", (e) => {
        RELEASE = parseFloat(e.target.value);
        relVal.textContent = RELEASE.toFixed(3);
    });
});

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
        const { oscs, nodeGain } = activeOscillators[key];
        const now = audioCtx.currentTime;

        nodeGain.gain.cancelScheduledValues(now);
        nodeGain.gain.setTargetAtTime(0.0, now, RELEASE);

        const stopAt = now + (RELEASE * 6);
        oscs.forEach(obj => {
        try { 
            obj.osc.stop(stopAt); 
            if (obj.lfo) obj.lfo.stop(stopAt); 
        } catch(e) {}
});


        delete activeOscillators[key];
        updateGains();
    }
}

function playNote(key) {
    console.log("playNote() using mode:", mode);
    const now = audioCtx.currentTime;
    const freq = keyboardFrequencyMap[key];

    // Envelope gain (shared by whole voice)
    const nodeGain = audioCtx.createGain();
    nodeGain.gain.setValueAtTime(0.0001, now);
    nodeGain.gain.setTargetAtTime(1.0, now, ATTACK);

    // Per-voice gain (for polyphony scaling + anti-clipping)
    const voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(0.25, now);

    const oscs = [];

    if (mode === 'additive') {
        const partials = [
            { mult: 1, gain: 1.0 },
            { mult: 2, gain: 0.5 },
            { mult: 3, gain: 0.25 },
            { mult: 4, gain: 0.125 },
        ];

        partials.forEach(p => {
            const osc = audioCtx.createOscillator();
            osc.type = waveform;
            osc.frequency.setValueAtTime(freq * p.mult, now);

            var lfo = audioCtx.createOscillator();
            lfo.frequency.value = 0.5;
            lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 8;
            lfo.connect(lfoGain).connect(osc.frequency);
            lfo.start();

            const partialGain = audioCtx.createGain();
            partialGain.gain.setValueAtTime(p.gain, now);

            // IMPORTANT: partials -> nodeGain (envelope) -> voiceGain
            osc.connect(partialGain);
            partialGain.connect(nodeGain);

            osc.start(now);
            oscs.push({ osc, lfo });
        });

        nodeGain.connect(voiceGain);

    } else if (mode === 'FM') {
        const carrier = audioCtx.createOscillator();
        carrier.type = waveform;
        carrier.frequency.setValueAtTime(freq, now);

        const modulator = audioCtx.createOscillator();
        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(FM_modulator_freq, now);

        const modulationGain = audioCtx.createGain();
        modulationGain.gain.setValueAtTime(FM_modulation_index, now);

        // FM wiring: mod -> gain -> carrier.frequency
        modulator.connect(modulationGain);
        modulationGain.connect(carrier.frequency);

        carrier.connect(nodeGain);
        nodeGain.connect(voiceGain);

        modulator.start(now);
        carrier.start(now);

        oscs.push(carrier, modulator);

    } else if (mode === 'AM') {
        const carrier = audioCtx.createOscillator();
        carrier.type = waveform;
        carrier.frequency.setValueAtTime(freq, now);

        // AM: carrier goes through a gain whose gain is modulated
        const ampGain = audioCtx.createGain();

        // Depth (0..1). Offset keeps gain positive (prevents negative gain flips)
        const depth = 0.7;

        const modulator = audioCtx.createOscillator();
        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(AM_modulator_freq, now);

        const modGain = audioCtx.createGain();
        modGain.gain.setValueAtTime(depth, now);

        const offset = audioCtx.createConstantSource();
        offset.offset.setValueAtTime(1.0 - depth, now);

        modulator.connect(modGain);
        modGain.connect(ampGain.gain);
        offset.connect(ampGain.gain);

        carrier.connect(ampGain);
        ampGain.connect(nodeGain);
        nodeGain.connect(voiceGain);

        modulator.start(now);
        offset.start(now);
        carrier.start(now);

        oscs.push(carrier, modulator, offset);
    }

    // final output routing
    voiceGain.connect(globalGain);

    // store voice (NOTE: includes voiceGain now)
    activeOscillators[key] = { oscs, nodeGain, voiceGain };
    updateGains();
}

function updateGains() {
    const keys = Object.keys(activeOscillators);
    const n = keys.length;
    const scale = n > 0 ? 0.25 / n : 0.25;

    keys.forEach(k => {
        const { voiceGain } = activeOscillators[k];
        if (voiceGain) voiceGain.gain.setValueAtTime(scale, audioCtx.currentTime);
    });
}

function playQuack() {
    if (!quackBuffer) return;

    const src = audioCtx.createBufferSource();
    src.buffer = quackBuffer;
    src.connect(globalGain);
    src.start();
}
