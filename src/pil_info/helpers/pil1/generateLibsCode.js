const { buildCode, pilCodeGen } = require("../../codegen");
const ExpressionOps = require("../../expressionops");
const { grandProductConnection } = require("./pil1_libs/grandProductConnection.js");
const { grandProductPermutation } = require("./pil1_libs/grandProductPermutation.js");
const { grandProductPlookup } = require("./pil1_libs/grandProductPlookup.js");

module.exports = function generateLibsCode(F, res, pil, ctx, stark) {
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
                const c = E.challenge(`stage${i+1}_challenge${k}`);
                res.challengesMap.push({stage: stage, stageId: k, globalId: c.id});
            }
            nChallengesStage = nChallengesLib;
    
        }
    }

    for(let i = 0; i < pilLibs.length; ++i) {
        pilLibs[i].lib();
    }

    for(let i = 0; i < res.nLibStages; ++i) {
        for(let j = 0; j < Object.keys(res.libs).length; ++j) {
            const libName = Object.keys(res.libs)[j];
            const lib = res.libs[libName];
            if(lib.length > i) {
                const polsStage = lib[i].pols;
                for(let k = 0; k < Object.keys(polsStage).length; ++k) {
                    let name = Object.keys(polsStage)[k];
                    if(polsStage[name].tmp) {
                        pilCodeGen(ctx, pil.expressions, pil.polIdentities, polsStage[name].id, 0);
                    }                    
                }
            }
        }
        const stage = 2 + i;
        res.code[`stage${stage}`] = buildCode(ctx, pil.expressions);
    }
}