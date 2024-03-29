module.exports = function map(res, symbols, expressions, stark, debug) {  
    for(let i = 0; i < expressions.length; i++) {
        if(expressions[i].keep && !expressions[i].imPol) {
            const symbol = { type: "tmpPol", name: `tmpPol${i}`, expId: i, stage: expressions[i].stage, dim: expressions[i].dim, subproofId: res.subproofId, airId: res.airId };
            symbols.push(symbol);
        }    
    }

    mapSymbols(res, symbols);

    res.mapSectionsN["q_ext"] = res.qDim;
	
    if(stark) {
        const qStage = res.numChallenges.length + 1;
        res.mapSectionsN[`cm${qStage}_n`] = 0;
        res.mapSectionsN[`cm${qStage}_ext`] = 0;
        for (let i=0; i<res.qDeg; i++) {
            const symbol = {
                stage: qStage,
                dim: res.qDim,
                name: `Q${i}`,
                polId: res.qs[i],
                stageId: i,
            }
            addPol(res, `cm${qStage}`, symbol);
        }
        res.mapSectionsN["f_ext"] = 3;

        if(!debug) setMapOffsets(res);   
    }
    
    
    setStageInfoSymbols(res, symbols);

    addHintsInfo(res, symbols, expressions);

    setSymbolsStage(res, symbols);
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
    if(symbol.imPol) ref[pos].imPol = symbol.imPol;
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
    const qStage = res.numChallenges.length + 1;
    res.mapOffsets[`cm${qStage}_n`] = res.mapOffsets["cm" + res.numChallenges.length + "_n"] +  N * res.mapSectionsN["cm" + res.numChallenges.length + "_n"];
    res.mapOffsets.tmpExp_n = res.mapOffsets[`cm${qStage}_n`] +  N * res.mapSectionsN[`cm${qStage}_n`];
    res.mapOffsets.cm1_ext = res.mapOffsets.tmpExp_n +  N * res.mapSectionsN.tmpExp_n;
    for(let i = 0; i < res.numChallenges.length - 1; ++i) {
        const stage = 2 + i;
        res.mapOffsets["cm" + stage + "_ext"] = res.mapOffsets["cm" + (stage - 1) + "_ext"] + extN * res.mapSectionsN["cm" +  (stage - 1) + "_ext"];
    }
    res.mapOffsets[`cm${qStage}_ext`] = res.mapOffsets["cm" + res.numChallenges.length + "_ext"] +  extN * res.mapSectionsN["cm" + res.numChallenges.length + "_ext"];
    res.mapOffsets.q_ext = res.mapOffsets[`cm${qStage}_ext`] +  extN * res.mapSectionsN[`cm${qStage}_ext`];
    res.mapOffsets.f_ext = res.mapOffsets.q_ext +  extN * res.mapSectionsN.q_ext;
    res.mapTotalN = res.mapOffsets.f_ext +  extN * res.mapSectionsN.f_ext;
}

function setSymbolsStage(res, symbols) {
    res.symbolsStage = [];
    for(let i = 0; i < res.numChallenges.length + 1; ++i) {
        res.symbolsStage[i] = symbols.filter(s => s.stage === i).map(s => {
            if(s.type === "challenge") {
                return {
                    op: "challenge",
                    stage: s.stage,
                    stageId: s.stageId,
                    id: s.id,
                }
            } else if(s.type === "witness" || (s.type === "tmpPol" && s.imPol)) {
                return {
                    op: "cm",
                    stage: s.stage,
                    stageId: s.stageId,
                    id: s.polId,
                }
            } else if(s.type === "tmpPol" && !s.imPol) {
                return {
                    op: "tmp",
                    stage: s.stage,
                    stageId: s.stageId,
                    id: s.polId,
                }
            } else if(s.type === "fixed") {
                return {
                    op: "const",
                    stage: s.stage,
                    id: s.stageId,
                }
            } else if(["public", "subproofValue", "challenge"].includes(s.type)) {
                return {
                    op: s.type,
                    stage: s.stage,
                    id: s.id,
                }
            }
        })
    }
}

function setStageInfoSymbols(res, symbols) {
    const qStage = res.numChallenges.length + 1;
    for(let i = 0; i < symbols.length; ++i) {
        const symbol = symbols[i];
        if(!["fixed", "witness", "tmpPol"].includes(symbol.type)) continue;
        const polsMapName = symbol.type === "fixed" ? "constPolsMap" : "cmPolsMap";
        const stage = symbol.type === "fixed" ? "const" : "cm" + symbol.stage;
        if(symbol.type === "witness" || (symbol.type === "tmpPol" && symbol.imPol)){
            const prevPolsStage = res[polsMapName]
            .filter((p, index) => p.stage === stage && index < symbol.polId);

            symbol.stagePos = prevPolsStage.reduce((acc, p) => acc + p.dim, 0);
            res.cmPolsMap[symbol.polId].stagePos = symbol.stagePos;
            if(!symbol.stageId) {
                symbol.stageId = symbol.stage === qStage 
                    ? prevPolsStage.length 
                    : res[polsMapName].filter(p => p.stageNum === symbol.stage).findIndex(p => p.name === symbol.name);
                res.cmPolsMap[symbol.polId].stageId = symbol.stageId;
            }
        } else if(symbol.type === "tmpPol") {
            const prevPolsStage = res.cmPolsMap.filter((p, index) => p.stage === "tmpExp" && index < symbol.polId);
            symbol.stagePos = prevPolsStage.reduce((acc, p) => acc + p.dim, 0);
            symbol.stageId = prevPolsStage.length;
            res.cmPolsMap[symbol.polId].stagePos = symbol.stagePos;
            res.cmPolsMap[symbol.polId].stageId = symbol.stageId;
        }
    }
}


function addHintsInfo(res, symbols, expressions) {
    for(let i = 0; i < res.hints.length; ++i) {
        const hint = res.hints[i];
        const hintSymbols = [];
        const keysHint = Object.keys(hint);
        const hintField = [];
        for(let j = 0; j < keysHint.length; ++j) {
            const key = keysHint[j];
            if(key === "name") continue;
            if(hint[key].op === "exp") {
                hintField.push(key);
                const symbol = symbols.find(s => s.expId === hint[key].id);
                if(symbol) {
                    const op = symbol.type === "witness" || (symbol.type === "tmpPol" && symbol.imPol) ? "cm" : "tmp";
                    const dest = { op, stage: symbol.stage, stageId: symbol.stageId, id: symbol.polId};
                    hint[key] = dest;
                    hintSymbols.push(dest);
                } else {
                    hintSymbols.push(...expressions[hint[key].id].symbols);
                }
            } else if(!key.includes("reference")) {
                hintField.push(key);
                if(["cm", "challenge"].includes(hint[key].op)) {
                    hintSymbols.push({op: hint[key].op, stage: hint[key].stage, stageId: hint[key].stageId, id: hint[key].id});
                } else if(["public", "subproofValue", "const"].includes(hint[key].op)) {
                    hintSymbols.push({op: hint[key].op, stage: hint[key].stage, id: hint[key].id});
                }
            } else {
                if(!hint.dest) hint.dest = []; 
                const hintDest = { op: hint[key].op, stage: hint[key].stage };
                if(["cm", "challenge"].includes(hintDest.op)) {
                    hintDest.id = hint[key].id;
                    hintDest.stageId = hint[key].stageId;
                } else if(["public", "subproofValue"].includes(hintDest.op)) {
                    hintDest.id = hint[key].id;
                }
                hint.dest.push(hintDest);
                delete hint[key];
            }
        }

        hint.fields = hintField;

        const uniqueSymbolsSet = new Set();

        hintSymbols.forEach((symbol) => { uniqueSymbolsSet.add(JSON.stringify(symbol)); });
          
        hint.symbols = Array.from(uniqueSymbolsSet).map((symbol) => JSON.parse(symbol))
            .sort((a, b) => a.stage !== b.stage ? a.stage - b.stage : a.op !== b.op ? b.op.localeCompare(a.op) : a.stageId - b.stageId);
    }
}
