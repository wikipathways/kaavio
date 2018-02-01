import "source-map-support/register";

const fs = require("fs-extra");
import * as ndjson from "ndjson";
import * as path from "path";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import {
  //compact,
  defaults,
  uniq,
  values
} from "lodash/fp";
import * as React from "react";
import * as ReactDOM from "react-dom";

// TODO why doesn't "import * as name" work with Webpack for the following packages?
const hl = require("highland");
import { Parser, Validator } from "collit";
const program = require("commander");
const VError = require("verror");

import { Diagram } from "./components/Diagram";
import { arrayify } from "./spinoffs/jsonld-utils";

import * as edgeDrawerMap from "./drawers/edges/index";
import * as filterDrawerMap from "./drawers/filters/index";
import * as markerDrawerMap from "./drawers/markers/index";
import * as customStyle from "./drawers/styles/__bundled_dont_edit__";
// This file is just for testing purposes, so we're only using a placeholder set
// of icons here.
import { Icons } from "./drawers/icons/__bundled_dont_edit__";

const npmPackage = require("../package.json");

const readdir = hl.wrapCallback(fs.readdir);
const ensureFile = hl.wrapCallback(fs.ensureFile);
const readFile = hl.wrapCallback(fs.readFile);

program
  .version(npmPackage.version)
  .description(
    "FOR TESTING PURPOSES ONLY! Convert Kaavio-formatted JSON to SVG"
  )
  .arguments("[source] [target]")
  .usage(
    "[source] [target]. If specified, must be a filepath. Default: standard in and standard out for source and target, respectively."
  )
  .option(
    "-s, --static [boolean]",
    "Exclude extra DOM attributes, such as data-reactid, that React uses internally. Default: true",
    (s: string) => ["", "true"].indexOf(s) > -1,
    true
  )
  .option(
    "--hide [target1,target2,target3...]",
    `Specify entities to hide. 
		target: entity id, type or textContent

		Examples:
			--hide b99fe
			--hide b99fe,abd6e
			--hide ensembl:ENSG00000124762
			--hide b99fe,ensembl:ENSG00000124762`,
    (s: string) => {
      return s;
    },
    []
  )
  .option(
    "--highlight [color=target1,target2,target3]",
    `Specify entities to highlight.
		To use multiple colors, you can specify multiple "--highlight" options.

		color: hex value or CSS/SVG color keyword
			<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#Color_keywords>
		target: entity id or typeof value

		If target contains a comma, you must URL encode it, e.g.,
			mytext,moretext => mytext%2Cmoretext

		Examples:
			--highlight red=b99fe
			--highlight ff000=b99fe
			--highlight "#ff000=b99fe"
			--highlight red=b99fe,abd6e
			--highlight red=ensembl:ENSG00000124762
			--highlight red=b99fe,ensembl:ENSG00000124762
			--highlight 66c2a5=b99fe --highlight 8da0cb=ensembl:ENSG00000124762`,
    (s: string, acc) => {
      const [color, targetString] = s.split(/=/);
      acc.push({
        color,
        targets: targetString.split(",").map(decodeURIComponent)
      });
      return acc;
    },
    []
  )
  .on("--help", function() {
    console.log(`
			Examples:

			Convert Kaavio-formatted JSON into SVG:
			$ ./bin/json2svgForTesting WP100.json WP100.svg

			Convert streaming:
			$ cat WP100.json | ./bin/json2svgForTesting > WP100.svg

			Convert streaming w/ pretty output:
      $ ../bulk-gpml2pvjson/wikipathways-20170910-json-Homo_sapiens-unified/WP554.json | ./bin/json2svgForTesting | xmllint --pretty 2 - | pygmentize -O encoding=UTF-8 -l xml
			`);
  });

program.parse(process.argv);

const [source, target] = program.args;

if (["-", "/dev/stdin"].indexOf(source) > -1) {
  console.warn("To use standard in as source, just don't specify a [source].");
}

if (["-", "/dev/stdout"].indexOf(target) > -1) {
  console.warn("To use standard out as target, just don't specify a [target].");
}

const inputStream = !source ? process.stdin : fs.createReadStream(source);
const outputStream = !target ? process.stdout : fs.createWriteStream(target);

// If stdin not being piped to json2svg and no source arg specified, output help.
if (process.stdin.isTTY && !inputStream) program.help();

const { static: staticMarkup, hide, highlight } = program;

const hiddenEntities = arrayify(hide);
const highlightedEntities = arrayify(highlight).reduce(function(
  acc,
  { color: rawColor, targets }
) {
  let color;
  if (Validator.isColor(rawColor)) {
    color = Parser.parseColor(rawColor);
  } else {
    const colorSecondTry = "#" + rawColor;
    if (Validator.isColor(colorSecondTry)) {
      color = Parser.parseColor(colorSecondTry);
    } else {
      throw new Error(
        `
						Could not parse provided highlight color ${rawColor}
						`
      );
    }
  }
  targets.forEach(function(target) {
    acc.push({ target, color: color.hex });
  });
  return acc;
}, []);

const render = staticMarkup ? renderToStaticMarkup : renderToString;

hl(inputStream)
  .through(ndjson.parse())
  //      .flatMap(function(input) {
  //        const entitiesWithText = values(input.entityMap).filter(entity =>
  //          entity.hasOwnProperty("textContent")
  //        );
  //        const fontFamilies = compact(
  //          uniq(
  //            entitiesWithText.map(
  //              (entity: Record<string, any>) => entity.fontFamily
  //            )
  //          )
  //        );
  //
  //        /* this was an older version
  //        return hl(nodeTextSizer.loadWrapprMap(fontFamilies)).map(function(
  //          wrapprMap
  //        ) {
  //          entitiesWithText.forEach(function(entity: Record<string, any>) {
  //            const {
  //              fontFamily,
  //              fontSize,
  //              textContent,
  //              width,
  //              padding
  //            } = entity;
  //            var lines = wrapprMap[fontFamily].wrap(
  //              textContent,
  //              fontSize,
  //              width - padding
  //            );
  //            console.log("lines");
  //            console.log(lines);
  //          });
  //
  //          return input;
  //        });
  //				//*/
  //
  //        return hl(
  //          nodeTextSizer.loadOpentypeLayoutMap(fontFamilies)
  //        ).map(function(opentypeLayoutMap) {
  //          entitiesWithText.forEach(function(entity: Record<string, any>) {
  //            const {
  //              fontFamily,
  //              fontSize,
  //              textContent,
  //              width,
  //              padding
  //            } = entity;
  //            console.log(`trying to use opentypeLayoutMap[${fontFamily}]`);
  //            console.log(opentypeLayoutMap);
  //            var lines = opentypeLayoutMap[fontFamily](textContent, {
  //              //fontSize,
  //              width: width - padding
  //            });
  //            console.log("lines");
  //            console.log(lines);
  //          });
  //
  //          return input;
  //        });
  //      })
  /*
      .flatMap(function(input) {
        console.log("iconPath");
        console.log(iconPath);
        return hl(
          //import { Icons } from iconPath;
          Promise.resolve()
            .then(function() {
              console.log("iconPath");
              console.log(iconPath);
              return require(iconPath);
            })
            .then(function(imported) {
              console.log("imported");
              console.log(imported);
              //const Icons = require(iconPath);
              //input.Icons = imported.Icons;
              return input;
            })
        );
      })
      //*/
  .map(function(input) {
    input.Icons = Icons;

    /*
        console.log("input");
        console.log(input);
        //*/
    return render(
      <Diagram
        customStyle={customStyle}
        edgeDrawerMap={edgeDrawerMap}
        filterDrawerMap={filterDrawerMap}
        markerDrawerMap={markerDrawerMap}
        highlightedEntities={highlightedEntities}
        hiddenEntities={hiddenEntities}
        Icons={input.Icons}
        pathway={input.pathway}
        entityMap={input.entityMap}
      />
    );
  })
  .errors(function(err) {
    console.error("err");
    console.error(err);
    process.exitCode = 1;
  })
  .pipe(outputStream);

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
