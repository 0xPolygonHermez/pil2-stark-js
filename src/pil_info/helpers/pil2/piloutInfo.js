const ProtoOut = require("pilcom2/src/proto_out.js");
const { formatExpressions, formatConstraints, formatSymbols, formatHints } = require("./utils");

module.exports.getPiloutInfo = function getPiloutInfo(res, pilout, stark) {
    res.airId = pilout.airId;
    res.subproofId = pilout.subproofId;
    
    const constraints = formatConstraints(pilout);
    
    let saveSymbols = pilout.symbols ? false : true;
    let expressions, symbols;
    if(!saveSymbols) {
        const e = formatExpressions(pilout, stark);
        expressions = e.expressions;
        symbols = formatSymbols(pilout, stark);
    } else {
        const e = formatExpressions(pilout, stark, true);
        expressions = e.expressions;
        symbols = e.symbols;
    }

    symbols = symbols.filter(s => !["witness", "fixed"].includes(s.type) || s.airId === res.airId && s.subproofId === res.subproofId);

    res.pilPower = Math.log2(pilout.numRows);
    res.nCommitments = symbols.filter(s => s.type === "witness" && s.airId === res.airId && s.subproofId === res.subproofId).length;
    res.nConstants = symbols.filter(s => s.type === "fixed" && s.airId === res.airId && s.subproofId === res.subproofId).length;
    res.nPublics = symbols.filter(s => s.type === "public").length;
    const subproofValues = [];
    for(let i = 0; i < symbols.length; ++i) {
        const symbol = symbols[i];
        if(symbol.type !== "subproofvalue") continue;
        if(!subproofValues.find(s => s.subproofId === symbol.subproofId && s.id === symbol.id)) {
            subproofValues.push(symbol);
        }
    }

    res.subproofValuesIds = subproofValues.map(s => s.id).sort();
    res.nSubproofValues = subproofValues.length;
    
    if(pilout.numChallenges) {
        res.numChallenges = pilout.numChallenges;
    } else {
        res.numChallenges = new Array(Math.max(...symbols.map(s => s.stage || 0))).fill(0);
    }
    
    const airHints = pilout.hints?.filter(h => h.airId === res.airId && h.subproofId === res.subproofId) || [];
    const hints = formatHints(pilout, airHints, symbols, stark, saveSymbols);

    const publicsNames = symbols.filter(s => s.type === "public").map(s => s.name);

    return {expressions, hints, constraints, symbols, publicsNames};
}

module.exports.getFixedPolsPil2 = function getFixedPolsPil2(pil, cnstPols, F) {        
    const P = new ProtoOut();

    for(let i = 0; i < cnstPols.$$defArray.length; ++i) {
        const def = cnstPols.$$defArray[i];
        const name = def.name;
        const [nameSpace, namePol] = name.split(".");
        const deg = def.polDeg;
        const fixedCols = pil.fixedCols[i];
        for(let j = 0; j < deg; ++j) {
            if(def.idx) {
                cnstPols[nameSpace][namePol][def.idx][j] = P.buf2bint(fixedCols.values[j]);
            } else {
                cnstPols[nameSpace][namePol][j] = P.buf2bint(fixedCols.values[j]);
            }
        }
    }
}
    
