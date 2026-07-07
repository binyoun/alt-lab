// Cyanotype, 1842. The reference process of the iron-salt family.

import { buildSiderotype } from './siderotype.js';

export default buildSiderotype({
  meta: {
    id: 'cyanotype',
    name: 'Cyanotype',
    year: 1842,
    inventor: 'Sir John Herschel',
    family: 'Iron and light',
    blurb:
      'Two iron salts, brushed onto paper, turn Prussian blue wherever ultraviolet light ' +
      'reaches them. Herschel devised the chemistry in 1842; Anna Atkins used it a year ' +
      'later to print the first book illustrated by photography.',
    exposureMinutes: 12,
    remarks: {
      fine: 'A fine blue. Herschel would nod; Miss Atkins might even keep it.',
      over: 'Bronzed. The sun ate your shadows while you admired them.',
      pale: 'Washed away to a whisper. The sun owes you nothing; you must take from it.',
    },
  },

  look: {
    paper: [0.94, 0.92, 0.86],
    sens: [0.86, 0.90, 0.62],
    deep: [0.05, 0.12, 0.31],
    toneWarm: [0.03, 0.17, 0.29],   // toward teal
    toneCool: [0.11, 0.08, 0.31],   // toward violet
    printOutMid: [0.34, 0.38, 0.44],
    printOutDeep: [0.21, 0.25, 0.33],
    bronze: [0.38, 0.33, 0.26],
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
        'A cyanotype is a contact print: the paper only darkens where light passes ' +
        'through. So the image must first become a <strong>negative</strong>, dark ' +
        'where the world was bright.',
      next: 'Coat the paper',
    },
    {
      id: 'coat',
      title: 'Coat',
      caption:
        'Brush the sensitizer across the paper. Work in dim light: the yellow-green ' +
        'iron salts are already listening for the sun. Where you do not coat, ' +
        'nothing will print.',
      next: 'Into the sun',
    },
    {
      id: 'expose',
      title: 'Expose',
      caption:
        'Press and hold to leave the print in the sun. Watch the coated paper turn ' +
        'from green to slate blue. Too little and the print will wash away pale; ' +
        'too long and the shadows bronze over.',
      next: 'Wash',
    },
    {
      id: 'wash',
      title: 'Wash',
      caption:
        'Plain water is the developer and the fixer at once. The unexposed salts ' +
        'rinse away, and the exposed iron settles into Prussian blue.',
      next: 'Wash the print',
    },
    {
      id: 'result',
      title: 'Print',
      caption:
        'A cyanotype. The blue will keep deepening for a day as it oxidizes; ' +
        'here you may deepen it yourself.',
    },
  ],
});
