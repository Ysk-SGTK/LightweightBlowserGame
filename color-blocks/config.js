export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 12;
export const COLOR_COUNT = 5;
export const DIFFICULTIES = Object.freeze({
  Easy: { color_count: 4, target_score: 240 },
  Normal: { color_count: COLOR_COUNT, target_score: 320 },
  Hard: { color_count: 6, target_score: 400 }
});
export const REWARD = { src: './assets/reward.svg', name: '色の小さな庭' };
export const scoreGroup = size => size * size;
export function settings(difficulty = 'Normal') {
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new Error('Unknown difficulty');
  return { difficulty, board_width: BOARD_WIDTH, board_height: BOARD_HEIGHT, ...DIFFICULTIES[difficulty] };
}
