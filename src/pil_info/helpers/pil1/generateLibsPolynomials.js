const { grandProductConnection, initChallengesConnection } = require("./pil1_libs/grandProductConnection.js");
const { grandProductPermutation, initChallengesPermutation } = require("./pil1_libs/grandProductPermutation.js");
const { grandProductPlookup, initChallengesPlookup } = require("./pil1_libs/grandProductPlookup.js");

module.exports = function generateLibsPolynomials(F, res, pil, symbols, hints, stark, firstPossibleStage = false) {

    const pilLibs = [];

    pil.nCm2 = 0;
    pil.nCm3 = 0;

    if(pil.plookupIdentities.length > 0) {
        pilLibs.push({
            lib: function() { grandProductPlookup(pil, symbols, hints, res.subproofId, res.airId, stark) },
        });
        const challenges = initChallengesPlookup(stark);
        calculateChallenges(res, symbols, challenges);
    }

    if(pil.permutationIdentities.length > 0) {
        pilLibs.push({
            lib: function() { grandProductPermutation(pil, symbols, hints, stark, res.subproofId, res.airId, firstPossibleStage)},
        });
        const challenges = initChallengesPermutation(stark, firstPossibleStage);
        calculateChallenges(res, symbols, challenges);
    }

    if(pil.connectionIdentities.length > 0) {
        pilLibs.push({
            lib: function() { grandProductConnection(pil, symbols, hints, stark, res.subproofId, res.airId, firstPossibleStage, F)},
        });
        const challenges = initChallengesConnection(stark, firstPossibleStage);
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

    const symbolsChallenges = symbols.filter(s => s.type === "challenge");
    for(let j = 0; j < symbolsChallenges.length; ++j) {
        const ch = symbolsChallenges[j];
        const id = symbolsChallenges.filter(c => c.stage < ch.stage || (c.stage === ch.stage && c.stageId < ch.stageId)).length;
        ch.id = id;
    }
}
