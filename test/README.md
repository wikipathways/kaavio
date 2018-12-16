# How To Set Up Environment for Development

A. Install required software:
1. [PhantomJS](http://phantomjs.org/) headless web browser for testing. If you use ```sudo apt-get install``` or ```brew install```, be sure the resulting version installed is >=1.9.7. Older versions may not include the GhostDriver Remote WebDriver required for working with Selenium.
2. [ImageMagick](http://www.imagemagick.org/) for comparing screenshots during development against last known good screenshots for testing.
3. [Node.js](http://nodejs.org/download/)
4. [Phash dependencies](https://github.com/aaronm67/node-phash)
B. When software is installed, open a terminal and enter the following commands:

```
$ git clone git@github.com:wikipathways/pathvisiojs.git #gets pathvisiojs source code
$ cd pathvisiojs/
$ npm update && npm install #uses npm (the node package manager) to install pathvisiojs dependencies
$ bower update && bower install #installs non-npm JS dependencies
```

C. Leave the [Selenium](http://docs.seleniumhq.org/) server terminal window open and running. Selenium is a web browser automation platform that tests the pathvisiojs code to ensure it works. Open a second terminal window and enter the following command:
