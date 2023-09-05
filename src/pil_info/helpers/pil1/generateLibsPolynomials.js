const { grandProductConnection, initChallengesConnection } = require("./pil1_libs/grandProductConnection.js");
const { grandProductPermutation, initChallengesPermutation } = require("./pil1_libs/grandProductPermutation.js");
const { grandProductPlookup, initChallengesPlookup } = require("./pil1_libs/grandProductPlookup.js");

module.exports = function generateLibsPolynomials(F, res, pil, symbols, hints, stark) {

    const pilLibs = [];

    res.nLibStages = 0;

    if(pil.permutationIdentities.length > 0) {
        pilLibs.push({
            lib: function() { grandProductPermutation(pil, symbols, hints, stark)},
        });
        res.nLibStages = Math.max(res.nLibStages, 1);
        const challenges = initChallengesPermutation(stark);
        for(let i = 0; i < challenges.length; ++i) {
            if(!symbols.find(c => c.type === "challenge" && c.name === challenges[i].name)) {
                symbols.push({type: "challenge", ...challenges[i]});
            }
        }
    }

    if(pil.connectionIdentities.length > 0) {
        pilLibs.push({
            lib: function() { grandProductConnection(pil, symbols, hints, stark, F)},
        });
        res.nLibStages = Math.max(res.nLibStages, 1);
        const challenges = initChallengesConnection(stark);
        for(let i = 0; i < challenges.length; ++i) {
            if(!symbols.find(c => c.type === "challenge" && c.name === challenges[i].name)) {
                symbols.push({type: "challenge", ...challenges[i]});
            }     
        }    
    }

    if(pil.plookupIdentities.length > 0) {
        pilLibs.push({
            lib: function() { grandProductPlookup(pil, symbols, hints, stark) },
        });
        res.nLibStages = 2;
        const challenges = initChallengesPlookup(stark);
        for(let i = 0; i < challenges.length; ++i) {
            if(!symbols.find(c => c.type === "challenge" && c.name === challenges[i].name)) {
                symbols.push({type: "challenge", ...challenges[i]});
            }
        }
    }

    for(let i = 0; i < pilLibs.length; ++i) {
        pilLibs[i].lib();
    }
}