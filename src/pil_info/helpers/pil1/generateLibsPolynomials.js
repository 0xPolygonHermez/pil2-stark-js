const { grandProductConnection, initChallengesConnection } = require("./pil1_libs/grandProductConnection.js");
const { grandProductPermutation, initChallengesPermutation } = require("./pil1_libs/grandProductPermutation.js");
const { grandProductPlookup, initChallengesPlookup } = require("./pil1_libs/grandProductPlookup.js");

module.exports = function generateLibsPolynomials(F, res, pil, symbols, hints, stark) {

    const pilLibs = [];

    res.numChallenges = [0];

    pil.nCm2 = 0;
    pil.nCm3 = 0;

    if(pil.permutationIdentities.length > 0) {
        pilLibs.push({
            lib: function() { grandProductPermutation(pil, symbols, hints, stark)},
        });
        const challenges = initChallengesPermutation(stark);
        calculateChallenges(res, symbols, challenges);
    }

    if(pil.connectionIdentities.length > 0) {
        pilLibs.push({
            lib: function() { grandProductConnection(pil, symbols, hints, stark, F)},
        });
        const challenges = initChallengesConnection(stark);
        calculateChallenges(res, symbols, challenges);

    }

    if(pil.plookupIdentities.length > 0) {
        pilLibs.push({
            lib: function() { grandProductPlookup(pil, symbols, hints, stark) },
        });
        const challenges = initChallengesPlookup(stark);
        calculateChallenges(res, symbols, challenges);
    }

    for(let i = 0; i < pilLibs.length; ++i) {
        pilLibs[i].lib();
    }
}

function calculateChallenges(res, symbols, challenges) {
    for(let i = 0; i < challenges.length; ++i) {
        if(!symbols.find(c => c.type === "challenge" && c.stage === challenges[i].stage && c.stageId === challenges[i].stageId)) {
            symbols.push({type: "challenge", ...challenges[i]});
        }
    }
    const numChallenges = challenges.map(c => c.stage - 1).reduce((acc, s) => {
        if(!acc[s]) acc[s] = 0;
        acc[s]++;
        return acc;
    },[0]);
    res.numChallenges = [...Array(Math.max(res.numChallenges.length, numChallenges.length))]
        .map((_, i) => Math.max(res.numChallenges[i] || 0, numChallenges[i] || 0));
}