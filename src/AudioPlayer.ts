import {Synthesizer} from "./Synthesizer";

const bufferSize = 1024;

export class AudioPlayer {
   private synthesizer:                Synthesizer;
   private audioContext:               AudioContext;
   private started:                    boolean;
   private scriptProcessor:            ScriptProcessorNode;
   private dummySource:                ConstantSourceNode;

   constructor(synthesizer: Synthesizer, audioContext: AudioContext) {
      this.synthesizer = synthesizer;
      this.audioContext = audioContext;
      this.started = false;
   }

   public start() {
      if (this.started) {
         return;
      }
      this.started = true;
      void this.resumeAudioContext();
      this.synthesizer.reset();
      this.createScriptProcessor();
   }

   public stop() {
      if (!this.started) {
         return;
      }
      this.started = false;
      this.releaseScriptProcessor();
   }

   private createScriptProcessor() {
      this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      this.scriptProcessor.connect(this.audioContext.destination);
      this.scriptProcessor.addEventListener("audioprocess", (event: AudioProcessingEvent) => this.audioprocessEventHandler(event));
      this.dummySource = new ConstantSourceNode(this.audioContext);
      this.dummySource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      this.dummySource.start();
   }

   private releaseScriptProcessor() {
      this.dummySource.stop();
      this.scriptProcessor.disconnect();
      this.dummySource.disconnect();
   }

   private async resumeAudioContext() {
      if (this.audioContext.state == "suspended") {
         await this.audioContext.resume();
      }
   }

   private audioprocessEventHandler(event: AudioProcessingEvent) {
      const buf = event.outputBuffer.getChannelData(0);
      this.synthesizer.synthesize(buf);
   }
}
