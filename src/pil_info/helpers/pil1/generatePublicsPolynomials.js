
const ExpressionOps = require("../../expressionops.js");

module.exports.generatePublicsPolynomials = function generatePublicsPolynomials(res, expressions, publicsInfo) {
    const E = new ExpressionOps();

    const publics = [];
    res.publicsCode = [];
    for (let i=0; i<publicsInfo.length; i++) {
        let expId;
        if (publicsInfo[i].polType == "cmP") {
            expId = expressions.findIndex(e => e.op === "cm" && e.id === publicsInfo[i].polId);
            if(expId === -1) {
                const stage = 1;
                const dim = 1;
                expressions.push(E.cm(publicsInfo[i].polId, 0, stage, dim));
                expId = expressions.length-1;
            }  
        } else {
            expId = publicsInfo[i].polId;
        }
        
        expressions[expId].dim = 1;
        publics.push({expId, idx: publicsInfo[i].idx});
    }
    return publics;
}