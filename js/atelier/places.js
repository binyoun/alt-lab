// The places on Atelier Square: the nine process ateliers and the history
// chapters. Plain data, so pages without Three.js can use it too.

export const HISTORY = [
  ['1826', 'The first fixed image'],
  ['1839', 'The daguerreotype'],
  ['1840', 'The negative, and the salt print'],
  ['1842', 'Iron, blue, and the garden'],
  ['1850', 'Albumen, and the family album'],
  ['1851', 'Wet collodion'],
  ['1873', 'Platinum, and the noble prints'],
  ['1888', 'You press the button'],
  ['1907', 'Colour arrives'],
  ['1925', 'Small cameras, instant pictures'],
  ['1975', 'The sensor'],
  ['now', 'The return of slow light'],
];

// The nine processes, each with its own atelier on Atelier Square.
// `chapter` is the history chapter that hangs by its door.
export const BENCHES = [
  { id: 'cyanotype', name: 'Cyanotype', year: 1842, props: 'iron', tint: '#274a86', chapter: '1842', atelier: 'The Sun Yard' },
  { id: 'vandyke', name: 'Van Dyke brown', year: 1895, props: 'iron', tint: '#4a2c14', chapter: '1842', atelier: 'The Varnish Room' },
  { id: 'platinum', name: 'Platinum', year: 1873, props: 'iron', tint: '#3d3d3f', chapter: '1873', atelier: 'The North Light Studio' },
  { id: 'saltprint', name: 'Salt print', year: 1840, props: 'salt', tint: '#5e3a22', chapter: '1840', atelier: 'The Lattice Window' },
  { id: 'albumen', name: 'Albumen print', year: 1850, props: 'egg', tint: '#553024', chapter: '1850', atelier: 'The Album Parlour' },
  { id: 'daguerreotype', name: 'Daguerreotype', year: 1839, props: 'fuming', tint: '#6b7076', chapter: '1839', atelier: 'The Plate Room' },
  { id: 'tintype', name: 'Tintype', year: 1856, props: 'camera', tint: '#26262a', chapter: '1851', atelier: 'The Portrait Studio' },
  { id: 'anthotype', name: 'Anthotype', year: 1842, props: 'berry', tint: '#7a2547', chapter: '1842', atelier: 'The Glasshouse' },
  { id: 'lumen', name: 'Lumen print', year: 1840, props: 'leaf', tint: '#8a5a4a', chapter: 'now', atelier: 'The Attic Sill' },
];
