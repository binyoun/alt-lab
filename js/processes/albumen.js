// Albumen print, 1850. Blanquart-Evrard's egg white gloss.

import { buildSiderotype } from './siderotype.js';

export default buildSiderotype({
  meta: {
    id: 'albumen',
    name: 'Albumen print',
    year: 1850,
    inventor: 'Louis Désiré Blanquart-Evrard',
    family: 'Early paper',
    blurb:
      'Beaten egg white, salted and coated onto thin paper, holds the silver image ' +
      'on the surface instead of in the fibre. The result is glossy, sharp, and was ' +
      'the look of nearly every photograph for half a century.',
    exposureMinutes: 10,
    remarks: {
      fine: 'Crisp on the albumen, clean at the whites. The album page accepts.',
      over: 'The gloss cannot save a burnt image.',
      pale: 'Underdone. The trade would send it back with a note.',
    },
  },

  look: {
    paper: [0.95, 0.91, 0.78],       // albumen highlights yellow with age
    sens: [0.95, 0.90, 0.72],
    deep: [0.22, 0.12, 0.10],
    toneWarm: [0.26, 0.14, 0.07],    // toward sepia
    toneCool: [0.17, 0.11, 0.14],    // toward aubergine, gold toned
    printOutMid: [0.57, 0.43, 0.43],
    printOutDeep: [0.37, 0.26, 0.28],
    bronze: [0.45, 0.37, 0.32],
    bronzeStart: 2.6,
    bronzeEnd: 4.8,
    fiber: 0.35,                     // the egg white fills the paper tooth
    gloss: 0.5,
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
        'Albumen prints were made by contact from glass negatives, sharp as the ' +
        'lens that took them. Your photograph becomes the <strong>negative</strong> ' +
        'on the glass.',
      next: 'Coat the paper',
    },
    {
      id: 'coat',
      title: 'Coat',
      caption:
        'The paper is already albumenized: floated on salted egg white and dried ' +
        'to a shine. Brush the silver nitrate over the glazed surface to make ' +
        'it sensitive.',
      next: 'Into the sun',
    },
    {
      id: 'expose',
      title: 'Expose',
      caption:
        'Press and hold to print out. The image rises on the surface of the egg ' +
        'white, purple-brown and crisp. Whole rooftop printing works once ran on ' +
        'this, frame after frame angled at the sun.',
      next: 'Fix',
    },
    {
      id: 'wash',
      title: 'Fix',
      caption:
        'Wash, tone in gold if you have it, fix in hypo. The purple calms toward ' +
        'sepia and the gloss comes up as the print dries.',
      next: 'Fix the print',
    },
    {
      id: 'result',
      title: 'Print',
      caption:
        'An albumen print. Glossy where the shadows sit, cream where the light ' +
        'was, and a faint yellow in the whites that time always adds.',
    },
  ],
});
