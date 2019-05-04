2019-04-29 Christian d'Heureuse, chdh@inventec.ch, www.source-code.biz
- Source code converted from plain JavaScript to TypeScript.
- Program logic for the GUI part and for the synthesizer part disentangled and split
  into separate classes and modules.
- Removed depencency on Web Audio subsystem by implementing the biquad bandpass
  filters in code.
- Processing of mouse/touch coordinates improved to allow non-fullscreen canvas
  display.
- In the original Pink Trombone 1.1 source code, there is an error in the AudioSystem
  class. The noise signals of the aspiration filter output and the fricative filter
  output are both connected to the (single) input of the ScriptProcessor, without
  using an intermediate ChannelMergerNode. This has the effect that the two noise
  sources are mixed (added) and both input channels of the ScriptProcessor receive
  the (same) mixed signal. The effect is that the 500 Hz and 1000 Hz bandpass filtered
  noise sources are added and the noise amplitude is doubled.
  After correcting this error, the noise amplitudes where lower. This was compensated
  by changing the range of the white noise source from 0 .. 1 to -1 .. 1.
- All improvements have been made while preserving the original user interface and
  synthesizer algorithm.

2017-03 Neil Thapen, venuspatrol.nfshost.com
- Pink Trombone Version 1.1, retrieved from https://dood.al/pinktrombone.
