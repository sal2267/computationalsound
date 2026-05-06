// ============================================
// FOURIER SYNTHESIZER - MAIN APPLICATION
// ============================================

class FourierSynthesizer {
    constructor() {
        // Canvas references
        this.drawingCanvas = document.getElementById('drawingCanvas');
        this.spectrumCanvas = document.getElementById('spectrumCanvas');
        this.waveformCanvas = document.getElementById('waveformCanvas');
        
        this.drawingCtx = this.drawingCanvas.getContext('2d');
        this.spectrumCtx = this.spectrumCanvas.getContext('2d');
        this.waveformCtx = this.waveformCanvas.getContext('2d');
        
        // Drawing state
        this.isDrawing = false;
        this.drawnPath = [];
        
        // FFT data
        this.sampleSize = 512;
        this.sampledWaveform = [];
        this.fftResult = null;
        this.harmonics = [];
        
        // Audio synthesis
        this.audioContext = null;
        this.oscillators = [];
        this.gainNodes = [];
        this.masterGain = null;
        this.isPlaying = false;
        this.fundamentalFreq = 220; // A3
        this.numHarmonicsToPlay = 16;
        
        this.init();
    }
    
    init() {
        this.setupDrawingCanvas();
        this.setupEventListeners();
        this.drawGrid(this.drawingCtx, this.drawingCanvas);
    }
    
    // ========================================
    // CANVAS DRAWING SETUP
    // ========================================
    
    setupDrawingCanvas() {
        const ctx = this.drawingCtx;
        const canvas = this.drawingCanvas;
        
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }
    
    drawGrid(ctx, canvas) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        // Horizontal center line
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        // Vertical grid lines
        const gridSpacing = 50;
        for (let x = 0; x < canvas.width; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    }
    
    setupEventListeners() {
        // Drawing controls
        this.drawingCanvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.drawingCanvas.addEventListener('mousemove', this.draw.bind(this));
        this.drawingCanvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.drawingCanvas.addEventListener('mouseleave', this.stopDrawing.bind(this));
        
        // Touch support
        this.drawingCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.drawingCanvas.dispatchEvent(mouseEvent);
        });
        
        this.drawingCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.drawingCanvas.dispatchEvent(mouseEvent);
        });
        
        this.drawingCanvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.drawingCanvas.dispatchEvent(mouseEvent);
        });
        
        // Button controls
        document.getElementById('clearBtn').addEventListener('click', this.clear.bind(this));
        document.getElementById('analyzeBtn').addEventListener('click', this.analyzeFFT.bind(this));
        document.getElementById('sampleSize').addEventListener('change', (e) => {
            this.sampleSize = parseInt(e.target.value);
        });
        
        // Audio synthesis controls
        document.getElementById('playBtn').addEventListener('click', this.playSound.bind(this));
        document.getElementById('stopBtn').addEventListener('click', this.stopSound.bind(this));
        
        document.getElementById('fundamentalFreq').addEventListener('input', (e) => {
            this.fundamentalFreq = parseInt(e.target.value);
            document.getElementById('freqDisplay').textContent = `${this.fundamentalFreq} Hz`;
            if (this.isPlaying) {
                this.updateOscillatorFrequencies();
            }
        });
        
        document.getElementById('numHarmonics').addEventListener('input', (e) => {
            this.numHarmonicsToPlay = parseInt(e.target.value);
            document.getElementById('harmonicsDisplay').textContent = e.target.value;
        });
        
        document.getElementById('masterVolume').addEventListener('input', (e) => {
            const volume = parseInt(e.target.value) / 100;
            document.getElementById('volumeDisplay').textContent = `${e.target.value}%`;
            if (this.masterGain) {
                this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
            }
        });
        
        // Keyboard controls for playing notes
        document.addEventListener('keydown', this.handleKeyPress.bind(this));
        document.addEventListener('keyup', this.handleKeyRelease.bind(this));
    }
    
    // ========================================
    // DRAWING FUNCTIONS
    // ========================================
    
    startDrawing(e) {
        this.isDrawing = true;

        const rect = this.drawingCanvas.getBoundingClientRect();

        const scaleX = this.drawingCanvas.width / rect.width;
        const scaleY = this.drawingCanvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        this.drawnPath = [{x, y}];

        this.drawingCtx.strokeStyle = '#38bdf8';
        this.drawingCtx.lineWidth = 3;
        this.drawingCtx.lineCap = 'round';
        this.drawingCtx.lineJoin = 'round';

        this.drawingCtx.beginPath();
        this.drawingCtx.moveTo(x, y);
    }
    
    draw(e) {
        if (!this.isDrawing) return;

        const rect = this.drawingCanvas.getBoundingClientRect();

        const scaleX = this.drawingCanvas.width / rect.width;
        const scaleY = this.drawingCanvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        this.drawnPath.push({x, y});

        this.drawingCtx.lineTo(x, y);
        this.drawingCtx.stroke();
    }
    
    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            console.log(`Drew ${this.drawnPath.length} points`);
        }
    }
    
    clear() {
        // Clear drawing canvas
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        this.drawGrid(this.drawingCtx, this.drawingCanvas);
        
        // Clear spectrum canvas
        this.spectrumCtx.clearRect(0, 0, this.spectrumCanvas.width, this.spectrumCanvas.height);
        
        // Clear waveform canvas
        this.waveformCtx.clearRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);
        
        // Reset data
        this.drawnPath = [];
        this.sampledWaveform = [];
        this.fftResult = null;
        this.harmonics = [];
        
        document.getElementById('harmonicInfo').textContent = '';
    }
    
    // ========================================
    // WAVEFORM SAMPLING
    // ========================================
    
    sampleDrawnPath() {
        if (this.drawnPath.length < 2) {
            alert('Please draw a waveform first!');
            return null;
        }
        
        // Sample the drawn path into uniform samples
        const samples = new Array(this.sampleSize);
        const canvasWidth = this.drawingCanvas.width;
        const canvasHeight = this.drawingCanvas.height;
        
        // For each sample position, find the closest drawn point
        for (let i = 0; i < this.sampleSize; i++) {
            const targetX = (i / this.sampleSize) * canvasWidth;
            
            // Find closest point in drawn path
            let closestPoint = this.drawnPath[0];
            let minDist = Math.abs(this.drawnPath[0].x - targetX);
            
            for (let point of this.drawnPath) {
                const dist = Math.abs(point.x - targetX);
                if (dist < minDist) {
                    minDist = dist;
                    closestPoint = point;
                }
            }
            
            // Normalize Y to range [-1, 1] (center is 0)
            const normalizedY = (canvasHeight / 2 - closestPoint.y) / (canvasHeight / 2);
            samples[i] = normalizedY;
        }
        
        return samples;
    }
    
    // ========================================
    // FFT ANALYSIS
    // ========================================
    
    analyzeFFT() {
        // Sample the drawn waveform
        this.sampledWaveform = this.sampleDrawnPath();
        if (!this.sampledWaveform) return;
        
        console.log('Sampled waveform:', this.sampledWaveform.slice(0, 10));
        
        try {
            // Perform DFT (Discrete Fourier Transform)
            // This is simpler than FFT but works fine for our purposes
            this.performDFT();
            
            console.log('DFT complete! First 10 harmonics:', this.harmonics.slice(0, 10));
            
            // Visualize results
            this.drawSpectrum();
            this.drawWaveformComparison();
            this.displayHarmonicInfo();
            
            console.log('Analysis complete!');
        } catch (error) {
            console.error('Error during analysis:', error);
            alert('Error analyzing waveform: ' + error.message);
        }
    }
    
    performDFT() {
        // Discrete Fourier Transform
        // Extract frequency components from the sampled waveform
        this.harmonics = [];
        
        const N = this.sampledWaveform.length;
        const numHarmonics = Math.floor(N / 2); // Only need positive frequencies
        
        for (let k = 0; k < numHarmonics; k++) {
            let real = 0;
            let imag = 0;
            
            // Calculate DFT for frequency k
            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                real += this.sampledWaveform[n] * Math.cos(angle);
                imag += -this.sampledWaveform[n] * Math.sin(angle);
            }
            
            // Normalize
            real /= N;
            imag /= N;
            
            // Calculate magnitude and phase
            const magnitude = Math.sqrt(real * real + imag * imag) * 2; // *2 for single-sided spectrum
            const phase = Math.atan2(imag, real);
            
            this.harmonics.push({
                index: k,
                real: real,
                imag: imag,
                magnitude: magnitude,
                phase: phase,
                frequency: k
            });
        }
    }
    
    
    // ========================================
    // VISUALIZATION
    // ========================================
    
    drawSpectrum() {
        const ctx = this.spectrumCtx;
        const canvas = this.spectrumCanvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw bars for first 64 harmonics (or fewer)
        const numBars = Math.min(256, this.harmonics.length);
        const barWidth = canvas.width / numBars;
        
        // Find max magnitude for scaling
        const maxMag = Math.max(...this.harmonics.slice(0, numBars).map(h => h.magnitude));
        
        for (let i = 0; i < numBars; i++) {
            const harmonic = this.harmonics[i];
            const barHeight = (harmonic.magnitude / maxMag) * canvas.height * 0.9;
            
            // Color based on magnitude
            const intensity = Math.floor((harmonic.magnitude / maxMag) * 200 + 55);
            ctx.fillStyle = `rgb(${intensity}, ${100}, ${255 - intensity})`;
            
            ctx.fillRect(
                i * barWidth,
                canvas.height - barHeight,
                barWidth - 1,
                barHeight
            );
        }
        
        // Draw labels for fundamental and first few harmonics
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.fillText('DC', 0, canvas.height - 5);
        ctx.fillText('f₀', barWidth, canvas.height - 5);
        ctx.fillText('2f₀', barWidth * 2, canvas.height - 5);
    }
    
    drawWaveformComparison() {
        const ctx = this.waveformCtx;
        const canvas = this.waveformCanvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw center line
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        // Draw original sampled waveform
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < this.sampledWaveform.length; i++) {
            const x = (i / this.sampledWaveform.length) * canvas.width;
            const y = canvas.height / 2 - this.sampledWaveform[i] * (canvas.height / 2) * 0.9;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Reconstruct waveform from harmonics (inverse FFT concept)
        const reconstructed = this.reconstructWaveform();
        
        // Draw reconstructed waveform
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        
        for (let i = 0; i < reconstructed.length; i++) {
            const x = (i / reconstructed.length) * canvas.width;
            const y = canvas.height / 2 - reconstructed[i] * (canvas.height / 2) * 0.9;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Legend
        ctx.fillStyle = '#667eea';
        ctx.fillRect(10, 10, 20, 3);
        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        ctx.fillText('Original', 35, 15);
        
        ctx.strokeStyle = '#ff6b6b';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(10, 30);
        ctx.lineTo(30, 30);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText('Reconstructed', 35, 33);
    }
    
    reconstructWaveform() {
        const reconstructed = new Array(this.sampleSize).fill(0);
        const numHarmonicsToUse = Math.min(this.numHarmonicsToPlay, this.harmonics.length);

        for (let t = 0; t < this.sampleSize; t++) {
            let value = 0;

            // DC component, no doubling
            if (this.harmonics[0]) {
                value += this.harmonics[0].real;
            }

            // Positive harmonics
            for (let h = 1; h < numHarmonicsToUse; h++) {
                const harmonic = this.harmonics[h];
                const omega = (2 * Math.PI * harmonic.frequency * t) / this.sampleSize;

                value += 2 * (
                    harmonic.real * Math.cos(omega) -
                    harmonic.imag * Math.sin(omega)
                );
            }
            reconstructed[t] = value;
        }
        return reconstructed;
        
    }
    
    displayHarmonicInfo() {
        const info = document.getElementById('harmonicInfo');
        
        // Show info about top harmonics
        const topN = 8;
        const top = this.harmonics
            .slice(1, topN + 1) // Skip DC component
            .sort((a, b) => b.magnitude - a.magnitude)
            .slice(0, 5);
        
        let text = `Total harmonics: ${this.harmonics.length} | `;
        text += `Top 5 by magnitude: `;
        
        top.forEach((h, i) => {
            text += `f${h.index} (${h.magnitude.toFixed(4)})`;
            if (i < top.length - 1) text += ', ';
        });
        
        info.textContent = text;
    }
    
    // ========================================
    // AUDIO SYNTHESIS
    // ========================================
    
    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            
            // Set initial volume
            const volume = parseInt(document.getElementById('masterVolume').value) / 100;
            this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }
    
    playSound() {
        if (!this.harmonics || this.harmonics.length === 0) {
            alert('Please draw and analyze a waveform first!');
            return;
        }
        
        if (this.isPlaying) {
            this.stopSound();
        }
        
        try {
            this.initAudioContext();
            this.createOscillatorBank();
            this.isPlaying = true;
            
            document.getElementById('playBtn').disabled = true;
            console.log('Playing sound with', this.numHarmonicsToPlay, 'harmonics');
            console.log('Audio context state:', this.audioContext.state);
        } catch (error) {
            console.error('Error playing sound:', error);
            alert('Error playing sound: ' + error.message);
            this.stopSound();
        }
    }
    
    stopSound() {
        if (this.masterGain && this.audioContext) {
            const now = this.audioContext.currentTime;

            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
            this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.05);

            setTimeout(() => {
                this.destroyOscillatorBank();
                this.isPlaying = false;
                document.getElementById('playBtn').disabled = false;

                const volume = parseInt(document.getElementById('masterVolume').value) / 100;
                this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
            }, 60);
        } else {
            this.destroyOscillatorBank();
            this.isPlaying = false;
            document.getElementById('playBtn').disabled = false;
        }
    }
    
    createOscillatorBank() {
        this.destroyOscillatorBank(); // Clean up any existing oscillators
        
        const numHarmonics = Math.min(this.numHarmonicsToPlay, this.harmonics.length);
        
        for (let i = 0; i < numHarmonics; i++) {
            const harmonic = this.harmonics[i];
            
            // Skip harmonics with negligible magnitude
            if (harmonic.magnitude < 0.001) continue;
            
            // Create oscillator
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine'; // Pure sine wave
            osc.frequency.setValueAtTime(
                this.fundamentalFreq * harmonic.frequency,
                this.audioContext.currentTime
            );
            
            // Create gain node for this harmonic
            const gain = this.audioContext.createGain();
            
            // Normalize magnitude and apply it
            const normalizedMagnitude = harmonic.magnitude * 2; // Scale up for audibility
            gain.gain.setValueAtTime(normalizedMagnitude, this.audioContext.currentTime);
            
            // Connect: oscillator -> gain -> master gain -> output
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            // Start oscillator
            osc.start();
            
            // Store references
            this.oscillators.push(osc);
            this.gainNodes.push(gain);
        }
        
        console.log(`Created ${this.oscillators.length} oscillators`);
    }
    
    destroyOscillatorBank() {
        // Stop and disconnect all oscillators
        this.oscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {
                // Oscillator might already be stopped
            }
        });
        
        // Disconnect all gain nodes
        this.gainNodes.forEach(gain => {
            gain.disconnect();
        });
        
        this.oscillators = [];
        this.gainNodes = [];
    }
    
    updateOscillatorFrequencies() {
        // Update frequencies of playing oscillators
        this.oscillators.forEach((osc, i) => {
            if (this.harmonics[i]) {
                const newFreq = this.fundamentalFreq * this.harmonics[i].frequency;
                osc.frequency.setValueAtTime(newFreq, this.audioContext.currentTime);
            }
        });
    }
    
    handleKeyPress(e) {
        // Map keys to note frequencies (chromatic scale)
        const keyMap = {
            'a': 220.00,  // A3
            's': 233.08,  // A#3
            'd': 246.94,  // B3
            'f': 261.63,  // C4
            'g': 277.18,  // C#4
            'h': 293.66,  // D4
            'j': 311.13,  // D#4
            'k': 329.63,  // E4
        };
        
        const key = e.key.toLowerCase();
        
        if (keyMap[key] && !this.isPlaying) {
            this.fundamentalFreq = keyMap[key];
            document.getElementById('fundamentalFreq').value = Math.round(this.fundamentalFreq);
            document.getElementById('freqDisplay').textContent = `${Math.round(this.fundamentalFreq)} Hz`;
            this.playSound();
        }
    }
    
    handleKeyRelease(e) {
        const keyMap = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];
        
        if (keyMap.includes(e.key.toLowerCase()) && this.isPlaying) {
            this.stopSound();
        }
    }
}

// ============================================
// INITIALIZE APPLICATION
// ============================================

let app;

window.addEventListener('DOMContentLoaded', () => {
    app = new FourierSynthesizer();
    console.log('Fourier Synthesizer initialized!');
});
