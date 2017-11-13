import "source-map-support/register";

import * as ndjson from "ndjson";
import * as path from "path";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import { defaults, uniq, values } from "lodash/fp";

import * as React from "react";
import * as ReactDOM from "react-dom";

// TODO why doesn't "import * as name" work with Webpack for the following packages?
const hl = require("highland");
const parent = require("parent-package-json");
import { Parser, Validator } from "collit";
const program = require("commander");
const VError = require("verror");

import { Diagram } from "./components/Diagram";

import * as edgeDrawerMapDefault from "./drawers/edges/__bundled_dont_edit__";
import * as filterDrawerMapDefault from "./drawers/filters/__bundled_dont_edit__";
import * as markerDrawerMapDefault from "./drawers/markers/__bundled_dont_edit__";
import * as customStyleDefault from "./drawers/styles/__bundled_dont_edit__";
import { Icons as IconsDefault } from "./drawers/icons/__bundled_dont_edit__";

import { arrayify } from "../src/spinoffs/jsonld-utils";

const npmPackage = require("../package.json");
//const exec = hl.wrapCallback(require("child_process").exec);
const pathToParent0 = parent(__dirname) ? parent(__dirname).path : false;
const pathToParent1 = parent(__dirname, 1) ? parent(__dirname, 1).path : false;
const dirs = uniq(
  [pathToParent1 || pathToParent0 || path.join(__dirname, "..")]
    .filter(p => !!p)
    .map(p => p.replace(/package\.json$/, ""))
);
/*
console.log(`__dirname: ${__dirname}`);
console.log(`pathToParent0: ${pathToParent0}`);
console.log(`pathToParent1: ${pathToParent1}`);
console.log("dirs");
console.log(dirs);
//*/

const fs = require("fs-extra");
const readdir = hl.wrapCallback(fs.readdir);
const ensureFile = hl.wrapCallback(fs.ensureFile);
const readFile = hl.wrapCallback(fs.readFile);

function pipeToFilepath(inputStream, destPath) {
  return ensureFile(destPath)
    .flatMap(success => readFile(destPath))
    .collect()
    .flatMap(function(originalContentChunks) {
      const destStream = fs.createWriteStream(destPath);

      const observerStream = hl([
        hl("finish", destStream),
        hl("error", destStream)
      ]).merge();

      inputStream.pipe(destStream);

      return observerStream.errors(function(err, push) {
        const augmentedErr = new VError(
          err,
          `Error in pipeToFilepath(${inputStream}, ${destPath}).`
        );
        pipeToFilepath(hl(originalContentChunks), destPath)
          .errors(function(revertErr, revertPush) {
            push(
              VError.errorFromList(
                augmentedErr,
                new VError(revertErr, `Failed to revert to initial contents.`)
              )
            );
          })
          .last()
          .each(function() {
            push(new VError(augmentedErr, `Reverted to initial contents.`));
          });
      });
    });
}

export function createJson2SvgCLI(
  name,
  edgeDrawerMap = edgeDrawerMapDefault,
  filterDrawerMap = filterDrawerMapDefault,
  markerDrawerMap = markerDrawerMapDefault,
  customStyle = customStyleDefault,
  Icons = IconsDefault
) {
  program
    .version(npmPackage.version)
    .description(`Run ${name} from the command line.`);

  program
    .command("json2svg [inputPath] [outputPath]")
    .description("Convert Kaavio-formatted JSON into SVG")
    .option(
      "-s, --static [boolean]",
      "Exclude extra DOM attributes, such as data-reactid, that React uses internally. Default: true",
      (s: string) => ["", "true"].indexOf(s) > -1
    )
    .option(
      "--hide [target1,target2,target3...]",
      `Specify entities to hide. 
			target: entity id, type or textContent

			Examples:
				--hide b99fe
				--hide b99fe,abd6e
				--hide ensembl:ENSG00000124762
				--hide b99fe,ensembl:ENSG00000124762`
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
    .action(function(inputPath, outputPath, optionsRaw) {
      const options = defaults(
        {
          static: true,
          hide: [],
          highlight: []
        },
        optionsRaw
      );
      const { static: staticMarkup, hide, highlight } = options;
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
      const inputStream = !!inputPath
        ? fs.createReadStream(inputPath)
        : process.stdin;
      const outputStream = !!outputPath
        ? fs.createWriteStream(outputPath)
        : process.stdout;

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
        .map(function(input) {
          return render(
            React.createElement(
              Diagram,
              {
                customStyle,
                edgeDrawerMap,
                filterDrawerMap,
                Icons,
                markerDrawerMap,
                pathway: input.pathway,
                entityMap: input.entityMap,
                /*
								id: input.pathway.id,
								backgroundColor: input.pathway.backgroundColor,
								height: input.pathway.height,
								name: input.pathway.height,
								width: input.pathway.width,
								//*/
                highlightedEntities,
                hiddenEntities
              },
              null
            )
          );
        })
        .errors(function(err) {
          console.error("err");
          console.error(err);
          process.exitCode = 1;
        })
        .pipe(outputStream);
    })
    .on("--help", function() {
      console.log(`
				Examples:

				Convert Kaavio-formatted JSON into SVG:
				$ ${name} json2svg WP100.json WP100.svg

				Convert streaming:
				$ cat WP100.json | ${name} json2svg > WP100.svg

				Convert streaming w/ pretty output:
				$ cat ../bulk-gpml2pvjson/unified/WP100.json | ./bin/${name} json2svg | xmllint --pretty 2 - | pygmentize -O encoding=UTF-8 -l xml
				`);
    });

  program.parse(process.argv);

  // If no command is specified, output help.
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

/*
hl(source).map(x => hl([x]))
.each(function(jsonStream) {
  jsonStream
    .errors(function(err) {
      console.error(err);
      process.exit(1);
    })
    .map(x => String(x))
    .pipe(process.stdout);
});
//*/

/*
./bin/kaavio json2svg ./WP4.json 
cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | ./bin/kaavio json2svg > output.svg
//*/
