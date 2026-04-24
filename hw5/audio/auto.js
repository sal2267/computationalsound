// note frequencies
const noteFreq = {
  "C": 261.63,
  "C#": 277.18,
  "D": 293.66,
  "D#": 311.13,
  "E": 329.63,
  "F": 349.23,
  "F#": 369.99,
  "G": 392.0,
  "G#": 415.30,
  "A": 440.0,
  "A#": 466.16,
  "B": 493.88,
  "C2": 523.25,
  "C#2": 554.37,
  "D2": 587.33,
  "D#2": 622.25,
  "E2": 659.25,
  "F2": 698.46,
  "F#2": 739.99,
  "G2": 783.99,
  "G#2": 830.61,
  "A2": 880.00,
  "A#2": 932.33,
  "B2": 987.77
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const TwinkleTrainingMelody = [
  "C","C","G","G","A","A","G",
  "F","F","E","E","D","D","C",
  "G","G","F","F","E","E","D",
  "G","G","F","F","E","E","D",
  "C","C","G","G","A","A","G",
  "F","F","E","E","D","D","C"
];

// initialize state of the system

let out;
let playing = false;

let markovChain = {};
let markovOrder = 2; //default for now
let currentState = [];
let trainingMelody = [...TwinkleTrainingMelody];

let cella = null;
let rhythmIndex = 0;
let rhythmPattern = [];

// Cellular Automata Rules

const CaRules  = {
  conway: {
    name: "Conway's Game of Life",
    survive: [2, 3],
    birth: [3]
  },
  highlife: {
    name: "Highlife",
    survive: [2, 3],
    birth: [3, 6]
  },
  daynight: {
    name: "Day & Night",
    survive: [3, 4, 6, 7, 8],
    birth: [3, 6, 7, 8]
  },
  seeds: {
    name: "Seeds",
    survive: [],
    birth: [2]
  },
  maze: {
    name: "Maze",
    survive: [1, 2, 3, 4, 5],
    birth: [3]
  }
}

// learning the markov chain

function learnMarkovChain(notes, order = 1) {
  const counts = {};
  const learnedChain = {};

  for (let i =  0; i <= notes.length - order - 1; i++){ //look back order notes, predict the next one
    const state = notes.slice(i, i + order).join(",");
    const nextNote = notes[i + order];

    if (!counts[state]) {
      counts[state] = {};
    }

    if (!counts[state][nextNote]) {
      counts[state][nextNote] = 0;
    }
    
    counts[state][nextNote]++;
  }

  for (const state in counts) {
    const total = Object.values(counts[state]).reduce((sum, count) => sum + count, 0);
    learnedChain[state] = {};

    for (const nextNote in counts[state]) {
      learnedChain[state][nextNote] = counts[state][nextNote] / total;
    }
  }

  return learnedChain;
}

function initializeM(order = 2, notes = TwinkleTrainingMelody) {
  if (!notes || notes.length < order + 1) {
    return false;
  }

  markovOrder = order;
  trainingMelody = [...notes];
  markovChain = learnMarkovChain(trainingMelody, markovOrder);
  currentState = trainingMelody.slice(0, markovOrder);
  
  return true;
}

function weightedChoice(probabilities) {
  const r = Math.random();
  let cumulative = 0;

  for (const note in probabilities) {
    cumulative += probabilities[note];
    if (r <= cumulative) {
      return note;
    }
  }

  const keys = Object.keys(probabilities);
  return keys.length ? keys[0] : "C";
}


function getNextNote() {

  let key = currentState.join(",");
  let transitions = markovChain[key];

  if (!transitions) {
    const states = Object.keys(markovChain);
    if (states.length === 0) return "C";
    const randomState = states[Math.floor(Math.random() * states.length)];
    currentState = randomState.split(",");
    transitions = markovChain[randomState];

  }

  const nextNote = weightedChoice(transitions);
  currentState.push(nextNote);
  currentState = currentState.slice(-markovOrder);
  return nextNote;
}

function changeOrder() {
  let order = parseInt(document.getElementById("markovOrder").value);

  if (isNaN(order) || order < 1) {
    alert("Please enter a valid order (>= 1)");
    return;
  }

  if (order >= trainingMelody.length) {
    alert("Order too large for current training melody.");
    return;
  }

  const success = initializeM(order, trainingMelody);

  if (!success) {
    alert("Not enough notes to train the Markov chain.");
  }

  if (!playing) {
    out.textContent = "Markov chain trained with order " + order;
  }
}

function retrainMarkov(){
  const raw = document.getElementById("trainingNotes").value.trim();
  const notes = raw.split(/\s+/).filter(note => noteFreq[note]);

  if (notes.length < markovOrder + 1) {
    alert("Please enter at least " + (markovOrder + 1) + " valid notes to train the Markov chain.");
    return;
  }

  initializeM(markovOrder, notes);
  out.textContent = 'Markov chain retrained with new melody with ' + notes.length + ' notes.' + ' Current order: ' + markovOrder;
}

// CELLULAR AUTOMATA :D

class Cella {
  constructor(width, height, rule = "conway") {
    this.width = width;
    this.height = height;
    this.grid = this.createGrid();
    this.rule = rule;
    this.generation = 0;
  }

  createGrid() {
    const grid = [];
    const density = parseFloat(document.getElementById("density")?.value || 0.3);

    for (let y = 0; y < this.height; y++) {
      grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        grid[y][x] = Math.random() < density ? 1 : 0;
      }
    }
    return grid;
  }

  countNeighbors(x, y) {
    let count = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + this.width) % this.width;
        const ny = (y + dy + this.height) % this.height;
        count += this.grid[ny][nx];
      }
    }
    return count;
  }

  step(){
    const newGrid = [];
    const rule = CaRules[this.rule];

    for (let y = 0; y < this.height; y++) {
      newGrid[y] = [];

      for (let x = 0; x < this.width; x++) {
        const neighbors = this.countNeighbors(x, y);
        const current = this.grid[y][x];

        if (current === 1 && rule.survive.includes(neighbors)) {
          newGrid[y][x] = 1;
        } else if (current === 0 && rule.birth.includes(neighbors)) {
          newGrid[y][x] = 1;
        } else {
          newGrid[y][x] = 0;
        }
      }
    }
    
    this.grid = newGrid;
    this.generation++;
  }

  getRhythmPattern() {
    const rowIndex = Math.floor(this.height / 2);
    const row = this.grid[rowIndex];
    const rhythms = [];

    for (let i = 0; i < row.length; i++) {
      if (row[i] === 1) {
        const neighbors = this.countNeighbors(i, rowIndex);
        let duration;

        if (neighbors <= 2) {
          duration = 0.15; // short
        } else if (neighbors <= 4) {
          duration = 0.25; // medium
        } else {
          duration = 0.4; // long
        }
        rhythms.push({play: true, duration});
      }
      else {
        rhythms.push({play: false, duration: 0.15}); // rest
    }
    }
    return rhythms;
  }

  draw(canvas) {
    const ctx = canvas.getContext("2d");
    const cellWidth = canvas.width / this.width;
    const cellHeight = canvas.height / this.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === 1) {
          ctx.fillStyle = "#4a9eff";
          ctx.fillRect(
            x * cellWidth,
            y * cellHeight,
            cellWidth - 1,
            cellHeight - 1
          );
        }
      }
    }

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    const midY = Math.floor(this.height / 2);
    ctx.strokeRect(0, midY * cellHeight, canvas.width, cellHeight);
  }

  toggleCell(x, y) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[y][x] = 1 - this.grid[y][x];
    }
  }
}

//AUDIO

function playNote(note, duration = 0.35) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  const waveform = document.getElementById("waveform").value;
  const volume = parseFloat(document.getElementById("volume").value);
  const t = audioCtx.currentTime;

  osc.frequency.value = noteFreq[note];
  osc.type = waveform;

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.start(t);
  osc.stop(t + duration);
}

// MAIN LOOP

async function start() {
  await audioCtx.resume();
  if (playing) return;

  playing = true;
  rhythmPattern = cella.getRhythmPattern();
  rhythmIndex = 0;

  out.textContent = "Playing...";

  const canvas = document.getElementById("cellaCanvas");
  cella.draw(canvas);

  function loop() {
    if (!playing) return;

    const rhythm = rhythmPattern[rhythmIndex];

    if (rhythm.play) {
      const note = getNextNote();
      playNote(note, rhythm.duration);
      out.textContent = `Note: ${note} | Cell: ${rhythmIndex + 1}/${rhythmPattern.length} | Generation: ${cella.generation}`;
    } else {
      out.textContent = `Rest | Cell: ${rhythmIndex + 1}/${rhythmPattern.length} | Generation: ${cella.generation}`;
    }
    
    const waitTime = rhythm.duration * 1000 + 100;

    rhythmIndex++;

    //after line has been played
    if (rhythmIndex >= rhythmPattern.length) {
      rhythmIndex = 0;
      cella.step();
      rhythmPattern = cella.getRhythmPattern();
      cella.draw(canvas);
    }

    setTimeout(loop, waitTime);
  }

  loop();
}

function stop() {
  playing = false;
  out.textContent = "Stopped.";
}

// CELL AUTOMATA CONTROLS

function resetCella() {
  const rulesSelect = document.getElementById("caRule").value;
  cella = new Cella(15, 15, rulesSelect);

  const canvas = document.getElementById("cellaCanvas");
  cella.draw(canvas);

  if (!playing) {
    out.textContent = `Cella reset with rule: ${CaRules[rulesSelect].name}. Press Start to generate rhythm.`;
  }
}

function changeRule(){
  const rulesSelect = document.getElementById("caRule").value;
  cella.rule = rulesSelect;

  if (!playing) {
    out.textContent = `Cellular automata rule changed to: ${CaRules[rulesSelect].name}`;
  }
}

function stepCella() {
  cella.step();

  const canvas = document.getElementById("cellaCanvas");
  cella.draw(canvas);
  
  if (!playing) {
    out.textContent = `Generation: ${cella.generation}`;
  }
}

// interaction

function setupInteraction(){
  const canvas = document.getElementById("cellaCanvas");

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellWidth = canvas.width / cella.width;
    const cellHeight = canvas.height / cella.height;
    const gridX = Math.floor(x / cellWidth);
    const gridY = Math.floor(y / cellHeight)

    cella.toggleCell(gridX, gridY);
    cella.draw(canvas);

    if (!playing) {
      out.textContent = `Toggled cell at (${gridX}, ${gridY}).`;
    }
  });
}

//INitial setup
window.addEventListener("load", () => {
  out = document.getElementById("output");
  
  // initialize CA
  cella = new Cella(15, 15, "conway");
  const canvas = document.getElementById("cellaCanvas");
  cella.draw(canvas);
  
  setupInteraction();

  // initialize Markov chain
  const trainingtextarea = document.getElementById("trainingNotes");
  const notesFromText = trainingtextarea.value.trim().split(/\s+/).filter(note => noteFreq[note]);

  const initialOrder = parseInt(document.getElementById("markovOrder").value, 10);
  const success = initializeM(initialOrder, notesFromText);

  if (!success) {
    initializeM(2, TwinkleTrainingMelody);
    out.textContent = "Initialized with default melody and order 2. Please enter more notes to train with higher order.";
  }

  // populate Cella rule selector
  const caRuleSelect = document.getElementById("caRule");
  for (const ruleKey in CaRules) {
    const option = document.createElement("option");
    option.value = ruleKey;
    option.textContent = CaRules[ruleKey].name;
    caRuleSelect.appendChild(option);
  }
  caRuleSelect.value = "conway";

  out.textContent = "System initialized. Press Start to generate music!";
});
