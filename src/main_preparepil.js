const fs = require("fs");
const version = require("../package").version;

const F3g = require("./helpers/f3g.js");
const { compile } = require("pilcom");
const { compile: compilePil2 } = require("pilcom2");
const { preparePil } = require("./pil_info/helpers/preparePil");

const argv = require("yargs")
    .version(version)
    .usage("node main_preparepil.js -p <pil.json> [-P <pilconfig.json] -s <starkstruct.json> -f <infopil.json>")
    .alias("p", "pil")
    .alias("P", "pilconfig")
    .alias("s", "starkstruct")
    .alias("f", "infopil")
    .alias("v", "pil2")
    .alias("m", "impolsstages")
    .string("subproofId")
    .string("airId")
    
    .argv;

async function run() {
    const F = new F3g();

    const pilFile = typeof(argv.pil) === "string" ?  argv.pil.trim() : "mycircuit.pil";
    const pilConfig = typeof(argv.pilconfig) === "string" ? JSON.parse(fs.readFileSync(argv.pilconfig.trim())) : {};

    const starkStructFile = typeof(argv.starkstruct) === "string" ?  argv.starkstruct.trim() : "mycircuit.stark_struct.json";
    
    const infoPilFile = typeof(argv.infopil) === "string" ?  argv.infopil.trim() : "mycircuit.infopil.json";

    const pil2 = argv.pil2 || false;

    let pil;
    if(pil2) {
        pil = await compilePil2(F, pilFile, null, pilConfig);
    } else {
        pil = await compile(F, pilFile, null, pilConfig);
    }

    const starkStruct = JSON.parse(await fs.promises.readFile(starkStructFile, "utf8"));

    const options = { debug: false };

    if(starkStruct.verificationHashType === "BN128") {
        options.arity = starkStruct.merkleTreeArity || 16;
        options.custom = starkStruct.merkleTreeCustom || false;
    }
    
    options.imPolsStages = argv.impolsstages || false;

    const infoPil = preparePil(F, pil, starkStruct, true, pil2, options);

    let maxDeg =  (1 << (starkStruct.nBitsExt - starkStruct.nBits)) + 1;

    const infoPilJSON = { maxDeg, cExpId: infoPil.res.cExpId, qDim: infoPil.res.qDim, ...infoPil };

    await fs.promises.writeFile(infoPilFile, JSON.stringify(infoPilJSON, null, 1), "utf8");

    console.log("files Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

