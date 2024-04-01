const fs = require("fs");
const version = require("../package").version;

const pil2circom = require("./pil2circom.js");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const argv = require("yargs")
    .version(version)
    .usage("node main_pil2circom.js -o <verifier.circom> -v <verification_key.json> -s <starkinfo.json> -e <expressionsinfo.json> [--skipMain] [--enableInput] [--verkeyInput]")
    .alias("s", "starkinfo")
    .alias("e", "expressionsinfo")
    .alias("v", "verkey")
    .alias("o", "output")
    .argv;

async function run() {
    const starkInfoFile = typeof(argv.starkinfo) === "string" ?  argv.starkinfo.trim() : "starkinfo.json";
    const expressionsInfoFile = typeof(argv.expressionsinfo) === "string" ? argv.expressionsinfo.trim() : "expressionsinfo.json";
    const outputFile = typeof(argv.output) === "string" ?  argv.output.trim() : "mycircuit.verifier.circom";

    const starkInfo = JSON.parse(await fs.promises.readFile(starkInfoFile, "utf8"));
    const expressionsInfo = JSON.parse(await fs.promises.readFile(expressionsInfoFile, "utf8"));
    
    const options = {
        skipMain: argv.skipMain || false,
        enableInput: argv.enableInput || false,
        verkeyInput: argv.verkeyInput || false,
    }

    console.log("Options: ", options);
    let constRoot;

    if(!options.verkeyInput) {
        const verKeyFile = typeof(argv.verkey) === "string" ?  argv.verkey.trim() : "mycircuit.verkey.json";
        const verKey = JSONbig.parse(await fs.promises.readFile(verKeyFile, "utf8"));
        constRoot = verKey.constRoot;
    } 
    

    if(starkInfo.starkStruct.verificationHashType === "BN128") {
        options.arity = starkInfo.merkleTreeArity || 16;
        options.custom = starkInfo.merkleTreeCustom || false;
        options.transcriptArity = options.custom ? starkInfo.merkleTreeArity : 16;
    }

    const verifier = await pil2circom(constRoot, starkInfo, expressionsInfo, options);

    await fs.promises.writeFile(outputFile, verifier, "utf8");

    console.log("file Generated Correctly");

}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

