import "source-map-support/register";

import * as ndjson from "ndjson";
import * as path from "path";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import { defaults, keys, toPairs, uniq, values } from "lodash/fp";

import * as React from "react";
import * as ReactDOM from "react-dom";

// TODO why doesn't "import * as name" work with Webpack for the following packages?
const hl = require("highland");
const parent = require("parent-package-json");
import { Parser, Validator } from "collit";
const program = require("commander");
const VError = require("verror");

import { Diagram } from "./components/Diagram";

import * as edgeDrawerMapDefault from "./drawers/edges/index";
import * as filterDrawerMapDefault from "./drawers/filters/index";
import * as markerDrawerMapDefault from "./drawers/markers/index";
import { Icons as IconsDefault } from "./drawers/icons/__bundled_dont_edit__";

import { arrayify } from "./spinoffs/jsonld-utils";

const npmPackage = require("../package.json");
//const exec = hl.wrapCallback(require("child_process").exec);
const pathToParent0 = parent(__dirname) ? parent(__dirname).path : false;
const pathToParent1 = parent(__dirname, 1) ? parent(__dirname, 1).path : false;
const dirs = uniq(
  [pathToParent1 || pathToParent0 || path.join(__dirname, "..")]
    .filter(p => !!p)
    .map(p => p.replace(/package\.json$/, ""))
);

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

export type Theme = Record<string, any>;
export function createJson2SvgCLI(name, themesRaw: Theme | Theme[] = {}) {
  const themes: Theme[] = arrayify(themesRaw);

  program
    .version(npmPackage.version)
    .description(
      `Convert Kaavio-formatted JSON to SVG by running ${name} from the command line.`
    )
    .arguments("[source] [target]")
    .usage(
      "[source] [target]. If specified, must be a filepath. Default: standard in and standard out for source and target, respectively."
    )
    .option(
      "--hide target[,target...]",
      `Specify entities to hide. 

			target: entity id, type or textContent

			Examples:
				--hide b99fe
				--hide b99fe,abd6e
				--hide ensembl:ENSG00000124762
				--hide b99fe,ensembl:ENSG00000124762`,
      (argValue: string) => {
        return argValue
          .split(",")
          .filter(x => x !== "")
          .map(decodeURIComponent);
      },
      []
    )
    .option(
      "--highlight target[=color][,target[=color],...]",
      `Specify entities to highlight.

			target: entity id or typeof value

			color: hex value or CSS/SVG color keyword
				<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#Color_keywords>
				Default: yellow

			If target contains a comma, you must URL encode it, e.g.,
				mytext,moretext => mytext%2Cmoretext

			Examples:
				--highlight b99fe
				--highlight b99fe=red
				--highlight b99fe=ff000
				--highlight "b99fe=#ff000"
				--highlight b99fe=red,abd6e=red
				--highlight ensembl:ENSG00000124762=red
				--highlight b99fe,ensembl:ENSG00000124762=red
				--highlight b99fe=red,ensembl:ENSG00000124762=red
				--highlight b99fe=66c2a5,ensembl:ENSG00000124762=8da0cb`,
      (argValue: string) => {
        return argValue
          .split(",")
          .filter(x => x !== "")
          .map(function(chunk: string) {
            const [rawTarget, rawColor = "yellow"] = chunk.split(/=/);
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
            return {
              target: decodeURIComponent(rawTarget),
              color: color || "yellow"
            };
          });
      },
      []
    )
    .option(
      "--react",
      /* When specified, we call ReactDOM.renderToString instead of ReactDOM.renderToStaticMarkup. */
      "Include DOM attributes that React uses internally, like data-reactid."
    );

  const defaultThemeName = themes[0].name || "default";
  const themeMap = themes.reduce(function(acc, theme) {
    /*
    const {
      edgeDrawerMap,
      filterDrawerMap,
      markerDrawerMap,
      style,
      Icons
    } = defaults(
      {
        edgeDrawerMap: edgeDrawerMapDefault,
        filterDrawerMap: filterDrawerMapDefault,
        markerDrawerMap: markerDrawerMapDefault,
        Icons: IconsDefault
      },
      theme
    );
	  //*/
    const { name: themeName = defaultThemeName } = theme;
    if (acc.hasOwnProperty(themeName)) {
      if (!theme.hasOwnProperty("name")) {
        throw new Error(
          `Theme is missing property "name" (optional for first theme; required for the rest).`
        );
      } else {
        throw new Error(`Multiple themes specified with name "${themeName}"`);
      }
    }
    acc[themeName] = defaults(
      {
        edgeDrawerMap: edgeDrawerMapDefault,
        filterDrawerMap: filterDrawerMapDefault,
        markerDrawerMap: markerDrawerMapDefault,
        Icons: IconsDefault
      },
      theme
    );
    return acc;
  }, {});

  const themeNames = keys(themeMap);

  if (themeNames.length > 1) {
    program.option("--theme [name]", `Available: ${themeNames.join(", ")}`);
  }

  program.on("--help", function() {
    console.log(`
				Examples:

				Convert Kaavio-formatted JSON into SVG:
				$ ${name} WP100.json WP100.svg

				Convert streaming:
				$ cat WP100.json | ${name} > WP100.svg

				Convert streaming w/ pretty output:
				$ cat WP100.json | ${name} | xmllint --pretty 2 - | pygmentize -O encoding=UTF-8 -l xml
				`);
  });

  program.parse(process.argv);

  const [source, target] = program.args;

  if (["-", "/dev/stdin"].indexOf(source) > -1) {
    console.warn(
      "To use standard in as source, just don't specify a [source]."
    );
  }

  if (["-", "/dev/stdout"].indexOf(target) > -1) {
    console.warn(
      "To use standard out as target, just don't specify a [target]."
    );
  }

  const inputStream = !source ? process.stdin : fs.createReadStream(source);
  const outputStream = !target ? process.stdout : fs.createWriteStream(target);

  // If stdin not being piped to json2svg and no source arg specified, output help.
  if (process.stdin.isTTY && !inputStream) program.help();

  const render = program.react ? renderToString : renderToStaticMarkup;
  const { hide, highlight, theme: themeName = defaultThemeName } = program;
  const hiddenEntities = arrayify(hide);
  const highlightedEntities = arrayify(highlight);

  const {
    edgeDrawerMap,
    filterDrawerMap,
    markerDrawerMap,
    style,
    Icons
  } = themeMap[themeName];

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
    //            var lines = opentypeLayoutMap[fontFamily](textContent, {
    //              //fontSize,
    //              width: width - padding
    //            });
    //          });
    //
    //          return input;
    //        });
    //      })
    .map(function(input) {
      //return render(<div id="wow" />);
      /*
          return render(
            <Diagram
              customStyle={customStyle}
              edgeDrawerMap={edgeDrawerMap}
              filterDrawerMap={filterDrawerMap}
              Icons={Icons}
              markerDrawerMap={markerDrawerMap}
              pathway={input.pathway}
              entityMap={input.entityMap}
              highlightedEntities={highlightedEntities}
              hiddenEntities={hiddenEntities}
            />
          );
				  //*/

      //            React.createElement(
      //              Diagram,
      //              {
      //                customStyle,
      //                edgeDrawerMap,
      //                filterDrawerMap,
      //                Icons,
      //                markerDrawerMap,
      //                pathway: input.pathway,
      //                entityMap: input.entityMap,
      //                /*
      //								id: input.pathway.id,
      //								backgroundColor: input.pathway.backgroundColor,
      //								height: input.pathway.height,
      //								name: input.pathway.height,
      //								width: input.pathway.width,
      //								//*/
      //                highlightedEntities,
      //                hiddenEntities
      //              },
      //              null
      //            )

      return render(
        <Diagram
          customStyleSVG={style}
          edgeDrawerMap={edgeDrawerMap}
          filterDrawerMap={filterDrawerMap}
          Icons={Icons}
          markerDrawerMap={markerDrawerMap}
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
./bin/kaavio ./WP4.json 
cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | ./bin/kaavio > output.svg
//*/
