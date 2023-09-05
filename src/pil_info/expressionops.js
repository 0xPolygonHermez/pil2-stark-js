class ExpressionOps {

    add(a, b) {
        if (!a) return b;
        if (!b) return a;
        return {
            op: "add",
            values: [ a, b]
        }
    }

    sub(a, b) {
        if (!a) return b;
        if (!b) return a;
        return {
            op: "sub",
            values: [ a, b]
        }
    }

    mul(a, b) {
        if (!a) return b;
        if (!b) return a;
        return {
            op: "mul",
            values: [ a, b]
        }
    }

    neg(a) {
        return {
            op: "neg",
            values: [a]
        }
    }

    exp(id, rowOffset = 0, stage) {
        return {
            op: "exp",
            id: id,
            rowOffset: rowOffset,
            stage: stage,
        }
    }

    cm(id, rowOffset = 0, stage, dim = 1) {
        if(stage === undefined) {
            throw new Error("Stage not defined for cm " + id);
        }
        return {
            op: "cm",
            id,
            stage: stage,
            dim,
            rowOffset
        }
    }

    const(id, rowOffset = 0, stage = 0, dim = 1) {
        console.log(stage);
        if(stage !== 0) throw new Error("Const must be declared in stage 0");
        return {
            op: "const",
            id,
            rowOffset,
            dim, 
            stage
        }
    }

 
    challenge(name, stage, dim, id) {
        return {
            op: "challenge",
            name,
            id,
            stage,
            dim,
        };
    }

    number(n) {
        return {
            op: "number",
            value: BigInt(n)
        }
    }

    eval(id, dim) {
        return {
            op: "eval",
            id,
            dim,
        }
    }

    xDivXSubXi(opening, id) {
        return {
            op: "xDivXSubXi",
            opening,
            id,
        }
    }

    zi(boundary, frameId) {
        return {
            op: "Zi",
            boundary,
            frameId,
        }
    }

    x() {
        return {
            op: "x"
        }
    }

}

module.exports = ExpressionOps;
