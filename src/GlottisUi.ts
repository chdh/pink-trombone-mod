import {Glottis} from "./Glottis";
import * as GuiUtils from "./GuiUtils";
import {AppTouch} from "./GuiUtils";
import * as Utils from "./Utils";

const baseNote               = 87.3071;                    // F
const marks                  = [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0];
const keyboardTop            = 500;
const keyboardLeft           = 0;
const keyboardWidth          = 600;
const keyboardHeight         = 100;
const semitones              = 20;

export class GlottisUi {

   private pitchControlX     = 240;
   private pitchControlY     = 530;

   private glottis:          Glottis;

   private touch:            GuiUtils.AppTouch | undefined;

   constructor(glottis: Glottis) {
      this.glottis = glottis;
   }

   public drawBackground(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.strokeStyle = GuiUtils.palePink;
      ctx.fillStyle = GuiUtils.palePink;
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      this.drawBar(ctx, 0, 0.4, 8);
      ctx.globalAlpha = 0.7;
      this.drawBar(ctx, 0.52, 0.72, 8);

      ctx.strokeStyle = "orchid";
      ctx.fillStyle = "orchid";
      for (let i = 0; i < semitones; i++) {
         const keyWidth = keyboardWidth / semitones;
         const x = keyboardLeft + (i + 1 / 2) * keyWidth;
         const y = keyboardTop;
         if (marks[(i + 3) % 12] == 1) {
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.4;
         } else {
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.2;
         }
         ctx.beginPath();
         ctx.moveTo(x, y + 9);
         ctx.lineTo(x, y + keyboardHeight * 0.4 - 9);
         ctx.stroke();

         ctx.lineWidth = 3;
         ctx.globalAlpha = 0.15;

         ctx.beginPath();
         ctx.moveTo(x, y + keyboardHeight * 0.52 + 6);
         ctx.lineTo(x, y + keyboardHeight * 0.72 - 6);
         ctx.stroke();
      }

      ctx.fillStyle = "orchid";
      ctx.font = "17px Arial";
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.7;
      ctx.fillText("voicebox control", 300, 490);
      ctx.fillText("pitch", 300, 592);
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = "orchid";
      ctx.fillStyle = "orchid";
      ctx.save();
      ctx.translate(410, 587);
      this.drawArrow(ctx, 80, 2, 10);
      ctx.translate(-220, 0);
      ctx.rotate(Math.PI);
      this.drawArrow(ctx, 80, 2, 10);
      ctx.restore();
      ctx.restore();
   }

   private drawBar(ctx: CanvasRenderingContext2D, topFactor: number, bottomFactor: number, radius: number) {
      ctx.lineWidth = radius * 2;
      ctx.beginPath();
      ctx.moveTo(keyboardLeft + radius, keyboardTop + topFactor * keyboardHeight + radius);
      ctx.lineTo(keyboardLeft + keyboardWidth - radius, keyboardTop + topFactor * keyboardHeight + radius);
      ctx.lineTo(keyboardLeft + keyboardWidth - radius, keyboardTop + bottomFactor * keyboardHeight - radius);
      ctx.lineTo(keyboardLeft + radius, keyboardTop + bottomFactor * keyboardHeight - radius);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
   }

   private drawArrow(ctx: CanvasRenderingContext2D, l: number, ahw: number, ahl: number) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-l, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(0, -ahw);
      ctx.lineTo(ahl, 0);
      ctx.lineTo(0, ahw);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
   }

   public draw(ctx: CanvasRenderingContext2D) {
      this.drawPitchControl(ctx, this.pitchControlX, this.pitchControlY);
   }

   private drawPitchControl(ctx: CanvasRenderingContext2D, x: number, y: number) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const w = 9;
      const h = 15;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "orchid";
      ctx.fillStyle = "orchid";
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(x - w, y - h);
      ctx.lineTo(x + w, y - h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x - w, y + h);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.restore();
   }

   public handleTouches(touches: AppTouch[]) {
      const glottis = this.glottis;
      if (this.touch && !this.touch.alive) {
         this.touch = undefined;
      }
      if (!this.touch) {
         for (const touch of touches) {
            if (!touch.alive) {
               continue;
            }
            if (touch.y < keyboardTop) {
               continue;
            }
            this.touch = touch;
         }
      }
      if (this.touch) {
         const localX = this.touch.x - keyboardLeft;
         const localY = Utils.clamp(this.touch.y - keyboardTop - 10, 0, keyboardHeight - 26);
         const semitone = semitones * localX / keyboardWidth + 0.5;
         glottis.targetFrequency = baseNote * Math.pow(2, semitone / 12);
         const t = Utils.clamp(1 - localY / (keyboardHeight - 28), 0, 1);
         glottis.targetTenseness = 1 - Math.cos(t * Math.PI / 2);
         this.pitchControlX = this.touch.x;
         this.pitchControlY = localY + keyboardTop + 10;
      }
      glottis.isTouched = !!this.touch;
   }
}
