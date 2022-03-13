// storage for the node that injects the dark.css into the site
var darkCSS = document.createElement("link");
darkCSS.rel = "stylesheet";
document.head.appendChild(darkCSS);

// storage for the node that injects the dynamic border css rule into the site
var borderCSS = document.createElement("style");
document.head.appendChild(borderCSS);

// storage for elements where the price is converted
// this is necessary, since prices are replaced by searching & replacing them
// thus for more price conversions, it's better to keep track of the original
// this uses search & replace for where prices are embedded in texts etc. too
// previous iterations of this feature did not account for this
var priceElements = [];

// constant for whether or not the current page is the checkout page
// will be used multiple times later
const isCheckout = new URL(window.location.href).pathname == "/checkout";

// the warning used for checkout if currency conversion is enabled
var checkoutWarning = undefined;

// the regex used to identify € prices within the page
const priceRegex = /\d+,\d{2}\s€/gm;

// selectors used for finding product lists for sorting (e.g. categories, search, ..)
const sortSelectors = [
    ".products",
    "#app > div.wrap > section.catalog > div.container > div.columns",
    "#app > div.wrap > section.cart > div.container > div.columns"
];

// apply the user's choices whenever they load up candykeys.com
apply();

chrome.storage.onChanged.addListener(function () {
    // on every change of the storage, apply the current options
    apply();
});

// this is the primary function to apply options on the candykeys website
// it is designed so that options can be seemlessly toggled on/off on desire
function apply() {
    chrome.storage.local.get([
        "outOfStock",
        "preorder",
        "frontPage",
        "enableSort",
        "sortBy",
        "sortOrder",
        "darkMode",
        "enableBorder",
        "borderStyle",
        "borderWidth",
        "borderColor",
        "enableConversion",
        "currency"], function (storage) {
            // hiding
            let displayOutOfStock = storage.outOfStock ? "none" : "";
            let displayPreorder = storage.preorder ? "none" : "";

            // check if options should be applied on front page and if not, set all objects to visible
            if (!storage.frontPage) {
                let url = new URL(window.location.href);
                if (url.pathname == "/") {
                    displayOutOfStock = displayPreorder = "";
                }
            }

            // apply options to both out of stock (danger) and preorder elements
            // TODO: perhaps just pass the query selection to the function, saves a few lines
            const tagsOutOfStock = document.querySelectorAll(".danger");
            tagsOutOfStock.forEach(function (tag) {
                tagSetDisplay(tag, displayOutOfStock);
            });

            const tagsPreorder = document.querySelectorAll(".preorder");
            tagsPreorder.forEach(function (tag) {
                tagSetDisplay(tag, displayPreorder)
            });


            // sorting
            if (storage.enableSort) {
                sortElements(storage.sortBy, storage.sortOrder);
            }

            // darkMode
            // this could've been done using injectCSS() from the tabs API
            // but for some reason i was unable to access it across browsers during testing
            // this seemingly overcomplicated if is necessary because we do not want to
            // unnecessarily set href anew because it might trigger the browser to refresh the css
            // disturbing the dark mode experience
            if (storage.darkMode && darkCSS.href != chrome.runtime.getURL("dark.css")) {
                darkCSS.href = chrome.runtime.getURL("dark.css");
            } else if (!storage.darkMode && darkCSS.href != "") {
                darkCSS.href = "";
            }

            // image border
            // delete any applied rules since they are either not wanted anymore
            // or will be overwritten anyways
            if (borderCSS.sheet.cssRules.length > 0) {
                borderCSS.sheet.deleteRule(0);
            }

            // create a new rule if borders are supposed to be enabled
            if (storage.enableBorder) {
                borderCSS.sheet.insertRule(`
                .image > img, image,
                .tns-item > a > img, image,
                tr > .xx > .flex > img, image {
                    border: ${storage.borderWidth}px ${storage.borderStyle} ${storage.borderColor}
                }`, 0);
            }

            // price conversion
            if (storage.enableConversion) {
                // request rates and apply conversion from there
                requestRates(storage.currency);

                // if we are at checkout page and no warning is in place, create one
                if (isCheckout && !checkoutWarning) {
                    createCheckoutWarning();
                }
            } else {
                // if prices were converted, restore the original state
                // this could've also been done using element cloning and may have been more elegant
                if (priceElements.length > 0) {
                    revertConversion();
                }

                // if we are at checkout page and a warning was put in place, delete it
                if (isCheckout && checkoutWarning) {
                    removeCheckoutWarning();
                }
            }
        })
}

function sortElements(property, order) {
    // unfortunately, products are often not wrapped in the same type of container making them hard to find
    // thus we test for a few of them and if no fitting one is found, this method is simply aborted
    let items = undefined;
    for (const selector of sortSelectors) {
        items = document.querySelector(selector);
        if (items) {
            break;
        }
    }

    if (!items) {
        return;
    }

    // anything without a price tag may just be an empty or invisible element
    // and should be disregarded
    let children = Array.from(items.children).filter((element) => {
        return element.querySelector(".price") ? true : false;
    });

    if (children.length == 0) {
        return;
    }

    let direction = order == "ascending" ? 1 : -1;

    // select a function to query the specific property from a product
    let selector = {
        price: e => { return parseFloat(e.querySelector(".price").innerText.replace(",", ".")) },
        name: e => { return e.querySelector(".name").innerText },
        rating: e => { return parseFloat(e.querySelector(".progresz").style.width) }
    }[property];

    children.sort((a, b) => {
        a = selector(a); b = selector(b);

        if (a < b) {
            return -1 * direction;
        }

        if (a > b) {
            return 1 * direction;
        }
        return 0;
    })
    items.replaceChildren(...children);
}

function requestRates(currency) {
    // this may not be optimal, but this has to be done every time since we cannot 
    // really work around this without risking serving vastly outdated exchange rates
    // however, caching hopefully saves us :)
    let xhr = new XMLHttpRequest();
    xhr.addEventListener("load", function () {
        if (this.status != 200) {
            alert(`Requesting currencies from CoinBase API was unsuccessful, currency conversion is not possible\n
                    Code: ${this.status}\n
                    Text: ${this.statusText}\n
                    Response: ${this.responseText}`)
            return;
        }

        // parse JSON data from coinbase & extract rate
        let data = JSON.parse(this.responseText);
        let rate = data.data.rates[currency];

        // check if the rate is even present in the response
        if (!rate) {
            // firefox sometimes fires this method before defaults are set, naturally causing an error
            // this check prevents at least part that would otherwise be exposed to the user
            // TODO: find a better suited place for a similar check
            if (currency != undefined && currency != "") {
                alert(`The requested rate for ${currency} was not found`);
            }
            return;
        }
        rate = parseFloat(rate);

        // search for objects with prices
        // this is pure insanity but necessary to account for all possible prices displayed on the site
        // if priceElements is empty, then search for matching objects
        if (priceElements.length == 0) {
            convertFirst(currency, rate);
        } else {
            convertExisting(currency, rate);
        }
    });

    xhr.open("GET", `https://api.coinbase.com/v2/exchange-rates?currency=EUR`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send();
}

function convertFirst(currency, rate) {
    // search for every element that has a € sign
    let xpath = document.evaluate("//*[contains(text(), '€')]", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let i = 0; i < xpath.snapshotLength; i++) {
        let node = xpath.snapshotItem(i);
        let text = node.innerText;

        // extract all prices from the elements using regex
        let match;
        while ((match = priceRegex.exec(text)) !== null) {
            // split the innerText into subtexts so that the content is more easily preserved
            let preMatch = text.substr(0, match.index);
            let postMatch = text.substr(match.index + match[0].length);

            // TODO: conversion from , -> . and back is sort of redundant within this script
            let originalPrice = parseFloat(match[0].replace(",", "."));
            let price = originalPrice * rate;
            price = price.toFixed(2).replace(".", ",");

            // reassemble the innerText
            // TODO: there is probably a nicer way of doing this
            node.innerText = `${preMatch}${price} ${currency}${postMatch}`

            // save the details of the element so that the original element can be restored more easily
            priceElements.push({
                node: node,
                originalPrice: originalPrice,
                preMatch: preMatch,
                match: match,
                postMatch: postMatch
            });
        }
    }
}

function convertExisting(currency, rate) {
    // if we already have evaluated all elements that include prices,
    // just convert the price for all of them using the data we stored
    for (const element of priceElements) {
        let price = element.originalPrice;
        price *= rate;
        price = price.toFixed(2).replace(".", ",");
        element.node.innerText = `${element.preMatch}${price} ${currency}${element.postMatch}`
    }
}

function revertConversion() {
    // this could've also been done using element cloning and may have been more elegant
    for (const element of priceElements) {
        element.node.innerText = element.preMatch + element.match + element.postMatch
    }
    priceElements = [];
}

function createCheckoutWarning() {
    // create all necessary elements
    // checkoutWarning is saved globally so it can be referenced later
    checkoutWarning = document.createElement("article")
    let header = document.createElement("div");
    let paragraph = document.createElement("p");
    let body = document.createElement("div");
    let bodyLink = document.createElement("a");

    // apply all data
    checkoutWarning.className = "message is-danger has-text-left";

    header.className = "message-header";
    paragraph.innerText = "WARNING (PowerKeys)";
    header.appendChild(paragraph);

    body.className = "message-body";
    body.innerText = `You still have currency conversion enabled.
    Prices shown may not be the same as will be charged.
    Please proceed with caution or `;

    // include a convenience link to disable the conversion immediately
    bodyLink.href = "#";
    bodyLink.innerText = "disable this feature.";
    bodyLink.addEventListener("click", function () {
        chrome.storage.local.set({ "enableConversion": false });
    });
    body.appendChild(bodyLink);

    // piece together the article element
    checkoutWarning.appendChild(header);
    checkoutWarning.appendChild(body);

    // add to DOM
    document.querySelector("#app > div.wrap > section > div > form > div > div:nth-child(2) > div").prepend(checkoutWarning);
}

function removeCheckoutWarning() {
    checkoutWarning.remove();
    checkoutWarning = undefined;
}

function tagSetDisplay(tag, display) {
    // the distinction here is necessary because not all elements
    // use the same primary html element depending on their context
    if (tag.closest(".column")) {
        tag.closest(".column").style.display = display;
    } else if (tag.closest(".catalog-item")) {
        tag.closest(".catalog-item").style.display = display;
    }
}