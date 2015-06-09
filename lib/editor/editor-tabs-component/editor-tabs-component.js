var _ = require('lodash');
var annotationTab = require('./tabs/annotation-tab/annotation-tab');
var highland = require('highland');
var propertiesTab = require('./tabs/properties-tab/properties-tab');
var m = require('mithril');

module.exports = function(kaavio) {

  var containerElement = kaavio.containerElement;
  var editorTabsComponentContainerElement = containerElement.querySelector(
      '.kaavio-editor-tabs');

  //module for editorTabsComponent
  //for simplicity, we use this module to namespace the model classes
  var editorTabsComponent = {};
  kaavio.editor.editorTabsComponent = editorTabsComponent;

  //the Tab class has two properties
  editorTabsComponent.Tab = function(data) {
    this.title = m.prop(data.title);
    this.view = highland.partial(data.view);
  };

  //the TabList class is a list of Tabs
  editorTabsComponent.TabList = m.prop([
    {
      title: 'Annotation',
      view: annotationTab.view
    },
    {
      title: 'Properties',
      view: propertiesTab.view
    }
    /* TODO add the rest of the tabs
    {
      title: 'Citations',
      view: null
    },
    //*/
  ]
  .map(function(tab) {
    return new editorTabsComponent.Tab(tab);
  }));

  //the view-model,
  editorTabsComponent.vm = (function() {
    var vm = {};

    vm.changeStateToBtnStyle = {
      'true': 'btn-success',
      'false': 'btn-close'
    };

    vm.changeStateToGlyphicon = {
      'true': 'span.glyphicon.glyphicon-ok[aria-hidden="true"]',
      'false': 'span.glyphicon.glyphicon-chevron-down[aria-hidden="true"]'
    };

    vm.changeStateToBtnText = {
      'true': ' Save & Close',
      'false': ' Close'
    };

    // TODO is this needed?
    vm.open = function() {
    };

    vm.close = function() {
      annotationTab.vm.onunload();
      propertiesTab.vm.onunload();
      //editorTabsComponentContainerElement.innerHTML = '';
    };

    vm.tabList = new editorTabsComponent.TabList();
    vm.currentTab = m.prop(vm.tabList[0]);

    vm.init = function() {
      vm.dataChanged = m.prop(false);
      annotationTab.vm.init(kaavio);
      propertiesTab.vm.init(kaavio);

      kaavio.on('rendered', function() {
        if (kaavio.sourceData) {
          vm.originalPvjsonAsString = JSON.stringify(kaavio.sourceData.pvjson);
        }
      });
    };

    vm.changeTab = function(title) {
      vm.currentTab(_.find(vm.tabList, function(tab) {
        return tab.title() === title;
      }));
    };

    return vm;
  }());

  //the controller defines what part of the model is relevant for the current page
  //in our case, there's only one view-model that handles everything
  editorTabsComponent.controller = function() {
    editorTabsComponent.vm.init();
  };

  //here's the view
  editorTabsComponent.view = function() {
    //*
    if (!!kaavio.sourceData && !!editorTabsComponent.vm.originalPvjsonAsString) {
      var currentPvjsonAsString = JSON.stringify(kaavio.sourceData.pvjson);
      editorTabsComponent.vm.dataChanged(currentPvjsonAsString !==
          editorTabsComponent.vm.originalPvjsonAsString);
    }
    //*/

    return [
      m('ul.nav.nav-tabs', {}, [
        editorTabsComponent.vm.tabList.map(function(tab) {
          var activeString = tab.title() === editorTabsComponent.vm.currentTab().title() ?
              '.active' : '';
          return m('li' + activeString + '[role="presentation"]', {}, [
            m('a[style="cursor: pointer"]', {
              onchange: m.withAttr('value', tab.title),
              onclick: m.withAttr('value', editorTabsComponent.vm.changeTab),
              value: tab.title()
            }, tab.title())
          ]);
        })
      ]),
      m('a[href="/editor/closed"]', {
        config: m.route,
        title: editorTabsComponent.vm.dataChanged() ? 'Save and Close' : 'Close'
      }, [
        m('span', {
          'class': 'editor-close-control glyphicon btn navbar-right ' +
              editorTabsComponent.vm.changeStateToBtnStyle[
                  editorTabsComponent.vm.dataChanged()],
        }, [
        m(editorTabsComponent.vm.changeStateToGlyphicon[
            editorTabsComponent.vm.dataChanged()]),
        m('span',{}, editorTabsComponent.vm.changeStateToBtnText[
            editorTabsComponent.vm.dataChanged()])
        ])
      ]),
      editorTabsComponent.vm.currentTab().view()
    ];
  };

  return editorTabsComponent;

};
