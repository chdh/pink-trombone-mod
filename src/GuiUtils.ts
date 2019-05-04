export const palePink = "#FFEEF5";

export interface AppTouch {                                // info associated with a touch or mouse click
   alive:                    boolean;                      // initially true, set to false when touch or mouse button is released
   x:                        number;                       // x position in canvas coordinate units
   y:                        number;                       // y position in canvas coordinate units
   id:                       number | string;              // reference to browser touch object
   index:                    number;                       // position within vocal tract
   diameter:                 number;                       // relative distance from outer radius
   startTime:                number;                       // time when the AppTouch object was created and alive was set to true
   endTime:                  number; }                     // time when alive was set to false

export class Button {

   private x:                number;
   private y:                number;
   private width:            number;
   private height:           number;
   private text:             string;
   public  switchedOn:       boolean;

   constructor(x: number, y: number, width: number, height: number, text: string, switchedOn: boolean) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.text = text;
      this.switchedOn = switchedOn;
   }

   public draw(ctx: CanvasRenderingContext2D) {
      const radius = 10;
      ctx.save();
      ctx.strokeStyle = palePink;
      ctx.fillStyle = palePink;
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2 * radius;

      ctx.beginPath();
      ctx.moveTo(this.x + radius, this.y + radius);
      ctx.lineTo(this.x + this.width - radius, this.y + radius);
      ctx.lineTo(this.x + this.width - radius, this.y + this.height - radius);
      ctx.lineTo(this.x + radius, this.y + this.height - radius);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      if (this.switchedOn) {
         ctx.fillStyle = "orchid";
         ctx.globalAlpha = 0.6;
      } else {
         ctx.fillStyle = "white";
         ctx.globalAlpha = 1;
      }
      this.drawText(ctx);
      ctx.restore();
   }

   private drawText(ctx: CanvasRenderingContext2D) {
      ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2 + 6);
   }

   public handleTouchStart(touch: AppTouch) {
      if (touch.x >= this.x && touch.x <= this.x + this.width && touch.y >= this.y && touch.y <= this.y + this.height) {
         this.switchedOn = !this.switchedOn;
      }
   }
}

export function mapDomToCanvasCoordinates(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
   const rect = canvas.getBoundingClientRect();
   const x1 = clientX - rect.left - (canvas.clientLeft || 0);
   const y1 = clientY - rect.top  - (canvas.clientTop || 0);
      // The canvas element may have a border, but must have no padding.
      // In the future, the CSSOM View Module can probably be used for proper coordinate mapping.
   const x = x1 / rect.width  * canvas.width;
   const y = y1 / rect.height * canvas.height;
   return {x, y};
}
