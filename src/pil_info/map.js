module.exports = function map(res, symbols) {  
    mapSymbols(res, symbols);
    setStageInfoSymbols(res, symbols);

    res.nCommitmentsStage1 = res.cmPolsMap.filter(p => p.stage === "cm1" && !p.imPol).length;
}

function mapSymbols(res, symbols) {
    let nCommits = res.nCommitments;
    for(let i = 0; i < symbols.length; ++i) {
    let symbol = symbols[i];
        if(["witness", "fixed", "tmpPol"].includes(symbol.type)) {
            if(symbol.type === "fixed") {
                symbol.stageId = symbol.polId;
            } else {
                if(isNaN(symbol.stage) || (symbol.type === "witness" && symbol.stage === 0)) throw new Error("Invalid witness stage");
            }
            

            if(symbol.type === "tmpPol") {
                if(symbol.imPol) {
                    throw new Error("Something went wrong!");
                } else {
                    symbol.polId = nCommits++;
                    symbol.stage = "tmpExp";
                }
            }
            addPol(res, symbol);
        } else if(symbol.type === "challenge") {
            res.challengesMap[symbol.id] = {name: symbol.name, stage: symbol.stage, dim: symbol.dim, stageId: symbol.stageId};
        }
    }
}

function addPol(res, symbol) {
    const ref = symbol.type === "fixed" ? res.constPolsMap : res.cmPolsMap;
    const pos = symbol.polId;
    const stage = symbol.type === "tmpPol" ? "tmpExp" : symbol.stage;
    const name = symbol.name;
    const dim = symbol.dim;
    ref[pos] = {stage, name, dim, cmPolsMapId: pos};
    if(symbol.stageId >= 0) ref[pos].stageId = symbol.stageId;
    if(symbol.type === "tmpPol") {
        res.mapSectionsN["tmpExp"] += dim;
    } else if(symbol.type === "fixed") {
        res.mapSectionsN["const"] += dim;
    } else {
        res.mapSectionsN["cm" + stage] += dim;
    }
    if(symbol.lengths) ref[pos].lengths = symbol.lengths;
    if(symbol.imPol) ref[pos].imPol = symbol.imPol;
}

function setStageInfoSymbols(res, symbols) {
    const qStage = res.nStages + 1;
    for(let i = 0; i < symbols.length; ++i) {
        const symbol = symbols[i];
        if(!["fixed", "witness", "tmpPol"].includes(symbol.type)) continue;
        const polsMapName = symbol.type === "fixed" ? "constPolsMap" : "cmPolsMap";
        if(symbol.type === "witness"){
            const prevPolsStage = res[polsMapName]
            .filter((p, index) => p.stage === symbol.stage && index < symbol.polId);

            symbol.stagePos = prevPolsStage.reduce((acc, p) => acc + p.dim, 0);
            res.cmPolsMap[symbol.polId].stagePos = symbol.stagePos;
            if(!symbol.stageId) {
                symbol.stageId = symbol.stage === qStage 
                    ? prevPolsStage.length 
                    : res[polsMapName].filter(p => p.stage === symbol.stage).findIndex(p => p.name === symbol.name);
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
