const fs = require("fs");
const path = require("path");
const version = require("../package").version;
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const protobuf = require('protobufjs');

const F3g = require("./helpers/f3g.js");
const { newConstantPolsArray, compile } = require("pilcom");
const { buildConstTree } = require("./stark/stark_buildConstTree");

const { compile: compilePil2 } = require("pilcom2");
const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray");

const argv = require("yargs")
    .version(version)
    .usage("node main_buildconsttree.js -c const.bin -p <pil.json> [-P <pilconfig.json>] -s <starkinfo.json> -t <consttree.bin>  -v <verification_key.json>")
    .alias("c", "const")
    .alias("p", "pil")
    .alias("P", "pilconfig")
    .alias("s", "starkinfo")
    .alias("t", "consttree")
    .alias("v", "verkey")
    .argv;

async function run() {
    const F = new F3g();

    const pilFile = typeof(argv.pil) === "string" ?  argv.pil.trim() : "mycircuit.pil";
    const pilConfig = typeof(argv.pilconfig) === "string" ? JSON.parse(fs.readFileSync(argv.pilconfig.trim())) : {};
    const constFile = typeof(argv.const) === "string" ?  argv.const.trim() : "mycircuit.const";
    const starkInfoFile = typeof(argv.starkinfo) === "string" ?  argv.starkinfo.trim() : "mycircuit.stark_struct.json";
    const constTreeFile = typeof(argv.consttree) === "string" ?  argv.consttree.trim() : "mycircuit.consttree";
    const verKeyFile = typeof(argv.verkey) === "string" ?  argv.verkey.trim() : "mycircuit.verkey.json";

    const starkInfo = JSON.parse(await fs.promises.readFile(starkInfoFile, "utf8"));

    let constPols;
    if(starkInfo.pil2) {
        const tmpPath = path.resolve(__dirname, '../tmp');
        if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
        let pilConfig = { piloutDir: tmpPath};
        await compilePil2(F, pilFile, null, pilConfig);
        
        const piloutEncoded = fs.readFileSync(path.join(tmpPath, "pilout.ptb"));
        const pilOutProtoPath = path.resolve(__dirname, '../node_modules/pilcom2/src/pilout.proto');
        const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
        let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
        
        const pil = pilout.subproofs[0].airs[0];
        pil.symbols = pilout.symbols;
        
        constPols = newConstantPolsArrayPil2(pil.symbols, pil.numRows, F);
    } else {
        const pil = await compile(F, pilFile, null, pilConfig);
        constPols = newConstantPolsArray(pil, F);
    }

    await constPols.loadFromFile(constFile);


    const {MH, constTree, verKey} = await buildConstTree(starkInfo, constPols);

    await fs.promises.writeFile(verKeyFile, JSONbig.stringify(verKey, null, 1), "utf8");

    await MH.writeToFile(constTree, constTreeFile);

    console.log("files Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});