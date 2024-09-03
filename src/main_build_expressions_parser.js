const { generateParser } = require("./stark/chelpers/generateParser");
const fs = require("fs");

const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage("node main_build_expressions_parser.js -c <chelpers.cpp>")
    .alias("c", "chelpers")
    .string("parserType")
    .argv;

async function run() {
    const expressionsFile = typeof (argv.chelpers) === "string" ? argv.chelpers.trim() : "mycircuit.chelpers";
        
    let parserType = "avx";

    if(argv.parserType) {
        if(!["avx", "avx512","pack"].includes(argv.parserType)) throw new Error("Invalid parser type");
        parserType = argv.parserType;
    }

    const parser = generateParser(parserType);
    
    const expressionsFilename = parserType === "avx" ? `EXPRESSIONS_AVX_HPP` : parserType === "avx512" ? "EXPRESSIONS_AVX512_HPP" : "EXPRESSIONS_PACK_HPP";
    
    const expressionsClass = parserType === "avx" ? `ExpressionsAvx` : parserType === "avx512" ? "ExpressionsAvx512" : "ExpressionsPack";

    const expressionsHpp = [
        `#ifndef ${expressionsFilename}`,
        `#define ${expressionsFilename}`,
        `#include "expressions_ctx.hpp"\n`,
        `class ${expressionsClass} : public ExpressionsCtx {`,
        "public:",
    ];
      

    expressionsHpp.push(parser);
    expressionsHpp.push("};\n");
    expressionsHpp.push("#endif")

    await fs.promises.writeFile(expressionsFile, expressionsHpp.join("\n"), "utf8");

    console.log("Generic parser generated correctly");
}

run().then(() => {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});