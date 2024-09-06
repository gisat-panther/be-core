const fsp = require('fs/promises');

async function loadRawStyle(path) {
    try {
        return (await fsp.readFile(path)).toString();
    } catch (e) {
        console.log(e);
    }
}

async function getJsonStyle(rawStyle) {
    const rawStyleLines = rawStyle.split("\n");
    const styleClasses = [];
    for (const rawStyleLine of rawStyleLines) {
        const rawStyleParts = rawStyleLine.split(": ");
        const value = Number(rawStyleParts[0].trim());
        const color = rawStyleParts[1].trim();
        const colorParts = color.split(",");
        const [r, g, b, opacity] = colorParts.map(Number);

        if (r && g && b && opacity) {
            const jsonStyle = {
                name: `${value}`,
                expression: `[pixel] = ${value}`,
                style: {
                    color: [
                        r, g, b
                    ]
                }
            }

            styleClasses.push(jsonStyle);
        }
    }

    return styleClasses;
}

async function init() {
    const rawStyle = await loadRawStyle("panther-apps/worldCereal/assets/confidence.style.txt");
    if (rawStyle) {
        const jsonStyle = await getJsonStyle(rawStyle);
        try {
            await fsp.writeFile("panther-apps/worldCereal/assets/confidence.style.json", JSON.stringify(jsonStyle, null, 2));
            console.log("Parsed!");
        } catch(e) {
            console.log(e);
        }
    }
}

init();