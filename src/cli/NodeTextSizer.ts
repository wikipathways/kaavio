/*
font work in node

Get fonts installed locally:
https://github.com/rBurgett/system-font-families/blob/master/src/main.js
https://github.com/vutran/os-fonts/blob/master/index.js

Parsing opentype fonts
https://github.com/Jam3/opentype-layout/blob/master/index.js
It uses this wrapping library: https://www.npmjs.com/package/word-wrapper


TODO: this isn't quite working yet, but the idea is to make this into
something like a simple box model implementation for Node.js.

TODO:
cache system fonts post-install.
get other bugs ironed out so it works!

*/

//import "source-map-support/register";
import * as hl from "highland";
import { curry, get, keys } from "lodash/fp";
import * as path from "path";
const osFonts = require("os-fonts");
import * as opentype from "opentype.js";
import * as opentypeLayoutUncurried from "opentype-layout";
import * as levenUncurried from "fast-levenshtein";
const leven = curry(function(opts, str1, str2) {
  return levenUncurried.get(str1, str2, opts);
});
const layoutOpentype = curry(function(font, text, opts) {
  return opentypeLayoutUncurried(font, text, opts);
});
const levenIntl = leven({ useCollator: true });
function firstWord(str) {
  const match = str.match(/^\w{4,}/);
  return !!match ? match[0] : str;
}

/*
import * as WordWrappr from "word-wrappr";
const loadNewWrappr = hl.wrapCallback(function(fontPath, cb) {
  var wrappr = new WordWrappr(fontPath);
  wrappr.load(function(err) {
    if (err) {
      return cb(err);
    }
    cb(null, wrappr);
  });
});
//*/

const loadOpentype = hl.wrapCallback(opentype.load);

//opentype.load("/Library/Fonts/Arial.ttf", function(err, font) {
//  if (err) {
//    alert("Font could not be loaded: " + err);
//  } else {
//    console.log("font ala opentype");
//    console.log(font.names.fontFamily);
//    const layout = layoutOpentype(font, "hello, world!", { align: "right" });
//    console.log("layout");
//    console.log(layout);
//    /*
//        var ctx = document.getElementById('canvas').getContext('2d');
//        // Construct a Path object containing the letter shapes of the given text.
//        // The other parameters are x, y and fontSize.
//        // Note that y is the position of the baseline.
//        var path = font.getPath('Hello, World!', 0, 150, 72);
//        // If you just want to draw the text you can also use font.draw(ctx, text, x, y, fontSize).
//        path.draw(ctx);
//			//*/
//  }
//});

const FONT_SOURCES = ["user", "local", "network", "system"];
export class NodeTextSizer {
  fontFamiliesToLoad: string[];
  layoutOpentypeMap: Record<string, Promise<any>>;
  fontPathMap: Record<string, Promise<string>>;
  //wrapprMap: Record<string, Promise<WordWrappr>>;
  fontPathSource: Record<string, hl.Stream<any>>;
  constructor(fontFamiliesToLoad = ["Arial", "Times New Roman"]) {
    this.fontFamiliesToLoad = fontFamiliesToLoad;
    const layoutOpentypeMap = (this.layoutOpentypeMap = {});
    const fontPathMap = (this.fontPathMap = {});
    //const wrapprMap = (this.wrapprMap = {});
    const fontAndFontPathSource = hl(
      FONT_SOURCES.map(function(source) {
        return hl(osFonts.getAll(source)).flatMap(hl);
      })
    )
      .merge()
      .filter(fontPath => fontPath.match(/\.(ttf)|(otf)$/))
      .filter(fontPath => fontPath.match(/Arial|Times|Myriad/))
      //.filter(x => fontFamiliesToLoad.indexOf(x.fontFamily) > -1)
      /*
      .flatMap(function(fontPath) {
        console.log("fontPath");
        console.log(fontPath);
        return loadOpentype(fontPath).map(function(font) {
          var fontFamilyGood = get("font.names.fontFamily.en", font);
          var fontFamily = !!fontFamilyGood
            ? fontFamilyGood
            : path.basename(fontPath).replace(/\.(ttf)|(otf)$/, "");
          return { fontFamily, fontPath, font };
        });
      })
			//*/
      //*
      .map(function(fontPath) {
        /*
        console.log("fontPath");
        console.log(fontPath);
				//*/
        const fontFamily = path
          .basename(fontPath)
          .replace(/\.(ttf)|(otf)$/, "");
        return { fontFamily, fontPath };
      })
      .uniqBy(function(a, b) {
        return a.fontFamily === b.fontFamily;
      })
      //*/
      .errors(err => {
        // ignoring these types of errors.
        if (
          [
            "Only the first kern subtable is supported.",
            "No valid cmap sub-tables found."
          ].indexOf(err.message) === -1
        ) {
          console.error(err);
        }
      });

    const fontPathSource = (this.fontPathSource = fontAndFontPathSource
      .fork()
      .errors(err => {
        console.error(err);
      }));

    const fontSource = fontAndFontPathSource
      .fork()
      .filter(x => fontFamiliesToLoad.indexOf(x.fontFamily) > -1)
      //*
      .flatMap(function({ fontFamily, fontPath }) {
        /*
        console.log("fontPath");
        console.log(fontPath);
				//*/
        return loadOpentype(fontPath).map(function(font) {
          var fontFamilyGood = get("font.names.fontFamily.en", font);
          var fontFamily = !!fontFamilyGood
            ? fontFamilyGood
            : path.basename(fontPath).replace(/\.(ttf)|(otf)$/, "");
          return { fontFamily, font };
        });
      })
      //*/
      .errors(err => {
        console.error(err);
      });

    /*
    const wrapprSource = fontAndFontPathSource
      .fork()
      .filter(x => fontFamiliesToLoad.indexOf(x.fontFamily) > -1)
      .flatMap(function({ fontFamily, fontPath }) {
        return loadNewWrappr(fontPath).map(wrappr => {
          return {
            fontFamily,
            wrappr
          };
        });
      })
      .errors(err => {
        console.error(err);
      });
		//*/

    fontSource.each(function({ fontFamily, font }) {
      layoutOpentypeMap[fontFamily] = Promise.resolve(layoutOpentype(font));
    });

    /*
    wrapprSource.each(function({ fontFamily, wrappr }) {
      wrapprMap[fontFamily] = Promise.resolve(wrappr);
    });
		//*/

    fontPathSource.each(function({ fontFamily, fontPath }) {
      console.log(`fontFamily: ${fontFamily}`);
      console.log(`fontPath: ${fontPath}`);
      fontPathMap[fontFamily] = Promise.resolve(fontPath);
    });
  }
  getFontPathByFontFamily = fontFamily => {
    const { fontPathMap, fontPathSource } = this;
    console.log(`getFontPathByFontFamily - getting fontFamily: ${fontFamily}`);
    if (fontPathMap.hasOwnProperty(fontFamily)) {
      return fontPathMap[fontFamily];
    } else if (!fontPathSource.ended) {
      return fontPathSource
        .observe()
        .find(x => x.fontFamily === fontFamily)
        .map(x => x.fontPath)
        .toPromise(Promise);
    } else {
      const levenForFontFamily = levenIntl(fontFamily);
      console.log("keys(fontPathMap)");
      console.log(keys(fontPathMap));
      const closest = keys(fontPathMap)
        .map(function(fontFamily) {
          return {
            fontFamily,
            leven: levenForFontFamily(fontFamily)
          };
        })
        .sort(function(a, b) {
          if (a.leven < b.leven) {
            return -1;
          } else if (a.leven > b.leven) {
            return 1;
          } else {
            return 0;
          }
        })[0];

      const replacement = closest.leven < 10 ? closest.fontFamily : "Arial";
      console.warn(
        `Cannot find font ${fontFamily}. Using ${replacement} as replacement.`
      );
      return this.getFontPathByFontFamily(replacement);
    }
  };

  loadOpentypeLayoutMap = fontFamilies => {
    const { loadOpentypeLayout, layoutOpentypeMap } = this;
    return hl(fontFamilies)
      .flatMap(function(fontFamily) {
        return hl(loadOpentypeLayout(fontFamily)).map(function(layoutOpentype) {
          return { fontFamily, layoutOpentype };
        });
      })
      .reduce({}, function(acc, { fontFamily, layoutOpentype }) {
        acc[fontFamily] = layoutOpentype;
        return acc;
      })
      .errors(err => {
        console.error(err);
      })
      .toPromise(Promise);
  };

  loadOpentypeLayout = fontFamily => {
    const { getFontPathByFontFamily, layoutOpentypeMap } = this;
    if (layoutOpentypeMap.hasOwnProperty(fontFamily)) {
      return layoutOpentypeMap[fontFamily];
    }
    return getFontPathByFontFamily(fontFamily).then(function(fontPath) {
      console.log("fontPath");
      console.log(fontPath);
      return loadOpentype(fontPath)
        .doto(function({ font }) {
          layoutOpentypeMap[fontFamily] = Promise.resolve(layoutOpentype(font));
        })
        .errors(err => {
          console.error(err);
        })
        .toPromise(Promise);
    });
  };

  /*
  loadWrapprMap = fontFamilies => {
    const { loadFont, wrapprMap } = this;
    return hl(fontFamilies)
      .flatMap(function(fontFamily) {
        return hl(loadFont(fontFamily)).map(function(wrappr) {
          return { fontFamily, wrappr };
        });
      })
      .reduce({}, function(acc, { fontFamily, wrappr }) {
        acc[fontFamily] = wrappr;
        return acc;
      })
      .errors(err => {
        console.error(err);
      })
      .toPromise(Promise);
  };

  loadFont = fontFamily => {
    const { getFontPathByFontFamily, wrapprMap } = this;
    if (wrapprMap.hasOwnProperty(fontFamily)) {
      return wrapprMap[fontFamily];
    }
    return getFontPathByFontFamily(fontFamily).then(function(fontPath) {
      return loadNewWrappr(fontPath)
        .doto(function({ wrappr }) {
          wrapprMap[fontFamily] = Promise.resolve(wrappr);
        })
        .errors(err => {
          console.error(err);
        })
        .toPromise(Promise);
    });
  };
	//*/
}
