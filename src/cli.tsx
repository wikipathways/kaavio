var fs = require("fs");
var Diagram = require("./components/Diagram").Diagram;
var hl = require("highland");
var path = require("path");
var npmPackage = require("../package.json");
var ndjson = require("ndjson");
var program = require("commander");
import { renderToString } from "react-dom/server";
import edgeDrawers from "./components/EdgeDrawers";
// Are the icons and markers are specific to Pvjs (less likely to useful to other applications)?
// Should they be part of Kaavio?
import markerDrawers from "./MarkerDrawers";
//import icons from "./icons/main";
//import icons from "../dist/icons";
var iconMap = require("../dist/icons").default;

// needed to load icons
declare global {
  // Augment Node.js `global`
  namespace NodeJS {
    interface Global {
      XMLHttpRequest: XMLHttpRequest;
    }
  }
  // Augment Browser `window`
  //interface Window extends NodeJS.Global { }
  // Augment Web Worker `self`
  //interface WorkerGlobalScope extends NodeJS.Global { }
}

if (!global.hasOwnProperty("XMLHttpRequest")) {
  global.XMLHttpRequest = require("xhr2");
}

var xpath = require("xpath");
var dom = require("xmldom").DOMParser;
import * as urlRegex from "url-regex";
import * as getit from "getit";
import * as JSONStream from "JSONStream";
import { Base64 } from "js-base64";
import {
  defaults,
  find,
  filter,
  intersection,
  keys,
  forOwn,
  omitBy,
  toPairs,
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

program
  .version(npmPackage.version)
  .description("Converts Kaavio-formatted JSON to SVG");
/*
  .option(
    "--mysampleoption [string]",
    'Instructions for my sampleoption'
  );
  //*/

program.on("--help", function() {
  console.log("  Examples:");
  console.log();
  console.log("    Convert Kaavio-formatted JSON into SVG:");
  console.log("    $ kaavio json2svg WP100.json WP100.svg");
  console.log();
  console.log("    Convert streaming:");
  console.log("    $ cat WP100.json | kaavio json2svg  > WP100.svg");
  console.log();
  console.log("    Convert streaming w/ pretty output:");
  console.log(
    "cat ../bulk-gpml2pvjson/unified/WP100.json | ./bin/kaavio json2svg | xmllint --pretty 2 - | pygmentize -O encoding=UTF-8 -l xml"
  );
});

function get(inputPath, opts = {}) {
  const strippedPath = inputPath.replace("file://", "");
  return hl.wrapCallback(getit)(strippedPath, opts);
}

program
  .command("compile-icons <inputPath> [outputPath]")
  .action(function(inputPath, outputPath) {
    const outputStream = !!outputPath
      ? fs.createWriteStream(outputPath)
      : process.stdout;
    get(inputPath)
      .through(JSONStream.parse())
      .flatMap(function(iconMap) {
        return hl
          .pairs(iconMap)
          .flatMap(function([name, iconPath]) {
            const iconPathComponents = iconPath.split("#");
            const url = iconPathComponents[0];
            const id = iconPathComponents[1];
            const idSafeName = name.replace(/[^\w]/, "").match(/[a-zA-Z]\w*/);
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
              var xml = svgString;
              var doc = new dom().parseFromString(xml);
              var node = !id
                ? doc
                : (node = xpath.select(`//*[@id='${id}']`, doc)[0]);
              node.setAttribute("id", idSafeName);
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
							export class IconDefs extends React.Component<any, any> {
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
      })
      .pipe(outputStream);
  });

program
  .command("json2svg [inputPath] [outputPath]")
  .action(function(inputPath, outputPath) {
    if (!!inputPath && !!outputPath) {
      console.log(`inputPath: ${inputPath}`);
      console.log(`outputPath: ${outputPath}`);
    } else {
      hl(process.stdin)
        .through(ndjson.parse())
        .map(function(input) {
          return renderToString(
            React.createElement(
              Diagram,
              {
                entities: values(input.entityMap),
                id: input.pathway.id,
                backgroundColor: input.pathway.backgroundColor,
                customStyle: {},
                edgeDrawers: edgeDrawers,
                entityMap: input.entityMap,
                //filters,
                height: input.pathway.height,
                name: input.pathway.height,
                organism: input.pathway.height,
                markerDrawers: markerDrawers,
                width: input.pathway.width,
                zIndices: input.pathway.contains
                //highlightedNodes,
                //icons: loadedIcons
                //hiddenEntities
              },
              null
            )
          );
        })
        .errors(function(err) {
          console.error(err);
          process.exit(1);
        })
        .map(x => String(x))
        .pipe(process.stdout);
    }
  });

/*
hl(source).map(x => hl([x])).each(function(jsonStream) {
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
var id = program.id;
