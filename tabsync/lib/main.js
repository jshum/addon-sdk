const {Cc,Ci} = require("chrome");

// XUL IMPORTS
var bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
                      .getService(Ci.nsINavBookmarksService);
var ios = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);
var historyService = Cc["@mozilla.org/browser/nav-history-service;1"]
                               .getService(Ci.nsINavHistoryService);
var options = historyService.getNewQueryOptions();
var query = historyService.getNewQuery(); 

var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
             .getService(Ci.nsIWindowWatcher);
var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Ci.nsIWindowMediator);

// ADDON-SDK IMPORTS
var tabs = require("sdk/tabs");
var widgets = require("sdk/widget");

// GLOBAL VARIABLES
var menuFolder = bmsvc.bookmarksMenuFolder; // Bookmarks menu folder
var tabsyncFolderId;
var inewBkmkId;
var mainWindow;
var addTabs = {};

/*
 * MERGE SYNC
 * combines saved tabs and current tabs into your current browser window
 */
function mergeSync(){
   findSyncFolder();
   getSyncWindow();
   mergeTabs();
   //D. open all saved but unopened tabs
   for (var key in addTabs){
     console.log("c:"+key);
     mainWindow.gBrowser.addTab(key); 
   }
}

// mainWindow is current browser window
function getSyncWindow(){
   mainWindow = wm.getMostRecentWindow("navigator:browser");
} 

// addTabs now has list of tabs to open
// new tabs have been saved
function mergeTabs(){ 
   //A. get saved tabs
   query.setFolders([tabsyncFolderId],1);   
   var result = historyService.executeQuery(query, options);
   var rootNode = result.root;
   rootNode.containerOpen = true;
   for (var i = 0; i < rootNode.childCount; i ++) {
     var node = rootNode.getChild(i);
     addTabs[node.uri] = node.uri;
     console.log("a:"+node.uri);
   }
   rootNode.containerOpen = false;

   //B. get list of saved but unopened tabs
   for each (var tab in tabs){
      console.log("b:"+tab.url);
      if(addTabs[tab.url]){
         delete addTabs[tab.url];
      }
   }
   //C. get list of opened but unsaved tabs
   for each (var tab in tabs){
      if(!addTabs[tab.url]){
         bmsvc.insertBookmark(tabsyncFolderId, ios.newURI(tab.url, null, null), bmsvc.DEFAULT_INDEX, tab.title);
      }
   } 
}

/*
 * PURGE SYNC
 * removes all existing saved tabs and replaces with mine
 */
function purgeSync(){
   findSyncFolder();
   removeExistingSavedTabs();
   bookmarkTabs();
}

function removeExistingSavedTabs(){
   //delete all bookmarks inside tabsync group 
   bmsvc.removeFolderChildren(tabsyncFolderId);

   //add back in the anchor
   var uri = ios.newURI("about:tabsync", null, null);
   inewBkmkId = bmsvc.insertBookmark(tabsyncFolderId, uri, bmsvc.DEFAULT_INDEX, "TabSyncAnchor");
}

function bookmarkTabs(){
   //save all open tabs to a bookmark folder to sync
   let bookmarks = [];
   for each (var tab in tabs){
      bmsvc.insertBookmark(tabsyncFolderId, ios.newURI(tab.url, null, null), bmsvc.DEFAULT_INDEX, tab.title);
   }
}

/*
 * UTILITIES
 */

//tabsyncFolderId is now updated
function findSyncFolder(){
   //search for anchor bookmark first
   //necessary because Places API or nslNavBookmarksService
   //doesn't have search for Folder function
   var uri = ios.newURI("about:tabsync", null, null);
   //if bookmark about:tabsync, does not exist, create folder and anchor
   if(bmsvc.isBookmarked(uri)){
      //if anchor exists, get parent folder
      var bookmarksArray = bmsvc.getBookmarkIdsForURI(uri, {});
      tabsyncFolderId = bmsvc.getFolderIdForItem(bookmarksArray[0])
   } else {
      //add the anchor if it doesn't exist
      tabsyncFolderId = bmsvc.createFolder(menuFolder, "TabSync", bmsvc.DEFAULT_INDEX);
      var uri = ios.newURI("about:tabsync", null, null);
      inewBkmkId = bmsvc.insertBookmark(tabsyncFolderId, uri, bmsvc.DEFAULT_INDEX, "TabSyncAnchor");
   }
}

/*
 * MAIN FUNCTION
 *
 */
findSyncFolder()
tabs.on('ready', purgeSync);

//on button press, open new window with all tabs in this bookmark group
var widget = widgets.Widget({
     id: "mozilla-link",
      label: "Mozilla website",
      contentURL: "http://www.mozilla.org/favicon.ico",
      onClick: mergeSync 
});
