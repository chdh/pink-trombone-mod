import * as Utils from "./Utils";
import {clamp} from "./Utils";
import * as NoiseGenerator from "./NoiseGenerator";

export class Glottis {

   public  alwaysVoice:                boolean = true;
   public  autoWobble:                 boolean = true;
   public  isTouched:                  boolean = false;
   public  targetTenseness             = 0.6;
   public  targetFrequency             = 140;
   public  vibratoAmount               = 0.005;                      // not modified in this package
   public  vibratoFrequency            = 6;                          // not modified in this package

   private sampleRate:                 number;
   private sampleCount                 = 0;
   private intensity                   = 0;
   private loudness                    = 1;
   private smoothFrequency             = 140;
   private timeInWaveform              = 0;
   private newTenseness                = 0.6;
   private oldTenseness                = 0.6;
   private newFrequency                = 140;
   private oldFrequency                = 140;
   private aspirationNoiseSource:      () => number;

   private waveformLength:             number;
   private alpha:                      number;
   private e0:                         number;
   private epsilon:                    number;
   private shift:                      number;
   private delta:                      number;
   private te:                         number;
   private omega:                      number;

   constructor(sampleRate: number) {
      this.sampleRate = sampleRate;
      this.aspirationNoiseSource = Utils.createFilteredNoiseSource(500, 0.5, sampleRate, 0x8000);
      this.setupWaveform(0);
   }

   // `lambda` is used for linear interpolation between the calculated frequency and tenseness values.
   public step(lambda: number) {
      const time = this.sampleCount / this.sampleRate;
      if (this.timeInWaveform > this.waveformLength) {
         this.timeInWaveform -= this.waveformLength;
         this.setupWaveform(lambda);
      }
      const out1 = this.normalizedLFWaveform(this.timeInWaveform / this.waveformLength);
      const aspirationNoise = this.aspirationNoiseSource();
      const aspiration1 = this.intensity * (1 - Math.sqrt(this.targetTenseness)) * this.getNoiseModulator() * aspirationNoise;
      const aspiration2 = aspiration1 * (0.2 + 0.02 * NoiseGenerator.simplex1(time * 1.99));
      const out = out1 + aspiration2;
      this.sampleCount++;
      this.timeInWaveform += 1 / this.sampleRate;
      return out;
   }

   public getNoiseModulator() {
      const voiced = 0.1 + 0.2 * Math.max(0, Math.sin(Math.PI * 2 * this.timeInWaveform / this.waveformLength));
      return this.targetTenseness * this.intensity * voiced + (1 - this.targetTenseness * this.intensity) * 0.3;
   }

   public adjustParameters(deltaTime: number) {
      const delta = deltaTime * this.sampleRate / 512;     // (512 is the original block size, used for scaling of the adjustment)
      const oldTime = this.sampleCount / this.sampleRate;
      const newTime = oldTime + deltaTime;
      this.adjustIntensity(delta);
      this.calculateNewFrequency(newTime, delta);
      this.calculateNewTenseness(newTime);
   }

   private calculateNewFrequency(time: number, delta: number) {
      if (this.intensity == 0) {
         this.smoothFrequency = this.targetFrequency;
      } else if (this.targetFrequency > this.smoothFrequency) {
         this.smoothFrequency = Math.min(this.smoothFrequency * (1 + 0.1 * delta), this.targetFrequency);
      } else if (this.targetFrequency < this.smoothFrequency) {
         this.smoothFrequency = Math.max(this.smoothFrequency / (1 + 0.1 * delta), this.targetFrequency);
      }
      this.oldFrequency = this.newFrequency;
      this.newFrequency = Math.max(10, this.smoothFrequency * (1 + this.calculateVibrato(time)));
   }

   private calculateNewTenseness(time: number) {
      this.oldTenseness = this.newTenseness;
      this.newTenseness = Math.max(0, this.targetTenseness + 0.1 * NoiseGenerator.simplex1(time * 0.46) + 0.05 * NoiseGenerator.simplex1(time * 0.36));
      if (!this.isTouched && this.alwaysVoice) {           // attack
         this.newTenseness += (3 - this.targetTenseness) * (1 - this.intensity);
      }
   }

   private adjustIntensity(delta: number) {
      if (this.isTouched || this.alwaysVoice) {
         this.intensity += 0.13 * delta;
      } else {
         this.intensity -= 0.05 * delta;
      }
      this.intensity = clamp(this.intensity, 0, 1);
   }

   private calculateVibrato(time: number) {
      let vibrato = 0;
      vibrato += this.vibratoAmount * Math.sin(2 * Math.PI * time * this.vibratoFrequency);
      vibrato += 0.02 * NoiseGenerator.simplex1(time * 4.07);
      vibrato += 0.04 * NoiseGenerator.simplex1(time * 2.15);
      if (this.autoWobble) {
         vibrato += 0.2 * NoiseGenerator.simplex1(time * 0.98);
         vibrato += 0.4 * NoiseGenerator.simplex1(time * 0.5);
      }
      return vibrato;
   }

   private setupWaveform(lambda: number) {
      const frequency = this.oldFrequency * (1 - lambda) + this.newFrequency * lambda;
      const tenseness = this.oldTenseness * (1 - lambda) + this.newTenseness * lambda;
      this.waveformLength = 1 / frequency;
      this.loudness = Math.pow(Math.max(0, tenseness), 0.25);

      const rd = clamp(3 * (1 - tenseness), 0.5, 2.7);

      // normalized to time = 1, Ee = 1
      const ra = -0.01 + 0.048 * rd;
      const rk = 0.224 + 0.118 * rd;
      const rg = (rk / 4) * (0.5 + 1.2 * rk) / (0.11 * rd - ra * (0.5 + 1.2 * rk));

      const ta = ra;
      const tp = 1 / (2 * rg);
      const te = tp + tp * rk;

      const epsilon = 1 / ta;
      const shift = Math.exp(-epsilon * (1 - te));
      const delta = 1 - shift;                               // divide by this to scale RHS

      const rhsIntegral = ((1 / epsilon) * (shift - 1) + (1 - te) * shift) / delta;
      const totalLowerIntegral = rhsIntegral - (te - tp) / 2;
      const totalUpperIntegral = -totalLowerIntegral;

      const omega = Math.PI / tp;
      const s = Math.sin(omega * te);
      // need E0*e^(alpha*Te)*s = -1 (to meet the return at -1)
      // and E0*e^(alpha*Tp/2) * Tp*2/pi = totalUpperIntegral
      //             (our approximation of the integral up to Tp)
      // writing x for e^alpha,
      // have E0*x^Te*s = -1 and E0 * x^(Tp/2) * Tp*2/pi = totalUpperIntegral
      // dividing the second by the first,
      // letting y = x^(Tp/2 - Te),
      // y * Tp*2 / (pi*s) = -totalUpperIntegral;
      const y = -Math.PI * s * totalUpperIntegral / (tp * 2);
      const z = Math.log(y);
      const alpha = z / (tp / 2 - te);
      const e0 = -1 / (s * Math.exp(alpha * te));

      this.alpha = alpha;
      this.e0 = e0;
      this.epsilon = epsilon;
      this.shift = shift;
      this.delta = delta;
      this.te = te;
      this.omega = omega;
   }

   private normalizedLFWaveform(t: number) {
      let output;
      if (t > this.te) {
         output = (-Math.exp(-this.epsilon * (t - this.te)) + this.shift) / this.delta;
      } else {
         output = this.e0 * Math.exp(this.alpha * t) * Math.sin(this.omega * t);
      }
      return output * this.intensity * this.loudness;
//    return Math.sin(this.omega * t);                     // (sine wave version)
   }
}
