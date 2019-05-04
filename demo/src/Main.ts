import {AudioPlayer} from "pink-trombone-mod/AudioPlayer";
import {MainUi, Screen} from "pink-trombone-mod/MainUi";
import {Synthesizer} from "pink-trombone-mod/Synthesizer";

var audioContext:  AudioContext;
var synthesizer:   Synthesizer;
var audioPlayer:   AudioPlayer;
var mainUi:        MainUi;

function animationFrameHandler() {
   mainUi.draw();
   requestAnimationFrame(animationFrameHandler);
}

function mainUi_screenSwitched() {
   if (mainUi.screen == Screen.main) {
      audioPlayer.start();
   } else {
      audioPlayer.stop();
   }
}

function init() {
   const canvas = <HTMLCanvasElement>document.getElementById("canvas");
   audioContext = new ((<any>window).AudioContext || (<any>window).webkitAudioContext)();
   const sampleRate = audioContext.sampleRate;
   synthesizer = new Synthesizer(sampleRate);
   audioPlayer = new AudioPlayer(synthesizer, audioContext);
   mainUi = new MainUi(synthesizer, canvas);
   mainUi.addEventListener("screen-switched", mainUi_screenSwitched);
   mainUi.draw();
   requestAnimationFrame(animationFrameHandler);
}

document.addEventListener("DOMContentLoaded", init);
