
const ExpressionOps = require("../../expressionops.js");

module.exports = function generatePublicCalculators(res, pil) {
    const E = new ExpressionOps();

    const publics = [];
    res.publicsCode = [];
    for (let i=0; i<pil.publics.length; i++) {
        let expId;
        if (pil.publics[i].polType == "cmP") {
            expId = pil.expressions.findIndex(e => e.op === "cm" && e.id === pil.publics[i].polId);
            if(expId === -1) {
                pil.expressions.push(E.cm(pil.publics[i].polId, false, 1));
                expId = pil.expressions.length-1;
            }  
        } else {
            expId = pil.publics[i].polId;
        }
        
        publics.push({expId, idx: pil.publics[i].idx});
    }
    return publics;
}