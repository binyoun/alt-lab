// Salted paper print, 1840. Talbot's positive from the calotype negative.

import { buildSiderotype } from './siderotype.js';

export default buildSiderotype({
  meta: {
    id: 'saltprint',
    name: 'Salt print',
    year: 1840,
    inventor: 'William Henry Fox Talbot',
    family: 'Early paper',
    blurb:
      'Paper bathed in table salt, then brushed with silver nitrate, prints out ' +
      'in sunlight under a paper negative. Talbot built the whole idea of the ' +
      'photographic print, one copy after another, on this chemistry.',
    exposureMinutes: 15,
  },

  look: {
    paper: [0.95, 0.92, 0.85],
    sens: [0.96, 0.92, 0.80],
    deep: [0.24, 0.13, 0.08],
    toneWarm: [0.28, 0.13, 0.05],   // toward red chestnut
    toneCool: [0.19, 0.12, 0.12],   // toward plum, as if gold toned
    printOutMid: [0.56, 0.43, 0.42],
    printOutDeep: [0.36, 0.26, 0.27], // lilac brown before the fixer
    bronze: [0.44, 0.36, 0.30],
    bronzeStart: 2.6,
    bronzeEnd: 4.8,
  },

  stages: [
    {
      id: 'upload',
      title: 'Photograph',
      caption:
        'Choose a photograph. Everything happens on your device. ' +
        'The image is never uploaded anywhere.',
    },
    {
      id: 'negative',
      title: 'Negative',
      caption:
        'Talbot printed from paper negatives, waxed until they turned translucent. ' +
        'Your photograph becomes one: a <strong>negative</strong>, dark where the ' +
        'world was bright.',
      next: 'Coat the paper',
    },
    {
      id: 'coat',
      title: 'Coat',
      caption:
        'The paper has already been bathed in salt and dried. Now brush the silver ' +
        'nitrate over it: where salt meets silver, light-sensitive silver chloride ' +
        'forms inside the paper itself.',
      next: 'Into the sun',
    },
    {
      id: 'expose',
      title: 'Expose',
      caption:
        'Press and hold to print out in the sun. The image rises lilac and ' +
        'red-brown, visibly, minute by minute. Printers judged it by eye, ' +
        'peeling back a corner of the frame to check.',
      next: 'Fix',
    },
    {
      id: 'wash',
      title: 'Fix',
      caption:
        'A wash, then hypo, the fixer Herschel lent to photography. The unexposed ' +
        'silver leaves, the colour shifts from lilac to chestnut, and the print ' +
        'settles a shade lighter than it looked in the frame.',
      next: 'Fix the print',
    },
    {
      id: 'result',
      title: 'Print',
      caption:
        'A salted paper print. Matte, warm, the image held in the very fibre of ' +
        'the paper.',
    },
  ],
});
