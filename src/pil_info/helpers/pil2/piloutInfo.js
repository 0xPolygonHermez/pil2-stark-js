const ProtoOut = require("pilcom2/src/proto_out.js");
const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray");
const { formatExpressions, formatConstraints, formatSymbols } = require("./utils");

module.exports.getPiloutInfo = function getPiloutInfo(res, pilout, stark) {
    const numChallenges = pilout.symbols.filter(s => s.type === 8).reduce((acc, s) => {
        if(!acc[s.stage - 2]) acc[s.stage - 2] = 0;
        acc[s.stage - 2]++;
        return acc; 
    },[]);

    res.nLibStages = numChallenges.length;

    const constraints = formatConstraints(pilout);
    const symbols = formatSymbols(pilout, stark);
    
    
    res.nCommitments = symbols.filter(s => s.type === "witness").length;
    res.nConstants = symbols.filter(s => s.type === "fixed").length;
    res.nPublics = symbols.filter(s => s.type === "public").length;

    const expressions = formatExpressions(pilout, symbols, stark);

    const publicsInfo = [];

    const hints = [];

    return {expressions, hints, constraints, symbols, publicsInfo};
}

module.exports.getFixedPolsPil2 = function getFixedPolsPil2(pil, F) {

    const cnstPols = newConstantPolsArrayPil2(pil.symbols, pil.numRows, F);
        
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

    return cnstPols;
}
    
