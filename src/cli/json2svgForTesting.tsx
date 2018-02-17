import "source-map-support/register";
import * as edgeDrawerMap from "../drawers/edges/index";
import * as filterDrawerMap from "../drawers/filters/index";
import * as markerDrawerMap from "../drawers/markers/index";
//import * as customSVGStyle from "./drawers/styles/__bundled_dont_edit__";
// This file is just for testing purposes, so we're only using a placeholder set
// of defs here.
import { Defs } from "../drawers/defs/__bundled_dont_edit__";

const npmPackage = require("../../package.json");

import { createJson2SvgCLI } from "../createJson2SvgCLI";

createJson2SvgCLI(npmPackage, [
  {
    name: "plain",
    backgroundColor: "white",
    //customSVGStyle: customSVGStyle,
    edgeDrawerMap,
    filterDrawerMap,
    Defs: Defs,
    markerDrawerMap
  }
]);

/*
./bin/json2svgForTesting ./WP4.json 

cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | ./bin/json2svgForTesting > output.svg

cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | jq -c '(. | .entityMap[] | select(.dbId == "HMDB00161")) as {id: $id} | .entityMap[$id].drawAs |= "wikidata:Q218642" | .entityMap[$id].height=81' | ./bin/json2svgForTesting --static true | sed 's/\[\]$//' > output.svg

cat ../bulk-gpml2pvjson/wikipathways-20170910-json-Homo_sapiens-unified/WP106.json | jq -c '(. | .entityMap[] | select(has("wikidata"))) as {id: $id, width: $width, wikidata: $wikidata} | .entityMap[$id].drawAs |= $wikidata | .entityMap[$id].height |= $width' | ./bin/json2svgForTesting --static true | sed 's/\[\]$//' > output.svg

cat ../bulk-gpml2pvjson/wikipathways-20170910-gpml-Homo_sapiens/Hs_Apoptosis-related_network_due_to_altered_Notch3_in_ovarian_cancer_WP2864_79278.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | ./bin/json2svgForTesting --highlight red=abd6e > output.svg

cat ../bulk-gpml2pvjson/wikipathways-20170910-json-Homo_sapiens-unified/WP2864.json | ./bin/json2svgForTesting --highlight green=b99fe,ensembl:ENSG00000124762 > output.svg

TODO what about coloring of text vs. edge for Chloroplast in this pathway:
http://www.wikipathways.org/index.php/Pathway:WP2623
//*/
