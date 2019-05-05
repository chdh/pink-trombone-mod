import {Glottis} from "./Glottis";
import * as Utils from "./Utils";
import {clamp, interpolate} from "./Utils";

export interface Transient {
   position:                           number;
   startTime:                          number;
   lifeTime:                           number;             // in seconds
   strength:                           number;
   exponent:                           number;
}

export interface TurbulencePoint {
   position:                           number;
   diameter:                           number;
   startTime:                          number;
   endTime:                            number;             // NaN if not yet ended
}

export class Tract {
   private glottis:                    Glottis;
   private tractSampleRate:            number;             // tract sample rate is twice the normal sample rate
   private fricationNoiseSource:       () => number;

   public  readonly n                  = 44;               // number waveguide cells for the main vocal tract
   public  readonly bladeStart         = 10;
   public  readonly tipStart           = 32;
   public  readonly lipStart           = 39;
   public  readonly noseLength         = 28;               // number of nose cells
   public  readonly noseStart          = this.n - this.noseLength + 1;
   private readonly glottalReflection  = 0.75;
   private readonly lipReflection      = -0.85;

   private sampleCount                 = 0;
   public  time                        = 0;

   private right:                      Float64Array;       // waveguide components going right
   private left:                       Float64Array;       // waveguide components going left
   private reflection:                 Float64Array;
   private newReflection:              Float64Array;
   private junctionOutputRight:        Float64Array;
   private junctionOutputLeft:         Float64Array;
   public  maxAmplitude:               Float64Array;       // max amplitudes per waveguide cell (read-only from outside)
   public  diameter:                   Float64Array;       // vocal tract cell diameters

   public  transients:                 Transient[] = [];
   public  turbulencePoints:           TurbulencePoint[] = [];

   private noseRight:                  Float64Array;
   private noseLeft:                   Float64Array;
   private noseJunctionOutputRight:    Float64Array;
   private noseJunctionOutputLeft:     Float64Array;
   private noseReflection:             Float64Array;
   public  noseDiameter:               Float64Array;       // nose diameters, [0] = velum opening
   public  noseMaxAmplitude:           Float64Array;       // max amplitudes per waveguide cell for nose (read-only from outside)

   private reflectionLeft:             number;             // nose junction parameters
   private newReflectionLeft:          number;
   private reflectionRight:            number;
   private newReflectionRight:         number;
   private reflectionNose:             number;
   private newReflectionNose:          number;

   constructor(glottis: Glottis, tractSampleRate: number) {
      this.glottis = glottis;
      this.tractSampleRate = tractSampleRate;
      this.fricationNoiseSource = Utils.createFilteredNoiseSource(1000, 0.5, tractSampleRate, 0x8000);
      this.diameter = new Float64Array(this.n);
      this.right = new Float64Array(this.n);
      this.left = new Float64Array(this.n);
      this.reflection = new Float64Array(this.n);
      this.newReflection = new Float64Array(this.n);
      this.junctionOutputRight = new Float64Array(this.n);
      this.junctionOutputLeft = new Float64Array(this.n + 1);
      this.maxAmplitude = new Float64Array(this.n);
      this.noseRight = new Float64Array(this.noseLength);
      this.noseLeft = new Float64Array(this.noseLength);
      this.noseJunctionOutputRight = new Float64Array(this.noseLength);
      this.noseJunctionOutputLeft = new Float64Array(this.noseLength + 1);
      this.noseReflection = new Float64Array(this.noseLength);
      this.noseDiameter = new Float64Array(this.noseLength);
      this.noseMaxAmplitude = new Float64Array(this.noseLength);
      this.newReflectionLeft = 0;
      this.newReflectionRight = 0;
      this.newReflectionNose = 0;
   }

   public calculateNoseReflections() {
      const a = new Float64Array(this.noseLength);
      for (let i = 0; i < this.noseLength; i++) {
         a[i] = Math.max(1E-6, this.noseDiameter[i] ** 2);
      }
      for (let i = 1; i < this.noseLength; i++) {
         this.noseReflection[i] = (a[i - 1] - a[i]) / (a[i - 1] + a[i]);
      }
   }

   // Calculates the new reflection coefficients for the main tract and the nose/velum junction.
   public calculateNewBlockParameters() {
      this.calculateMainTractReflections();
      this.calculateNoseJunctionReflections();
   }

   private calculateMainTractReflections() {
      const a = new Float64Array(this.n);
      for (let i = 0; i < this.n; i++) {
         a[i] = this.diameter[i] ** 2;
      }
      for (let i = 1; i < this.n; i++) {
         this.reflection[i] = this.newReflection[i];
         const sum = a[i - 1] + a[i];
         this.newReflection[i] = (Math.abs(sum) > 1E-6) ? (a[i - 1] - a[i]) / sum : 1;
      }
   }

   private calculateNoseJunctionReflections() {
      this.reflectionLeft  = this.newReflectionLeft;
      this.reflectionRight = this.newReflectionRight;
      this.reflectionNose  = this.newReflectionNose;
      const velumA = this.noseDiameter[0] ** 2;
      const an0 = this.diameter[this.noseStart] ** 2;
      const an1 = this.diameter[this.noseStart + 1] ** 2;
      const sum = an0 + an1 + velumA;
      this.newReflectionLeft  = (Math.abs(sum) > 1E-6) ? (2 * an0    - sum) / sum : 1;
      this.newReflectionRight = (Math.abs(sum) > 1E-6) ? (2 * an1    - sum) / sum : 1;
      this.newReflectionNose  = (Math.abs(sum) > 1E-6) ? (2 * velumA - sum) / sum : 1;
   }

   // `lambda` is used for linear interpolation between the calculated reflection values.
   public step(glottalOutput: number, lambda: number): number {

      // mouth
      this.processTransients();
      this.addTurbulenceNoise();

      // this.glottalReflection = -0.8 + 1.6 * this.glottis.newTenseness;
      this.junctionOutputRight[0] = this.left[0] * this.glottalReflection + glottalOutput;
      this.junctionOutputLeft[this.n] = this.right[this.n - 1] * this.lipReflection;

      for (let i = 1; i < this.n; i++) {
         const r = interpolate(this.reflection[i],  this.newReflection[i], lambda);
         const w = r * (this.right[i - 1] + this.left[i]);
         this.junctionOutputRight[i] = this.right[i - 1] - w;
         this.junctionOutputLeft[i] = this.left[i] + w;
      }

      // now at junction with nose
      {
         const i = this.noseStart;
         let r = interpolate(this.reflectionLeft, this.newReflectionLeft, lambda);
         this.junctionOutputLeft[i] = r * this.right[i - 1] + (1 + r) * (this.noseLeft[0] + this.left[i]);
         r = interpolate(this.reflectionRight, this.newReflectionRight, lambda);
         this.junctionOutputRight[i] = r * this.left[i] + (1 + r) * (this.right[i - 1] + this.noseLeft[0]);
         r = interpolate(this.reflectionNose, this.newReflectionNose, lambda);
         this.noseJunctionOutputRight[0] = r * this.noseLeft[0] + (1 + r) * (this.left[i] + this.right[i - 1]);
      }

      for (let i = 0; i < this.n; i++) {
         const right = this.junctionOutputRight[i] * 0.999;
         const left  = this.junctionOutputLeft[i + 1] * 0.999;
         this.right[i] = right;
         this.left[i]  = left;
         const amplitude = Math.abs(right + left);
         this.maxAmplitude[i] = Math.max(this.maxAmplitude[i] *= 0.9999, amplitude);
      }

      const lipOutput = this.right[this.n - 1];

      // nose
      this.noseJunctionOutputLeft[this.noseLength] = this.noseRight[this.noseLength - 1] * this.lipReflection;

      for (let i = 1; i < this.noseLength; i++) {
         const w = this.noseReflection[i] * (this.noseRight[i - 1] + this.noseLeft[i]);
         this.noseJunctionOutputRight[i] = this.noseRight[i - 1] - w;
         this.noseJunctionOutputLeft[i] = this.noseLeft[i] + w;
      }

      for (let i = 0; i < this.noseLength; i++) {
         const right = this.noseJunctionOutputRight[i];
         const left  = this.noseJunctionOutputLeft[i + 1];
         this.noseRight[i] = right;
         this.noseLeft[i] = left;
         const amplitude = Math.abs(right + left);
         this.noseMaxAmplitude[i] = Math.max(this.noseMaxAmplitude[i] *= 0.9999, amplitude);
      }

      const noseOutput = this.noseRight[this.noseLength - 1];

      this.sampleCount++;
      this.time = this.sampleCount / this.tractSampleRate;

      return lipOutput + noseOutput;
   }

   private processTransients() {
      for (let i = this.transients.length - 1; i >= 0; i--) {
         const trans = this.transients[i];
         const timeAlive = this.time - trans.startTime;
         if (timeAlive > trans.lifeTime) {
            this.transients.splice(i, 1);
            continue;
         }
         const amplitude = trans.strength * Math.pow(2, -trans.exponent * timeAlive);
         this.right[trans.position] += amplitude / 2;
         this.left[trans.position] += amplitude / 2;
      }
   }

   private addTurbulenceNoise() {
      const fricativeAttackTime = 0.1;                     // 0.1 seconds
      for (const p of this.turbulencePoints) {
         if (p.position < 2 || p.position > this.n) {
            continue;
         }
         if (p.diameter <= 0) {
            continue;
         }
         let intensity;
         if (isNaN(p.endTime)) {
            intensity = clamp((this.time - p.startTime) / fricativeAttackTime, 0, 1);
         } else {                                          // point has been released
            intensity = clamp(1 - (this.time - p.endTime) / fricativeAttackTime, 0, 1);
         }
         if (intensity <= 0) {
            continue;
         }
         const turbulenceNoise = 0.66 * this.fricationNoiseSource() * intensity * this.glottis.getNoiseModulator();
         this.addTurbulenceNoiseAtPosition(turbulenceNoise, p.position, p.diameter);
      }
   }

   private addTurbulenceNoiseAtPosition(turbulenceNoise: number, position: number, diameter: number) {
      const i = Math.floor(position);
      const delta = position - i;
      const thinness0 = clamp(8 * (0.7 - diameter), 0, 1);
      const openness = clamp(30 * (diameter - 0.3), 0, 1);
      const noise0 = turbulenceNoise * (1 - delta) * thinness0 * openness;
      const noise1 = turbulenceNoise * delta * thinness0 * openness;
      if (i + 1 < this.n) {
         this.right[i + 1] += noise0 / 2;
         this.left[i + 1]  += noise0 / 2;
      }
      if (i + 2 < this.n) {
         this.right[i + 2] += noise1 / 2;
         this.left[i + 2]  += noise1 / 2;
      }
   }
}
