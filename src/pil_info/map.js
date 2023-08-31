
module.exports = function map(res, symbols, stark) {  
    res.cmPolsMap = [];
    res.constPolsMap = [];

    res.mapSectionsN = {};

    res.mapSectionsN["tmpExp"] = 0;
    
    mapSymbols(res, symbols);

    res.mapSectionsN["q_ext"] = res.qDim;
	
    if(stark) {
        res.mapSectionsN["cmQ"] = 0;
        for (let i=0; i<res.qDeg; i++) {
            addPol(res, "cmQ", `Q${i}`, res.qDim, res.qs[i]);
        }
        res.mapSectionsN["f_ext"] = 3;

        setMapOffsets(res);   
    }

    for(let i = 0; i < res.cmPolsMap.length; ++i) {
        let cm = res.cmPolsMap[i];
        cm.stagePos = res.cmPolsMap
            .slice(0, i)
            .filter((p) => p.stage == cm.stage)
            .reduce((acc, p) => acc + p.dim, 0);
    }
}

function mapSymbols(res, symbols) {
    let nCommits = res.nCommitments;
    for(let i = 0; i < symbols.length; ++i) {
        let symbol = symbols[i];
        if(!["witness", "fixed", "tmpPol"].includes(symbol.type)) continue;
        let stage;
        if(symbol.type === "fixed") {
            stage = "const";
        } else {
            if(!symbol.stage || symbol.stage === 0) throw new Error("Invalid witness stage");
            stage = "cm" + symbol.stage;
        }
        
        if(!res.mapSectionsN[stage]) res.mapSectionsN[stage] = 0;

        if(symbol.type === "tmpPol") {
            const [nameSpace, namePol] = symbol.name.split("."); 
            const im = symbol.imPol;
            if(!im) symbol.polId = nCommits++;        
            stage = im ? stage : "tmpExp";
            addPol(res, stage, symbol.name, symbol.dim, symbol.polId, im);
            if(res.libs[nameSpace]) {
                res.libs[nameSpace][symbol.stage - 2].pols[namePol].id = symbol.polId;
            }
        } else {
            addPol(res, stage, symbol.name, symbol.dim, symbol.polId);
        }
    }
}

function addPol(res, stage, name, dim, pos, imPol) {
    if(stage === "const") {
        res.constPolsMap[pos] = { stage, name, dim, stagePos: pos };
    } else {
        res.cmPolsMap[pos] = { stage, name, dim };
        if(imPol) res.cmPolsMap[pos].imPol = true;
    }
    res.mapSectionsN[stage] += dim;
}

function setMapOffsets(res) {
    const N = 1 << res.starkStruct.nBits;
    const extN = 1 << res.starkStruct.nBitsExt;

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
        res.mapOffsets["cm" + stage + "_ext"] = res.mapOffsets["cm" + (stage - 1) + "_ext"] + extN * res.mapSectionsN["cm" +  (stage - 1) ];
    }
    res.mapOffsets.cmQ_ext = res.mapOffsets["cm" + (res.nLibStages + 1) + "_ext"] +  extN * res.mapSectionsN["cm" + (res.nLibStages + 1)];
    res.mapOffsets.q_ext = res.mapOffsets.cmQ_ext +  extN * res.mapSectionsN.cmQ;
    res.mapOffsets.f_ext = res.mapOffsets.q_ext +  extN * res.mapSectionsN.q_ext;
    res.mapTotalN = res.mapOffsets.f_ext +  extN * res.mapSectionsN.f_ext;
}
