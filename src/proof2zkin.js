
module.exports.proof2zkin = function proof2zkin(p, starkInfo) {

    const friSteps = starkInfo.starkStruct.steps;
    const nQueries = starkInfo.starkStruct.nQueries;
    const nStages = starkInfo.nStages;
    const nSubproofValues = starkInfo.nSubproofValues;

    const qStage = nStages + 1;
    
    const zkin = {};
    zkin.root1 = p.root1;
    for(let i = 0; i < nStages - 1; ++i) {
        const stage = i + 2;
        zkin[`root${stage}`] = p[`root${stage}`];
    }
    zkin[`root${qStage}`] = p[`root${qStage}`];
    zkin.evals = p.evals;

    for (let i=1; i<friSteps.length; i++) {
        zkin[`s${i}_root`] = p.fri[i].root;
        zkin[`s${i}_vals`] = [];
        zkin[`s${i}_siblings`] = [];
        for (let q=0; q<nQueries; q++) {
            const query = p.fri[i].polQueries[q];
            zkin[`s${i}_vals`][q] = query[0];
            zkin[`s${i}_siblings`][q] = query[1];
        }
    }

    zkin.s0_valsC = [];
    zkin.s0_vals1 = [];

    for(let i = 0; i < nStages - 1; ++i) {
        const stage = i + 2;
        if(starkInfo.mapSectionsN[`cm${stage}`] > 0) {
            zkin[`s0_vals${stage}`] = [];
        }
    }
    zkin[`s0_vals${qStage}`] = [];

    zkin.s0_siblingsC = [];
    zkin.s0_siblings1 = [];
    for(let i = 0; i < nStages - 1; ++i) {
        const stage = i + 2;
        if(starkInfo.mapSectionsN[`cm${stage}`] > 0) {
            zkin[`s0_siblings${stage}`] = [];
        }
    }
    zkin[`s0_siblings${qStage}`] = [];

    for (let i=0; i<nQueries; i++) {
        const query = p.fri[0].polQueries[i];
        
        zkin.s0_vals1[i] = query[0][0];
        zkin.s0_siblings1[i] = query[0][1];

        for(let stage = 1; stage <= nStages; ++stage) {
            if(starkInfo.mapSectionsN[`cm${stage}`] > 0) {
                zkin[`s0_vals${stage}`][i] = query[stage - 1][0];
                zkin[`s0_siblings${stage}`][i] = query[stage - 1][1];
            }
        }

        zkin[`s0_vals${qStage}`][i] = query[nStages][0];
        zkin[`s0_siblings${qStage}`][i] = query[nStages][1];

        zkin.s0_valsC[i] = query[nStages + 1][0];
        zkin.s0_siblingsC[i] = query[nStages + 1][1];
    }

    zkin.finalPol = p.fri[friSteps.length];

    if(nSubproofValues > 0) {
        zkin.subproofValues = p.subproofValues;
    }
         
    return zkin;
}

module.exports.genNullProof = function genNullProof(starkInfo) {
    const zkin = {};

    const friSteps = starkInfo.starkStruct.steps;
    const nQueries = starkInfo.starkStruct.nQueries;
    const nStages = starkInfo.nStages;
    const nSubproofValues = starkInfo.nSubproofValues;
    const nEvals = starkInfo.evMap.length;

    const qStage = nStages + 1;

    zkin.evals = [];

    zkin.s0_valsC = [];
    zkin.s0_siblingsC = [];

    zkin.s0_vals1 = [];
    zkin.s0_siblings1 = [];

    for(let i = 0; i < nStages - 1; ++i) {
        const stage = i + 2;
        if(starkInfo.mapSectionsN[`cm${stage}`] > 0) {
            zkin[`s0_vals${stage}`] = [];
            zkin[`s0_siblings${stage}`] = [];
        }
        
    }

    zkin[`s0_vals${qStage}`] = [];
    zkin[`s0_siblings${qStage}`] = [];

    for (let i=1; i<friSteps.length; i++) {
        zkin[`s${i}_vals`] = [];
        zkin[`s${i}_siblings`] = [];
    }

    zkin.finalPol = [];

    if(nSubproofValues > 0) {
        zkin.subproofValues = [];
    }


    zkin.root1 = ["0", "0", "0", "0"];
    for(let i = 0; i < nStages - 1; ++i) {
        const stage = i + 2;
        zkin[`root${stage}`] = ["0", "0", "0", "0"];    
    }
    zkin[`root${qStage}`] = ["0", "0", "0", "0"];

    for (let i=0; i < nQueries; i++) {
        zkin.s0_valsC[i] = [];
        for(let j = 0; j < starkInfo.nConstants; j++) {
            zkin.s0_valsC[i][j] = "0";
        }

        for(let s = 0; s < nStages + 1; ++s) {
            const stage = s + 1;
            if(starkInfo.mapSectionsN[`cm${stage}`] > 0) {
                zkin[`s0_vals${stage}`][i] = [];
                for(let j = 0; j < starkInfo.mapSectionsN[`cm${stage}`]; j++) {
                    zkin[`s0_vals${stage}`][i][j] = "0";
                }
            }
        }


        zkin.s0_siblingsC[i] = [];
        for(let j = 0; j < friSteps[0].nBits; ++j) {
            zkin.s0_siblingsC[i][j] = ["0", "0", "0", "0"];
        }

        for(let s = 0; s < nStages + 1; ++s) {
            const stage = s + 1;
            if(starkInfo.mapSectionsN[`cm${stage}`] > 0) {
                zkin[`s0_siblings${stage}`][i] = [];
                for(let j = 0; j < friSteps[0].nBits; ++j) {
                    zkin[`s0_siblings${stage}`][i][j] = ["0", "0", "0", "0"];
                }
            }
        }   
    }

    for(let i = 0; i < nEvals; ++i) {
        zkin.evals[i] = ["0", "0", "0"];
    }

    for (let i=1; i<friSteps.length; i++) {
        zkin[`s${i}_root`] = ["0", "0", "0", "0"];
        for (let q=0; q<nQueries; q++) {
            zkin[`s${i}_vals`][q] = [];
            for(let j = 0; j < (1 << (friSteps[i-1].nBits - friSteps[i].nBits))*3; ++j) {
                zkin[`s${i}_vals`][q][j] = "0";
            }
            zkin[`s${i}_siblings`][q] = [];
            for(let j = 0; j < friSteps[i].nBits; ++j) {
                zkin[`s${i}_siblings`][q][j] = ["0", "0", "0", "0"];
            }
        }
    }
    
    const finalPolSize = 2**(friSteps[friSteps.length - 1].nBits);

    for(let i = 0; i < finalPolSize; i++) {
        zkin.finalPol[i] = ["0", "0", "0"];
    }

    if(nSubproofValues > 0) {
        for(let i = 0; i < nSubproofValues; i++) {
            zkin.subproofValues[i] = ["0", "0", "0"];
        }
    }

    zkin.enable = 0;
        
    return zkin;   
}

module.exports.challenges2zkinCircom = function challenges2zkinCircom(challenges, starkInfo, zkin) {
    for(let i=0; i < starkInfo.nStages; i++) {
        if(starkInfo.challengesMap.filter(c => c.stage === i + 1).length === 0) continue;
        zkin[`challengesStage${i+1}`] = [];
        for(let j = 0; j < starkInfo.challengesMap.filter(c => c.stage === i + 1).length; ++j) {
            zkin[`challengesStage${i+1}`][j] = challenges.challenges[i][j];
        }       
    }
    
    let qStage = starkInfo.nStages + 1;     
    let evalsStage = starkInfo.nStages + 2; 
    let friStage = starkInfo.nStages + 3;


    zkin.challengeQ = challenges.challenges[qStage - 1];
    zkin.challengeXi = challenges.challenges[evalsStage - 1];
    zkin.challengesFRI = challenges.challenges[friStage - 1];

    zkin.challengesFRISteps = challenges.challengesFRISteps;

    return zkin;
}

module.exports.challenges2zkin = function challenges2zkin(challenges, zkin) {
    zkin.challenges = [];
    for(let i=0; i < challenges.challenges.length; i++) {
        for(let j = 0; j < challenges.challenges[i].length; ++j) {
            zkin.challenges.push(challenges.challenges[i][j]);
        }       
    }

    zkin.challengesFRISteps = challenges.challengesFRISteps;
    
    return zkin;
}
