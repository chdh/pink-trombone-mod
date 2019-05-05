2019-04-29 Christian d'Heureuse, chdh@inventec.ch, www.source-code.biz
- Source code converted from plain JavaScript to TypeScript.
- Program logic for the GUI part and for the synthesizer part disentangled and split
  into separate classes and modules.
- Removed depencency on Web Audio subsystem by implementing the biquad bandpass
  filters in code.
- Processing of mouse/touch coordinates improved to allow non-fullscreen canvas
  display.
- All improvements have been made while preserving the original user interface and
  synthesizer algorithm.
- Error corrected in the AudioSystem class:
  The noise signals of the aspiration filter output and the fricative filter
  output were both connected to the (single) input of the ScriptProcessor without
  using an intermediate ChannelMergerNode. This had the effect that the two noise
  sources were mixed (added) and both input channels of the ScriptProcessor received
  the (same) mixed signal. The effect was that the 500 Hz and 1000 Hz bandpass filtered
  noise sources were added and the noise amplitude was doubled.
  After correcting this error, the noise amplitudes were lower. This was compensated
  by changing the range of the white noise source from 0 .. 1 to -1 .. 1.
- Error corrected in the Tract class:
  The interpolation for reflectionLeft/newReflectionLeft, reflectionRight/newReflectionRight
  and reflectionNose/newReflectionNose was done in the wrong direction.

2017-03 Neil Thapen, venuspatrol.nfshost.com
- Pink Trombone Version 1.1, retrieved from https://dood.al/pinktrombone.
