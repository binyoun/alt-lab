// Daguerreotype, 1839. The mirror with a memory.

import { buildPlate } from './plate.js';

export default buildPlate({
  meta: {
    id: 'daguerreotype',
    name: 'Daguerreotype',
    year: 1839,
    inventor: 'Louis Daguerre',
    family: 'Metal and glass',
    blurb:
      'A silvered copper plate, polished to a mirror, fumed with iodine, exposed ' +
      'in the camera and developed over warm mercury. The first photographic ' +
      'process the public ever saw, and still the strangest: the image floats on ' +
      'a mirror and flips from positive to negative as the plate turns.',
    exposureSeconds: 25,
    remarks: {
      fine: 'A true mirror with a memory. Tilt it and watch it breathe.',
      over: 'Milk. The astronomers do this on purpose; you did not.',
      pale: 'The mercury found almost nothing to hold. Longer under the lens.',
      thin: 'The polish is lazy, and the plate shows every stroke you did not make.',
    },
  },

  look: {
    plateDark: [0.07, 0.08, 0.10],
    plateBright: [0.82, 0.84, 0.87],
    deposit: [0.74, 0.75, 0.76],   // frosted mercury amalgam
    dull: [0.42, 0.41, 0.39],      // unpolished silver
    tarnish1: [0.32, 0.23, 0.13],
    tarnish2: [0.18, 0.23, 0.40],
    fogColor: [0.62, 0.66, 0.72],  // solarized bluish milk
    restingReflect: 0.30,
  },

  stages: [
    {
      id: 'upload',
      title: 'Sitter',
      caption:
        'Choose a photograph to sit for the camera. Everything happens on your ' +
        'device. The image is never uploaded anywhere.',
    },
    {
      id: 'coat',
      type: 'paint',
      title: 'Polish',
      auto: 'coat',
      autoLabel: 'Polish for me',
      caption:
        'Buff the silvered plate until it holds a true mirror. Daguerreotypists ' +
        'polished with rouge and lampblack until their own face looked back. ' +
        'Where the polish misses, the image will not sit.',
      bareText:
        'The plate is still dull. Rub it with your finger or pointer, or let the studio polish it.',
      next: 'Fume and load',
    },
    {
      id: 'expose',
      type: 'hold',
      title: 'Expose',
      holdLabel: 'Open the lens',
      caption:
        'The fumed plate waits in the camera. Press and hold to open the lens. ' +
        'Nothing appears; the light writes an invisible, latent image. Early ' +
        'sitters held still for minutes, necks braced in iron stands.',
      noLightText: 'The lens has not been opened. Give the plate its seconds first.',
      next: 'Develop',
    },
    {
      id: 'wash',
      type: 'reveal',
      title: 'Develop',
      caption:
        'The plate goes face down over a dish of warm mercury. The vapour finds ' +
        'the exposed silver and the image condenses out of nothing, white as ' +
        'frost. This step poisoned a generation of photographers.',
      next: 'Fume with mercury',
    },
    {
      id: 'result',
      title: 'Plate',
      caption:
        'A daguerreotype, left for right like a mirror. Drag across the plate to ' +
        'tilt it against the light and watch the image turn from positive to ' +
        'negative and back.',
    },
  ],
});
