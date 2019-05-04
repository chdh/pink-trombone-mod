export function clamp(x: number, min: number, max: number): number {
   return (x < min) ? min : (x > max) ? max : x;
}

export function moveTowards(current: number, target: number, amountUp: number, amountDown: number): number {
   return (current < target) ? Math.min(current + amountUp, target) : Math.max(current - amountDown, target);
}

// Returns the current time in seconds.
export function getTime(): number {
   return Date.now() / 1000;
}

// Returns a second-order (biquad) IIR filter function.
// Filter function:
//  a0 * y[n] + a1 * y[n-1] + a2 * y[n-2] = b0 * x[n] + b1 * x[n-1] + b2 * x[n-2]
// Transfer function:
//  H(z) = (a0 + a1 * z^-1 + a2 * z^-2) / (b0 + b1 * z^-1 + b2 * z^-2)
function createBiquadIirFilter(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): (x: number) => number {
   const nb0 = b0 / a0;                                   // normalized coefficients...
   const nb1 = b1 / a0;
   const nb2 = b2 / a0;
   const na1 = a1 / a0;
   const na2 = a2 / a0;
   let x1 = 0;                                            // x[n-1], last input value
   let x2 = 0;                                            // x[n-2], second-last input value
   let y1 = 0;                                            // y[n-1], last output value
   let y2 = 0;                                            // y[n-2], second-last output value
   return (x: number) => {
      const y = nb0 * x + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      return y;
   };
}

// Returns a biquad bandpass filter function.
export function createBandPassFilter(f0: number, q: number, sampleRate: number): (x: number) => number {
   const w0 = 2 * Math.PI * f0 / sampleRate;
   const alpha = Math.sin(w0) / (2 * q);
   const b0 = alpha;
   const b1 = 0;
   const b2 = -alpha;
   const a0 = 1 + alpha;
   const a1 = - 2 * Math.cos(w0);
   const a2 = 1 - alpha;
   return createBiquadIirFilter(b0, b1, b2, a0, a1, a2);
}

export function createBufferedWhiteNoiseSource(bufferSize: number): () => number {
   const buf = new Float64Array(bufferSize);
   for (let i = 0; i < bufferSize; i++) {
      buf[i] = 2 * Math.random() - 1;
   }
   let i = 0;
   return () => {
      if (i >= bufferSize) {
         i = 0;
      }
      return buf[i++];
   };
}

export function createFilteredNoiseSource(f0: number, q: number, sampleRate: number, bufferSize: number): () => number {
   const whiteNoise = createBufferedWhiteNoiseSource(bufferSize);
   const filter = createBandPassFilter(f0, q, sampleRate);
   return () => filter(whiteNoise());
}
