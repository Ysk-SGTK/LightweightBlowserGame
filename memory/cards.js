const gems = [
  ['太陽', '<circle cx="50" cy="51" r="14"/><path d="M50 25v7m0 38v7M24 51h7m38 0h7M32 33l5 5m26 26 5 5M32 69l5-5m26-26 5-5" fill="none"/>'],
  ['月', '<path d="M60 28a25 25 0 1 0 12 38A22 22 0 0 1 60 28Z"/><path d="m69 30 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>'],
  ['星', '<path d="m50 25 8 17 19 3-14 14 3 19-16-9-16 9 3-19-14-14 19-3Z"/><path d="m50 38 0 25m-11-13 22 0" fill="none" stroke="#f4dfaa"/>'],
  ['雫', '<path d="M50 25C45 38 30 47 30 60a20 20 0 0 0 40 0C70 47 55 38 50 25Z"/><path d="M40 55q-5 13 7 15" stroke="#f4dfaa" fill="none"/>'],
  ['炎', '<path d="M48 24c6 16-16 20-11 34 2-9 11-7 14-18 2 14 20 17 17 29-3 12-30 14-36-2-7-15 7-24 16-43Z"/><path d="M50 54c-13 17-8 23 1 23s15-9-1-23Z" fill="#edcf91"/>'],
  ['葉', '<path d="M73 28C31 25 21 54 35 69c15 15 38-3 38-41Z"/><path d="m32 78 33-41m-19 23-10-1m17-9 0-10m-13 29 14-1" fill="none" stroke="#f4dfaa"/>'],
  ['六角結晶', '<path d="m50 25 23 14v27L50 80 27 66V39Z"/><path d="m50 25 0 55M27 39l23 13 23-13M27 66l23-14 23 14" fill="none" stroke="#f4dfaa"/>'],
  ['螺旋', '<path d="M51 53c8-12 20 6 9 14-16 12-35-9-23-25 16-23 47-3 39 23-9 30-54 25-56-8" fill="none" stroke-width="6"/><circle cx="51" cy="53" r="3" fill="#f4dfaa"/>']
];
const stem = '<path d="M50 79V55m0 14q-15-14-20-8 2 13 20 12m0-7q15-13 20-7-2 12-20 11" fill="#789480" stroke="#587367"/>';
const botanicals = [
  ['バラ', '<path d="M34 39q-3-15 12-13 12-10 19 4 14 3 6 17-1 16-19 14-21 7-23-9-8-9 5-13Z"/><path d="M37 37q18-16 26 4-2 15-16 11-11-4-5-12 11-5 12 6" fill="none" stroke="#efd4c2"/>'],
  ['チューリップ', '<path d="M31 30 43 39 50 25 57 39 69 30v18q-1 18-19 18T31 48Z"/><path d="M43 39q-3 18 7 27 10-9 7-27" fill="none" stroke="#efd4c2"/>'],
  ['ユリ', '<path d="M50 49Q33 16 27 30q0 21 23 19Q40 16 50 22q10-6 0 27 23-2 23-19-6-14-23 19 35-10 23 7-12 11-23-7 8 30 0 22-8 8 0-22-11 18-23 7-12-17 23-7Z"/><path d="m50 49-5-10m5 10 6-9" stroke="#a18445"/><circle cx="50" cy="49" r="4" fill="#c9a95e"/>'],
  ['ヒマワリ', '<g fill="#c9ac69"><ellipse cx="50" cy="32" rx="6" ry="12"/><ellipse cx="50" cy="60" rx="6" ry="12"/><ellipse cx="36" cy="46" rx="12" ry="6"/><ellipse cx="64" cy="46" rx="12" ry="6"/><path d="M31 27q18-1 19 19-19-1-19-19m38 0q0 18-19 19 1-19 19-19M31 65q0-18 19-19-1 19-19 19m38 0q-18 1-19-19 19 1 19 19"/></g><circle cx="50" cy="46" r="12" fill="#8d7558"/><circle cx="50" cy="46" r="7" fill="none" stroke="#dbc28c" stroke-dasharray="1 4"/>'],
  ['クローバー', '<path d="M50 45C24 46 25 21 39 25q9-2 11 13 2-15 11-13 14-4 11 13-2 9-18 10 17 0 18 10 3 16-12 12-9 1-10-14-1 15-10 14-15 4-12-12 1-10 18-10Z" fill="#789480"/><path d="m50 35 0 26M37 46h26" fill="none" stroke="#c8d1aa"/>'],
  ['ラベンダー', '<path d="M43 79V33m14 46V29" fill="none" stroke="#587367"/><g fill="#9c88a3"><ellipse cx="40" cy="32" rx="5" ry="7"/><ellipse cx="46" cy="42" rx="5" ry="7"/><ellipse cx="40" cy="52" rx="5" ry="7"/><ellipse cx="54" cy="28" rx="5" ry="7"/><ellipse cx="60" cy="38" rx="5" ry="7"/><ellipse cx="54" cy="48" rx="5" ry="7"/><ellipse cx="60" cy="58" rx="5" ry="7"/></g>'],
  ['桜', '<path d="M50 47C29 32 39 21 47 28l3 5 3-5c8-7 18 4-3 19 8-23 22-19 18-8l-4 4 6 1c10 5 5 20-20 3 23 1 26 16 14 18l-6-2-1 6c-6 8-17-3-7-22-10 19-24 16-20 5l4-4-5-2c-8-10 9-15 21 1Z"/><circle cx="50" cy="47" r="4" fill="#cfb26d"/>'],
  ['小さな葉', '<path d="M50 77V29m0 12Q26 19 28 36q4 11 22 9m0 11Q74 29 72 47q-3 12-22 13m0 8Q28 47 30 63q3 10 20 9" fill="#789480" stroke="#587367"/>']
];

export function cardSet(theme) {
  if (!['gem','botanical'].includes(theme)) throw new Error('Unknown card theme');
  const motifs = theme === 'gem' ? gems : botanicals;
  return motifs.map(([name, art]) => ({ name, svg: `<svg viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="100" height="125" rx="8" fill="#ede5d4"/>
    <rect x="5" y="5" width="90" height="115" rx="4" fill="none" stroke="#b39a65" stroke-width=".8"/>
    <path d="m10 20 0-10 10 0m60 0h10v10M10 105v10h10m60 0h10v-10" fill="none" stroke="#b39a65" stroke-width="1.4"/>
    <circle cx="50" cy="52" r="34" fill="none" stroke="#b39a65" stroke-opacity=".22"/>
    <g fill="${theme === 'gem' ? '#658a83' : '#bb8d86'}" stroke="${theme === 'gem' ? '#426a65' : '#9d776f'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${theme === 'botanical' && ![5,7].includes(motifs.findIndex(m => m[0] === name)) ? stem : ''}${art}</g>
    <path d="m46 106 4-4 4 4-4 4Z" fill="#b39a65"/>
  </svg>` }));
}
export const BACK_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1"><path d="m50 10 33 40-33 40-33-40Z"/><path d="m50 24 22 26-22 26-22-26Z"/><circle cx="50" cy="50" r="12"/><path d="M50 4v27m0 38v27M4 50h27m38 0h27"/><path d="m50 39 6 11-6 11-6-11Z" fill="currentColor"/></g></svg>';
