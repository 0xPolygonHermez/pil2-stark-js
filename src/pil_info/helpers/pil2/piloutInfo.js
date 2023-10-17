const ProtoOut = require("pilcom2/src/proto_out.js");
const { formatExpressions, formatConstraints, formatSymbols, calculatePublics } = require("./utils");

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

    res.pilPower = Math.log2(pilout.numRows);
    res.nCommitments = symbols.filter(s => s.type === "witness" && s.airId === res.airId && s.subproofId === res.subproofId).length;
    res.nConstants = symbols.filter(s => s.type === "fixed" && s.airId === res.airId && s.subproofId === res.subproofId).length;
    res.nPublics = symbols.filter(s => s.type === "public").length;
    res.numChallenges = pilout.numChallenges || [0];

    const hints = pilout.hints || [];

    const publicsInfo = calculatePublics(hints, pilout, symbols, stark, saveSymbols);

    return {expressions, hints, constraints, symbols, publicsInfo};
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
    
