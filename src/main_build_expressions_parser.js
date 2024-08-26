const { generateParser } = require("./stark/chelpers/generateParser");
const fs = require("fs");
const { getAllOperations, getGlobalOperations } = require("./stark/chelpers/utils");

const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage("node main_build_expressions_parser.js -c <chelpers.cpp>")
    .alias("c", "chelpers")
    .argv;

async function run() {
    const cHelpersFile = typeof (argv.chelpers) === "string" ? argv.chelpers.trim() : "mycircuit.chelpers";
        
    const parser = generateParser();

    console.log(getGlobalOperations());
    
    const cHelpersStepsHpp = [
        `#ifndef CHELPERS_STEPS_HPP`,
        `#define CHELPERS_STEPS_HPP`,
        `#include "expressions_builder.hpp"\n`,
        `class CHelpersSteps : public ExpressionsBuilder {`,
        "public:",
    ];
      

    cHelpersStepsHpp.push(parser);
    cHelpersStepsHpp.push("};\n");
    cHelpersStepsHpp.push("#endif")

    await fs.promises.writeFile(cHelpersFile, cHelpersStepsHpp.join("\n"), "utf8");

    console.log("Generic parser generated correctly");
}

run().then(() => {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});