const analyzeValorant = require('./analyzeValorant');
const analyzePUBG = require('./analyzePUBG');
const analyzeTekken = require('./analyzeTekken');

async function analyzeGameSkill(game, framePaths, frameResults, yoloData) {
  switch (game) {
    case 'Valorant':
      return analyzeValorant(framePaths, frameResults, yoloData);
    case 'PUBG Mobile':
      return analyzePUBG(framePaths, frameResults);
    case 'Tekken 8':
      return analyzeTekken(framePaths, frameResults);
    default:
      return null;
  }
}

module.exports = { analyzeGameSkill };
