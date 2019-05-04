import {Glottis} from "./Glottis";
import {Tract} from "./Tract";
import {TractShaper} from "./TractShaper";

const maxBlockLength = 512;

export class Synthesizer {
   public  glottis:                    Glottis;
   public  tract:                      Tract;
   public  tractShaper:                TractShaper;
   private sampleRate:                 number;

   constructor(sampleRate: number) {
      this.sampleRate = sampleRate;
      this.glottis = new Glottis(sampleRate);
      const tractSampleRate = 2 * sampleRate;                        // tract runs at twice the sample rate
      this.tract = new Tract(this.glottis, tractSampleRate);
      this.tractShaper = new TractShaper(this.tract);
   }

   public reset() {
      this.calculateNewBlockParameters(0);
   }

   public synthesize(buf: Float32Array | Float64Array) {
      let p = 0;
      while (p < buf.length) {
         const blockLength = Math.min(maxBlockLength, buf.length - p);
         const blockBuf = buf.subarray(p, p + blockLength);
         this.synthesizeBlock(blockBuf);
         p += blockLength;
      }
   }

   private synthesizeBlock(buf: Float32Array | Float64Array) {
      const n = buf.length;
      const deltaTime = n / this.sampleRate;
      this.calculateNewBlockParameters(deltaTime);
      for (let i = 0; i < n; i++) {
         const lambda1 = i / n;                                      // relative position within block
         const lambda2 = (i + 0.5) / n;
         const glottalOutput = this.glottis.step(lambda1);
         const vocalOutput1 = this.tract.step(glottalOutput, lambda1);
         const vocalOutput2 = this.tract.step(glottalOutput, lambda2);  // tract runs at twice the sample rate
         buf[i] = (vocalOutput1 + vocalOutput2) * 0.125;
      }
   }

   private calculateNewBlockParameters(deltaTime: number) {
      this.glottis.adjustParameters(deltaTime);
      this.tractShaper.adjustTractShape(deltaTime);
      this.tract.calculateNewBlockParameters();
   }
}
