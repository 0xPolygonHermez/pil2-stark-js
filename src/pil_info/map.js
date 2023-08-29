
const { getExpDim } = require("./helpers/helpers.js");

module.exports = function map(res, symbols, expressions, stark) {  
    res.cmPolsMap = [];
    res.constPolsMap = [];

    res.mapSectionsN = {};

    res.mapSectionsN["tmpExp"] = 0;
    
    mapCmAndConstPols(res, symbols);

    mapLibPols(res, expressions, stark);

    mapImPols(res, expressions, stark);

    res.qDim = getExpDim(res, expressions, res.cExp, stark);

    res.mapSectionsN["q_ext"] = res.qDim;
	
    if(stark) {
        res.mapSectionsN["cmQ"] = 0;
        for (let i=0; i<res.qDeg; i++) {
            addPol(res, "cmQ", `Q${i}`, res.qDim, res.qs[i]);
        }
        res.mapSectionsN["f_ext"] = 3;

        setMapOffsets(res);   
    }
}

function mapCmAndConstPols(res, symbols) {
    res.mapSectionsN["const"] = 0;
    res.mapSectionsN["cm1"] = 0;
    for(let i = 0; i < symbols.length; ++i) {
        if(!["witness", "fixed"].includes(symbols[i].type)) continue;
        const stage = symbols[i].type === "witness" ? "cm1" : "const";
        addPol(res, stage, symbols[i].name, 1, symbols[i].polId);
    }
}

function mapLibPols(res, expressions, stark) {
    let nCommits = res.nCommitments;
    for(let i = 0; i < Object.keys(res.libs).length; ++i) {
        const libName = Object.keys(res.libs)[i];
        const lib = res.libs[libName];
        for(let j = 0; j < lib.length; ++j) {
            const libStage = lib[j];
            const stage = 2 + j;
            for(let k = 0; k < Object.keys(libStage.pols).length; ++k) {
                const name = Object.keys(libStage.pols)[k];
                if(libStage.pols[name].tmp) {
                    const polId = libStage.pols[name].id;
                    if (!res.imPolsMap[polId]) {
                        res.imPolsMap[polId] = {imPol: false, id: nCommits++};
                    }

                    res.imPolsMap[polId].libName = libName;
                    res.imPolsMap[polId].stage = j;
                    res.imPolsMap[polId].stageImPol = stage;
                    res.imPolsMap[polId].name = name;
                } else {
                    let dim = -1;

                    if(!res.mapSectionsN[`cm${stage}`]) res.mapSectionsN[`cm${stage}`] = 0;

                    for(let l = 0; l < libStage.hints.length; ++l) {
                        if(libStage.hints[l].outputs.includes(name)) {
                            for(let m = 0; m < libStage.hints[l].inputs.length; ++m) {
                                let inputPol = libStage.hints[l].inputs[m];
                                dim = Math.max(dim, getExpDim(res, expressions, libStage.pols[inputPol].id, stark));
                            }
                        }
                    }

                    if(dim === -1) dim = stark ? 3 : 1;

                    addPol(res,`cm${stage}`,`${libName}_${name}`, dim, libStage.pols[name].id);
                }
            }
        }
    }
}

function mapImPols(res, expressions, stark) {
    for (let i=0; i<Object.keys(res.imPolsMap).length; i++) {
        let id = Object.keys(res.imPolsMap)[i];
        let pol = res.imPolsMap[id];
        const stage = pol.stageImPol ? pol.stageImPol : 1;
        const section = pol.imPol ? "cm" + stage : "tmpExp";
        const dim = getExpDim(res, expressions, id, stark);

        if(!res.mapSectionsN[section]) res.mapSectionsN[section] = 0;

        const name = pol.imPol ? `ImPol${id}` : `TmpExp${id}`;
        addPol(res, section, name, dim, pol.id);

        if(pol.imPol) {
            res.cmPolsMap[pol.id].imPol = true;
        }

        if(pol.libName) {
            res.libs[pol.libName][pol.stage].pols[pol.name].id = pol.id;
        } 
    }
}

function addPol(res, stage, name, dim, pos) {
    const polsStage = res.cmPolsMap.filter((p) => p.stage == stage);
    const stagePos = polsStage.reduce((acc, p) => acc + p.dim, 0);
    if(stage === "const") {
        res.constPolsMap[pos] = { stage, name, dim, stagePos };
    } else {
        res.cmPolsMap[pos] = { stage, name, dim, stagePos };
    }
    res.mapSectionsN[stage] += dim;
}

function setMapOffsets(res) {
    const N = 1 << res.starkStruct.nBits;
    const Next = 1 << res.starkStruct.nBitsExt;

    res.mapOffsets = {};
    res.mapOffsets.cm1_n = 0;
    for(let i = 0; i < res.nLibStages; ++i) {
        const stage = 2 + i;
        res.mapOffsets["cm" + stage + "_n"] = res.mapOffsets["cm" + (stage - 1) + "_n"] + N * res.mapSectionsN["cm" + (stage - 1)];
    }
    res.mapOffsets.cmQ_n = res.mapOffsets["cm" + (res.nLibStages + 1) + "_n"] +  N * res.mapSectionsN["cm" + (res.nLibStages + 1)];
    res.mapOffsets.tmpExp_n = res.mapOffsets.cmQ_n +  N * res.mapSectionsN.cmQ;
    res.mapOffsets.cm1_ext = res.mapOffsets.tmpExp_n +  N * res.mapSectionsN.tmpExp;
    for(let i = 0; i < res.nLibStages; ++i) {
        const stage = 2 + i;
        res.mapOffsets["cm" + stage + "_ext"] = res.mapOffsets["cm" + (stage - 1) + "_ext"] + Next * res.mapSectionsN["cm" +  (stage - 1) ];
    }
    res.mapOffsets.cmQ_ext = res.mapOffsets["cm" + (res.nLibStages + 1) + "_ext"] +  Next * res.mapSectionsN["cm" + (res.nLibStages + 1)];
    res.mapOffsets.q_ext = res.mapOffsets.cmQ_ext +  Next * res.mapSectionsN.cmQ;
    res.mapOffsets.f_ext = res.mapOffsets.q_ext +  Next * res.mapSectionsN.q_ext;
    res.mapTotalN = res.mapOffsets.f_ext +  Next * res.mapSectionsN.f_ext;
}
