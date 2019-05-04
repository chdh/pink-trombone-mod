import {Synthesizer} from "./Synthesizer";
import {Glottis} from "./Glottis";
import {GlottisUi} from "./GlottisUi";
import {TractUi} from "./TractUi";
import * as GuiUtils from "./GuiUtils";
import {AppTouch, Button} from "./GuiUtils";

export const enum Screen {main, instructions, about}

const projectUrl = "github.com/chdh/pink-tronbone-mod";

// Main user interface of the Pink Trombone voice synthesizer.
export class MainUi extends EventTarget {
   public screen: Screen;

   private synthesizer:              Synthesizer;
   private glottis:                  Glottis;
   private glottisUi:                GlottisUi;
   private tractUi:                  TractUi;
   private canvas:                   HTMLCanvasElement;
   private ctx:                      CanvasRenderingContext2D;
   private backCanvas:               HTMLCanvasElement;

   private touchesWithMouse:         AppTouch[];
   private instructionsLine:         number;
   private mouseTouch:               AppTouch;
   private aboutButton:              Button;
   private alwaysVoiceButton:        Button;
   private autoWobbleButton:         Button;
   private mouseTouchCtr             = 0;

   constructor(synthesizer: Synthesizer, canvas: HTMLCanvasElement) {
      super();
      this.synthesizer = synthesizer;
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d")!;
      this.glottis = synthesizer.glottis;
      this.glottisUi = new GlottisUi(synthesizer.glottis);
      this.tractUi = new TractUi(synthesizer.tract, synthesizer.tractShaper);
      this.touchesWithMouse = [];
      this.screen = Screen.about;
      this.aboutButton       = new Button(460, 392, 140, 30, "about...", true);
      this.alwaysVoiceButton = new Button(460, 428, 140, 30, "always voice", true);
      this.autoWobbleButton  = new Button(460, 464, 140, 30, "pitch wobble", true);
      canvas.addEventListener("touchstart",  (event) => this.touchStartEventHandler(event));
      canvas.addEventListener("touchmove",   (event) => this.touchMoveEventHandler(event));
      canvas.addEventListener("touchend",    (event) => this.touchEndEventHandler(event));
      canvas.addEventListener("touchcancel", (event) => this.touchEndEventHandler(event));
      canvas.addEventListener("mousedown",   (event) => this.mouseDownEventHandler(event));
      document.addEventListener("mouseup",   (event) => this.mouseUpEventHandler(event));
      document.addEventListener("mousemove", (event) => this.mouseMoveEventHandler(event));
      this.createBackgroundCanvas();
   }

   private createBackgroundCanvas() {
      this.backCanvas = document.createElement("canvas");
      this.backCanvas.width = this.canvas.width;
      this.backCanvas.height = this.canvas.height;
      const ctx = this.backCanvas.getContext("2d")!;
      this.glottisUi.drawBackground(ctx);
      this.tractUi.drawBackground(ctx);
   }

   private getTractTime() {
      return this.synthesizer.tract.time;
   }

   private switchScreen(screen: Screen) {
      this.screen = screen;
      this.aboutButton.switchedOn = true;
      this.dispatchEvent(new CustomEvent("screen-switched"));
   }

   public draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(this.backCanvas, 0, 0);
      this.glottisUi.draw(ctx);
      this.tractUi.draw(ctx);
      this.alwaysVoiceButton.draw(ctx);
      this.autoWobbleButton.draw(ctx);
      this.aboutButton.draw(ctx);
      switch (this.screen) {
         case Screen.about: {
            this.drawAboutScreen();
            break;
         }
         case Screen.instructions: {
            this.drawInstructionsScreen();
            break;
         }
      }
   }

   private drawAboutScreen() {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "white";
      ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fill();
      ctx.restore();
      this.drawAboutText();
   }

   private drawAboutText() {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#C070C6";
      ctx.strokeStyle = "#C070C6";
      ctx.font = "50px Arial";
      ctx.lineWidth = 3;
      ctx.textAlign = "center";
      const titleText = "P i n k   T r o m b o n e";
      ctx.strokeText(titleText, 300, 230);
      ctx.fillText(titleText, 300, 230);
      ctx.font = "28px Arial";
      ctx.fillText("bare-handed  speech synthesis", 300, 330);
      ctx.font = "20px Arial";
      ctx.restore();
   }

   private drawInstructionsScreen() {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "white";
      ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = "#C070C6";
      ctx.strokeStyle = "#C070C6";
      ctx.font = "24px Arial";
      ctx.lineWidth = 2;
      ctx.textAlign = "center";

      ctx.font = "19px Arial";
      ctx.textAlign = "left";
      this.instructionsLine = 0;
      this.write("Sound is generated in the glottis (at the bottom left) then ");
      this.write("filtered by the shape of the vocal tract. The voicebox ");
      this.write("controls the pitch and intensity of the initial sound.");
      this.write("");
      this.write("Then, to talk:");
      this.write("");
      this.write("- move the body of the tongue to shape vowels");
      this.write("");
      this.write("- touch the oral cavity to narrow it, for fricative consonants");
      this.write("");
      this.write("- touch above the oral cavity to close it, for stop consonants");
      this.write("");
      this.write("- touch the nasal cavity to open the velum and let sound ");
      this.write("   flow through the nose.");
      this.write("");
      this.write("");
      this.write("(tap anywhere to continue)");

//    ctx.textAlign = "center";
//    ctx.fillText("[tap here to RESET]", 470, 535);

      this.instructionsLine = 18.8;
      ctx.textAlign = "left";
      this.write("This is the demo program for the pink-trombone-mod package.");
      ctx.save();
      ctx.fillStyle = "blue";
      ctx.globalAlpha = 0.6;
      this.write(projectUrl);
      ctx.restore();
      this.write("Pink Trombone was developed by Neil Thapen in 2017.");

      ctx.restore();
   }

   private instructionsScreenHandleTouches(touches: TouchList) {
      for (const touch of touches) {
         const p = GuiUtils.mapDomToCanvasCoordinates(this.canvas, touch.clientX, touch.clientY);
         this.instructionsScreenHandleTouch(p.x, p.y);
      }
   }

   private instructionsScreenHandleTouch(x: number, y: number) {
      if ((x >= 35 && x <= 400) && (y >= 515 && y <= 540)) {
         window.location.href = "https://" + projectUrl;
      } else {
         this.switchScreen(Screen.main);
      }
   }

   private write(text: string) {
      this.ctx.fillText(text, 50, 100 + this.instructionsLine * 22);
      this.instructionsLine += (text == "") ? 0.7 : 1;
   }

   private buttonsHandleTouchStart(touch: AppTouch) {
      this.alwaysVoiceButton.handleTouchStart(touch);
      this.glottis.alwaysVoice = this.alwaysVoiceButton.switchedOn;
      this.autoWobbleButton.handleTouchStart(touch);
      this.glottis.autoWobble = this.autoWobbleButton.switchedOn;
      this.aboutButton.handleTouchStart(touch);
   }

   private touchStartEventHandler(event: TouchEvent) {
      event.preventDefault();
      switch (this.screen) {
         case Screen.main: {
            this.processStartTouches(event.changedTouches);
            this.handleTouches();
            break;
         }
         case Screen.about: {
            this.switchScreen(Screen.main);
            break;
         }
         case Screen.instructions: {
            this.instructionsScreenHandleTouches(event.changedTouches);
            break;
         }
      }
   }

   private processStartTouches(touches: TouchList) {
      for (const touch of touches) {
         const appTouch = <AppTouch>{};
         appTouch.startTime = this.getTractTime();
         appTouch.endTime = 0;
         appTouch.alive = true;
         appTouch.id = touch.identifier;
         this.updateAppTouchPosition(appTouch, touch.clientX, touch.clientY);
         this.touchesWithMouse.push(appTouch);
         this.buttonsHandleTouchStart(appTouch);
      }
   }

   private updateAppTouchPosition(appTouch: AppTouch, clientX: number, clientY: number) {
      const p = GuiUtils.mapDomToCanvasCoordinates(this.canvas, clientX, clientY);
      appTouch.x = p.x;
      appTouch.y = p.y;
      appTouch.index = this.tractUi.getIndex(p.x, p.y);
      appTouch.diameter = this.tractUi.getDiameter(p.x, p.y);
   }

   private getAppTouchById(id: number): AppTouch | undefined {
      for (const appTouch of this.touchesWithMouse) {
         if (appTouch.id == id && appTouch.alive) {
            return appTouch;
         }
      }
      return undefined;
   }

   private touchMoveEventHandler(event: TouchEvent) {
      for (const touch of event.changedTouches) {
         const appTouch = this.getAppTouchById(touch.identifier);
         if (appTouch) {
            this.updateAppTouchPosition(appTouch, touch.clientX, touch.clientY);
         }
      }
      this.handleTouches();
   }

   private touchEndEventHandler(event: TouchEvent) {
      for (const touch of event.changedTouches) {
         const appTouch = this.getAppTouchById(touch.identifier);
         if (appTouch) {
            appTouch.alive = false;
            appTouch.endTime = this.getTractTime();
         }
      }
      this.handleTouches();
      if (this.screen == Screen.main && !this.aboutButton.switchedOn) {
         this.switchScreen(Screen.instructions);
      }
   }

   private mouseDownEventHandler(event: MouseEvent) {
      event.preventDefault();
      switch (this.screen) {
         case Screen.main: {
            const appTouch = <AppTouch>{};
            appTouch.startTime = this.getTractTime();
            appTouch.endTime = 0;
            appTouch.alive = true;
            appTouch.id = "mouse" + this.mouseTouchCtr++;
            this.updateAppTouchPosition(appTouch, event.clientX, event.clientY);
            this.mouseTouch = appTouch;
            this.touchesWithMouse.push(appTouch);
            this.buttonsHandleTouchStart(appTouch);
            this.handleTouches();
            break;
         }
         case Screen.about: {
            this.switchScreen(Screen.main);
            break;
         }
         case Screen.instructions: {
            const p = GuiUtils.mapDomToCanvasCoordinates(this.canvas, event.clientX, event.clientY);
            this.instructionsScreenHandleTouch(p.x, p.y);
            break;
         }
      }
   }

   private mouseMoveEventHandler(event: MouseEvent) {
      const appTouch = this.mouseTouch;
      if (!appTouch || !appTouch.alive) {
         return;
      }
      this.updateAppTouchPosition(appTouch, event.clientX, event.clientY);
      this.handleTouches();
   }

   private mouseUpEventHandler(_event: MouseEvent) {
      const appTouch = this.mouseTouch;
      if (!appTouch || !appTouch.alive) {
         return;
      }
      appTouch.alive = false;
      appTouch.endTime = this.getTractTime();
      this.handleTouches();
      if (this.screen == Screen.main && !this.aboutButton.switchedOn) {
         this.switchScreen(Screen.instructions);
      }
   }

   private handleTouches() {
      this.removeOldTouches();
      if (this.screen == Screen.main) {
         this.tractUi.handleTouches(this.touchesWithMouse, this.getTractTime());
         this.glottisUi.handleTouches(this.touchesWithMouse);
      }
   }

   private removeOldTouches() {
      const time = this.getTractTime();
      for (let i = this.touchesWithMouse.length - 1; i >= 0; i--) {
         const appTouch = this.touchesWithMouse[i];
         if (!appTouch.alive && time > appTouch.endTime + 1) {       // one second after touch or mouse button was released
            this.touchesWithMouse.splice(i, 1);                      // remove this touch record
         }
      }
   }
}
