
module.exports = function map(res, symbols, stark, debug) {  
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

        if(!debug) setMapOffsets(res);   
    }

    setStageInfoSymbols(res, symbols);
}

function mapSymbols(res, symbols) {
    let nCommits = res.nCommitments;
    for(let i = 0; i < symbols.length; ++i) {
        let symbol = symbols[i];
        if(["witness", "fixed", "tmpPol"].includes(symbol.type)) {
            let stage;
            if(symbol.type === "fixed") {
                stage = "const";
            } else {
                if(!symbol.stage || symbol.stage === 0) throw new Error("Invalid witness stage");
                stage = "cm" + symbol.stage;
            }
            
            if(!res.mapSectionsN[stage]) res.mapSectionsN[stage] = 0;

            if(symbol.type === "tmpPol") {
                const im = symbol.imPol;
                if(!im) {
                    symbol.polId = nCommits++;  
                    stage = "tmpExp";      
                }
                addPol(res, stage, symbol.name, symbol.dim, symbol.polId);
            } else {
                addPol(res, stage, symbol.name, symbol.dim, symbol.polId);
            }
        }
    }
}

function addPol(res, stage, name, dim, pos) {
    if(stage === "const") {
        res.constPolsMap[pos] = { stage, name, dim };
    } else {
        res.cmPolsMap[pos] = { stage, name, dim };
    }
    res.mapSectionsN[stage] += dim;
}

function setMapOffsets(res) {
    const N = 1 << res.starkStruct.nBits;
    const extN = 1 << res.starkStruct.nBitsExt;

    res.mapOffsets = {};
    res.mapOffsets.cm1_n = 0;
    for(let i = 0; i < res.numChallenges.length - 1; ++i) {
        const stage = 2 + i;
        res.mapOffsets["cm" + stage + "_n"] = res.mapOffsets["cm" + (stage - 1) + "_n"] + N * res.mapSectionsN["cm" + (stage - 1)];
    }
    res.mapOffsets.cmQ_n = res.mapOffsets["cm" + res.numChallenges.length + "_n"] +  N * res.mapSectionsN["cm" + res.numChallenges.length];
    res.mapOffsets.tmpExp_n = res.mapOffsets.cmQ_n +  N * res.mapSectionsN.cmQ;
    res.mapOffsets.cm1_ext = res.mapOffsets.tmpExp_n +  N * res.mapSectionsN.tmpExp;
    for(let i = 0; i < res.numChallenges.length - 1; ++i) {
        const stage = 2 + i;
        res.mapOffsets["cm" + stage + "_ext"] = res.mapOffsets["cm" + (stage - 1) + "_ext"] + extN * res.mapSectionsN["cm" +  (stage - 1) ];
    }
    res.mapOffsets.cmQ_ext = res.mapOffsets["cm" + res.numChallenges.length + "_ext"] +  extN * res.mapSectionsN["cm" + res.numChallenges.length];
    res.mapOffsets.q_ext = res.mapOffsets.cmQ_ext +  extN * res.mapSectionsN.cmQ;
    res.mapOffsets.f_ext = res.mapOffsets.q_ext +  extN * res.mapSectionsN.q_ext;
    res.mapTotalN = res.mapOffsets.f_ext +  extN * res.mapSectionsN.f_ext;
}

function setStageInfoSymbols(res, symbols) {
    for(let i = 0; i < symbols.length; ++i) {
        const symbol = symbols[i];
        if(!["fixed", "witness", "tmpPol"].includes(symbol.type)) continue;
        const polsMapName = symbol.type === "fixed" ? "constPolsMap" : "cmPolsMap";
        const stage = symbol.type === "fixed" ? "const" : "cm" + symbol.stage;
        if(symbol.type === "witness" || symbol.type === "tmpPol"){
            const prevPolsStage = res[polsMapName]
            .filter((p, index) => p.stage === stage && index < symbol.polId);

            symbol.stagePos = prevPolsStage.reduce((acc, p) => acc + p.dim, 0);
            symbol.stageId = prevPolsStage.length;
        }
    }
}
