import {Tract, Transient} from "./Tract";
import {moveTowards} from "./Utils";

const gridOffset                       = 1.7;

export class TractShaper {
   private tract:                      Tract;

   private readonly movementSpeed      = 15;               // speed of vocal tract wall movement in cm per second
   public  readonly velumOpenTarget    = 0.4;
   public  readonly velumClosedTarget  = 0.01;

   public  targetDiameter:             Float64Array;       // target diameters of the waveguide cells for the main vocal tract
   public  velumTarget:                number;             // target value for velum opening
   public  tongueIndex:                number;
   public  tongueDiameter:             number;

   private lastObstruction             = -1;

   constructor(tract: Tract) {
      this.tract = tract;
      this.targetDiameter = new Float64Array(tract.n);
      this.tongueIndex = 12.9;
      this.tongueDiameter = 2.43;
      this.shapeNose(true);
      tract.calculateNoseReflections();                    // (nose reflections are calculated only once, but with open velum)
      this.shapeNose(false);
      this.shapeMainTract();
   }

   private shapeMainTract() {
      const tract = this.tract;
      for (let i = 0; i < tract.n; i++) {
         const d = this.getRestDiameter(i);
         tract.diameter[i] = d;
         this.targetDiameter[i] = d;
      }
   }

   public getRestDiameter(i: number) {
      const tract = this.tract;
      if (i < 7) {
         return 0.6;
      }
      if (i < tract.bladeStart) {
         return 1.1;
      }
      if (i >= tract.lipStart) {
         return 1.5;
      }
      const t = 1.1 * Math.PI * (this.tongueIndex - i) / (tract.tipStart - tract.bladeStart);
      const fixedTongueDiameter = 2 + (this.tongueDiameter - 2) / 1.5;
      let curve = (1.5 - fixedTongueDiameter + gridOffset) * Math.cos(t);
      if (i == tract.bladeStart - 2 || i == tract.lipStart - 1) {
         curve *= 0.8;
      }
      if (i == tract.bladeStart || i == tract.lipStart - 2) {
         curve *= 0.94;
      }
      return 1.5 - curve;
   }

   // Adjusts the shape of the tract towards the target values.
   public adjustTractShape(deltaTime: number) {
      const tract = this.tract;
      const amount = deltaTime * this.movementSpeed;
      let newLastObstruction = -1;
      for (let i = 0; i < tract.n; i++) {
         const diameter = tract.diameter[i];
         const targetDiameter = this.targetDiameter[i];
         if (diameter <= 0) {
            newLastObstruction = i;
         }
         let slowReturn;
         if (i < tract.noseStart) {
            slowReturn = 0.6;
         } else if (i >= tract.tipStart) {
            slowReturn = 1;
         } else {
            slowReturn = 0.6 + 0.4 * (i - tract.noseStart) / (tract.tipStart - tract.noseStart);
         }
         tract.diameter[i] = moveTowards(diameter, targetDiameter, slowReturn * amount, 2 * amount);
      }
      if (this.lastObstruction > -1 && newLastObstruction == -1 && tract.noseDiameter[0] < 0.223) {
         this.addTransient(this.lastObstruction);
      }
      this.lastObstruction = newLastObstruction;
      // Adjust velum opening:
      tract.noseDiameter[0] = moveTowards(tract.noseDiameter[0], this.velumTarget, amount * 0.25, amount * 0.1);
   }

   private addTransient(position: number) {
      const tract = this.tract;
      const transient: Transient = {
         position:  position,
         startTime: tract.time,
         lifeTime:  0.2,
         strength:  0.3,
         exponent:  200
      };
      tract.transients.push(transient);
   }

   private shapeNose(velumOpen: boolean) {
      const tract = this.tract;
      this.velumTarget = velumOpen ? this.velumOpenTarget : this.velumClosedTarget;
      for (let i = 0; i < tract.noseLength; i++) {
         let diameter: number;
         const d = 2 * (i / tract.noseLength);
         if (i == 0) {
            diameter = this.velumTarget;
         } else if (d < 1) {
            diameter = 0.4 + 1.6 * d;
         } else {
            diameter = 0.5 + 1.5 * (2 - d);
         }
         diameter = Math.min(diameter, 1.9);
         tract.noseDiameter[i] = diameter;
      }
   }

}
