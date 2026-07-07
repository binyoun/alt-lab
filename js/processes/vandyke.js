// Van Dyke brown, 1895 formula, after Herschel's argentotype of 1842.

import { buildSiderotype } from './siderotype.js';

export default buildSiderotype({
  meta: {
    id: 'vandyke',
    name: 'Van Dyke brown',
    year: 1895,
    inventor: 'Arndt and Troost, after Herschel',
    family: 'Iron and light',
    blurb:
      'Iron does the listening and silver does the speaking: the exposed iron salt ' +
      'reduces silver nitrate to a deep brown the colour of the old Flemish pigment ' +
      'the process is named after.',
    exposureMinutes: 8,
    remarks: {
      fine: 'The colour of old varnish, exactly. Keep it from the light and it will outlive us.',
      over: 'Past brown into grief. Less sun, apprentice.',
      pale: 'Weak tea. The silver never woke.',
    },
  },

  look: {
    paper: [0.94, 0.90, 0.82],
    sens: [0.94, 0.88, 0.66],
    deep: [0.19, 0.11, 0.06],
    toneWarm: [0.24, 0.12, 0.04],   // toward chocolate
    toneCool: [0.15, 0.11, 0.09],   // toward cold sepia
    printOutMid: [0.58, 0.44, 0.34],
    printOutDeep: [0.38, 0.27, 0.19],
    bronze: [0.46, 0.38, 0.35],     // solarized grey-lilac
    bronzeStart: 2.6,
    bronzeEnd: 4.6,
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
        'Like the cyanotype, a Van Dyke is printed by contact. The photograph ' +
        'must become a <strong>negative</strong> first, dark where the world was bright.',
      next: 'Coat the paper',
    },
    {
      id: 'coat',
      title: 'Coat',
      caption:
        'Brush on the pale straw sensitizer: ferric ammonium citrate, tartaric acid ' +
        'and silver nitrate. It looks like weak tea and stains like strong tea, ' +
        'so mind your sleeves.',
      next: 'Into the sun',
    },
    {
      id: 'expose',
      title: 'Expose',
      caption:
        'Press and hold to expose. Van Dykes print out quickly, rising through ' +
        'tan and umber. Stop while the highlights still look a little too light; ' +
        'the print will darken in the wash.',
      next: 'Wash',
    },
    {
      id: 'wash',
      title: 'Wash',
      caption:
        'Water clears the unexposed salts, then a fixing bath settles the silver ' +
        'into permanent brown. The image deepens as it dries.',
      next: 'Wash the print',
    },
    {
      id: 'result',
      title: 'Print',
      caption:
        'A Van Dyke brown print. The colour of old varnish and older photographs.',
    },
  ],
});
