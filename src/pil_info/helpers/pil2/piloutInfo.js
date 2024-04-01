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

    const aggregationTypes = pilout.aggregationTypes || [];
    res.pilPower = Math.log2(pilout.numRows);
    res.nCommitments = symbols.filter(s => s.type === "witness" && s.airId === res.airId && s.subproofId === res.subproofId).length;
    res.nConstants = symbols.filter(s => s.type === "fixed" && s.airId === res.airId && s.subproofId === res.subproofId).length;
    res.nPublics = symbols.filter(s => s.type === "public").length;
    res.aggregationTypes = aggregationTypes;
    res.nSubAirValues = pilout.aggregationTypes 
        ? aggregationTypes.length 
        : symbols.filter(s => s.type === "subproofValue" && s.subproofId === res.subproofId).length;
    if(pilout.numChallenges) {
        res.nStages = pilout.numChallenges.length;
    } else {
        const numChallenges = new Array(Math.max(...symbols.map(s => s.stage || 0))).fill(0);
        res.nStages = numChallenges.length;
    }
    
    const airHints = pilout.hints?.filter(h => h.airId === res.airId && h.subproofId === res.subproofId) || [];
    const hints = formatHints(pilout, airHints, symbols, expressions, stark, saveSymbols);

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
    
