module.exports = function map(res, symbols, stark, debug) {  
    mapSymbols(res, symbols);

    if(stark) {
        const qStage = res.nStages + 1;
        res.mapSectionsN[`cm${qStage}`] = 0;
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
    }
    
    
    setStageInfoSymbols(res, symbols);

    addHintsInfo(res, symbols);

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
        } else if(symbol.type === "challenge") {
            res.challengesMap[symbol.id] = {name: symbol.name, stageNum: symbol.stage, dim: symbol.dim, stageId: symbol.stageId};
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
    res.mapSectionsN[stage] += dim;
    if(symbol.imPol) ref[pos].imPol = symbol.imPol;
}

function setSymbolsStage(res, symbols) {
    res.symbolsStage = [];
    for(let i = 0; i < res.nStages + 1; ++i) {
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
    const qStage = res.nStages + 1;
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


function addHintsInfo(res, symbols) {
    for(let i = 0; i < res.hints.length; ++i) {
        const hint = res.hints[i];

        const hintFields = [];

        const fields = Object.keys(hint);
    
        for(let j = 0; j < fields.length; ++j) {
            const field = fields[j];
            if(field === "name") continue;
            if(hint[field].op === "exp") {
                const symbol = symbols.find(s => s.expId === hint[field].id);
                if(!symbol) throw new Error("Something went wrong!");
                const op = symbol.type === "witness" || (symbol.type === "tmpPol" && symbol.imPol) ? "cm" : "tmp";
                const id = symbol.polId;
                hintFields.push({name: field, op, id});
            } else if(["cm", "challenge", "public"].includes(hint[field].op)) {
                hintFields.push({name: field, op: hint[field].op, id: hint[field].id});
            } else if(["public", "subproofValue", "const"].includes(hint[field].op)) {
                hintFields.push({name: field, op: hint[field].op, id: hint[field].id});
            } else if(hint[field].op === "number") {
                hintFields.push({name: field, op: "number", value: hint[field].value});
            } else throw new Error("Invalid hint op: " + hint[field].op);
        }


        res.hints[i] = {
            name: hint.name,
            fields: hintFields,
        }
    }
}
