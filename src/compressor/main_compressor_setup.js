const fs = require("fs");
const version = require("../../package").version;

const F3g = require("../helpers/f3g.js");
const {readR1cs} = require("r1csfile");
const plonkSetupC18 = require("./compressor18_setup.js");
const plonkSetupC12 = require("./compressor12_setup.js");
const { writeExecFile } = require("./exec_helpers");


const argv = require("yargs")
    .version(version)
    .usage("node main_compressor_setup.js -r <verifier.c12.r1cs> -p <verifier.c12.pil> -c <verifier.c12.const> -e <verifier.c12.exec> [--forceNBits=23]")
    .alias("r", "r1cs")
    .alias("c", "const")  // Output file required to build the constants
    .alias("p", "pil")    // Proposed PIL
    .alias("e", "exec")   // File required to execute
    .string("cols")
    .argv;

async function run() {
    const F = new F3g();

    const r1csFile = typeof(argv.r1cs) === "string" ?  argv.r1cs.trim() : "mycircuit.verifier.r1cs";
    const constFile = typeof(argv.const) === "string" ?  argv.const.trim() : "mycircuit.c12.const";
    const pilFile = typeof(argv.pil) === "string" ?  argv.pil.trim() : "mycircuit.c12.pil";
    const execFile = typeof(argv.exec) === "string" ?  argv.exec.trim() : "mycircuit.c12.exec";

    let cols = argv.cols ? Number(argv.cols) : 12;

    const {exec, pilStr, constPols} = await compressorSetup(F, r1csFile, cols);

    const fd =await fs.promises.open(execFile, "w+");
    await fd.write(exec);
    await fd.close();

    await fs.promises.writeFile(pilFile, pilStr, "utf8");
    
    await constPols.saveToFile(constFile);

    console.log("files Generated Correctly");

}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

async function compressorSetup(F, r1csFile, cols) {
    const r1cs = await readR1cs(r1csFile, {F: F, logger:console });

    const options = {
        forceNBits: argv.forceNBits
    };
    
    if(![12,18].includes(cols)) throw new Error("Invalid number of cols");

    let res;
    if(cols === 12) {
        res = await plonkSetupC12(F, r1cs, options);
    } else {
        res = await plonkSetupC18(F, r1cs, options);
    }

    const exec = await writeExecFile(res.plonkAdditions, res.sMap);

    return {exec, pilStr: res.pilStr, constPols: res.constPols};
}

module.exports.compressorSetup = compressorSetup;