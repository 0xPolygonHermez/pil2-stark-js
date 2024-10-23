const { printExpressions } = require("./helpers/pil2/utils");

module.exports = function map(res, symbols, expressions, constraints, options) {
    mapSymbols(res, symbols);
    setStageInfoSymbols(res, symbols);

    for(let i = 0; i < constraints.length; ++i) {
        if(constraints[i].filename === `${res.name}.ImPol`) {
            try {
                constraints[i].line = printExpressions(res, expressions[constraints[i].e], expressions, true);
                constraints[i].imPol = true;
            } catch(e) {
                constraints[i].line = "";
            }  
        }
        constraints[i].line += " == 0";
    }

    console.log("----------------- INTERMEDIATE POLYNOMIALS -----------------");
    res.imPolsInfo = { baseField: [], extendedField: []};
    const imPols = res.cmPolsMap.filter(i => i.imPol === true);
    for(let i = 0; i < imPols.length; ++i) {
        if(!options.recursion) {
            const imPolExpression = printExpressions(res, expressions[imPols[i].expId], expressions);
            if(i > 0) console.log("------------------------------------------------------------");
            console.log(`Intermediate polynomial ${i} columns: ${imPols[i].dim}`);
            console.log(imPolExpression);
            if(imPols[i].dim == 1) {
                res.imPolsInfo.baseField.push(imPolExpression);
            } else {
                res.imPolsInfo.extendedField.push(imPolExpression);
            }
        }
    }
    res.nCommitmentsStage1 = res.cmPolsMap.filter(p => p.stage === "cm1" && !p.imPol).length; 
}

function mapSymbols(res, symbols) {
    for(let i = 0; i < symbols.length; ++i) {
    let symbol = symbols[i];
        if(["witness", "fixed"].includes(symbol.type)) {
            if(symbol.type === "fixed") {
                symbol.stageId = symbol.polId;
            } else {
                if(isNaN(symbol.stage) || (symbol.type === "witness" && symbol.stage === 0)) throw new Error("Invalid witness stage");
            }
            
            addPol(res, symbol);
        } else if(symbol.type === "challenge") {
            res.challengesMap[symbol.id] = {name: symbol.name, stage: symbol.stage, dim: symbol.dim, stageId: symbol.stageId};
        } else if(symbol.type === "public") {
            res.publicsMap[symbol.id] = {name: symbol.name, stage: symbol.stage};
        } else if(symbol.type === "airgroupvalue") {
            res.airgroupValuesMap[symbol.id] = { name: symbol.name, stage: symbol.stage };
        } else if(symbol.type == "airvalue") {
            res.airValuesMap[symbol.id] = { name: symbol.name, stage: symbol.stage };
        }
    }
}

function addPol(res, symbol) {
    const ref = symbol.type === "fixed" ? res.constPolsMap : res.cmPolsMap;
    const pos = symbol.polId;
    const stage = symbol.stage;
    const name = symbol.name;
    const dim = symbol.dim;
    ref[pos] = {stage, name, dim, polsMapId: pos};
    if(symbol.stageId >= 0) ref[pos].stageId = symbol.stageId;
    if(symbol.type === "fixed") {
        res.mapSectionsN["const"] += dim;
    } else {
        res.mapSectionsN["cm" + stage] += dim;
    }
    if(symbol.lengths) ref[pos].lengths = symbol.lengths;
    if(symbol.imPol) {
        ref[pos].imPol = symbol.imPol;
        ref[pos].expId = symbol.expId;
    }
}

function setStageInfoSymbols(res, symbols) {
    const qStage = res.nStages + 1;
    for(let i = 0; i < symbols.length; ++i) {
        const symbol = symbols[i];
        if(!["fixed", "witness"].includes(symbol.type)) continue;
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
        }
    }
}
