var loadTabsProgressively = {
  init: function() {
    window.removeEventListener("DOMContentLoaded", this, false);
    window.addEventListener("unload", this, false);

    gBrowser.mTabContainer.addEventListener("TabOpen", this, false);
    gBrowser.mTabContainer.addEventListener("TabClose", this, false);
    gBrowser.mTabContainer.addEventListener("TabSelect", this, false);
    gBrowser.mTabContainer.addEventListener("SSTabRestoring", this, false);
    gBrowser.mTabContainer.addEventListener("SSTabRestored", this, false);

    gMaxLoadingTabs = LTP_getPref("extensions.loadTabsProgressively.maxLoadingTabs", 3);
    gMaxLoadedTabs = LTP_getPref("extensions.loadTabsProgressively.maxLoadedTabs", 3);
    gNextToLoad = LTP_getPref("extensions.loadTabsProgressively.nextToLoad", 4);
    gLoadInterval = LTP_getPref("extensions.loadTabsProgressively.loadInterval", 0);

    this.register();
    this._loadTabsProgressively();

    if (gBrowser.mTabListeners.length > 0) { //Fx 5.0+
      gBrowser.mTabFilters[0].removeProgressListener(gBrowser.mTabListeners[0]);
      gBrowser.mTabListeners[0] = gBrowser.mTabProgressListener(gBrowser.mTabs[0], gBrowser.browsers[0], gBrowser.mTabListeners[0].mBlank);
      gBrowser.mTabFilters[0].addProgressListener(gBrowser.mTabListeners[0], Ci.nsIWebProgress.NOTIFY_ALL);
    }
  },

  uninit: function() {
    this.unregister();
    gBrowser.mTabContainer.removeEventListener("TabOpen", this, false);
    gBrowser.mTabContainer.removeEventListener("TabClose", this, false);
    gBrowser.mTabContainer.removeEventListener("TabSelect", this, false);
    gBrowser.mTabContainer.removeEventListener("SSTabRestoring", this, false);
    gBrowser.mTabContainer.removeEventListener("SSTabRestored", this, false);
    window.removeEventListener("unload", this, false);
  },

  register: function() {
    var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch2);
    prefs.addObserver("extensions.loadTabsProgressively.", this, false);
  },

  unregister: function() {
    var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch2);
    prefs.removeObserver("extensions.loadTabsProgressively.", this);
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic != "nsPref:changed")
      return;

    switch (aData) {
      case "extensions.loadTabsProgressively.maxLoadingTabs":
        gMaxLoadingTabs = LTP_getPref("extensions.loadTabsProgressively.maxLoadingTabs", 3);
        break;
      case "extensions.loadTabsProgressively.maxLoadedTabs":
        gMaxLoadedTabs = LTP_getPref("extensions.loadTabsProgressively.maxLoadedTabs", 3);
        break;
      case "extensions.loadTabsProgressively.nextToLoad":
        gNextToLoad = LTP_getPref("extensions.loadTabsProgressively.nextToLoad", 4);
        break;
      case "extensions.loadTabsProgressively.loadInterval":
        gLoadInterval = LTP_getPref("extensions.loadTabsProgressively.loadInterval", 0);
        break;
    }
  },

  onTabOpen: function onTabOpen(event) {},
  onTabClose: function onTabClose(event) {},
  onTabSelect: function onTabSelect(event) {},
  onTabRestoring: function onTabRestoring(event) {},
  onTabRestored: function onTabRestored(event) {},

  handleEvent: function(event) {
    switch (event.type) {
      case "DOMContentLoaded": this.init();break;
      case "unload": this.uninit();break;
      case "TabOpen": this.onTabOpen(event);break;
      case "TabClose": this.onTabClose(event);break;
      case "TabSelect": this.onTabSelect(event);break;
      case "SSTabRestoring": this.onTabRestoring(event);break;
      case "SSTabRestored": this.onTabRestored(event);break;
    }
  }
};
window.addEventListener("DOMContentLoaded", loadTabsProgressively, false);

//Load tabs progressively
loadTabsProgressively._loadTabsProgressively = function() {
  gBrowser.tryToLoadPendingTabs = function tryToLoadPendingTabs() {
    if (!this._loadTabsProgressivelyTimer) {
      this._loadTabsProgressivelyTimer = setTimeout(function(self) {
        for (let tab; tab = self.getNextPendingTab();) {
          tab.removeAttribute("pending");
          tab.linkedBrowser.doPendingAction();
        }
        self._loadTabsProgressivelyTimer = null;
      }, gLoadInterval, this);
    }
  };

  gBrowser._pendingTabs = [];
  gBrowser.getNextPendingTab = function getNextPendingTab() {
    if (this._pendingTabs.length > 0 && this._pendingTabs[0].getAttribute("pending") > 2)
      return this._pendingTabs.shift();

    var count = 0;
    for (let i = 0, tab; tab = this.mTabs[i]; i++) {
      if (tab.hasAttribute("busy"))
        count++;
    }
    if (gMaxLoadingTabs > 0 && count >= gMaxLoadingTabs)
      return null;

    if (this._pendingTabs.length > 0)
      return this._pendingTabs.shift();

    if (gMaxLoadedTabs == 0)
      return null;

    var count = 0;
    for (let tab in (this._tabsToSelect || this._tabsToLoad).apply(this)) {
      if (tab.hasAttribute("pending"))
        return tab;
      if (gMaxLoadedTabs > 0 && ++count >= gMaxLoadedTabs)
        return null;
    }
    return null;
  };

  gBrowser._tabsToLoad = function _tabsToLoad(aTab) {
    if (!aTab)
      aTab = this.mCurrentTab;

    for (let tab in __tabs__(gNextToLoad)) {
      if (!tab.hidden && !tab.selected)
        yield tab;
    }

    function __tabs__(nextToLoad) {
      var tabs = gBrowser.mTabs;
      switch (nextToLoad) {
        case 0: //Right
          for (let i = aTab._tPos + 1; i < tabs.length; i++) yield tabs[i];
          for (let i = aTab._tPos - 1; i >= 0; i--) yield tabs[i];
          break;
        case 1: //Left
          for (let i = aTab._tPos - 1; i >= 0; i--) yield tabs[i];
          for (let i = aTab._tPos + 1; i < tabs.length; i++) yield tabs[i];
          break;
        case 2: //First
          for (let i = 0; i < tabs.length; i++) yield tabs[i];
          break;
        case 3: //Last
          for (let i = tabs.length - 1; i >= 0; i--) yield tabs[i];
          break;
        case 4: //Related
        default:
          for (let tab in __tabs__(0)) if (gBrowser.isRelatedTab(tab, aTab)) yield tab;
          for (let tab in __tabs__(2)) if (!gBrowser.isRelatedTab(tab, aTab)) yield tab;
          break;
      }
    }
  };

  if (!("tabutils" in window))
  LTP_hookMethod("loadTabsProgressively.onTabOpen", "}", 'event.target.setAttribute("opener", gBrowser.mCurrentTab.linkedPanel);');

  if (!("isRelatedTab" in gBrowser))
  gBrowser.isRelatedTab = function isRelatedTab(aTab, bTab) {
    bTab = bTab || this.mCurrentTab;

    return aTab.getAttribute("opener") == bTab.getAttribute("opener")
        || aTab.getAttribute("opener") == bTab.getAttribute("linkedpanel")
        || aTab.getAttribute("linkedpanel") == bTab.getAttribute("opener");
  };

  LTP_hookMethod("gBrowser.mTabProgressListener", /(?=var location)/, "this.mTabBrowser.tryToLoadPendingTabs();");
  LTP_hookMethod("loadTabsProgressively.onTabClose", "}", "gBrowser.tryToLoadPendingTabs();");
  LTP_hookMethod("loadTabsProgressively.onTabSelect", "}", function() {
    var tab = event.target;
    tab.removeAttribute("pending");
    tab.linkedBrowser.doPendingAction();
    gBrowser.tryToLoadPendingTabs();
  });

  gBrowser.mSessionStore = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
  gBrowser.wrapWebNavigation = function(aTab) {
    var browser = gBrowser.getBrowserForTab(aTab);

    browser.__defineGetter__("webNav", browser.__lookupGetter__("webNavigation"));
    browser.__defineGetter__("webNavigation", function() this._webNav || (this._webNav = {
      mTab: aTab,
      mBrowser: browser,
      mTabBrowser: gBrowser,

      get canGoBack() this.mBrowser.webNav.canGoBack,
      get canGoForward() this.mBrowser.webNav.canGoForward,
      get document() this.mBrowser.webNav.document,
      get currentURI() this.mBrowser.webNav.currentURI,
      get referringURI() this.mBrowser.webNav.referringURI,
      get sessionHistory() this.mBrowser.webNav.sessionHistory,
      set sessionHistory(val) this.mBrowser.webNav.sessionHistory = val,

      __noSuchMethod__: function __noSuchMethod__(id, args) this.mBrowser.webNav[id].apply(this.mBrowser.webNav, args),
      QueryInterface: function(aIID) {
        if (Ci.nsISupports.equals(aIID) || Ci.nsIWebNavigation.equals(aIID)) {
          return this;
        }
        return this.mBrowser.webNav.QueryInterface(aIID);
      }
    }));

    browser.webNavigation.__noSuchMethod__ = function __noSuchMethod__(id, args) {
      if (["loadURI", "goBack", "goForward", "gotoIndex"].indexOf(id) != -1 && !this.mTab.selected && (gMaxLoadingTabs > 0 || gMaxLoadedTabs > -1)) {
        this.mTab.removeAttribute("busy");
        this.mTab.setAttribute("pending", 1);

        switch (id) {
          case "goBack":
            [id, args] = ["gotoIndex", [this.sessionHistory.index - 1]];
            break;
          case "goForward":
            [id, args] = ["gotoIndex", [this.sessionHistory.index + 1]];
            break;
        }
        this.mBrowser._pendingAction = [id, args];

        switch (id) {
          case "loadURI":
            var entry = {}, userTypedValue = args[0];
            entry.URI = this.mTabBrowser.mURIFixup.createFixupURI(args[0].replace(/\s+/g, ""), Ci.nsIURIFixup.FIXUP_FLAG_NONE);
            entry.title = PlacesUtils.history.getPageTitle(entry.URI) || args[0];
            break;
          case "gotoIndex":
            var entry = this.sessionHistory.getEntryAtIndex(args[0], true);
            var userTypedValue = "";
            break;
        }
        this.mTab.label = entry.title || entry.URI.spec;
        this.mTab.image = this.mTabBrowser.mFaviconService.getFaviconImageForPage(entry.URI).spec;

        setTimeout(function(self) {
          if (self.mTab.hasAttribute("pending") && self.mTab.label != (entry.title || entry.URI.spec)) {
            self.mTab.label = entry.title || entry.URI.spec;
            self.mTab.image = self.mTabBrowser.mFaviconService.getFaviconImageForPage(entry.URI).spec;
          }
        }, 500, this);

        this.mBrowser.docShell.setCurrentURI(entry.URI);
        this.mTabBrowser.mSessionStore.setTabValue(this.mTab, "userTypedValue", userTypedValue);
        this.mTabBrowser.tryToLoadPendingTabs();
        return;
      }

      if (id == "reload" && this.mTab.hasAttribute("pending")) {
        this.mTab.setAttribute("pending", parseInt(this.mTab.getAttribute("pending")) + 1);
        this.mTabBrowser._pendingTabs[this.mTab.getAttribute("pending") > 2 ? "unshift" : "push"](this.mTab);
        this.mTabBrowser.tryToLoadPendingTabs();
        return;
      }

      if (id == "reload" && !this.mTab.selected && gMaxLoadingTabs > 0) {
        this.mTab.setAttribute("pending", 2);
        this.mBrowser._pendingAction = [id, args];
        this.mTabBrowser._pendingTabs.push(this.mTab);
        this.mTabBrowser.tryToLoadPendingTabs();
        return;
      }

      if (id == "stop" && this.mTab.hasAttribute("pending")) {
        this.mTab.removeAttribute("pending");
        this.mBrowser._pendingAction = null;
        this.mTabBrowser.mSessionStore.setTabValue(this.mTab, "userTypedValue", "");
      }

      return this.mBrowser.webNav[id].apply(this.mBrowser.webNav, args);
    };

    browser.doPendingAction = function doPendingAction() {
      if (this._pendingAction) {
        this.docShell.setCurrentURI(this.contentDocument.documentURIObject);

        var [id, args] = this._pendingAction;
        if (id == "loadURI")
          this.userTypedValue = args[0];

        try {
          this.webNav[id].apply(this.webNav, args);
        }
        catch (e) {}

        this._pendingAction = null;
        this.webNavigation.mTabBrowser.mSessionStore.setTabValue(this.webNavigation.mTab, "userTypedValue", "");
      }
    };

    if ("swapDocShells" in browser)
    LTP_hookMethod.call(browser, "swapDocShells", /.*fieldsToSwap.*/, "$&;fieldsToSwap.push('_pendingAction');");
  };

  for (let i = 0, tab; tab = gBrowser.mTabs[i]; i++) {
    gBrowser.wrapWebNavigation(tab);
  }
  LTP_hookMethod("loadTabsProgressively.onTabOpen", "}", "gBrowser.wrapWebNavigation(event.target);");

  LTP_hookMethod("loadTabsProgressively.onTabRestoring", "}", function() {
    var tab = event.target;
    var browser = gBrowser.getBrowserForTab(tab);
    var userTypedValue = gBrowser.mSessionStore.getTabValue(tab, "userTypedValue");
    if (userTypedValue) {
      setTimeout(function() {
        browser.stop();
        browser.loadURIWithFlags(userTypedValue, Ci.nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP);
      }, 0);
    }
  });

  LTP_hookMethod("loadTabsProgressively.onTabRestored", "}", function() {
    if (LTP_getPref("extensions.loadTabsProgressively.autoReload", true))
      gBrowser.getBrowserForTab(event.target).reload();
  });

  LTP_hookMethod("nsBrowserAccess.prototype.openURI", /^(?:\W+(\w+)){2}.*loadOneTab.*/m, '$&;$1.setAttribute("diverted", !isExternal);');
  LTP_hookMethod("gBrowser.mTabProgressListener", "this.mRequestCount++;", "$&" + <![CDATA[
    if (this.mBrowser.__SS_restoreState == 2 && this.mBrowser.sessionHistory.requestedIndex > -1) { //Fx 4.0+
      this.mBrowser.stop();
      this.mBrowser.gotoIndex(this.mBrowser.sessionHistory.requestedIndex);
      return;
    }

    let uri = aRequest.QueryInterface(Ci.nsIChannel).URI;
    if (this.mTab.getAttribute("diverted") == "true" && uri.spec != "about:blank" && uri.scheme != "wyciwyg") {
      this.mTab.removeAttribute("diverted");
      this.mBrowser.stop();

      let referrer = aRequest instanceof Ci.nsIHttpChannel ? aRequest.referrer : null;
      let postData = aRequest instanceof Ci.nsIUploadChannel ? aRequest.uploadStream : null;
      this.mBrowser.loadURIWithFlags(uri.spec, Ci.nsIWebNavigation.LOAD_FLAGS_FIRST_LOAD, referrer, null, postData);
      return;
    }
  ]]>);

  LTP_hookMethod("gBrowser.swapBrowsersAndCloseOther", "{", function() {
    if (aOtherTab.hasAttribute("pending")) {
      if (aOurTab == this.mCurrentTab) {
        aOtherTab.removeAttribute("pending");
        aOtherTab.linkedBrowser.doPendingAction();
      }
      else {
        aOurTab.setAttribute("pending", aOtherTab.getAttribute("pending"));
      }
    }
  });

  var allTabsPopup = gBrowser.mTabContainer.mAllTabsPopup;
  if (allTabsPopup) {
    LTP_hookMethod.call(allTabsPopup, "_createTabMenuItem", /(?=.*busy.*)/, function() {
      if (aTab.hasAttribute("pending"))
        menuItem.setAttribute("pending", aTab.getAttribute("pending"));
    });
    LTP_hookMethod.call(allTabsPopup, "_tabOnAttrModified", /(?=.*busy.*)/, 'case "pending":');

    if ("_setMenuitemAttributes" in allTabsPopup)
    LTP_hookMethod.call(allTabsPopup, "_setMenuitemAttributes", /(?=.*busy.*)/, function() {
      if (aTab.hasAttribute("pending"))
        aMenuitem.setAttribute("pending", aTab.getAttribute("pending"));
      else
        aMenuitem.removeAttribute("pending");
    });
  }

  LTP_hookMethod("gBrowser.addTab", 'aURI == "about:blank"', '!aURI || $&');  //Compatibility with Firefox 3.6

  if ("isBlankTab" in gBrowser) //Compatibility with Tab Mix Plus
  LTP_hookMethod("gBrowser.isBlankTab", "{", function() {
    if (aTab.hasAttribute("pending"))
      return false;
  });

  if ("isBlankNotBusyTab" in gBrowser) //Compatibility with Tab Mix Plus
  LTP_hookMethod("gBrowser.isBlankNotBusyTab", "{", function() {
    if (aTab.hasAttribute("pending"))
      return false;
  });
};

function LTP_hookMethod(aStr) {
  try {
    var namespaces = aStr.split(".");

    try {
      var object = this;
      while (namespaces.length > 1) {
        object = object[namespaces.shift()];
      }
    }
    catch (e) {
      throw TypeError(aStr + " is not a function");
    }

    var method = namespaces.pop();
    if (typeof object[method] != "function")
      throw TypeError(aStr + " is not a function");

    return object[method] = LTP_hookFunc.apply(this, Array.concat(object[method], Array.slice(arguments, 1)));
  }
  catch (e) {
    Components.utils.reportError("Failed to hook " + aStr + ": " + e.message);
  }
}

function LTP_hookFunc(aFunc) {
  var myCode = aFunc.toString();
  for (var i = 1; i < arguments.length;) {
    if (arguments[i].constructor.name == "Array") {
      var [orgCode, newCode, flags] = arguments[i++];
    }
    else {
      var [orgCode, newCode, flags] = [arguments[i++], arguments[i++], arguments[i++]];
    }

    if (typeof newCode == "function" && newCode.length == 0)
      newCode = newCode.toString().replace(/^.*{|}$/g, "");

    switch (orgCode) {
      case "{": [orgCode, newCode] = [/^.*{/, "$&" + newCode];break;
      case "}": [orgCode, newCode] = [/}$/, newCode + "$&"];break;
    }

    if (typeof orgCode == "string")
      orgCode = RegExp(orgCode.replace(/[{[(\\^|$.?*+/)\]}]/g, "\\$&"), flags || "");

    myCode = myCode.replace(orgCode, newCode);
  }

  return eval("(" + myCode + ")");
}

function LTP_getPref(aPrefName, aDefault) {
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  switch (prefs.getPrefType(aPrefName)) {
    case prefs.PREF_BOOL: return prefs.getBoolPref(aPrefName);
    case prefs.PREF_INT: return prefs.getIntPref(aPrefName);
    case prefs.PREF_STRING: return prefs.getCharPref(aPrefName);
    default:
      switch (typeof aDefault) {
        case "boolean": prefs.setBoolPref(aPrefName, aDefault);break;
        case "number": prefs.setIntPref(aPrefName, aDefault);break;
        case "string": prefs.setCharPref(aPrefName, aDefault);break;
      }
      return aDefault;
  }
}
