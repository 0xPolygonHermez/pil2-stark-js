const { pilCodeGen, buildCode } = require("./helpers/code/codegen");
const { addInfoExpressions } = require("./helpers/helpers");
const { formatExpressions, formatSymbols } = require("./helpers/pil2/utils");

module.exports.getGlobalConstraintsInfo = function getGlobalConstraintsInfo(pilout, stark) {
    
    const constraints = pilout.constraints.map(c => {  return { e: c.expressionIdx.idx, boundary: "finalProof", line: c.debugLine } });

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

    for(let i = 0; i < constraints.length; ++i) {
        addInfoExpressions(symbols, expressions, expressions[constraints[i].e], stark);
    }
   
    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        expMap: [],
        dom: "n",
        stark,
    };

    const constraintsCode = [];

    for(let j = 0; j < constraints.length; ++j) {
        pilCodeGen(ctx, symbols, expressions, constraints[j].e, 0);
        let code = buildCode(ctx, expressions);
        code.boundary = constraints[j].boundary;
        code.line = constraints[j].line;

        constraintsCode.push(code);
    }   
    
    return constraintsCode;
}
