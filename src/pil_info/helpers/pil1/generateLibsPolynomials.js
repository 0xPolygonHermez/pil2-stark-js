const ExpressionOps = require("../../expressionops");
const { grandProductConnection } = require("./pil1_libs/grandProductConnection.js");
const { grandProductPermutation } = require("./pil1_libs/grandProductPermutation.js");
const { grandProductPlookup } = require("./pil1_libs/grandProductPlookup.js");

module.exports = function generateLibsPolynomials(F, res, pil, stark) {
    const E = new ExpressionOps();

    let pilLibs = [];

    if(pil.plookupIdentities.length > 0) {
        pilLibs.push({
            nChallenges: [2,2],
            lib: function() { grandProductPlookup(res, pil, stark) },
        });
    }

    if(pil.connectionIdentities.length > 0) {
        pilLibs.push({
            nChallenges: [2],
            lib: function() { grandProductConnection(res, pil, stark, F)},
        });
    }

    if(pil.permutationIdentities.length > 0) {
        pilLibs.push({
            nChallenges: [3],
            lib: function() { grandProductPermutation(res, pil, stark)},
        });
    }

    if(pilLibs.length > 0) {
        res.nLibStages = Math.max(...pilLibs.map(lib => lib.nChallenges.length));
    }
    
    for(let i = 0; i < res.nLibStages; ++i) {
        const stage = 2 + i;
        let nChallengesStage = 0;
        for(let j = 0; j < pilLibs.length; ++j) {
            const lib = pilLibs[j];
            const nStagesLib = lib.nChallenges.length;
            if(i >= nStagesLib) continue;
            const nChallengesLib = lib.nChallenges[i];
            for(let k = nChallengesStage; k < nChallengesLib; ++k) {
                const c = E.challenge(`stage${i+1}_challenge${k}`, stage);
                res.challengesMap.push({stage: stage, name: `challenge${k}`, stageId: k, globalId: c.id});
            }
            nChallengesStage = nChallengesLib;
    
        }
    }

    for(let i = 0; i < pilLibs.length; ++i) {
        pilLibs[i].lib();
    }
}