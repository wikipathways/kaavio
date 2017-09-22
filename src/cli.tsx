import "source-map-support/register";
import * as fs from "fs";
import * as hl from "highland";
import * as path from "path";
import * as ndjson from "ndjson";
import * as program from "commander";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import * as xpath from "xpath";
import { DOMParser } from "xmldom";
import * as urlRegex from "url-regex";
import * as getit from "getit";
import * as JSONStream from "JSONStream";
import { Base64 } from "js-base64";
import {
  camelCase,
  curry,
  upperFirst,
  compact,
  defaults,
  find,
  filter,
  intersection,
  keys,
  flow,
  forOwn,
  omitBy,
  toPairs,
  trim,
  uniq,
  values
} from "lodash";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Observable } from "rxjs/Observable";
import { AjaxRequest } from "rxjs/observable/dom/AjaxObservable";
import "rxjs/add/observable/dom/ajax";
import "rxjs/add/observable/from";
import "rxjs/add/observable/fromPromise";
import "rxjs/add/observable/pairs";
import "rxjs/add/observable/of";
import "rxjs/add/operator/toArray";
import "rxjs/add/operator/toPromise";
import "rxjs/add/operator/do";
import "rxjs/add/operator/map";
import "rxjs/add/operator/mergeMap";
import * as validDataUrl from "valid-data-url";
import * as isVarName from "is-valid-var-name";
import { Diagram } from "./components/Diagram";
import * as edgeDrawers from "./drawers/edges/index";
// Are the icons and markers are specific to Pvjs (less likely to useful to other applications)?
// Should they be part of Kaavio?
import * as markerDrawers from "./drawers/markers";
import * as customStyle from "./drawers/style/custom.style";
const npmPackage = require("../package.json");
const exec = hl.wrapCallback(require("child_process").exec);

// TODO why does TS complain when I define and try using the titleCase below?
//const titleCase = flow(camelCase, upperFirst);
function getSuggestedVarName(str: string): string {
  return upperFirst(camelCase(str)).match(/[_a-zA-Z]\w*/)[0];
}

/* TODO get this working
const DEFAULT_FONTS = ["Arial", "Times New Roman"];
import { NodeTextSizer } from "./NodeTextSizer";
const nodeTextSizer = new NodeTextSizer(DEFAULT_FONTS);
//*/

program
  .version(npmPackage.version)
  .description("Control and customize Kaavio from the command line.");

function get(inputPath, opts = {}) {
  const strippedPath = inputPath.replace("file://", "");
  return hl.wrapCallback(getit)(strippedPath, opts);
}

function build() {
  console.log("Rebuilding project (may take some time)...");
  return exec("npm run build", {
    // NOTE: we want to build from the top level of the package
    // __dirname is kaavio/src/, even after compilation
    // we want either kaavio/ or else PKG-DEPENDING-ON-KAAVIO/
    cwd: path.join(__dirname, "..")
  }).doto(x => console.log("Build complete."));
}

const compileBySelectiveImport = curry(function(name, input) {
  console.log(`Compiling ${name}...`);
  const whatToImport = !input || input === "*"
    ? `*`
    : "{" +
        uniq(
          input.split(",").map(trim).map(function(inputItem: string) {
            if (!isVarName(inputItem)) {
              throw new Error(
                `Input item "${inputItem}" is not a valid JS export name.
	Suggested alternative: ${getSuggestedVarName(inputItem)}`
              );
            }
            return inputItem;
          })
        ).join(", ") +
        "}";
  console.log(`Successfully compiled ${name}. Set includes "${whatToImport}".`);
  console.log(`Rebuild kaavio to make changes take effect:\n\r  npm run build`);

  const compiledDrawerCode =
    ` import "source-map-support/register";
    export ${whatToImport} from "./index";
		` + "\n";

  /*
  build()
    .errors(function(err) {
      console.error(err);
      process.exit(1);
    })
    .each(function(x) {});
	//*/

  hl([compiledDrawerCode]).pipe(
    fs.createWriteStream(
      path.join(__dirname, `../src/drawers/${name}/__bundled_dont_edit__.tsx`)
    )
  );
});

const compileEdges = compileBySelectiveImport("edges");
const compileMarkers = compileBySelectiveImport("markers");

function compileIcons(inputPath) {
  console.log("Compiling icons...");
  const iconStream = get(inputPath)
    .through(JSONStream.parse())
    .flatMap(function(iconMap) {
      return hl
        .pairs(iconMap)
        .flatMap(function([name, iconPath]) {
          const iconPathComponents = iconPath.split("#");
          const url = iconPathComponents[0];
          const id = iconPathComponents[1];
          // NOTE: data URI parsing is a variation of code from
          // https://github.com/killmenot/parse-data-url/blob/master/index.js
          let svgStringStream;
          if (validDataUrl(url)) {
            const parts = url.match(validDataUrl.regex);
            let mediaType;
            if (parts[1]) {
              mediaType = parts[1].toLowerCase();
            }

            let charset;
            if (parts[2]) {
              charset = parts[2].split("=")[1].toLowerCase();
            }

            const isBase64 = !!parts[3];

            let data;
            if (parts[4]) {
              data = parts[4];
            }

            const decoded = !isBase64
              ? decodeURIComponent(data)
              : Base64.decode(data);
            svgStringStream = hl([decoded]);
          } else {
            const strippedPath = url.replace("file://", "");
            if (urlRegex({ strict: true, exact: true }).test(strippedPath)) {
              svgStringStream = get(strippedPath);
            } else {
              svgStringStream = get(strippedPath, {
                cwd: path.dirname(inputPath)
              });
            }
          }

          return svgStringStream.map(function(svgString) {
            var doc = new DOMParser().parseFromString(svgString);
            var node = !id
              ? doc
              : (node = xpath.select(`//*[@id='${id}']`, doc)[0]);
            node.setAttribute("id", name);
            return node.toString();
          });
        })
        .collect()
        .map(function(svgStrings) {
          const joinedSvgString = svgStrings.join("").replace(/[\r\n]/g, "");
          return (
            `import "source-map-support/register";
							import * as React from "react";
							import * as ReactDom from "react-dom";
							export class Icons extends React.Component<any, any> {
								constructor(props) {
									super(props);
								}

								render() {
									return <g dangerouslySetInnerHTML={{
											__html: '${joinedSvgString}'
										}}/>
								}
							}` + "\n"
          );
        });
    })
    .errors(function(err) {
      console.error(err);
      process.exit(1);
    });

  iconStream.observe().each(function(x) {
    console.log("Successfully compiled icons.");
    console.log("Rebuild kaavio to make changes take effect: npm run build");
  });

  iconStream.pipe(
    fs.createWriteStream(
      path.join(__dirname, "../src/drawers/icons/__bundled_dont_edit__.tsx")
    )
  );
}

const compilerMap = {
  icons: compileIcons,
  markers: compileMarkers,
  edges: compileEdges
};

program
  .command("compile <whatToCompile> [input]")
  .action(function(whatToCompile, input) {
    if (compilerMap.hasOwnProperty(whatToCompile)) {
      compilerMap[whatToCompile](input);
    } else {
      const cmdSuggestions = keys(compilerMap)
        .map(key => `\tkaavio compile ${key} ${input}`)
        .join("\r\n");
      throw new Error(
        `"${whatToCompile}" is not a supported whatToCompile option. Supported options: \r\n${cmdSuggestions}\r\n`
      );
    }
  })
  .on("--help", function() {
    console.log();
    console.log(
      `  <whatToCompile> can be one of these: ${keys(compilerMap).join(", ")}`
    );
    console.log();
    console.log("  Examples:");
    console.log();
    console.log("    Compile markers (include all available):");
    console.log("    $ kaavio compile markers '*'");
    console.log();
    console.log("    Compile markers (include only selected):");
    console.log("    $ kaavio compile markers 'arrow, tbar'");
    console.log();
    console.log("    Compile icons:");
    console.log(
      "    $ kaavio compile icons ./src/drawers/icons/defaultIconMap.json"
    );
    console.log();
    console.log("    Compile edges (include all available):");
    console.log("    $ kaavio compile edges '*'");
    console.log();
    console.log("    Compile edges (include only selected):");
    console.log(
      "    $ kaavio compile edges 'straightline,curvedline,elbowline,segmentedline'"
    );
  });

program
  .command("json2svg [inputPath] [outputPath]")
  .description("Convert Kaavio-formatted JSON into SVG")
  .option(
    "-s, --static [boolean]",
    "Exclude extra DOM attributes, such as data-reactid, that React uses internally. Default: true",
    (s: string) => ["", "true"].indexOf(s) > -1
  )
  .action(function(inputPath, outputPath, options) {
    const staticMarkup = options.hasOwnProperty("static")
      ? options.static
      : true;
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
        return (
          render(
            React.createElement(
              Diagram,
              {
                pathway: input.pathway,
                id: input.pathway.id,
                backgroundColor: input.pathway.backgroundColor,
                entityMap: input.entityMap,
                //filters,
                height: input.pathway.height,
                name: input.pathway.height,
                width: input.pathway.width,
                zIndices: input.pathway.contains,
                //highlightedNodes,
                //hiddenEntities
                customStyle: customStyle,
                edgeDrawers: edgeDrawers
              },
              null
            )
          ) + "\n"
        );
      })
      .errors(function(err) {
        console.error(err);
        process.exit(1);
      })
      .map(x => String(x))
      .pipe(outputStream);
  })
  .on("--help", function() {
    console.log();
    console.log("  Examples:");
    console.log();
    console.log("    Convert Kaavio-formatted JSON into SVG:");
    console.log("    $ kaavio json2svg WP100.json WP100.svg");
    console.log();

    console.log("    Convert streaming:");
    console.log("    $ cat WP100.json | kaavio json2svg > WP100.svg");
    console.log();
    console.log("    Convert streaming w/ pretty output:");
    console.log(
      "    $ cat ../bulk-gpml2pvjson/unified/WP100.json | ./bin/kaavio json2svg | xmllint --pretty 2 - | pygmentize -O encoding=UTF-8 -l xml"
    );
  });

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

// TODO does the process exit on its own?
//process.exit(0);

program.parse(process.argv);

// If no command is specified, output help.
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

/*
./bin/kaavio json2svg ./WP4.json 
cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | ./bin/kaavio json2svg > output.svg
//*/
