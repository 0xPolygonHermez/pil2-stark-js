const proofGen = require("../../prover/prover.js")

const parallelExec = false;
const useThreads = false;

module.exports = async function fflonkProve(zkey, cmPols, pilInfo, options = {}) {
    if(!"parallelExec" in options) options.parallelExec = parallelExec;
    if(!"useThreads" in options) options.useThreads = useThreads;

    return proofGen(cmPols, pilInfo, null, null, zkey, options);
}