// Platinotype, 1873. Platinum and palladium printing.

import { buildSiderotype } from './siderotype.js';

export default buildSiderotype({
  meta: {
    id: 'platinum',
    name: 'Platinum and palladium',
    year: 1873,
    inventor: 'William Willis',
    family: 'Iron and light',
    blurb:
      'Iron salts catch the light, then a developing bath swaps them for platinum ' +
      'or palladium metal lodged in the paper fibre. No gloss, no silver, and the ' +
      'longest tonal scale in photography. A platinum print outlives the paper it ' +
      'sits on.',
    exposureMinutes: 20,
    remarks: {
      fine: 'Look at the middle greys. That is why they pay for platinum.',
      over: 'Even the noble metals can be bullied. This one was.',
      pale: 'A ghost in the oxalate. It wanted twice the light.',
    },
  },

  look: {
    paper: [0.95, 0.93, 0.88],
    sens: [0.94, 0.91, 0.80],
    deep: [0.10, 0.10, 0.10],
    toneWarm: [0.14, 0.10, 0.07],   // toward palladium brown-black
    toneCool: [0.08, 0.09, 0.11],   // toward cold platinum
    printOutMid: [0.64, 0.60, 0.54],
    printOutDeep: [0.48, 0.45, 0.41],
    bronze: [0.35, 0.33, 0.30],
    bronzeStart: 3.6,
    bronzeEnd: 6.0,
    exposedStrength: 0.3,           // develop-out: the sun only whispers
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
        'A platinotype is printed by contact, so the photograph must first become ' +
        'a <strong>negative</strong>, dark where the world was bright.',
      next: 'Coat the paper',
    },
    {
      id: 'coat',
      title: 'Coat',
      caption:
        'Brush on ferric oxalate and the platinum salt. The coating is faint, ' +
        'barely a shadow of lemon on the paper. The metal is waiting, not watching.',
      next: 'Into the sun',
    },
    {
      id: 'expose',
      title: 'Expose',
      caption:
        'Press and hold to expose. Unlike the cyanotype, almost nothing appears: ' +
        'only a ghost of an image. Printers learned to read that ghost, because ' +
        'the developer tells the truth all at once.',
      next: 'Develop',
    },
    {
      id: 'wash',
      title: 'Develop',
      caption:
        'The paper slides into warm potassium oxalate and the image arrives in ' +
        'seconds, grey-black and complete. Baths of dilute acid then clear the ' +
        'last of the iron away.',
      next: 'Develop the print',
    },
    {
      id: 'result',
      title: 'Print',
      caption:
        'A platinum print. Matte, quiet, and effectively permanent. Palladium ' +
        'leans warmer; platinum cooler.',
    },
  ],
});
