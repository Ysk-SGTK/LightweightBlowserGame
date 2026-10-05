export const DIFFICULTIES = Object.freeze({ Easy: 4, Normal: 5, Hard: 6 });
export const REWARD = { src: './assets/reward.svg', alt: '数字順押しクリア記念のカード', caption: 'CLEAR! また少し、速くなれる。' };
export function settings(difficulty) {
  const size = DIFFICULTIES[difficulty];
  if (!size) throw new Error('Unknown difficulty');
  return { difficulty, board_width: size, board_height: size, max_number: size * size };
}
