// Tintype, 1853. The fairground portrait, wet and ready in minutes.

import { buildPlate } from './plate.js';

export default buildPlate({
  meta: {
    id: 'tintype',
    name: 'Tintype',
    year: 1853,
    inventor: 'Adolphe-Alexandre Martin',
    family: 'Metal and glass',
    blurb:
      'Collodion poured over a lacquered iron plate, sensitized, and exposed while ' +
      'still wet. The thin negative image reads as a positive against the black ' +
      'plate. Cheap, tough, and fast: the portrait you could carry home from the ' +
      'fair in your pocket.',
    exposureSeconds: 8,
    remarks: {
      fine: 'Ready while the sitter is still smiling. That is the whole trade.',
      over: 'Flat as spilled cream. The fair forgives; I do not.',
      pale: 'Murk. Another few seconds of lens was all it wanted.',
    },
  },

  look: {
    plateDark: [0.055, 0.048, 0.042],  // japanned iron
    plateBright: [0.30, 0.27, 0.24],
    deposit: [0.76, 0.73, 0.66],       // creamy collodion silver
    dull: [0.10, 0.09, 0.08],          // bare lacquer, no collodion
    tarnish1: [0.20, 0.15, 0.10],
    tarnish2: [0.10, 0.10, 0.12],
    fogColor: [0.60, 0.58, 0.54],
    restingReflect: 0.42,
    sheen: 0.08,                       // the varnish catches the light
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
      title: 'Pour',
      auto: 'pour',
      autoLabel: 'Pour for me',
      caption:
        'Pour the collodion and roll it across the lacquered plate before it sets. ' +
        'Sweep with your finger or pointer. The plate must reach the camera ' +
        'while still wet: the clock starts now.',
      bareText:
        'The plate is still bare lacquer. Pour the collodion, or let the studio pour it.',
      next: 'Into the bath, into the camera',
    },
    {
      id: 'expose',
      type: 'hold',
      title: 'Expose',
      holdLabel: 'Open the lens',
      caption:
        'Silvered in the bath and loaded wet. Press and hold to open the lens. ' +
        'A few seconds of strong light are enough; the fairground photographer ' +
        'counted them out loud.',
      noLightText: 'The lens has not been opened. Give the plate its seconds first.',
      next: 'Develop',
    },
    {
      id: 'wash',
      type: 'reveal',
      title: 'Develop',
      caption:
        'Developer flows over the plate and the creamy silver image blooms ' +
        'against the black lacquer. Fix, rinse, varnish while the sitter watches.',
      next: 'Develop the plate',
    },
    {
      id: 'result',
      title: 'Tintype',
      caption:
        'A tintype, left for right like a mirror, and one of a kind: there is no ' +
        'negative to print again. Drag across the plate to catch the varnish in ' +
        'the light.',
    },
  ],
});
