import {Tract, TurbulencePoint} from "./Tract";
import {TractShaper} from "./TractShaper";
import * as GuiUtils from "./GuiUtils";
import {AppTouch} from "./GuiUtils";
import * as Utils from "./Utils";

const originX                        = 340;                // x coordinate of the center of the circle
const originY                        = 449;                // y coordinate of the center of the circle
const radius                         = 298;                // radius of the outer circle
const scale                          = 60;                 // radial scaling factor
const fillColour                     = 'pink';
const lineColour                     = '#C070C6';
const angleScale                     = 0.64;
const angleOffset                    = -0.24;
const noseOffset                     = 0.8;
const innerTongueControlRadius       = 2.05;
const outerTongueControlRadius       = 3.5;

export class TractUi  {
   private tract:                      Tract;
   private tractShaper:                TractShaper;
   private ctx:                        CanvasRenderingContext2D;
   private tongueLowerIndexBound:      number;
   private tongueUpperIndexBound:      number;
   private tongueIndexCentre:          number;
   private tongueTouch:                GuiUtils.AppTouch | undefined;
   private guiWobbleTime               = 0;

   constructor(tract: Tract, tractShaper: TractShaper) {
      this.tract = tract;
      this.tractShaper = tractShaper;
      this.tongueLowerIndexBound = tract.bladeStart + 2;
      this.tongueUpperIndexBound = tract.tipStart - 3;
      this.tongueIndexCentre = 0.5 * (this.tongueLowerIndexBound + this.tongueUpperIndexBound);
   }

   // i = index = position within vocal tract
   // d = diameter of vocal tract = distance from outer circle / scale
   private getPolar(i: number, d: number, doWobble: boolean = false) {
      let angle = angleOffset + i * angleScale * Math.PI / (this.tract.lipStart - 1);
      let r = radius - scale * d;
      if (doWobble) {
         const wobble = this.getWobble(i);
         angle += wobble;
         r += 100 * wobble;
      }
      return {angle, r};
   }

   private getWobble(i: number) {
      const tract = this.tract;
      return (tract.maxAmplitude[tract.n - 1] + tract.noseMaxAmplitude[tract.noseLength - 1]) * 0.03 * Math.sin(2 * i - 50 * this.guiWobbleTime) * i / tract.n;
   }

   private moveTo(i: number, d: number) {
      const p = this.getPolar(i, d, true);
      this.ctx.moveTo(originX - p.r * Math.cos(p.angle), originY - p.r * Math.sin(p.angle));
   }

   private lineTo(i: number, d: number) {
      const p = this.getPolar(i, d, true);
      this.ctx.lineTo(originX - p.r * Math.cos(p.angle), originY - p.r * Math.sin(p.angle));
   }

   private drawText(i: number, d: number, text: string) {
      const ctx = this.ctx;
      const p = this.getPolar(i, d);
      ctx.save();
      ctx.translate(originX - p.r * Math.cos(p.angle), originY - p.r * Math.sin(p.angle) + 2);
      ctx.rotate(p.angle - Math.PI / 2);
      ctx.fillText(text, 0, 0);
      ctx.restore();
   }

   private drawTextStraight(i: number, d: number, text: string) {
      const ctx = this.ctx;
      const p = this.getPolar(i, d);
      ctx.save();
      ctx.translate(originX - p.r * Math.cos(p.angle), originY - p.r * Math.sin(p.angle) + 2);
      ctx.fillText(text, 0, 0);
      ctx.restore();
   }

   private drawCircle(i: number, d: number, circleRadius: number) {
      const ctx = this.ctx;
      const p = this.getPolar(i, d);
      ctx.beginPath();
      ctx.arc(originX - p.r * Math.cos(p.angle), originY - p.r * Math.sin(p.angle), circleRadius, 0, 2 * Math.PI);
      ctx.fill();
   }

   // Returns the vocal tract position for an x/y coordinate.
   public getIndex(x: number, y: number) {
      const xx = x - originX;
      const yy = y - originY;
      let angle = Math.atan2(yy, xx);
      while (angle > 0) {
         angle -= 2 * Math.PI;
      }
      return (Math.PI + angle - angleOffset) * (this.tract.lipStart - 1) / (angleScale * Math.PI);
   }

   // Returns the scaled distance from the outer circle.
   public getDiameter(x: number, y: number) {
      const xx = x - originX;
      const yy = y - originY;
      return (radius - Math.sqrt(xx * xx + yy * yy)) / scale;
   }

   public draw(ctx: CanvasRenderingContext2D) {
      this.ctx = ctx;
      const tract = this.tract;
      this.guiWobbleTime = Utils.getTime();

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      this.drawTongueControl();

      const velum = tract.noseDiameter[0];
      const velumAngle = velum * 4;

      // first draw fill
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = fillColour;
      ctx.fillStyle = fillColour;
      this.moveTo(1, 0);
      for (let i = 1; i < tract.n; i++) {
         this.lineTo(i, tract.diameter[i]);
      }
      for (let i = tract.n - 1; i >= 2; i--) {
         this.lineTo(i, 0);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      // for nose
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = fillColour;
      ctx.fillStyle = fillColour;
      this.moveTo(tract.noseStart, -noseOffset);
      for (let i = 1; i < tract.noseLength; i++) {
         this.lineTo(i + tract.noseStart, -noseOffset - tract.noseDiameter[i] * 0.9);
      }
      for (let i = tract.noseLength - 1; i >= 1; i--) {
         this.lineTo(i + tract.noseStart, -noseOffset);
      }
      ctx.closePath();
      this.ctx.fill();

      // velum
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = fillColour;
      ctx.fillStyle = fillColour;
      this.moveTo(tract.noseStart - 2, 0);
      this.lineTo(tract.noseStart, -noseOffset);
      this.lineTo(tract.noseStart + velumAngle, -noseOffset);
      this.lineTo(tract.noseStart + velumAngle - 2, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      // white text
      ctx.fillStyle = "white";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.globalAlpha = 1;
      this.drawText(tract.n * 0.10, 0.425, "throat");
      this.drawText(tract.n * 0.71, -1.8, "nasal");
      this.drawText(tract.n * 0.71, -1.3, "cavity");
      ctx.font = "22px Arial";
      this.drawText(tract.n * 0.6, 0.9, "oral");
      this.drawText(tract.n * 0.7, 0.9, "cavity");

      this.drawAmplitudes();

      // then draw lines
      ctx.beginPath();
      ctx.lineWidth = 5;
      ctx.strokeStyle = lineColour;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      this.moveTo(1, tract.diameter[0]);
      for (let i = 2; i < tract.n; i++) {
         this.lineTo(i, tract.diameter[i]);
      }
      this.moveTo(1, 0);
      for (let i = 2; i <= tract.noseStart - 2; i++) {
         this.lineTo(i, 0);
      }
      this.moveTo(tract.noseStart + velumAngle - 2, 0);
      for (let i = tract.noseStart + Math.ceil(velumAngle) - 2; i < tract.n; i++) {
         this.lineTo(i, 0);
      }
      ctx.stroke();

      // for nose
      ctx.beginPath();
      ctx.lineWidth = 5;
      ctx.strokeStyle = lineColour;
      ctx.lineJoin = 'round';
      this.moveTo(tract.noseStart, -noseOffset);
      for (let i = 1; i < tract.noseLength; i++) {
         this.lineTo(i + tract.noseStart, -noseOffset - tract.noseDiameter[i] * 0.9);
      }
      this.moveTo(tract.noseStart + velumAngle, -noseOffset);
      for (let i = Math.ceil(velumAngle); i < tract.noseLength; i++) {
         this.lineTo(i + tract.noseStart, -noseOffset);
      }
      ctx.stroke();

      // velum
      ctx.globalAlpha = velum * 5;
      ctx.beginPath();
      this.moveTo(tract.noseStart - 2, 0);
      this.lineTo(tract.noseStart, -noseOffset);
      this.moveTo(tract.noseStart + velumAngle - 2, 0);
      this.lineTo(tract.noseStart + velumAngle, -noseOffset);
      ctx.stroke();

      ctx.fillStyle = "orchid";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.7;
      this.drawText(tract.n * 0.95, 0.8 + 0.8 * tract.diameter[tract.n - 1], " lip");

      ctx.restore();
   }

   public drawBackground(ctx: CanvasRenderingContext2D) {
      this.ctx = ctx;
      const tract = this.tract;
      ctx.save();

      //text
      ctx.fillStyle = "orchid";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.7;
      this.drawText(tract.n * 0.44, -0.28, "soft");
      this.drawText(tract.n * 0.51, -0.28, "palate");
      this.drawText(tract.n * 0.77, -0.28, "hard");
      this.drawText(tract.n * 0.84, -0.28, "palate");
      this.drawText(tract.n * 0.95, -0.28, " lip");

      ctx.font = "17px Arial";
      this.drawTextStraight(tract.n * 0.18, 3, "  tongue control");
      ctx.textAlign = "left";
      this.drawText(tract.n * 1.03, -1.07, "nasals");
      this.drawText(tract.n * 1.03, -0.28, "stops");
      this.drawText(tract.n * 1.03, 0.51, "fricatives");
      // this.drawTextStraight(1.5, 0.8, "glottis")
      ctx.strokeStyle = "orchid";
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.moveTo(tract.n * 1.03, 0);
      this.lineTo(tract.n * 1.07, 0);
      this.moveTo(tract.n * 1.03, -noseOffset);
      this.lineTo(tract.n * 1.07, -noseOffset);
      ctx.stroke();

      ctx.restore();
   }

   private drawAmplitudes() {
      const ctx = this.ctx;
      const tract = this.tract;
      ctx.strokeStyle = "orchid";
      ctx.lineCap = "butt";
      ctx.globalAlpha = 0.3;
      for (let i = 2; i < tract.n - 1; i++) {
         ctx.beginPath();
         ctx.lineWidth = Math.sqrt(tract.maxAmplitude[i]) * 3;
         this.moveTo(i, 0);
         this.lineTo(i, tract.diameter[i]);
         ctx.stroke();
      }
      for (let i = 1; i < tract.noseLength - 1; i++) {
         ctx.beginPath();
         ctx.lineWidth = Math.sqrt(tract.noseMaxAmplitude[i]) * 3;
         this.moveTo(i + tract.noseStart, -noseOffset);
         this.lineTo(i + tract.noseStart, -noseOffset - tract.noseDiameter[i] * 0.9);
         ctx.stroke();
      }
      ctx.globalAlpha = 1;
   }

   private drawTongueControl() {
      const ctx = this.ctx;
      const tract = this.tract;
      const tractShaper = this.tractShaper;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = GuiUtils.palePink;
      ctx.fillStyle = GuiUtils.palePink;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.lineWidth = 45;

      //outline
      this.moveTo(this.tongueLowerIndexBound, innerTongueControlRadius);
      for (let i = this.tongueLowerIndexBound + 1; i <= this.tongueUpperIndexBound; i++) {
         this.lineTo(i, innerTongueControlRadius);
      }
      this.lineTo(this.tongueIndexCentre, outerTongueControlRadius);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      {
         const a = innerTongueControlRadius;
         const c = outerTongueControlRadius;
         const b = 0.5 * (a + c);
         const r = 3;
         ctx.fillStyle = "orchid";
         ctx.globalAlpha = 0.3;
         this.drawCircle(this.tongueIndexCentre, a, r);
         this.drawCircle(this.tongueIndexCentre - 4.25, a, r);
         this.drawCircle(this.tongueIndexCentre - 8.5, a, r);
         this.drawCircle(this.tongueIndexCentre + 4.25, a, r);
         this.drawCircle(this.tongueIndexCentre + 8.5, a, r);
         this.drawCircle(this.tongueIndexCentre - 6.1, b, r);
         this.drawCircle(this.tongueIndexCentre + 6.1, b, r);
         this.drawCircle(this.tongueIndexCentre, b, r);
         this.drawCircle(this.tongueIndexCentre, c, r);
      }

      ctx.globalAlpha = 1;

      // circle for tongue position
      {
         const angle = angleOffset + tractShaper.tongueIndex * angleScale * Math.PI / (tract.lipStart - 1);
         const r = radius - scale * tractShaper.tongueDiameter;
         const x = originX - r * Math.cos(angle);
         const y = originY - r * Math.sin(angle);
         ctx.lineWidth = 4;
         ctx.strokeStyle = "orchid";
         ctx.globalAlpha = 0.7;
         ctx.beginPath();
         ctx.arc(x, y, 18, 0, 2 * Math.PI);
         ctx.stroke();
         ctx.globalAlpha = 0.15;
         ctx.fill();
         ctx.globalAlpha = 1;
      }

      ctx.fillStyle = "orchid";
   }

   public handleTouches(touches: AppTouch[], time: number) {
      const tract = this.tract;
      const tractShaper = this.tractShaper;
      this.handleTongueTouch(touches, time);
      tract.turbulencePoints = this.generateTurbulencePoints(touches);
      for (let i = 0; i < tract.n; i++) {
         tractShaper.targetDiameter[i] = tractShaper.getRestDiameter(i);
      }
      let velumOpen = false;
      for (const touch of touches) {
         if (!touch.alive) {
            continue;
         }
         const x = touch.x;
         const y = touch.y;
         const index = this.getIndex(x, y);
         const diameter1 = this.getDiameter(x, y);
         if (index > tract.noseStart && diameter1 < -noseOffset) {
            velumOpen = true;
         }
         if (diameter1 < -0.85 - noseOffset) {
            continue;
         }
         const diameter2 = Math.max(0, diameter1 - 0.3);
         this.reduceTargetDiametersByTouch(index, diameter2);
      }
      tractShaper.velumTarget = velumOpen ? tractShaper.velumOpenTarget : tractShaper.velumClosedTarget;
   }

   private reduceTargetDiametersByTouch(index: number, diameter: number) {
      const tract = this.tract;
      const tractShaper = this.tractShaper;
      if (index < 2 || index >= tract.n || diameter >= 3) {
         return;
      }
      let width;
      if (index < 25) {
         width = 10;
      } else if (index >= tract.tipStart) {
         width = 5;
      } else {
         width = 10 - 5 * (index - 25) / (tract.tipStart - 25);
      }
      for (let i = -Math.ceil(width) - 1; i < width + 1; i++) {
         const p = Math.round(index) + i;
         if (p < 0 || p >= tract.n) {
            continue;
         }
         const relpos = Math.abs(p - index) - 0.5;
         let shrink;
         if (relpos <= 0) {
            shrink = 0;
         } else if (relpos > width) {
            shrink = 1;
         } else {
            shrink = 0.5 * (1 - Math.cos(Math.PI * relpos / width));
         }
         if (diameter < tractShaper.targetDiameter[p]) {
            tractShaper.targetDiameter[p] = diameter + (tractShaper.targetDiameter[p] - diameter) * shrink;
         }
      }
   }

   private generateTurbulencePoints(touches: AppTouch[]): TurbulencePoint[] {
      const a: TurbulencePoint[] = [];
      for (const touch of touches) {
         const p: TurbulencePoint = {
            position:  touch.index,
            diameter:  touch.diameter,
            startTime: touch.startTime,
            endTime:   touch.alive ? NaN : touch.endTime
         };
         a.push(p);
      }
      return a;
   }

   private handleTongueTouch(touches: AppTouch[], time: number) {
      const tractShaper = this.tractShaper;

      // Update tongueTouch.
      if (this.tongueTouch && !this.tongueTouch.alive) {
         this.tongueTouch = undefined;
      }
      if (!this.tongueTouch) {
         for (const touch of touches) {
            if (!touch.alive) {
               continue;
            }
            if (time - touch.startTime > 0.1) {               // only new touches will pass this
               continue;
            }
            const x = touch.x;
            const y = touch.y;
            const index = this.getIndex(x, y);
            const diameter = this.getDiameter(x, y);
            if (index >= this.tongueLowerIndexBound - 4 && index <= this.tongueUpperIndexBound + 4 &&
               diameter >= innerTongueControlRadius - 0.5 && diameter <= outerTongueControlRadius + 0.5) {
               this.tongueTouch = touch;
            }
         }
      }

      // Update tongueIndex and tongueDiameter.
      if (this.tongueTouch) {
         const x = this.tongueTouch.x;
         const y = this.tongueTouch.y;
         const index = this.getIndex(x, y);
         const diameter = this.getDiameter(x, y);
         let fromPoint = (outerTongueControlRadius - diameter) / (outerTongueControlRadius - innerTongueControlRadius);
         fromPoint = Utils.clamp(fromPoint, 0, 1);
         fromPoint = Math.pow(fromPoint, 0.58) - 0.2 * (fromPoint * fromPoint - fromPoint);                // horrible kludge to fit curve to straight line
         tractShaper.tongueDiameter = Utils.clamp(diameter, innerTongueControlRadius, outerTongueControlRadius);
         const out = fromPoint * 0.5 * (this.tongueUpperIndexBound - this.tongueLowerIndexBound);
         tractShaper.tongueIndex = Utils.clamp(index, this.tongueIndexCentre - out, this.tongueIndexCentre + out);
      }
   }
}
