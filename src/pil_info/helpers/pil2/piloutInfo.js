const ProtoOut = require("pil2-compiler/src/proto_out.js");
const { formatExpressions, formatConstraints, formatSymbols, formatHints } = require("./utils");

module.exports.getPiloutInfo = function getPiloutInfo(res, pilout, stark) {
    res.airId = pilout.airId;
    res.airgroupId = pilout.airgroupId;
    
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

    symbols = symbols.filter(s => !["witness", "fixed"].includes(s.type) || s.airId === res.airId && s.airgroupId === res.airgroupId);

    const airGroupValues = pilout.airGroupValues || [];
    res.pilPower = Math.log2(pilout.numRows);
    res.nCommitments = symbols.filter(s => s.type === "witness" && s.airId === res.airId && s.airgroupId === res.airgroupId).length;
    res.nConstants = symbols.filter(s => s.type === "fixed" && s.airId === res.airId && s.airgroupId === res.airgroupId).length;
    res.nPublics = symbols.filter(s => s.type === "public").length;
    res.airGroupValues = airGroupValues;
    if(pilout.numChallenges) {
        res.nStages = pilout.numChallenges.length;
    } else {
        const numChallenges = symbols.length > 0 ? new Array(Math.max(...symbols.map(s => s.stage || 0))).fill(0) : [];
        res.nStages = numChallenges.length;
    }
    
    const airHints = pilout.hints?.filter(h => h.airId === res.airId && h.airGroupId === res.airgroupId) || [];
    const hints = formatHints(pilout, airHints, symbols, expressions, stark, saveSymbols);

    return {expressions, hints, constraints, symbols};
}

module.exports.getFixedPolsPil2 = function getFixedPolsPil2(pil, cnstPols, F) {        
    const P = new ProtoOut();

    for(let i = 0; i < cnstPols.$$defArray.length; ++i) {
        const def = cnstPols.$$defArray[i];
        const id = def.id;
        const deg = def.polDeg;
        const fixedCols = pil.fixedCols[i];
        for(let j = 0; j < deg; ++j) {
            const constPol = cnstPols[id];
            constPol[j] = P.buf2bint(fixedCols.values[j]);
        }
    }
}
    
