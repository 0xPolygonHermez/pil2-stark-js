
const {pilCodeGen, buildCode} = require("../../codegen.js");
const ExpressionOps = require("../../expressionops.js");
const { iterateCode } = require("../helpers.js");

module.exports = function generatePublicCalculators(res, pil, ctx) {
    const E = new ExpressionOps();

    res.publicsCode = [];
    for (let i=0; i<pil.publics.length; i++) {
        let expId;
        if (pil.publics[i].polType == "cmP") {
            expId = pil.expressions.findIndex(e => e.op === "cm" && e.id === pil.publics[i].polId);
            if(expId === -1) {
                pil.expressions.push(E.cm(pil.publics[i].polId));
                expId = pil.expressions.length-1;
            }  
        } else {
            expId = pil.publics[i].polId;
        }
        
        pilCodeGen(ctx, pil.expressions, pil.polIdentities, expId, 0);
        res.publicsCode[i] = buildCode(ctx, pil.expressions);
        res.publicsCode[i].idx = pil.publics[i].idx;
        iterateCode(res.publicsCode[i], "n", fixRef);
    }

    function fixRef(r, ctx) {
        const p = r.prime ? 1 : 0;
        if (r.type === "exp") {
            if (typeof ctx.expMap[p][r.id] === "undefined") {
                ctx.expMap[p][r.id] = ctx.code.tmpUsed++;
            }
            delete r.prime;
            r.type= "tmp";
            r.id= ctx.expMap[p][r.id];
        }
    }
}