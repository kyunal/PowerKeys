// this scripts only purpose is to watch for the onInstalled event
chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == chrome.runtime.OnInstalledReason.INSTALL) {
        // set defaults after the add-on was installed
        chrome.storage.local.set({
            "outOfStock": false,
            "preorder": false,
            "frontPage": false,
            "enableSort": false,
            "sortBy": "price",
            "sortOrder": "ascending",
            "darkMode": false,
            "enableBorder": false,
            "borderStyle": "solid",
            "borderWidth": 5,
            "borderColor": "red",
            "enableConversion": false,
            "currency": "EUR"
        });
    }
});