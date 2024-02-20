
module.exports = function map(res, symbols, stark, debug) {  
    mapSymbols(res, symbols);

    res.mapSectionsN["q_ext"] = res.qDim;
	
    if(stark) {
        res.mapSectionsN["cmQ_n"] = 0;
        res.mapSectionsN["cmQ_ext"] = 0;
        const qStage = res.numChallenges.length + 1;
        for (let i=0; i<res.qDeg; i++) {
            const symbol = {
                stage: qStage,
                dim: res.qDim,
                name: `Q${i}`,
                polId: res.qs[i],
                stageId: i,
            }
            addPol(res, "cmQ", symbol);
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
                symbol.stageId = symbol.polId;
            } else {
                if(!symbol.stage || symbol.stage === 0) throw new Error("Invalid witness stage");
                stage = "cm" + symbol.stage;
            }
            
            if(!res.mapSectionsN[stage + "_n"]) {
                res.mapSectionsN[stage + "_n"] = 0;
                if(stage !== "tmpExp") res.mapSectionsN[stage + "_ext"] = 0;

            }

            if(symbol.type === "tmpPol") {
                const im = symbol.imPol;
                if(!im) {
                    symbol.polId = nCommits++;  
                    stage = "tmpExp";      
                }
            } 
            addPol(res, stage, symbol);
        }
    }
}

function addPol(res, stage, symbol) {
    const ref = stage === "const" ? res.constPolsMap : res.cmPolsMap;
    const pos = symbol.polId;
    const stageNum = symbol.stage;
    const name = symbol.name;
    const dim = symbol.dim;
    const imPol = symbol.imPol || false;
    ref[pos] = {stage, stageNum, name, dim, imPol};
    if(symbol.stageId >= 0) ref[pos].stageId = symbol.stageId;
    res.mapSectionsN[stage + "_n"] += dim;
    if(stage !== "tmpExp") res.mapSectionsN[stage + "_ext"] += dim;
}

function setMapOffsets(res) {
    const N = 1 << res.starkStruct.nBits;
    const extN = 1 << res.starkStruct.nBitsExt;

    res.mapOffsets = {};
    res.mapOffsets.cm1_n = 0;
    for(let i = 0; i < res.numChallenges.length - 1; ++i) {
        const stage = 2 + i;
        res.mapOffsets["cm" + stage + "_n"] = res.mapOffsets["cm" + (stage - 1) + "_n"] + N * res.mapSectionsN["cm" + (stage - 1) + "_n"];
    }
    res.mapOffsets.cmQ_n = res.mapOffsets["cm" + res.numChallenges.length + "_n"] +  N * res.mapSectionsN["cm" + res.numChallenges.length + "_n"];
    res.mapOffsets.tmpExp_n = res.mapOffsets.cmQ_n +  N * res.mapSectionsN.cmQ_n;
    res.mapOffsets.cm1_ext = res.mapOffsets.tmpExp_n +  N * res.mapSectionsN.tmpExp_n;
    for(let i = 0; i < res.numChallenges.length - 1; ++i) {
        const stage = 2 + i;
        res.mapOffsets["cm" + stage + "_ext"] = res.mapOffsets["cm" + (stage - 1) + "_ext"] + extN * res.mapSectionsN["cm" +  (stage - 1) + "_ext"];
    }
    res.mapOffsets.cmQ_ext = res.mapOffsets["cm" + res.numChallenges.length + "_ext"] +  extN * res.mapSectionsN["cm" + res.numChallenges.length + "_ext"];
    res.mapOffsets.q_ext = res.mapOffsets.cmQ_ext +  extN * res.mapSectionsN.cmQ_ext;
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
            if(res.cmPolsMap[symbol.polId].stage !== "tmpExp") {
                const prevPolsStage = res[polsMapName]
                .filter((p, index) => p.stage === stage && index < symbol.polId);

                symbol.stagePos = prevPolsStage.reduce((acc, p) => acc + p.dim, 0);
                res.cmPolsMap[symbol.polId].stagePos = symbol.stagePos;
                if(!symbol.stageId) {
                    symbol.stageId = prevPolsStage.length;
                    res.cmPolsMap[symbol.polId].stageId = symbol.stageId;
                }
            } else {
                const prevPolsStage = res.cmPolsMap.filter((p, index) => p.stage === "tmpExp" && index < symbol.polId);
                symbol.stagePos = prevPolsStage.reduce((acc, p) => acc + p.dim, 0);
                symbol.stageId = prevPolsStage.length;
                res.cmPolsMap[symbol.polId].stagePos = symbol.stagePos;
                res.cmPolsMap[symbol.polId].stageId = symbol.stageId;

            }
        }
    }
}
