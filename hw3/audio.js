const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/* ===================== BABBLING BROOK ===================== */
let brookNodes = [];
let brookMaster = null;

function makeBrownNoise(ctx) {
    const bufferSize = 10 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const brown = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * brown)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
    }

    const brownNoise = ctx.createBufferSource();
    brownNoise.buffer = noiseBuffer;
    brownNoise.loop = true;
    return brownNoise;
}

async function start() {
    await audioCtx.resume();
    stopBrook();

    const brownNoise1 = makeBrownNoise(audioCtx);
    const brownNoise2 = makeBrownNoise(audioCtx);

    const LPF1Node = audioCtx.createBiquadFilter();
    LPF1Node.type = "lowpass";
    LPF1Node.frequency.setValueAtTime(400, audioCtx.currentTime);

    const LPF2Node = audioCtx.createBiquadFilter();
    LPF2Node.type = "lowpass";
    LPF2Node.frequency.setValueAtTime(14, audioCtx.currentTime);

    const gainNode1 = audioCtx.createGain();
    gainNode1.gain.setValueAtTime(400, audioCtx.currentTime);

    const RHPFNode = audioCtx.createBiquadFilter();
    RHPFNode.type = "highpass";
    RHPFNode.Q.setValueAtTime(33.3, audioCtx.currentTime);

    const baseFreq = audioCtx.createConstantSource();
    baseFreq.offset.setValueAtTime(500, audioCtx.currentTime);

    const outputGainNode = audioCtx.createGain();
    outputGainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

    brownNoise1.connect(LPF1Node);
    LPF1Node.connect(RHPFNode);

    brownNoise2.connect(LPF2Node);
    LPF2Node.connect(gainNode1);
    gainNode1.connect(RHPFNode.frequency);

    baseFreq.connect(RHPFNode.frequency);

    RHPFNode.connect(outputGainNode);
    outputGainNode.connect(audioCtx.destination);

    brownNoise1.start();
    brownNoise2.start();
    baseFreq.start();

    brookNodes = [
        brownNoise1,
        brownNoise2,
        baseFreq,
        LPF1Node,
        LPF2Node,
        gainNode1,
        RHPFNode,
        outputGainNode
    ];
    brookMaster = outputGainNode;
}

function stopBrook() {
    if (!brookMaster) return;

    const nodesToStop = brookNodes.slice();
    const masterToStop = brookMaster;
    const now = audioCtx.currentTime;

    brookNodes = [];
    brookMaster = null;

    masterToStop.gain.cancelScheduledValues(now);
    masterToStop.gain.setValueAtTime(masterToStop.gain.value, now);
    masterToStop.gain.linearRampToValueAtTime(0.0001, now + 0.1);

    setTimeout(() => {
        nodesToStop.forEach(node => {
            try {
                if (node.stop) node.stop();
            } catch (e) {}
            try {
                if (node.disconnect) node.disconnect();
            } catch (e) {}
        });
    }, 120);
}
/* ===================== CREAKING DOOR ===================== */

let doorNodes = [];
let doorTimeout = null;
let doorMaster = null;
let doorForce = 0.78;
let lastDoorEventTime = 0;

function startDoor() {
  audioCtx.resume();
  stopDoor();

  doorMaster = audioCtx.createGain();
  doorMaster.gain.value = 0.35;
  doorMaster.connect(audioCtx.destination);

  lastDoorEventTime = audioCtx.currentTime;
  scheduleDoorEvent();
}

function stopDoor() {
  if (doorTimeout) {
    clearTimeout(doorTimeout);
    doorTimeout = null;
  }

  doorNodes.forEach(node => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch (e) {}
  });
  doorNodes = [];

  if (doorMaster) {
    try {
      doorMaster.disconnect();
    } catch (e) {}
    doorMaster = null;
  }
}

function scheduleDoorEvent() {
  if (!doorMaster) return;

  if (doorForce < 0.3) {
    doorTimeout = setTimeout(scheduleDoorEvent, 50);
    return;
  }

  const now = audioCtx.currentTime;
  triggerDoorEvent(now);

  const minMs = 75;
  const baseMs = 60 + (1 - doorForce) * 150;
  const jitterMs = Math.random() * 40;
  const nextMs = Math.max(minMs, baseMs + jitterMs);

  doorTimeout = setTimeout(scheduleDoorEvent, nextMs);
}

function triggerDoorEvent(now) {
  const dt = Math.min(now - lastDoorEventTime, 0.1);
  lastDoorEventTime = now;

  const amp = Math.sqrt(dt / 0.1) * 0.6;
  const decay = 0.004 + Math.sqrt(dt / 0.1) * 0.015;

  const impulse = audioCtx.createBufferSource();
  const impulseBuffer = audioCtx.createBuffer(1, 192, audioCtx.sampleRate);
  const data = impulseBuffer.getChannelData(0);
  data[0] = 1.0;
  data[1] = 0.55;
  data[2] = 0.28;
  data[3] = 0.12;
  for (let i = 4; i < data.length; i++) data[i] = 0.0;
  impulse.buffer = impulseBuffer;

  const impulseGain = audioCtx.createGain();
  impulseGain.gain.setValueAtTime(0.0001, now);
  impulseGain.gain.exponentialRampToValueAtTime(Math.max(0.001, amp), now + 0.001);
  impulseGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

  impulse.connect(impulseGain);

  const dryGain = audioCtx.createGain();
  dryGain.gain.value = 0.02;

  const woodMix = audioCtx.createGain();
  woodMix.gain.value = 1.0;

  const woodFreqs = [85, 170, 280, 430, 610, 860];
  const woodQs = [1.5, 2, 2.5, 3, 3.5, 4];

  woodFreqs.forEach((freq, i) => {
    const bp = audioCtx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(freq, now);
    bp.Q.value = woodQs[i];
    impulseGain.connect(bp);
    bp.connect(woodMix);
    doorNodes.push(bp);
  });

  impulseGain.connect(dryGain);
  dryGain.connect(woodMix);

  const panelMix = audioCtx.createGain();
  panelMix.gain.value = 1.0;

  const panelTimes = [0.00452, 0.00506, 0.00627, 0.00800, 0.00548, 0.00714, 0.01012, 0.01600];

  panelTimes.forEach((time) => {
    const delay = audioCtx.createDelay(0.05);
    const fb = audioCtx.createGain();
    delay.delayTime.value = time;
    fb.gain.value = 0.03;
    woodMix.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(panelMix);
    doorNodes.push(delay, fb);
  });

  const panelHP = audioCtx.createBiquadFilter();
  panelHP.type = "highpass";
  panelHP.frequency.value = 125;

  const panelLP = audioCtx.createBiquadFilter();
  panelLP.type = "lowpass";
  panelLP.frequency.value = 2400;

  const outGain = audioCtx.createGain();
  outGain.gain.value = 0.45;

  panelMix.connect(panelHP);
  panelHP.connect(panelLP);
  panelLP.connect(outGain);
  outGain.connect(doorMaster);

  const hingeBP = audioCtx.createBiquadFilter();
  hingeBP.type = "bandpass";
  hingeBP.frequency.setValueAtTime(1850, now);
  hingeBP.Q.value = 7.5;

  const hingeGain = audioCtx.createGain();
  hingeGain.gain.value = 0.025;

  impulseGain.connect(hingeBP);
  hingeBP.connect(hingeGain);
  hingeGain.connect(doorMaster);

  impulse.start(now);
  impulse.stop(now + 0.03);

  doorNodes.push(
    impulse, impulseGain, dryGain, woodMix, panelMix,
    panelHP, panelLP, outGain, hingeBP, hingeGain
  );
}

/* ===================== BOUNCING BALL ===================== */

var dropHeight = 1.0; // set by slider

function dropBall() {
  audioCtx.resume();

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(audioCtx.destination);

  const g = 9.81;            // gravity, m/s^2
  const h0 = dropHeight;     // initial height in meters
  const e = 0.72;            // coefficient of restitution (0 < e < 1)

  const now = audioCtx.currentTime;
  let t = now + Math.sqrt(2 * h0 / g);   // first impact time
  let v = Math.sqrt(2 * g * h0);         // first impact speed
  const v0 = v;

  let bounce = 0;
  const maxBounces = 25;

  while (bounce < maxBounces && v > 0.12) {
    const energyNorm = Math.min(1, (v * v) / (v0 * v0));
    const amp = Math.min(1.0, 0.9 * Math.pow(energyNorm, 0.5));
    const decay = 0.03 + 0.12 * energyNorm;

    scheduleBounce(t, amp, decay, energyNorm, masterGain);

    v = e * v;
    const dt = 2 * v / g;   // up and back down
    t += dt;
    bounce++;
  }
}

function scheduleBounce(when, amp, decay, energy, masterGain) {
  // Farnell: FM synthesis
  // Carrier: fixed 120Hz
  // Modulator: sweeps from 210Hz down to 80Hz with a 4th-power decay curve
  // FM index scales with energy so big bounces = dense harmonics, small = near-sine

  const carrier = audioCtx.createOscillator();
  carrier.frequency.value = 120;

  const modulator = audioCtx.createOscillator();
  modulator.frequency.value = 210; // starts high, swept down by envelope below

  // FM depth: scales modulator contribution by energy (Farnell: 70Hz * bounce height)
  const modDepth = audioCtx.createGain();
  modDepth.gain.setValueAtTime(70 * energy, when);
  modDepth.gain.linearRampToValueAtTime(0, when + decay);

  modulator.connect(modDepth);
  modDepth.connect(carrier.frequency); // FM: modulator -> carrier freq

  // Carrier frequency sweep: 210 -> 80Hz, 4th-power curve (Farnell spec)
  // Approximate with a few ramp steps
  carrier.frequency.setValueAtTime(120 + 210 * energy, when);
  carrier.frequency.setValueAtTime(120 + 80  * energy, when + decay * 0.1);
  carrier.frequency.linearRampToValueAtTime(120 + 0,   when + decay);

  // Amplitude envelope: square-law decay (Farnell spec)
  const env = audioCtx.createGain();
  const clampedAmp = Math.min(1.0, amp);
  env.gain.setValueAtTime(clampedAmp, when);
  env.gain.setValueAtTime(clampedAmp, when + 0.001); // 1ms attack
  env.gain.linearRampToValueAtTime(clampedAmp * 0.5, when + decay * 0.5);
  env.gain.linearRampToValueAtTime(0.0001,            when + decay);

  carrier.connect(env);
  env.connect(masterGain);

  carrier.start(when);  carrier.stop(when + decay + 0.02);
  modulator.start(when); modulator.stop(when + decay + 0.02);
}

/* ===================== WIRING ===================== */

window.startDoor = startDoor;
window.stopDoor = stopDoor;
window.dropBall = dropBall;
window.stopBrook = stopBrook;

window.addEventListener("DOMContentLoaded", () => {
  const playBtn = document.getElementById("playBtn");
  if (playBtn) {
    playBtn.addEventListener("click", start);
  }
});
