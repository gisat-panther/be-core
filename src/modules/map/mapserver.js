function jsonToLineStringArray(json, lineStringArray = [], indentation = 0) {
    const ownProperties = Object.keys(json).filter((property) => !property.startsWith("_"));

    for (const property of ownProperties) {
        if (typeof json[property] === "object" && json[property] instanceof Array) {
            if (json[property].length) {
                if (
                    property.toLowerCase() === "colorrange"
                    || property.toLowerCase() === "datarange"
                    || property.toLowerCase() === "color"
                ) {
                    const values = json[property].map((value) => {
                        if (value instanceof Array) {
                            return value.map((arrayValue) => {
                                return isNaN(arrayValue) ? `"${arrayValue}"` : arrayValue
                            }).join(" ");
                        } else {
                            return isNaN(value) ? `"${value}"` : value
                        }
                    });
                    lineStringArray.push(`${' '.repeat(indentation)} ${property.toUpperCase()} ${values.join(" ")}`)
                } else {
                    lineStringArray.push(`${' '.repeat(indentation)} ${property.toUpperCase()}`);

                    for (const value of json[property]) {
                        if (typeof value === "object") {
                            jsonToLineStringArray(value, lineStringArray, indentation + 2);
                        } else {
                            lineStringArray.push(`${' '.repeat(indentation + 2)} ${isNaN(value) ? `"${value}"` : value}`);
                        }
                    }

                    lineStringArray.push(`${' '.repeat(indentation)} END`);
                }
            }
        } else if (typeof json[property] === "object") {
            if (
                property.toLowerCase() === "config"
                || property.toLowerCase() === "processing"
            ) {
                for (const property2 of Object.keys(json[property])) {
                    lineStringArray.push(`${' '.repeat(indentation)} ${property.toUpperCase()} "${property2}" "${json[property][property2]}"`);
                }
            } else {
                lineStringArray.push(`${' '.repeat(indentation)} ${property.toUpperCase()}`);

                jsonToLineStringArray(json[property], lineStringArray, indentation + 2);

                lineStringArray.push(`${' '.repeat(indentation)} END`);
            }
        } else {
            if (
                property.toLowerCase() === "units"
                || property.toLowerCase() === "status"
                || property.toLowerCase() === "type"
                || !isNaN(json[property])
            ) {
                lineStringArray.push(`${' '.repeat(indentation)} ${property.toUpperCase()} ${json[property]}`);
            } else if (
                property.toLowerCase() === "expression"
            ) {
                lineStringArray.push(`${' '.repeat(indentation)} ${property.toUpperCase()} (${json[property]})`);
            } else {
                lineStringArray.push(`${' '.repeat(indentation)} ${property.toUpperCase()} "${json[property]}"`);
            }
        }
    }
    return lineStringArray;
}

function getMapfileString(json) {
    const lineStringArray = [];

    lineStringArray.push("MAP");

    jsonToLineStringArray(json, lineStringArray, 2);

    lineStringArray.push("END");

    return lineStringArray.join("\n");
}

module.exports = {
    getMapfileString
}