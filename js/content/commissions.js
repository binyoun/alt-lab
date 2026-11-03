// Letters that arrive at the studio. Each names a goal the ritual can
// actually detect; check() receives the judged result:
// { tier, eff, exposure, adj, tone, contrast, coverage, handCoated, handMarks }

export const PROCESSES = {
  cyanotype: { name: 'Cyanotype', seal: '#274a86' },
  vandyke: { name: 'Van Dyke brown', seal: '#4a2c14' },
  platinum: { name: 'Platinum and palladium', seal: '#3d3d3f' },
  saltprint: { name: 'Salt print', seal: '#5e3a22' },
  albumen: { name: 'Albumen print', seal: '#553024' },
  daguerreotype: { name: 'Daguerreotype', seal: '#6b7076' },
  tintype: { name: 'Tintype', seal: '#26262a' },
  anthotype: { name: 'Anthotype', seal: '#7a2547' },
  lumen: { name: 'Lumen print', seal: '#8a5a4a' },
};

export const COMMISSIONS = [
  {
    id: 'cyan-atkins',
    process: 'cyanotype',
    from: 'Miss Anna Atkins',
    year: 1843,
    letter:
      'I am assembling a volume of impressions of British algae, and every plate ' +
      'must be coated by a steady hand, not by a machine of any kind. Send me a ' +
      'well made print where the brush did all the work.',
    goal: 'Coat the paper yourself, by hand, and earn a fine print.',
    check: (r) => r.handCoated && r.tier === 'fine',
  },
  {
    id: 'cyan-bronze',
    process: 'cyanotype',
    from: 'Sir John Herschel',
    year: 1842,
    letter:
      'A curiosity: when the exposure runs long past reason, the deepest shadows ' +
      'turn upon themselves and bronze. I should like to see this failure made on ' +
      'purpose. Ruin one for me, thoroughly.',
    goal: 'Overexpose a print until the shadows bronze.',
    check: (r) => r.eff > 1.6,
  },
  {
    id: 'vandyke-varnish',
    process: 'vandyke',
    from: 'A portrait painter of Antwerp',
    year: 1896,
    letter:
      'They tell me your brown print is named for our Van Dyck. Prove it: I want ' +
      'a print the exact colour of old varnish, warm as a chapel in October, and ' +
      'nothing pale about it.',
    goal: 'Earn a fine print toned warm, toward chocolate.',
    check: (r) => r.tier === 'fine' && r.tone >= 0.4,
  },
  {
    id: 'vandyke-proof',
    process: 'vandyke',
    from: 'The bookbinder on Cast Iron Row',
    year: 1897,
    letter:
      'Before I commit the edition I need a pale proof, barely breathed upon by ' +
      'the sun, to judge the plate against. Do not finish it. I mean this kindly.',
    goal: 'Make a deliberately pale, underexposed proof.',
    check: (r) => r.eff < 0.5 && r.coverage >= 0.15,
  },
  {
    id: 'platinum-scale',
    process: 'platinum',
    from: 'Mr William Willis',
    year: 1880,
    letter:
      'Any silver man can make black and white. The platinotype is bought for what ' +
      'lies between: the longest grey scale in photography. Send a fine print with ' +
      'the contrast held gently back, and let the middle tones speak.',
    goal: 'Earn a fine print with the contrast eased low.',
    check: (r) => r.tier === 'fine' && r.contrast <= 0.85,
  },
  {
    id: 'platinum-palladium',
    process: 'platinum',
    from: 'A printer, writing from the war years',
    year: 1916,
    letter:
      'Platinum has gone to the war and the price with it. We print in palladium ' +
      'now and learn to love the warmth. Make me one the colour of brown bread ' +
      'and I will stop mourning.',
    goal: 'Earn a fine print toned warm, toward palladium.',
    check: (r) => r.tier === 'fine' && r.tone >= 0.5,
  },
  {
    id: 'salt-ghost',
    process: 'saltprint',
    from: 'Mr W. H. F. Talbot',
    year: 1841,
    letter:
      'The faintest images interest me most of late: the picture that is nearly ' +
      'not there, the shadow of a shadow. Print one that has only begun to arrive ' +
      'and stop it there.',
    goal: 'Make a ghost: a barely exposed print.',
    check: (r) => r.eff < 0.5 && r.coverage >= 0.15,
  },
  {
    id: 'salt-steady',
    process: 'saltprint',
    from: 'The Reading printing establishment',
    year: 1846,
    letter:
      'We print by the hundred here and machines coat nothing; every sheet is ' +
      'brushed by an apprentice like yourself. Show us your hand is steady enough ' +
      'for the bench: coat your own sheet and bring it home well.',
    goal: 'Coat the paper by hand and earn a fine print.',
    check: (r) => r.handCoated && r.tier === 'fine',
  },
  {
    id: 'albumen-gold',
    process: 'albumen',
    from: 'A studio proprietor, Saigon',
    year: 1868,
    letter:
      'My sitters pay for the gold bath even when there is no gold in it, so the ' +
      'colour must convince: a rich sepia, nothing purple, nothing cheap. The ' +
      'album page is waiting.',
    goal: 'Earn a fine print toned toward gold sepia.',
    check: (r) => r.tier === 'fine' && r.tone >= 0.3,
  },
  {
    id: 'albumen-crisp',
    process: 'albumen',
    from: 'The carte de visite trade',
    year: 1862,
    letter:
      'Fashion wants faces sharp as etching this season. Give the print more snap ' +
      'than is polite: contrast up, whites clean, and have it look expensive.',
    goal: 'Earn a fine print with the contrast pushed high.',
    check: (r) => r.tier === 'fine' && r.contrast >= 1.2,
  },
  {
    id: 'dag-parlor',
    process: 'daguerreotype',
    from: 'A parlor on Broadway',
    year: 1841,
    letter:
      'The plate is the mirror and the mirror is the portrait; a lazy polish shows ' +
      'forever. Buff your own plate until your face looks back, then make the ' +
      'exposure count.',
    goal: 'Polish the plate yourself, by hand, and earn a fine plate.',
    check: (r) => r.handCoated && r.tier === 'fine',
  },
  {
    id: 'dag-moon',
    process: 'daguerreotype',
    from: 'An astronomer, half apologetic',
    year: 1852,
    letter:
      'I attempted the moon and drowned the plate in light; the result was a milk ' +
      'of silver, strangely beautiful. Reproduce my failure so I may study it ' +
      'without losing another night.',
    goal: 'Overexpose the plate until it turns milky.',
    check: (r) => r.eff > 1.6,
  },
  {
    id: 'tintype-fair',
    process: 'tintype',
    from: 'The fairground, second wagon',
    year: 1875,
    letter:
      'Sitter is paid for, band starts at eight, and my pour man has run off with ' +
      'the cook. Pour the collodion yourself, keep it even, and have the plate ' +
      'ready while the seat is warm.',
    goal: 'Pour the plate yourself, by hand, and earn a fine plate.',
    check: (r) => r.handCoated && r.tier === 'fine',
  },
  {
    id: 'tintype-storm',
    process: 'tintype',
    from: 'A tintypist following the storm',
    year: 1878,
    letter:
      'The light fails, the queue grows, and a thin dark plate is better than no ' +
      'plate at all. Make me one under-lit and honest about it: the weather is ' +
      'part of the portrait.',
    goal: 'Make an underexposed plate, dark and thin.',
    check: (r) => r.eff < 0.55 && r.coverage >= 0.15,
  },
  {
    id: 'antho-spinach',
    process: 'anthotype',
    from: 'Sir John Herschel, from the garden',
    year: 1842,
    letter:
      'The beetroot performs, but I suspect the humbler leaf: try the spinach, ' +
      'whose green fades slow and quiet. Weeks, mind you. Bring me a good print ' +
      'in chlorophyll and I will owe you a dinner.',
    goal: 'Earn a fine print in the green of spinach.',
    check: (r) => r.tier === 'fine' && r.tone <= -0.5,
  },
  {
    id: 'antho-turmeric',
    process: 'anthotype',
    from: 'A dyer of Hoi An',
    year: 1890,
    letter:
      'You bleach pictures into plants; I dye cloth with them. Turmeric holds the ' +
      'strongest yellow I know. Print in it, well and fully, and tell me which of ' +
      'us the sun obeys.',
    goal: 'Earn a fine print in turmeric yellow.',
    check: (r) => r.tier === 'fine' && r.tone >= 0.5,
  },
  {
    id: 'lumen-census',
    process: 'lumen',
    from: 'A botanist without a camera',
    year: 2019,
    letter:
      'I want a census of the garden made with no lens at all: lay the plants ' +
      'themselves on the paper, generously, and let the afternoon take their ' +
      'portraits. Six specimens at the least.',
    goal: 'Lay at least six leaves on the paper by your own hand.',
    check: (r) => r.handMarks >= 6,
  },
  {
    id: 'lumen-bare',
    process: 'lumen',
    from: 'The last sheet in the box',
    year: 2024,
    letter:
      'This paper expired before you were an apprentice. Lay nothing on it: let ' +
      'the photograph alone do the printing, sun through the image and nothing ' +
      'else, and see what the years left in the silver.',
    goal: 'Print with no leaves at all, the photograph alone, well exposed.',
    check: (r) => r.coverage < 0.03 && r.eff >= 0.72 && r.eff <= 1.45,
  },

  // Pair work, only possible in the atelier: one apprentice coats a sheet
  // and hands it over, the other exposes and washes it. Both are credited
  // when the print comes out fine.
  {
    id: 'cyan-pair',
    process: 'cyanotype',
    pair: true,
    from: 'Miss Anne Dixon',
    year: 1854,
    letter:
      'Anna and I made our book of ferns between us: one coated while the other ' +
      'laid out the specimens and watched the sun. Work as we did. One of you ' +
      'brushes the sheet, the other gives it its light.',
    goal: 'In the atelier, make a fine cyanotype with a partner: one coats and hands it over, the other exposes it.',
    check: (r) => r.paired && r.tier === 'fine',
  },
  {
    id: 'salt-pair',
    process: 'saltprint',
    pair: true,
    from: 'Nicolaas Henneman, the Reading Establishment',
    year: 1844,
    letter:
      'At Reading we print Mr Talbot\'s pictures by the hundred, and no hand does ' +
      'every step. I want to see that you can pass a sensitised sheet to a ' +
      'colleague and trust them with it.',
    goal: 'In the atelier, make a fine salt print with a partner: one coats and hands it over, the other exposes it.',
    check: (r) => r.paired && r.tier === 'fine',
  },

  // Errands: letters that send the apprentice out into the country to
  // gather something, then print with it. `quest.wants` lists specimens
  // any one of which will do; markers show where they grow.
  {
    id: 'atkins-dulse',
    process: 'cyanotype',
    quest: { wants: ['dulse'], place: 'shore' },
    from: 'Miss Anna Atkins',
    year: 1846,
    letter:
      'My British Algae wants one more plate. Go down to the shore at low tide, ' +
      'find me red dulse among the rock pools, and print it in blue as I do.',
    goal: 'Gather red dulse at the Shore and print it as a cyanotype.',
    check: (r) => (r.gathered || []).includes('dulse'),
  },
  {
    id: 'linnean-fern',
    process: 'lumen',
    quest: { wants: ['ladyfern', 'hartstongue', 'bracken'], place: 'wood' },
    from: 'A botanist of the Linnean Society',
    year: 1850,
    letter:
      'We are told a fern may be drawn by the sun with hardly any chemistry ' +
      'worth the name. Bring a frond from the Fern Wood, lay it on the paper, ' +
      'and show the Society.',
    goal: 'Gather a fern in the Fern Wood and lay it on lumen paper.',
    check: (r) => (r.laid || []).some((id) => ['ladyfern', 'hartstongue', 'bracken'].includes(id)),
  },
  {
    id: 'herschel-harebell',
    process: 'anthotype',
    quest: { wants: ['harebell'], place: 'hill' },
    from: 'Sir John Herschel',
    year: 1842,
    letter:
      'I have tried the juices of a great many flowers. The harebell I have ' +
      'not. It grows on the hill above the old ruin; crush it and see what the ' +
      'sun makes of it.',
    goal: 'Gather harebells on Ruin Hill and make an anthotype in their juice.',
    check: (r) => r.dye === 'harebell',
  },
  {
    id: 'talbot-salt',
    process: 'saltprint',
    quest: { wants: ['salt'], place: 'shore' },
    from: 'William Henry Fox Talbot',
    year: 1841,
    letter:
      'Salt from the grocer is never quite right; there is always something in ' +
      'it. Bring me salt from the pans by the sea and salt your paper with it ' +
      'before the silver goes on.',
    goal: 'Gather sea salt at the Shore and salt your paper with it.',
    check: (r) => !!r.salted,
  },
  {
    id: 'miller-willow',
    process: 'vandyke',
    quest: { wants: ['willow'], place: 'stream' },
    from: "The miller's daughter",
    year: 1897,
    letter:
      'Father says the willows by our wheel are the oldest in the county. ' +
      'Would you print their leaves for him, in that warm brown, before they ' +
      'come down for the winter?',
    goal: 'Gather willow leaves by the Mill Stream and print them in Van Dyke brown.',
    check: (r) => (r.gathered || []).includes('willow'),
  },
];

// what the open errands still want gathered
export const errandsOpen = (fulfilled) => COMMISSIONS.filter((c) => c.quest && !fulfilled(c.id));

export const commissionsFor = (processId) =>
  COMMISSIONS.filter((c) => c.process === processId);
