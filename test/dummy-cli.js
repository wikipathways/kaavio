const path = require("path");
const createJson2SvgCLI = require("../es5/createJson2SvgCLI").createJson2SvgCLI;
const npmPackage = require("../package.json");

// TODO: for the css below, I just want the CSS string,
// but the .css -> .d.ts compiler doesn't specify a default export.
// Importing as * as blah yields an object, not a string.
// Both require and import + extract default work, but they look ugly.
/*
//import DiagramCustomStyle from "./DiagramCustomStyle.css";
import * as DiagramCustomStyleModule from "./DiagramCustomStyle.css";
const DiagramCustomStyle = DiagramCustomStyleModule["default"];
//*/

//import * as theme from "../themes/silly/theme";
const theme = require("./dummy-themes/silly/theme");
// TODO what is the best way to handle CSS when using tsc?
// Compiling w/ webpack is really slow for the CLI.
// how about using this: https://github.com/longlho/ts-transform-css-modules
/*
const DiagramCustomStylePlain = require("./themes/styles/Diagram.plain.css");
const DiagramCustomStyleDark = require("./themes/styles/Diagram.dark.css");
//*/
//*
const fs = require("fs");
const DiagramCustomStyle = fs.readFileSync(
  path.resolve(__dirname, "dummy-themes/styles/Diagram.silly.css"),
  "utf8"
);
//*/

theme.diagramStyle = DiagramCustomStyle;

createJson2SvgCLI(npmPackage, [
  {
    name: "silly",
    theme: theme
  }
]);

/*
./bin/json2svgForTesting ./WP4.json 

cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | ./bin/json2svgForTesting > output.svg

cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | jq -c '(. | .entitiesById[] | select(.dbId == "HMDB00161")) as {id: $id} | .entitiesById[$id].drawAs |= "wikidata:Q218642" | .entitiesById[$id].height=81' | ./bin/json2svgForTesting --static true | sed 's/\[\]$//' > output.svg

cat ../bulk-gpml2pvjson/wikipathways-20170910-json-Homo_sapiens-unified/WP106.json | jq -c '(. | .entitiesById[] | select(has("wikidata"))) as {id: $id, width: $width, wikidata: $wikidata} | .entitiesById[$id].drawAs |= $wikidata | .entitiesById[$id].height |= $width' | ./bin/json2svgForTesting --static true | sed 's/\[\]$//' > output.svg

cat ../bulk-gpml2pvjson/wikipathways-20170910-gpml-Homo_sapiens/Hs_Apoptosis-related_network_due_to_altered_Notch3_in_ovarian_cancer_WP2864_79278.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | ./bin/json2svgForTesting --highlighted red=abd6e > output.svg

cat ../bulk-gpml2pvjson/wikipathways-20170910-json-Homo_sapiens-unified/WP2864.json | ./bin/json2svgForTesting --highlighted green=b99fe,ensembl:ENSG00000124762 > output.svg

TODO what about coloring of text vs. edge for Chloroplast in this pathway:
http://www.wikipathways.org/index.php/Pathway:WP2623
//*/
